import { IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateDepositDto {
  @IsNumber()
  amount!: number;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
