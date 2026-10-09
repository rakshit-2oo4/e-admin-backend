import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { PlatformAuthGuard } from '../common/platform-auth.guard';
import { PlatformRoles } from '../common/platform-roles.decorator';
import { PlatformRolesGuard } from '../common/platform-roles.guard';
import { PlatformRole } from '../entities/platform-user.entity';
import { AuditQueryDto } from './dto/audit-query.dto';
import { ExportAuditQueryDto } from './dto/export-audit-query.dto';
import { PlatformAuditReadService } from './platform-audit-read.service';

@Controller('platform/audit')
@UseGuards(PlatformAuthGuard, PlatformRolesGuard)
export class PlatformAuditController {
  constructor(private readonly service: PlatformAuditReadService) {}

  @Get()
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  list(@Query() q: AuditQueryDto) {
    return this.service.list(q);
  }

  @Get('filters')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  filters() {
    return this.service.getFilterOptions();
  }


  @Get('export')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  async export(
    @Query() q: ExportAuditQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { filename, csv } = await this.service.exportCsv(q);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return csv;
  }
}

