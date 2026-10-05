import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { PlatformAuthGuard } from '../common/platform-auth.guard';
import { PlatformRolesGuard } from '../common/platform-roles.guard';
import { PlatformStatsService } from './platform-stats.service';

@Controller('platform/stats')
@UseGuards(PlatformAuthGuard, PlatformRolesGuard)
export class PlatformStatsController {
  constructor(private readonly service: PlatformStatsService) {}

  @Get('overview')
  overview() {
    return this.service.overview();
  }

  @Get('orgs/:id/usage')
  orgUsage(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.orgUsage(id);
  }
}
