import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDateString, IsInt, IsEnum, IsObject } from 'class-validator';

enum Frequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export class CreateFixedExpenseDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(Frequency)
  frequency?: string;

  @IsOptional()
  @IsInt()
  dayOfMonth?: number;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  personId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  paymentTagId?: string;

  @IsOptional()
  @IsObject()
  paymentTemplateData?: Record<string, unknown>;
}
