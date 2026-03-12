import { Module } from '@nestjs/common';
import { TaxController } from './tax.controller';
import { TaxContextService } from './tax-context.service';

@Module({
  controllers: [TaxController],
  providers: [TaxContextService],
  exports: [TaxContextService],
})
export class TaxModule {}
