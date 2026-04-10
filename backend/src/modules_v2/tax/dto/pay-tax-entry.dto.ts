import { IsNumber, IsOptional, IsString } from 'class-validator';

export class PayTaxEntryDto {
  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  paymentDate?: string;
}
