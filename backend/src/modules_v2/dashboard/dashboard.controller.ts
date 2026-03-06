import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../shared/guards/auth.guard';
import { FamilyId } from '../../shared/decorators/session.decorator';
import { DashboardContextService } from './dashboard-context.service';

@Controller('v2/dashboard')
@UseGuards(SessionAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardContext: DashboardContextService) {}

  @Get()
  async getDashboard(@FamilyId() familyId: string) {
    return this.dashboardContext.getDashboard(familyId);
  }

  @Get('summary')
  async getSummary(@FamilyId() familyId: string) {
    return this.dashboardContext.getSummary(familyId);
  }
}
