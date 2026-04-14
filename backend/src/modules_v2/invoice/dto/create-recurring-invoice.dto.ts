import { IsString, IsOptional, IsBoolean, IsInt, Min, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class RecurringInvoiceItemDto {
  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsString()
  description!: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  unitPrice!: number;

  @IsString()
  @IsOptional()
  vatRate?: string;
}

export class CreateRecurringInvoiceDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  frequency?: string; // DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY

  @IsString()
  nextIssueDate!: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  sellerId!: string;

  @IsString()
  buyerId!: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  bankAccount?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  dueDays?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  autoIssue?: boolean;

  @IsBoolean()
  @IsOptional()
  autoSend?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecurringInvoiceItemDto)
  items!: RecurringInvoiceItemDto[];
}
