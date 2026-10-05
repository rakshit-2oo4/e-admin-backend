import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { PlatformAuthGuard } from '../common/platform-auth.guard';
import { CurrentPlatformUser, ReqMeta } from '../common/platform-roles.decorator';
import { PlatformRolesGuard } from '../common/platform-roles.guard';
import type { RequestMeta } from '../common/platform.types';
import { PlatformUser } from '../entities/platform-user.entity';
import { EndImpersonationDto, StartImpersonationDto } from './dto/impersonation.dto';
import { ImpersonationService } from './impersonation.service';

@Controller('platform/impersonate')
@UseGuards(PlatformAuthGuard, PlatformRolesGuard)
export class ImpersonationController {
  constructor(private readonly service: ImpersonationService) {}

  @Post()
  @HttpCode(201)
  start(@Body() dto: StartImpersonationDto, @CurrentPlatformUser() actor: PlatformUser, @ReqMeta() meta: RequestMeta) {
    return this.service.start(dto, actor, meta);
  }

  @Post('end')
  @HttpCode(200)
  end(@Body() dto: EndImpersonationDto, @CurrentPlatformUser() actor: PlatformUser, @ReqMeta() meta: RequestMeta) {
    return this.service.end(dto, actor, meta);
  }
}
