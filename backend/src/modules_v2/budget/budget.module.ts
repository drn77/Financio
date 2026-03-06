import { Module } from '@nestjs/common';
import { BudgetController } from './budget.controller';
import { BudgetContextService } from './budget-context.service';
import { BudgetActionsService } from './budget-actions.service';

@Module({
  controllers: [BudgetController],
  providers: [BudgetContextService, BudgetActionsService],
  exports: [BudgetActionsService],
})
export class BudgetModule {}
