import { Module } from '@nestjs/common';
import { PlatformCoreModule } from '../common/platform-core.module';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformThrottleService } from './platform-throttle.service';
import { PlatformTokenService } from './platform-token.service';

@Module({
  imports: [PlatformCoreModule],
  controllers: [PlatformAuthController],
  providers: [PlatformAuthService, PlatformTokenService, PlatformThrottleService],
  exports: [PlatformTokenService],
})
export class PlatformAuthModule {}
