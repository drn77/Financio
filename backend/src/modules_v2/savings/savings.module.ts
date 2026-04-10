import { Module } from '@nestjs/common';
import { SavingsController } from './savings.controller';
import { SavingsContextService } from './savings-context.service';
import { SavingsActionsService } from './savings-actions.service';
import { TemplateModule } from '../template/template.module';

@Module({
  imports: [TemplateModule],
  controllers: [SavingsController],
  providers: [SavingsContextService, SavingsActionsService],
  exports: [SavingsActionsService],
})
export class SavingsModule {}
