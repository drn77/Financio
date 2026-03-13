import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId } from '../../shared/decorators/session.decorator';
import { DashboardContextService } from './dashboard-context.service';
import { UpdateDashboardConfigDto } from './dto/update-dashboard-config.dto';

@Controller('v2/dashboard')
@UseGuards(SessionAuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboardContext: DashboardContextService,
  ) {}

  @Get()
  async getDashboard(@FamilyId() familyId: string) {
    return this.dashboardContext.getDashboard(familyId);
  }

  @Get('summary')
  async getSummary(@FamilyId() familyId: string) {
    return this.dashboardContext.getSummary(familyId);
  }

  @Get('statistics')
  async getStatistics(@FamilyId() familyId: string) {
    return this.dashboardContext.getStatistics(familyId);
  }

  @Get('config')
  async getConfig(@FamilyId() familyId: string) {
    return this.dashboardContext.getConfig(familyId);
  }

  @Put('config')
  async updateConfig(@FamilyId() familyId: string, @Body() input: UpdateDashboardConfigDto) {
    return this.dashboardContext.updateConfig(familyId, input);
  }
}
