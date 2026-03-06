import { Module } from '@nestjs/common';
import { TagController } from './tag.controller';
import { TagContextService } from './tag-context.service';
import { TagActionsService } from './tag-actions.service';

@Module({
  controllers: [TagController],
  providers: [TagContextService, TagActionsService],
  exports: [TagActionsService],
})
export class TagModule {}
