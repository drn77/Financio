import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminContextService } from './admin-context.service';
import { AdminActionsService } from './admin-actions.service';

@Module({
  controllers: [AdminController],
  providers: [AdminContextService, AdminActionsService],
})
export class AdminModule {}
