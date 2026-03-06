import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
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

export class CreateBillDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsInt()
  @Min(1)
  @Max(31)
  dueDay!: number;

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
