import { Module } from '@nestjs/common';
import { TemplateController } from './template.controller';
import { RecordController } from './record.controller';
import { TemplateContextService } from './template-context.service';
import { TemplateActionsService } from './template-actions.service';
import { RecordContextService } from './record-context.service';
import { RecordActionsService } from './record-actions.service';

@Module({
  controllers: [TemplateController, RecordController],
  providers: [
    TemplateContextService,
    TemplateActionsService,
    RecordContextService,
    RecordActionsService,
  ],
  exports: [TemplateActionsService, RecordActionsService],
})
export class TemplateModule {}
