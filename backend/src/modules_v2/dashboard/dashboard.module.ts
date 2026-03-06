import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardContextService } from './dashboard-context.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardContextService],
})
export class DashboardModule {}
