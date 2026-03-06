import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsBoolean,
  IsArray,
  IsUUID,
} from 'class-validator';

enum Frequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

enum PaymentType {
  MANUAL = 'MANUAL',
  AUTO_PAY = 'AUTO_PAY',
  DIRECT_DEBIT = 'DIRECT_DEBIT',
}

export class UpdateBillDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;

  @IsOptional()
  @IsEnum(Frequency)
  frequency?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: string;

  @IsOptional()
  @IsBoolean()
  autoCreateExpense?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  reminderDays?: number;

  @IsOptional()
  @IsNumber()
  budgetLimit?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];
}
