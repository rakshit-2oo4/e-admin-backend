import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { PageQueryDto } from '../common/pagination.dto';
import { PlatformAuthGuard } from '../common/platform-auth.guard';
import { CurrentPlatformUser, PlatformRoles, ReqMeta } from '../common/platform-roles.decorator';
import { PlatformRolesGuard } from '../common/platform-roles.guard';
import type { RequestMeta } from '../common/platform.types';
import { PlatformRole, PlatformUser } from '../entities/platform-user.entity';
import { CreateOrgDto, ExportOrgsQueryDto, ListOrgsQueryDto, SuspendOrgDto, UpdateOrgDto } from './dto/org.dto';
import { PlatformOrgsService } from './platform-orgs.service';

@Controller('platform/orgs')
@UseGuards(PlatformAuthGuard, PlatformRolesGuard)
export class PlatformOrgsController {
  constructor(private readonly service: PlatformOrgsService) {}

  @Get()
  list(@Query() q: ListOrgsQueryDto) {
    return this.service.list(q);
  }

  @Get('export')
  async export(
    @Query() q: ExportOrgsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { filename, csv } = await this.service.exportCsv(q);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return csv;
  }


  @Post()
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  create(@Body() dto: CreateOrgDto, @CurrentPlatformUser() actor: PlatformUser, @ReqMeta() meta: RequestMeta) {
    return this.service.create(dto, actor, meta);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(id);
  }

  @Patch(':id')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrgDto,
    @CurrentPlatformUser() actor: PlatformUser,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.service.update(id, dto, actor, meta);
  }

  @Post(':id/suspend')
  @HttpCode(200)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendOrgDto,
    @CurrentPlatformUser() actor: PlatformUser,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.service.suspend(id, dto, actor, meta);
  }

  @Post(':id/unsuspend')
  @HttpCode(200)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  unsuspend(@Param('id', ParseUUIDPipe) id: string, @CurrentPlatformUser() actor: PlatformUser, @ReqMeta() meta: RequestMeta) {
    return this.service.unsuspend(id, actor, meta);
  }

  @Delete(':id')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentPlatformUser() actor: PlatformUser, @ReqMeta() meta: RequestMeta) {
    return this.service.remove(id, actor, meta);
  }

  @Get(':id/users')
  listUsers(@Param('id', ParseUUIDPipe) id: string, @Query() q: PageQueryDto) {
    return this.service.listUsers(id, q);
  }

  @Get(':id/usage')
  usage(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getUsage(id);
  }
}
