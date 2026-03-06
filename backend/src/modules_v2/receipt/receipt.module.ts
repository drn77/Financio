import { Module } from '@nestjs/common';
import { ReceiptController } from './receipt.controller';
import { ReceiptContextService } from './receipt-context.service';
import { ReceiptActionsService } from './receipt-actions.service';
import { TemplateModule } from '../template/template.module';

@Module({
  imports: [TemplateModule],
  controllers: [ReceiptController],
  providers: [ReceiptContextService, ReceiptActionsService],
  exports: [ReceiptActionsService],
})
export class ReceiptModule {}
