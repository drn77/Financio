import { IsString, IsNumber, IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';

export class CreateTaxEntryDto {
  @IsString()
  type!: string; // VAT_9M, CUSTOM

  @IsString()
  name!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsInt()
  @Min(2024)
  @Max(2035)
  year!: number;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}
