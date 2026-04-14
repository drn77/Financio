import { IsString, MinLength } from 'class-validator';

export class ParseReceiptAiDto {
  @IsString()
  @MinLength(10)
  text!: string;
}
