import { IsOptional, IsString } from 'class-validator';

export class UpdateDashboardConfigDto {
  @IsOptional()
  @IsString()
  categoryFieldId?: string | null;
}
