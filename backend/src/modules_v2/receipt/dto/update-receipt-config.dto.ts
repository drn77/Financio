import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateReceiptConfigDto {
  @IsOptional()
  @IsString()
  amountFieldId?: string | null;

  @IsOptional()
  @IsString()
  dateFieldId?: string | null;

  @IsOptional()
  @IsString()
  descriptionFieldId?: string | null;

  @IsOptional()
  @IsString()
  notesFieldId?: string | null;

  @IsOptional()
  @IsString()
  personFieldId?: string | null;

  @IsOptional()
  @IsString()
  storeFieldId?: string | null;

  @IsOptional()
  @IsString()
  categoryFieldId?: string | null;

  @IsOptional()
  @IsString()
  itemsFieldId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  autoTagIds?: string[];

  @IsOptional()
  @IsObject()
  fieldConfigs?: Record<string, {
    mode?: 'none' | 'map' | 'auto_tags' | 'receipt_configurable';
    receiptFieldId?: 'amount' | 'date' | 'description' | 'notes' | 'person' | 'store' | 'category' | 'items' | 'tags' | null;
    autoTagIds?: string[];
    required?: boolean;
  }>;
}
