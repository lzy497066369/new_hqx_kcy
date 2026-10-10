import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CompanyMemberDto {
  @IsString()
  @MaxLength(64)
  appCode!: string;

  @IsOptional()
  @IsIn(['all', 'assigned'])
  dataScope?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsIn(['employee', 'owner', 'project_teacher'])
  memberType!: string;

  @IsOptional()
  @IsIn([0, 1])
  status?: number;

  @IsString()
  userId!: string;
}
