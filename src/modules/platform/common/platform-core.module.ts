import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attempt } from '../../attempts/attempt.entity';
import { Organization } from '../../organizations/organization.entity';
import { User } from '../../users/user.entity';
import { ImpersonationSession } from '../entities/impersonation-session.entity';
import { PlatformAuditLog } from '../entities/platform-audit-log.entity';
import { PlatformRefreshToken } from '../entities/platform-refresh-token.entity';
import { PlatformUser } from '../entities/platform-user.entity';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformAuthGuard } from './platform-auth.guard';
import { PlatformPasswordService } from './platform-password.service';
import { PlatformRolesGuard } from './platform-roles.guard';
import { PlatformUsageService } from './platform-usage.service';

const entities = TypeOrmModule.forFeature([
  PlatformUser,
  PlatformRefreshToken,
  PlatformAuditLog,
  ImpersonationSession,
  Organization,
  User,
  Attempt,
]);

const jwt = JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (c: ConfigService) => ({
    secret: c.getOrThrow<string>('jwtSecret'),
    signOptions: { expiresIn: c.getOrThrow<number>('jwtAccessTtlSeconds') },
  }),
});

@Module({
  imports: [entities, jwt],
  providers: [
    PlatformAuditService,
    PlatformPasswordService,
    PlatformUsageService,
    PlatformAuthGuard,
    PlatformRolesGuard,
  ],
  exports: [
    entities,
    jwt,
    PlatformAuditService,
    PlatformPasswordService,
    PlatformUsageService,
    PlatformAuthGuard,
    PlatformRolesGuard,
  ],
})
export class PlatformCoreModule {}
