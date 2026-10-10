import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UserAppDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  homePath?: string | null;

  @IsOptional()
  @IsIn([0, 1])
  status?: number;
}
