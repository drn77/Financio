import { IsOptional, IsString, IsNumber } from 'class-validator';

export class MarkInvoicePaidDto {
  @IsOptional()
  @IsNumber()
  paidAmount?: number;

  @IsOptional()
  @IsString()
  paymentDate?: string;
}
