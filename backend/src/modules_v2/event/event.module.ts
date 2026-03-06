import { Module } from '@nestjs/common';
import { EventController } from './event.controller';
import { EventContextService } from './event-context.service';
import { EventActionsService } from './event-actions.service';

@Module({
  controllers: [EventController],
  providers: [EventContextService, EventActionsService],
  exports: [EventActionsService],
})
export class EventModule {}
