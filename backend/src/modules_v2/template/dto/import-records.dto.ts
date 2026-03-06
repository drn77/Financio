import { IsArray, ValidateNested, IsObject, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportRecordItemDto {
  @IsObject()
  data!: Record<string, any>;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class ImportRecordsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRecordItemDto)
  records!: ImportRecordItemDto[];
}
