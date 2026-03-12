import { IsOptional, IsNumber, IsDateString, IsString, IsObject } from 'class-validator';

export class PayFixedExpenseDto {
  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  overrideTemplateData?: Record<string, unknown>;
}
