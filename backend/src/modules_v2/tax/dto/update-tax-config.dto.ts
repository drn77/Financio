import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export enum TaxForm {
  SCALE = 'SCALE',
  LINEAR = 'LINEAR',
  LUMPSUM = 'LUMPSUM',
}

export enum ZusProfile {
  FULL = 'FULL',
  PREFERENTIAL = 'PREFERENTIAL',
  STARTER = 'STARTER',
}

export enum LumpSumPreset {
  CUSTOM = 'CUSTOM',
  GENERAL_8_5 = 'GENERAL_8_5',
  IT_12 = 'IT_12',
  LIBERAL_15 = 'LIBERAL_15',
}

export enum BusinessProfile {
  CUSTOM = 'CUSTOM',
  IT_B2B = 'IT_B2B',
  CONSULTING = 'CONSULTING',
  TRADE = 'TRADE',
  STARTING = 'STARTING',
}

export class UpdateTaxConfigDto {
  @IsOptional()
  @IsInt()
  @Min(2024)
  @Max(2035)
  year?: number;

  @IsOptional()
  @IsEnum(TaxForm)
  form?: TaxForm;

  @IsOptional()
  @IsNumber()
  lumpSumRate?: number;

  @IsOptional()
  @IsEnum(LumpSumPreset)
  lumpSumPreset?: LumpSumPreset;

  @IsOptional()
  @IsEnum(BusinessProfile)
  businessProfile?: BusinessProfile;

  @IsOptional()
  @IsBoolean()
  includeSickness?: boolean;

  @IsOptional()
  @IsBoolean()
  includeSocialContributions?: boolean;

  @IsOptional()
  @IsBoolean()
  includeHealthContribution?: boolean;

  @IsOptional()
  @IsEnum(ZusProfile)
  zusProfile?: ZusProfile;
}
