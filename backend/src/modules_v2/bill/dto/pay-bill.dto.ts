import { IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';

export class PayBillDto {
  @IsNumber()
  amount!: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
