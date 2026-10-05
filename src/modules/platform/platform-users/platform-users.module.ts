import { Module } from '@nestjs/common';
import { PlatformCoreModule } from '../common/platform-core.module';
import { PlatformAuthModule } from '../platform-auth/platform-auth.module';
import { PlatformUsersController } from './platform-users.controller';
import { PlatformUsersService } from './platform-users.service';

@Module({
  imports: [PlatformCoreModule, PlatformAuthModule],
  controllers: [PlatformUsersController],
  providers: [PlatformUsersService],
})
export class PlatformUsersModule {}
