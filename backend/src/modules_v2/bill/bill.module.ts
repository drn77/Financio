import { Module } from '@nestjs/common';
import { BillController } from './bill.controller';
import { BillContextService } from './bill-context.service';
import { BillActionsService } from './bill-actions.service';
import { TemplateModule } from '../template/template.module';

@Module({
  imports: [TemplateModule],
  controllers: [BillController],
  providers: [BillContextService, BillActionsService],
  exports: [BillActionsService],
})
export class BillModule {}
