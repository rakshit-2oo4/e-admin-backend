import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, randomUUID } from 'crypto';
import { DataSource, EntityManager, IsNull, Not, Repository } from 'typeorm';
import { PlatformRefreshToken } from '../entities/platform-refresh-token.entity';
import { PlatformUser } from '../entities/platform-user.entity';
import { PlatformError } from '../common/platform-error';
import { PlatformJwtPayload, RequestMeta } from '../common/platform.types';

@Injectable()
export class PlatformTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(PlatformRefreshToken) private readonly tokens: Repository<PlatformRefreshToken>,
    @InjectRepository(PlatformUser) private readonly users: Repository<PlatformUser>,
  ) {}

  hash(raw: string): string {
    return createHmac('sha256', this.cfg.getOrThrow<string>('pepper')).update(raw).digest('hex');
  }

  signAccess(user: PlatformUser): Promise<string> {
    const payload: PlatformJwtPayload = { sub: user.id, email: user.email, role: user.role, kind: 'platform' };
    return this.jwt.signAsync(payload);
  }

  get refreshMaxAgeMs(): number {
    return this.cfg.getOrThrow<number>('refreshTtlDays') * 24 * 60 * 60 * 1000;
  }

  /** Creates a refresh token. Pass familyId to continue a family (rotation), omit to start a new login family. */
  async issue(manager: EntityManager, user: PlatformUser, meta: RequestMeta, familyId?: string) {
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshMaxAgeMs);
    await manager.save(
      manager.create(PlatformRefreshToken, {
        platformUserId: user.id,
        tokenHash: this.hash(raw),
        familyId: familyId ?? randomUUID(),
        expiresAt,
        revokedAt: null,
        ip: meta.ip,
        userAgent: meta.userAgent,
      }),
    );
    return { raw, expiresAt };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.tokens.update({ familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  /** Rotates a refresh token. Reuse of a revoked token kills the whole family. */
  async rotate(raw: string, meta: RequestMeta) {
    const found = await this.tokens.findOne({ where: { tokenHash: this.hash(raw) } });
    if (!found) throw new PlatformError(401, 'INVALID_REFRESH_TOKEN');

    if (found.revokedAt) {
      await this.revokeFamily(found.familyId);
      throw new PlatformError(401, 'REFRESH_TOKEN_REUSE_DETECTED');
    }
    if (found.expiresAt.getTime() <= Date.now()) throw new PlatformError(401, 'INVALID_REFRESH_TOKEN');

    const user = await this.users.findOne({ where: { id: found.platformUserId } });
    if (!user) throw new PlatformError(401, 'INVALID_REFRESH_TOKEN');
    if (!user.isActive) throw new PlatformError(401, 'ACCOUNT_DISABLED');

    const result = await this.dataSource.transaction(async (m) => {
      const upd = await m.update(
        PlatformRefreshToken,
        { id: found.id, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      if (!upd.affected) return null; // lost a race: someone else already used this token
      const next = await this.issue(m, user, meta, found.familyId);
      return next;
    });

    if (!result) {
      await this.revokeFamily(found.familyId);
      throw new PlatformError(401, 'REFRESH_TOKEN_REUSE_DETECTED');
    }
    return { user, ...result };
  }

  /** Revokes a single token by its raw value. Returns the owner id (or null if unknown). */
  async revokeByRaw(raw: string): Promise<string | null> {
    const found = await this.tokens.findOne({ where: { tokenHash: this.hash(raw) } });
    if (!found) return null;
    if (!found.revokedAt) await this.tokens.update({ id: found.id }, { revokedAt: new Date() });
    return found.platformUserId;
  }

  async revokeAllForUser(manager: EntityManager, userId: string, exceptRaw?: string): Promise<void> {
    const where: Record<string, unknown> = { platformUserId: userId, revokedAt: IsNull() };
    if (exceptRaw) where.tokenHash = Not(this.hash(exceptRaw));
    await manager.update(PlatformRefreshToken, where, { revokedAt: new Date() });
  }
}
