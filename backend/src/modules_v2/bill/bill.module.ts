import { Module } from '@nestjs/common';
import { BillController } from './bill.controller';
import { BillContextService } from './bill-context.service';
import { BillActionsService } from './bill-actions.service';
import { TemplateModule } from '../template/template.module';
import { SavingsModule } from '../savings/savings.module';

@Module({
  imports: [TemplateModule, SavingsModule],
  controllers: [BillController],
  providers: [BillContextService, BillActionsService],
  exports: [BillActionsService],
})
export class BillModule {}
