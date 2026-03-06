import { IsString, IsNotEmpty } from 'class-validator';

export class CreateTagGroupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}
