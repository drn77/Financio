import { IsObject, IsOptional, IsInt } from 'class-validator';

export class UpdateRecordDto {
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
