import { IsNotEmpty, IsString } from 'class-validator';

export class ExtractPdfTextDto {
  @IsString()
  @IsNotEmpty()
  dataUrl!: string;
}
