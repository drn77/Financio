import { IsString, IsOptional } from 'class-validator';

export class SendInvoiceEmailDto {
  @IsString()
  @IsOptional()
  to?: string; // Override buyer email

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  body?: string;
}
