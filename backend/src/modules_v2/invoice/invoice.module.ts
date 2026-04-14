import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { InvoiceController } from './invoice.controller';
import { InvoiceContextService } from './invoice-context.service';
import { InvoiceExtensionsService } from './invoice-extensions.service';
import { TemplateModule } from '../template/template.module';

@Module({
  imports: [TemplateModule, ScheduleModule.forRoot()],
  controllers: [InvoiceController],
  providers: [InvoiceContextService, InvoiceExtensionsService],
  exports: [InvoiceContextService, InvoiceExtensionsService],
})
export class InvoiceModule {}
