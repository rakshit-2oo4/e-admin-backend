import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Attempt } from '../../attempts/attempt.entity';
import { Organization } from '../../organizations/organization.entity';
import { User } from '../../users/user.entity';
import { PageQueryDto } from '../common/pagination.dto';
import { PlatformAuditService } from '../common/platform-audit.service';
import { isUniqueViolation, PlatformError } from '../common/platform-error';
import { PlatformPasswordService } from '../common/platform-password.service';
import { PlatformUsageService } from '../common/platform-usage.service';
import { RequestMeta } from '../common/platform.types';
import { PlatformUser } from '../entities/platform-user.entity';
import { CreateOrgDto, ListOrgsQueryDto, OrgStatusFilter, SuspendOrgDto, UpdateOrgDto } from './dto/org.dto';

const TRIAL_DAYS = 14;
const DELETE_GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PlatformOrgsService {
  private readonly log = new Logger(PlatformOrgsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly passwords: PlatformPasswordService,
    private readonly audit: PlatformAuditService,
    private readonly usage: PlatformUsageService,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async list(q: ListOrgsQueryDto) {
    const qb = this.orgs.createQueryBuilder('o').withDeleted();
    const status = q.status ?? OrgStatusFilter.ACTIVE;

    if (status === OrgStatusFilter.ACTIVE) qb.andWhere('o."deletedAt" IS NULL AND o."suspendedAt" IS NULL');
    else if (status === OrgStatusFilter.SUSPENDED) qb.andWhere('o."deletedAt" IS NULL AND o."suspendedAt" IS NOT NULL');
    else if (status === OrgStatusFilter.DELETED) qb.andWhere('o."deletedAt" IS NOT NULL');

    if (q.plan) qb.andWhere('o.plan = :plan', { plan: q.plan });
    if (q.search) qb.andWhere('(o.name ILIKE :s OR o.slug ILIKE :s)', { s: `%${q.search.replace(/[%_]/g, '\\$&')}%` });

    const [items, total] = await qb
      .orderBy('o."createdAt"', 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();
    return { items, page: q.page, limit: q.limit, total };
  }

  private async findOrThrow(id: string, withDeleted = false): Promise<Organization> {
    const org = await this.orgs.findOne({ where: { id }, withDeleted });
    if (!org) throw new PlatformError(404, 'ORG_NOT_FOUND');
    return org;
  }

  async detail(id: string) {
    const org = await this.findOrThrow(id, true);
    return { ...org, usage: await this.usage.getOrgUsage(id) };
  }

  async create(dto: CreateOrgDto, actor: PlatformUser, meta: RequestMeta) {
    if (await this.users.exists({ where: { email: dto.ownerEmail } })) throw new PlatformError(409, 'EMAIL_TAKEN');
    const passwordHash = await this.passwords.hash(dto.ownerPassword);
    const plan = dto.plan ?? 'trial';
    const trialEndsAt = dto.trialEndsAt ?? (plan === 'trial' ? new Date(Date.now() + TRIAL_DAYS * DAY_MS) : null);

    return this.dataSource.transaction(async (m) => {
      let org: Organization;
      try {
        org = await m.save(
          m.create(Organization, {
            name: dto.name,
            slug: dto.slug,
            plan,
            trialEndsAt,
            suspendedAt: null,
            suspendedReason: null,
            createdByPlatformUserId: actor.id,
          }),
        );
      } catch (e) {
        if (isUniqueViolation(e)) throw new PlatformError(409, 'ORG_SLUG_TAKEN');
        throw e;
      }

      let owner: User;
      try {
        owner = await m.save(
          m.create(User, {
            orgId: org.id,
            email: dto.ownerEmail,
            name: dto.ownerName ?? null,
            passwordHash,
            role: 'OWNER',
            isActive: true,
          }),
        );
      } catch (e) {
        if (isUniqueViolation(e)) throw new PlatformError(409, 'EMAIL_TAKEN');
        throw e;
      }

      await this.audit.log(m, {
        platformUserId: actor.id,
        action: 'ORG_CREATED',
        entityType: 'Organization',
        entityId: org.id,
        diff: { after: { name: org.name, slug: org.slug, plan: org.plan, trialEndsAt: org.trialEndsAt }, ownerUserId: owner.id },
        ...meta,
      });
      return { ...org, owner: { id: owner.id, email: owner.email, name: owner.name, role: owner.role } };
    });
  }

  async update(id: string, dto: UpdateOrgDto, actor: PlatformUser, meta: RequestMeta) {
    return this.dataSource.transaction(async (m) => {
      const org = await m.findOne(Organization, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!org) throw new PlatformError(404, 'ORG_NOT_FOUND');

      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (const key of ['name', 'plan', 'retentionDays'] as const) {
        if (dto[key] !== undefined && dto[key] !== org[key]) {
          before[key] = org[key];
          after[key] = dto[key];
          (org as any)[key] = dto[key];
        }
      }
      if (Object.keys(after).length > 0) {
        await m.save(org);
        await this.audit.log(m, {
          platformUserId: actor.id,
          action: 'ORG_UPDATED',
          entityType: 'Organization',
          entityId: org.id,
          diff: { before, after },
          ...meta,
        });
      }
      return org;
    });
  }

  async suspend(id: string, dto: SuspendOrgDto, actor: PlatformUser, meta: RequestMeta) {
    return this.dataSource.transaction(async (m) => {
      const org = await m.findOne(Organization, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!org) throw new PlatformError(404, 'ORG_NOT_FOUND');

      const before = { suspendedAt: org.suspendedAt, suspendedReason: org.suspendedReason };
      org.suspendedAt = new Date();
      org.suspendedReason = dto.reason;
      await m.save(org);
      await this.audit.log(m, {
        platformUserId: actor.id,
        action: 'ORG_SUSPENDED',
        entityType: 'Organization',
        entityId: org.id,
        diff: { before, after: { suspendedAt: org.suspendedAt, suspendedReason: org.suspendedReason } },
        ...meta,
      });
      return org;
    });
  }

  async unsuspend(id: string, actor: PlatformUser, meta: RequestMeta) {
    return this.dataSource.transaction(async (m) => {
      const org = await m.findOne(Organization, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!org) throw new PlatformError(404, 'ORG_NOT_FOUND');
      if (!org.suspendedAt) return org; // idempotent: nothing to change, nothing to audit

      const before = { suspendedAt: org.suspendedAt, suspendedReason: org.suspendedReason };
      org.suspendedAt = null;
      org.suspendedReason = null;
      await m.save(org);
      await this.audit.log(m, {
        platformUserId: actor.id,
        action: 'ORG_UNSUSPENDED',
        entityType: 'Organization',
        entityId: org.id,
        diff: { before, after: { suspendedAt: null, suspendedReason: null } },
        ...meta,
      });
      return org;
    });
  }

  async remove(id: string, actor: PlatformUser, meta: RequestMeta) {
    return this.dataSource.transaction(async (m) => {
      const org = await m.findOne(Organization, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!org) throw new PlatformError(404, 'ORG_NOT_FOUND');

      const inProgress = await m.count(Attempt, { where: { orgId: id, status: 'IN_PROGRESS' } });
      if (inProgress > 0) {
        this.log.warn(`Soft-deleting org ${id} with ${inProgress} in-progress attempt(s)`);
      }

      await m.softDelete(Organization, { id });
      const deletedAt = new Date();
      const purgeAfter = new Date(deletedAt.getTime() + DELETE_GRACE_DAYS * DAY_MS);
      await this.audit.log(m, {
        platformUserId: actor.id,
        action: 'ORG_DELETED',
        entityType: 'Organization',
        entityId: id,
        diff: { inProgressAttempts: inProgress, graceDays: DELETE_GRACE_DAYS, purgeAfter },
        ...meta,
      });
      return { id, deletedAt, purgeAfter, inProgressAttempts: inProgress };
    });
  }

  async listUsers(id: string, q: PageQueryDto) {
    await this.findOrThrow(id, true);
    const [rows, total] = await this.users.findAndCount({
      where: { orgId: id },
      order: { createdAt: 'DESC' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    const items = rows.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, isActive: u.isActive, createdAt: u.createdAt }));
    return { items, page: q.page, limit: q.limit, total };
  }

  getUsage(id: string) {
    return this.usage.getOrgUsage(id);
  }
}
