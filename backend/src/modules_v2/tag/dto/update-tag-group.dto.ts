import { IsString, IsOptional } from 'class-validator';

export class UpdateTagGroupDto {
  @IsOptional()
  @IsString()
  name?: string;
}
