import { IsArray, ValidateNested, IsString, IsObject, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkRecordItemDto {
  @IsOptional()
  @IsString()
  id?: string; // existing record id (omit for new)

  @IsObject()
  data!: Record<string, any>;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class BulkUpdateRecordsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkRecordItemDto)
  records!: BulkRecordItemDto[];

  @IsOptional()
  @IsArray()
  deletedIds?: string[]; // record ids to delete
}
