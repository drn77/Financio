import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ColumnDefinitionDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  type!: string; // 'text'|'number'|'date'|'checkbox'|'select'|'tag_group'|'currency'|'person'

  @IsBoolean()
  required!: boolean;

  @IsOptional()
  @IsString()
  defaultBehavior?: string;

  @IsOptional()
  width?: number;

  @IsOptional()
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  options?: string[];

  @IsOptional()
  @IsArray()
  currencyOptions?: string[];

  @IsOptional()
  @IsString()
  tagGroupId?: string;

  @IsOptional()
  @IsString()
  defaultTagId?: string;

  @IsOptional()
  @IsString()
  defaultValue?: string;

  @IsOptional()
  @IsString()
  colorFieldByTag?: string;

  @IsOptional()
  @IsBoolean()
  colorRowByTag?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMultiple?: boolean;
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnDefinitionDto)
  columns!: ColumnDefinitionDto[];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
