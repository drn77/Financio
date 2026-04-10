import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSplitDto {
  @IsString()
  eventId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class JoinSplitDto {
  @IsString()
  nickname!: string;

  @IsOptional()
  @IsString()
  email?: string;
}

export class SendMessageDto {
  @IsString()
  content!: string;
}

export class SplitReceiptItemDto {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(0)
  total!: number;
}

export class CreateSplitReceiptDto {
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  storeName?: string;

  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsOptional()
  @IsString()
  paidByParticipantId?: string;

  @IsOptional()
  @IsString()
  ocrRawText?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitReceiptItemDto)
  items!: SplitReceiptItemDto[];
}

export class UpdateSplitReceiptDto {
  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @IsString()
  paidByParticipantId?: string;

  @IsOptional()
  @IsBoolean()
  isConfirmed?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitReceiptItemDto)
  items?: SplitReceiptItemDto[];
}

export class ClaimItemDto {
  @IsString()
  splitReceiptItemId!: string;
}
