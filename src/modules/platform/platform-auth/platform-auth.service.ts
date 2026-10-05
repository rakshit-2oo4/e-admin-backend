import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { DataSource, Repository } from 'typeorm';
import { REDIS } from '../../../common/redis/redis.module';
import { PlatformError } from '../common/platform-error';
import { PlatformAuditService } from '../common/platform-audit.service';
import { PlatformPasswordService } from '../common/platform-password.service';
import { normalizeEmail, RequestMeta, toPublicUser } from '../common/platform.types';
import { PlatformUser } from '../entities/platform-user.entity';
import { PlatformThrottleService } from './platform-throttle.service';
import { PlatformTokenService } from './platform-token.service';

const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;
const RESET_TTL_SECONDS = 60 * 60;
const MAIL_QUEUE = 'queue:platform-email';

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly passwords: PlatformPasswordService,
    private readonly tokens: PlatformTokenService,
    private readonly throttle: PlatformThrottleService,
    private readonly audit: PlatformAuditService,
    @Inject(REDIS) private readonly redis: Redis,
    @InjectRepository(PlatformUser) private readonly users: Repository<PlatformUser>,
  ) {}

  private async auditFailure(userId: string | null, reason: string, meta: RequestMeta) {
    await this.audit.log(this.dataSource.manager, {
      platformUserId: userId,
      action: 'LOGIN_FAILED',
      entityType: 'PlatformUser',
      entityId: userId,
      diff: { reason },
      ...meta,
    });
  }

  async login(emailInput: string, password: string, meta: RequestMeta) {
    const email = normalizeEmail(emailInput);
    await this.throttle.assertNotBlocked(email, meta.ip);

    const user = await this.users.findOne({ where: { email } });
    if (!user) {
      await this.passwords.dummyVerify(password);
      await this.throttle.recordFailure(email, meta.ip);
      await this.auditFailure(null, 'UNKNOWN_EMAIL', meta);
      throw new PlatformError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.auditFailure(user.id, 'ACCOUNT_LOCKED', meta);
      throw new PlatformError(401, 'ACCOUNT_LOCKED', 'Account is temporarily locked');
    }

    const valid = await this.passwords.verify(user.passwordHash, password);
    if (!valid) {
      user.failedLoginCount += 1;
      if (user.failedLoginCount >= MAX_FAILED_LOGINS) {
        user.lockedUntil = new Date(Date.now() + LOCK_MS);
        user.failedLoginCount = 0;
      }
      await this.users.save(user);
      await this.throttle.recordFailure(email, meta.ip);
      await this.auditFailure(user.id, 'BAD_PASSWORD', meta);
      throw new PlatformError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (!user.isActive) {
      await this.auditFailure(user.id, 'ACCOUNT_DISABLED', meta);
      throw new PlatformError(401, 'ACCOUNT_DISABLED');
    }

    const refresh = await this.dataSource.transaction(async (m) => {
      await m.update(PlatformUser, { id: user.id }, { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() });
      const issued = await this.tokens.issue(m, user, meta);
      await this.audit.log(m, {
        platformUserId: user.id,
        action: 'LOGIN_SUCCEEDED',
        entityType: 'PlatformUser',
        entityId: user.id,
        ...meta,
      });
      return issued;
    });

    await this.throttle.clearEmail(email);
    return { accessToken: await this.tokens.signAccess(user), refresh, user: toPublicUser(user) };
  }

  async refresh(raw: string, meta: RequestMeta) {
    const { user, raw: newRaw, expiresAt } = await this.tokens.rotate(raw, meta);
    return { accessToken: await this.tokens.signAccess(user), refresh: { raw: newRaw, expiresAt } };
  }

  async logout(raw: string | undefined, meta: RequestMeta): Promise<void> {
    if (!raw) return;
    const userId = await this.tokens.revokeByRaw(raw);
    if (!userId) return;
    await this.audit.log(this.dataSource.manager, {
      platformUserId: userId,
      action: 'LOGOUT',
      entityType: 'PlatformUser',
      entityId: userId,
      ...meta,
    });
  }

  async logoutAll(user: PlatformUser, meta: RequestMeta): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      await this.tokens.revokeAllForUser(m, user.id);
      await this.audit.log(m, {
        platformUserId: user.id,
        action: 'LOGOUT_ALL',
        entityType: 'PlatformUser',
        entityId: user.id,
        ...meta,
      });
    });
  }

  /** Always resolves the same way. Both branches do equivalent hashing and Redis work. */
  async forgotPassword(emailInput: string): Promise<void> {
    const email = normalizeEmail(emailInput);
    const user = await this.users.findOne({ where: { email, isActive: true } });
    const raw = randomBytes(32).toString('base64url');
    const key = `platform:pwreset:${this.tokens.hash(raw)}`;

    if (user) {
      await this.redis.set(key, user.id, 'EX', RESET_TTL_SECONDS);
      await this.redis.rpush(MAIL_QUEUE, JSON.stringify({ template: 'platform-password-reset', to: user.email, token: raw }));
    } else {
      await this.passwords.dummyVerify(raw);
      await this.redis.set(`${key}:decoy`, '0', 'EX', 5);
      await this.redis.llen(MAIL_QUEUE);
    }
  }

  async resetPassword(token: string, newPassword: string, meta: RequestMeta): Promise<void> {
    const userId = await this.redis.getdel(`platform:pwreset:${this.tokens.hash(token)}`);
    const invalid = () => new PlatformError(401, 'RESET_TOKEN_INVALID_OR_EXPIRED');
    if (!userId) throw invalid();

    const user = await this.users.findOne({ where: { id: userId, isActive: true } });
    if (!user) throw invalid();

    const passwordHash = await this.passwords.hash(newPassword);
    await this.dataSource.transaction(async (m) => {
      await m.update(PlatformUser, { id: user.id }, { passwordHash, failedLoginCount: 0, lockedUntil: null });
      await this.tokens.revokeAllForUser(m, user.id);
      await this.audit.log(m, {
        platformUserId: user.id,
        action: 'PLATFORM_USER_PASSWORD_RESET',
        entityType: 'PlatformUser',
        entityId: user.id,
        ...meta,
      });
    });
  }
}
