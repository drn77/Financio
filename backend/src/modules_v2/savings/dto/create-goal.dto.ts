import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDateString, IsBoolean, IsObject } from 'class-validator';

export class CreateGoalDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  targetAmount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  autoCreateExpense?: boolean;

  @IsOptional()
  @IsString()
  paymentTagId?: string;

  @IsOptional()
  @IsObject()
  paymentTemplateData?: Record<string, any>;
}
