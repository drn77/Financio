import { IsOptional, IsString } from 'class-validator';

export class UpdateTagMappingsDto {
  @IsOptional()
  @IsString()
  income?: string; // Tag ID for income

  @IsOptional()
  @IsString()
  expense?: string; // Tag ID for expense

  @IsOptional()
  @IsString()
  planning?: string; // Tag ID for planning

  @IsOptional()
  @IsString()
  costs?: string; // Tag ID for deductible tax costs
}
