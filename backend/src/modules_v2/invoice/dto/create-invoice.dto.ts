import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';

export class InvoiceItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsNumber()
  sortOrder!: number;

  @IsString()
  description!: string;

  @IsString()
  unit!: string;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  unitPrice!: number;

  @IsString()
  vatRate!: string; // 23, 8, 5, 0, zw, np
}

export class CreateInvoiceDto {
  @IsString()
  type!: string; // STANDARD, PROFORMA, CORRECTION, ADVANCE

  @IsString()
  sellerId!: string;

  @IsString()
  buyerId!: string;

  @IsString()
  issueDate!: string; // ISO date

  @IsString()
  saleDate!: string;

  @IsString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  issuePlace?: string;

  @IsOptional()
  @IsString()
  correctedInvoiceId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
}
