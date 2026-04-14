import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export const KANBAN_OBJECT_TYPES = ['bill', 'expense', 'fixed-expense', 'receipt'] as const;
export type KanbanObjectType = (typeof KANBAN_OBJECT_TYPES)[number];

export class KanbanColumnDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsUUID('4')
  tagId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(KANBAN_OBJECT_TYPES, { each: true })
  objectTypes!: KanbanObjectType[];
}

export class UpdateKanbanConfigDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KanbanColumnDto)
  columns?: KanbanColumnDto[];
}
