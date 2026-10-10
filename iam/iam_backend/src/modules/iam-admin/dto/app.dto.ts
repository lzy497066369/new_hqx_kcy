import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AppDto {
  @IsString()
  @MaxLength(64)
  appCode!: string;

  @IsString()
  @MaxLength(128)
  appName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  companySourceSystem?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  homePath?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  portalType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string | null;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  status?: number;
}
