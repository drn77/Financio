import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateTaxEntryDto {
  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
