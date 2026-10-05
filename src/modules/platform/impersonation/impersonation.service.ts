import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Organization } from '../../organizations/organization.entity';
import { User } from '../../users/user.entity';
import { PlatformAuditService } from '../common/platform-audit.service';
import { PlatformError } from '../common/platform-error';
import { RequestMeta } from '../common/platform.types';
import { ImpersonationSession } from '../entities/impersonation-session.entity';
import { PlatformRole, PlatformUser } from '../entities/platform-user.entity';
import { EndImpersonationDto, StartImpersonationDto } from './dto/impersonation.dto';

const IMPERSONATION_TTL_SECONDS = 15 * 60;

@Injectable()
export class ImpersonationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly audit: PlatformAuditService,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async start(dto: StartImpersonationDto, actor: PlatformUser, meta: RequestMeta) {
    if (!(await this.orgs.exists({ where: { id: dto.orgId } }))) throw new PlatformError(404, 'ORG_NOT_FOUND');

    const target = await this.users.findOne({ where: { id: dto.targetUserId, orgId: dto.orgId } });
    if (!target) throw new PlatformError(404, 'TARGET_USER_NOT_FOUND');
    if (!target.isActive) throw new PlatformError(400, 'TARGET_USER_INACTIVE');

    const session = await this.dataSource.transaction(async (m) => {
      const s = await m.save(
        m.create(ImpersonationSession, {
          platformUserId: actor.id,
          orgId: dto.orgId,
          targetUserId: target.id,
          reason: dto.reason,
          endedAt: null,
          ip: meta.ip,
          userAgent: meta.userAgent,
        }),
      );
      await this.audit.log(m, {
        platformUserId: actor.id,
        action: 'IMPERSONATION_STARTED',
        entityType: 'ImpersonationSession',
        entityId: s.id,
        diff: { orgId: dto.orgId, targetUserId: target.id, reason: dto.reason },
        ...meta,
      });
      return s;
    });

    const token = await this.jwt.signAsync(
      {
        sub: target.id,
        email: target.email,
        role: target.role,
        orgId: dto.orgId,
        kind: 'admin',
        impersonatedBy: actor.id,
        readOnly: true,
        sessionId: session.id,
      },
      { expiresIn: IMPERSONATION_TTL_SECONDS },
    );

    return { token, sessionId: session.id, expiresInSeconds: IMPERSONATION_TTL_SECONDS, readOnly: true };
  }

  async end(dto: EndImpersonationDto, actor: PlatformUser, meta: RequestMeta) {
    return this.dataSource.transaction(async (m) => {
      const s = await m.findOne(ImpersonationSession, { where: { id: dto.sessionId }, lock: { mode: 'pessimistic_write' } });
      if (!s) throw new PlatformError(404, 'IMPERSONATION_SESSION_NOT_FOUND');
      if (s.platformUserId !== actor.id && actor.role !== PlatformRole.SUPER_ADMIN) {
        throw new PlatformError(403, 'INSUFFICIENT_ROLE');
      }
      if (s.endedAt) return { sessionId: s.id, endedAt: s.endedAt };

      s.endedAt = new Date();
      await m.save(s);
      await this.audit.log(m, {
        platformUserId: actor.id,
        action: 'IMPERSONATION_ENDED',
        entityType: 'ImpersonationSession',
        entityId: s.id,
        diff: { orgId: s.orgId, targetUserId: s.targetUserId, startedBy: s.platformUserId },
        ...meta,
      });
      return { sessionId: s.id, endedAt: s.endedAt };
    });
  }
}
