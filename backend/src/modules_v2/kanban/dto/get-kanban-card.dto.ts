import { IsIn, IsString } from 'class-validator';
import { KANBAN_OBJECT_TYPES } from './update-kanban-config.dto';

export class GetKanbanCardDto {
  @IsIn(KANBAN_OBJECT_TYPES)
  objectType!: (typeof KANBAN_OBJECT_TYPES)[number];

  @IsString()
  objectId!: string;
}
