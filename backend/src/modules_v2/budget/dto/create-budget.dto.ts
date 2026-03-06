import { IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BudgetCategoryDto {
  @IsNotEmpty()
  @IsString()
  categoryId!: string;

  @IsNotEmpty()
  @IsNumber()
  limitAmount!: number;
}

export class CreateBudgetDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsNotEmpty()
  @IsInt()
  @Min(2020)
  year!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetCategoryDto)
  categories?: BudgetCategoryDto[];
}
