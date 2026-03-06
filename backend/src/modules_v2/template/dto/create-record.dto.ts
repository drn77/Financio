import { IsObject, IsOptional, IsInt } from 'class-validator';

export class CreateRecordDto {
  @IsObject()
  data!: Record<string, any>;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
