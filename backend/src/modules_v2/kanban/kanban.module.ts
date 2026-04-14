import { Module } from '@nestjs/common';
import { KanbanController } from './kanban.controller';
import { KanbanContextService } from './kanban-context.service';

@Module({
  controllers: [KanbanController],
  providers: [KanbanContextService],
  exports: [KanbanContextService],
})
export class KanbanModule {}
