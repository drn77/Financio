import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { KANBAN_OBJECT_TYPES } from './update-kanban-config.dto';

export class MoveKanbanCardDto {
  @IsIn(KANBAN_OBJECT_TYPES)
  objectType!: (typeof KANBAN_OBJECT_TYPES)[number];

  @IsString()
  objectId!: string;

  @IsOptional()
  @IsUUID('4')
  fromTagId?: string;

  @IsUUID('4')
  toTagId!: string;
}
