import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAuthGuard } from '../common/platform-auth.guard';
import { PlatformRoles } from '../common/platform-roles.decorator';
import { PlatformRolesGuard } from '../common/platform-roles.guard';
import { PlatformRole } from '../entities/platform-user.entity';
import { AuditQueryDto } from './dto/audit-query.dto';
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
}
