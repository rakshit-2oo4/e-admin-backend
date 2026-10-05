import { Module } from '@nestjs/common';
import { PlatformCoreModule } from '../common/platform-core.module';
import { PlatformStatsController } from './platform-stats.controller';
import { PlatformStatsService } from './platform-stats.service';

@Module({
  imports: [PlatformCoreModule],
  controllers: [PlatformStatsController],
  providers: [PlatformStatsService],
})
export class PlatformStatsModule {}
