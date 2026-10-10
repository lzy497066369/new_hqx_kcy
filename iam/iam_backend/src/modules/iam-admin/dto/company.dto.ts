import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string | null;

  @IsString()
  @MaxLength(128)
  companyName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  contactName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  creditCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  district?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  legalPerson?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  province?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  shortName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceCompanyId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceSystem?: string | null;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  status?: number;
}
