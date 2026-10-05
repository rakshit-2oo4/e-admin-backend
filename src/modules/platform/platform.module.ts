import { Module } from '@nestjs/common';
import { ImpersonationModule } from './impersonation/impersonation.module';
import { PlatformAuditModule } from './platform-audit/platform-audit.module';
import { PlatformAuthModule } from './platform-auth/platform-auth.module';
import { PlatformOrgsModule } from './platform-orgs/platform-orgs.module';
import { PlatformStatsModule } from './platform-stats/platform-stats.module';
import { PlatformUsersModule } from './platform-users/platform-users.module';

@Module({
  imports: [
    PlatformAuthModule,
    PlatformOrgsModule,
    PlatformUsersModule,
    PlatformStatsModule,
    PlatformAuditModule,
    ImpersonationModule,
  ],
})
export class PlatformModule {}
