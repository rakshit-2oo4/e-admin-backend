import { Module } from '@nestjs/common';
import { PlatformCoreModule } from '../common/platform-core.module';
import { PlatformAuditController } from './platform-audit.controller';
import { PlatformAuditReadService } from './platform-audit-read.service';

@Module({
  imports: [PlatformCoreModule],
  controllers: [PlatformAuditController],
  providers: [PlatformAuditReadService],
})
export class PlatformAuditModule {}
