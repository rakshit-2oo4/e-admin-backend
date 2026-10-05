import { Module } from '@nestjs/common';
import { PlatformCoreModule } from '../common/platform-core.module';
import { ImpersonationController } from './impersonation.controller';
import { ImpersonationService } from './impersonation.service';

@Module({
  imports: [PlatformCoreModule],
  controllers: [ImpersonationController],
  providers: [ImpersonationService],
})
export class ImpersonationModule {}
