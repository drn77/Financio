import { Module } from '@nestjs/common';
import { FixedExpenseController } from './fixed-expense.controller';
import { FixedExpenseContextService } from './fixed-expense-context.service';
import { FixedExpenseActionsService } from './fixed-expense-actions.service';

@Module({
  controllers: [FixedExpenseController],
  providers: [FixedExpenseContextService, FixedExpenseActionsService],
  exports: [FixedExpenseActionsService],
})
export class FixedExpenseModule {}
