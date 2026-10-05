import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PlatformAuditService } from '../common/platform-audit.service';
import { isUniqueViolation, PlatformError } from '../common/platform-error';
import { PlatformPasswordService } from '../common/platform-password.service';
import { RequestMeta, toPublicUser } from '../common/platform.types';
import { PageQueryDto } from '../common/pagination.dto';
import { PlatformRole, PlatformUser } from '../entities/platform-user.entity';
import { PlatformTokenService } from '../platform-auth/platform-token.service';
import { ChangePasswordDto, CreatePlatformUserDto, UpdatePlatformUserDto } from './dto/platform-user.dto';

@Injectable()
export class PlatformUsersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly passwords: PlatformPasswordService,
    private readonly audit: PlatformAuditService,
    private readonly tokens: PlatformTokenService,
    @InjectRepository(PlatformUser) private readonly users: Repository<PlatformUser>,
  ) {}

  async list(q: PageQueryDto) {
    const [rows, total] = await this.users.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    return { items: rows.map(toPublicUser), page: q.page, limit: q.limit, total };
  }

  async create(dto: CreatePlatformUserDto, actor: PlatformUser, meta: RequestMeta) {
    if (await this.users.exists({ where: { email: dto.email } })) throw new PlatformError(409, 'EMAIL_TAKEN');
    const passwordHash = await this.passwords.hash(dto.password);

    try {
      return await this.dataSource.transaction(async (m) => {
        const user = await m.save(
          m.create(PlatformUser, { email: dto.email, name: dto.name, role: dto.role, passwordHash, isActive: true }),
        );
        await this.audit.log(m, {
          platformUserId: actor.id,
          action: 'PLATFORM_USER_CREATED',
          entityType: 'PlatformUser',
          entityId: user.id,
          diff: { after: { email: user.email, name: user.name, role: user.role, isActive: true } },
          ...meta,
        });
        return toPublicUser(user);
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new PlatformError(409, 'EMAIL_TAKEN');
      throw e;
    }
  }

  async update(id: string, dto: UpdatePlatformUserDto, actor: PlatformUser, meta: RequestMeta) {
    return this.dataSource.transaction(async (m) => {
      const target = await m.findOne(PlatformUser, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!target) throw new PlatformError(404, 'PLATFORM_USER_NOT_FOUND');

      const demoting = dto.role !== undefined && dto.role !== PlatformRole.SUPER_ADMIN;
      const deactivating = dto.isActive === false;
      if (target.role === PlatformRole.SUPER_ADMIN && target.isActive && (demoting || deactivating)) {
        const activeAdmins = await m.find(PlatformUser, {
          where: { role: PlatformRole.SUPER_ADMIN, isActive: true },
          lock: { mode: 'pessimistic_write' },
        });
        if (activeAdmins.length <= 1) throw new PlatformError(403, 'CANNOT_REMOVE_LAST_SUPER_ADMIN');
      }

      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (const key of ['name', 'role', 'isActive'] as const) {
        if (dto[key] !== undefined && dto[key] !== target[key]) {
          before[key] = target[key];
          after[key] = dto[key];
          (target as any)[key] = dto[key];
        }
      }

      if (Object.keys(after).length > 0) {
        await m.save(target);
        if (after.isActive === false) await this.tokens.revokeAllForUser(m, target.id);
        await this.audit.log(m, {
          platformUserId: actor.id,
          action: 'PLATFORM_USER_UPDATED',
          entityType: 'PlatformUser',
          entityId: target.id,
          diff: { before, after },
          ...meta,
        });
      }
      return toPublicUser(target);
    });
  }

  async changeOwnPassword(user: PlatformUser, dto: ChangePasswordDto, currentRefreshRaw: string | undefined, meta: RequestMeta) {
    if (!(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      throw new PlatformError(400, 'INVALID_CURRENT_PASSWORD');
    }
    const passwordHash = await this.passwords.hash(dto.newPassword);

    await this.dataSource.transaction(async (m) => {
      await m.update(PlatformUser, { id: user.id }, { passwordHash });
      await this.tokens.revokeAllForUser(m, user.id, currentRefreshRaw);
      await this.audit.log(m, {
        platformUserId: user.id,
        action: 'PLATFORM_USER_PASSWORD_CHANGED',
        entityType: 'PlatformUser',
        entityId: user.id,
        ...meta,
      });
    });
    return { changed: true };
  }
}
