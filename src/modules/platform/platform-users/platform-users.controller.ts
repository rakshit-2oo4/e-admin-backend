import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PageQueryDto } from '../common/pagination.dto';
import { PlatformAuthGuard } from '../common/platform-auth.guard';
import { CurrentPlatformUser, PlatformRoles, ReqMeta } from '../common/platform-roles.decorator';
import { PlatformRolesGuard } from '../common/platform-roles.guard';
import { REFRESH_COOKIE } from '../common/platform.types';
import type { RequestMeta } from '../common/platform.types';
import { PlatformRole, PlatformUser } from '../entities/platform-user.entity';
import { ChangePasswordDto, CreatePlatformUserDto, UpdatePlatformUserDto } from './dto/platform-user.dto';
import { PlatformUsersService } from './platform-users.service';

@Controller('platform/users')
@UseGuards(PlatformAuthGuard, PlatformRolesGuard)
export class PlatformUsersController {
  constructor(private readonly service: PlatformUsersService) {}

  @Get()
  list(@Query() q: PageQueryDto) {
    return this.service.list(q);
  }

  @Post()
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  create(@Body() dto: CreatePlatformUserDto, @CurrentPlatformUser() actor: PlatformUser, @ReqMeta() meta: RequestMeta) {
    return this.service.create(dto, actor, meta);
  }

  @Post('me/password')
  @HttpCode(200)
  changeOwnPassword(
    @Body() dto: ChangePasswordDto,
    @CurrentPlatformUser() user: PlatformUser,
    @Req() req: Request,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.service.changeOwnPassword(user, dto, req.cookies?.[REFRESH_COOKIE] as string | undefined, meta);
  }

  @Patch(':id')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlatformUserDto,
    @CurrentPlatformUser() actor: PlatformUser,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.service.update(id, dto, actor, meta);
  }
}
