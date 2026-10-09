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
import { toCsvString } from '../common/csv.util';
import { CreateOrgDto, ExportOrgsQueryDto, ListOrgsQueryDto, OrgStatusFilter, SuspendOrgDto, UpdateOrgDto } from './dto/org.dto';

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
  ) { }

  async list(q: ListOrgsQueryDto) {
    const qb = this.orgs.createQueryBuilder('o').withDeleted();
    const status = q.status ?? OrgStatusFilter.ACTIVE;

    if (status === OrgStatusFilter.ACTIVE) qb.andWhere('o."deletedAt" IS NULL AND o."suspendedAt" IS NULL');
    else if (status === OrgStatusFilter.SUSPENDED) qb.andWhere('o."deletedAt" IS NULL AND o."suspendedAt" IS NOT NULL');
    else if (status === OrgStatusFilter.DELETED) qb.andWhere('o."deletedAt" IS NOT NULL');

    if (q.plan) qb.andWhere('o.plan = :plan', { plan: q.plan });
    if (q.search) qb.andWhere('(o.name ILIKE :s OR o.slug ILIKE :s)', { s: `%${q.search.replace(/[%_]/g, '\\$&')}%` });

    if (q.sortBy?.toLowerCase() === 'oldest') {
      qb.orderBy('o."createdAt"', 'ASC');
    } else {
      qb.orderBy('o."createdAt"', 'DESC');
    }

    const [rawItems, total] = await qb
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();

    const items = await Promise.all(
      rawItems.map(async (org) => {
        try {
          const usage = await this.usage.getOrgUsage(org.id);
          return {
            ...org,
            userCount: usage.userCount ?? 1,
            attemptsTotal: usage.attemptsTotal ?? 0,
            storageBytes: usage.storageBytes ?? 0,
          };
        } catch {
          return {
            ...org,
            userCount: 1,
            attemptsTotal: 0,
            storageBytes: 0,
          };
        }
      }),
    );
    const countsRaw = await this.orgs
      .createQueryBuilder('o')
      .withDeleted()
      .select('COUNT(*) FILTER (WHERE o."deletedAt" IS NULL AND o."suspendedAt" IS NULL)', 'active')
      .addSelect('COUNT(*) FILTER (WHERE o."deletedAt" IS NULL AND o."suspendedAt" IS NOT NULL)', 'suspended')
      .addSelect('COUNT(*) FILTER (WHERE o."deletedAt" IS NOT NULL)', 'deleted')
      .addSelect('COUNT(*)', 'total')
      .getRawOne();

    const counts = {
      active: Number(countsRaw?.active ?? 0),
      suspended: Number(countsRaw?.suspended ?? 0),
      deleted: Number(countsRaw?.deleted ?? 0),
      total: Number(countsRaw?.total ?? 0),
    };

    return { items, page: q.page, limit: q.limit, total, counts };
  }

  async exportCsv(q: ExportOrgsQueryDto): Promise<{ filename: string; csv: string }> {
    const qb = this.orgs.createQueryBuilder('o').withDeleted();
    const status = q.status ?? OrgStatusFilter.ACTIVE;

    if (status === OrgStatusFilter.ACTIVE) qb.andWhere('o."deletedAt" IS NULL AND o."suspendedAt" IS NULL');
    else if (status === OrgStatusFilter.SUSPENDED) qb.andWhere('o."deletedAt" IS NULL AND o."suspendedAt" IS NOT NULL');
    else if (status === OrgStatusFilter.DELETED) qb.andWhere('o."deletedAt" IS NOT NULL');

    if (q.plan && q.plan.toLowerCase() !== 'all') qb.andWhere('o.plan = :plan', { plan: q.plan.toLowerCase() });
    if (q.search) qb.andWhere('(o.name ILIKE :s OR o.slug ILIKE :s)', { s: `%${q.search.replace(/[%_]/g, '\\$&')}%` });

    if (q.sortBy?.toLowerCase() === 'oldest') {
      qb.orderBy('o."createdAt"', 'ASC');
    } else {
      qb.orderBy('o."createdAt"', 'DESC');
    }

    const maxRows = q.limit ? Math.min(q.limit, 10000) : 5000;
    const rawItems = await qb
      .limit(maxRows)
      .getMany();

    const items = await Promise.all(
      rawItems.map(async (org) => {
        try {
          const usage = await this.usage.getOrgUsage(org.id);
          return {
            ...org,
            userCount: usage.userCount ?? 1,
            attemptsTotal: usage.attemptsTotal ?? 0,
            storageBytes: usage.storageBytes ?? 0,
          };
        } catch {
          return {
            ...org,
            userCount: 1,
            attemptsTotal: 0,
            storageBytes: 0,
          };
        }
      }),
    );

    const headers = ['Name', 'Slug', 'Plan', 'Users', 'Attempts', 'Storage', 'Created', 'Status'];
    const rows = items.map((org) => {
      const planStr = org.plan ? org.plan.charAt(0).toUpperCase() + org.plan.slice(1) : 'Trial';
      const storageStr = org.storageBytes
        ? org.storageBytes >= 1073741824
          ? `${(org.storageBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
          : `${(org.storageBytes / (1024 * 1024)).toFixed(1)} MB`
        : '0 GB';
      const createdStr = org.createdAt ? new Date(org.createdAt).toISOString().slice(0, 10) : '';
      const statusStr = org.deletedAt ? 'Deleted' : org.suspendedAt ? 'Suspended' : 'Active';

      return [
        org.name,
        org.slug,
        planStr,
        org.userCount,
        org.attemptsTotal,
        storageStr,
        createdStr,
        statusStr,
      ];
    });

    const csv = toCsvString(headers, rows);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `organizations-${dateStr}.csv`;
    return { filename, csv };
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
