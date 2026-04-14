import { Module } from '@nestjs/common';
import { TaxController } from './tax.controller';
import { TaxContextService } from './tax-context.service';
import { TemplateModule } from '../template/template.module';

@Module({
  imports: [TemplateModule],
  controllers: [TaxController],
  providers: [TaxContextService],
  exports: [TaxContextService],
})
export class TaxModule {}
