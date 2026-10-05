import { Module } from '@nestjs/common';
import { PlatformCoreModule } from '../common/platform-core.module';
import { PlatformOrgsController } from './platform-orgs.controller';
import { PlatformOrgsService } from './platform-orgs.service';

@Module({
  imports: [PlatformCoreModule],
  controllers: [PlatformOrgsController],
  providers: [PlatformOrgsService],
})
export class PlatformOrgsModule {}
