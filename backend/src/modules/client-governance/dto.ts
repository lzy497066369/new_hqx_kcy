import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEmail, IsIn, IsUUID, IsInt, Min, Max, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { ENTERPRISE_PROJECTS } from '../../common/constants/enterprise-projects';

const trimString = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateGovernanceAccountDto {
  @Transform(trimString) @IsString() @MinLength(2) @MaxLength(64) name!: string;
  @Transform(trimString) @IsString() @MinLength(3) @MaxLength(64) username!: string;
  @IsString() @MinLength(8) @MaxLength(128)
  @Matches(/^\S(?:[\s\S]*\S)?$/, { message: '初始密码首尾不能包含空格' }) password!: string;
  @IsOptional() @IsEmail() @MaxLength(128) email?: string | null;
  @IsOptional() @IsString() @MaxLength(32) phone?: string | null;
}

export class AssignProjectEnterprisesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsString({ each: true }) @Matches(/^[1-9]\d*$/, { each: true }) enterpriseIds!: string[];
}

export class CreateGovernanceEnterpriseDto {
  @Transform(trimString) @IsString() @MinLength(2) @MaxLength(128) name!: string;
  @IsString() @Matches(/^[1-9]\d*$/) regionId!: string;
  @Transform(trimString) @IsString() @MinLength(1) @MaxLength(64) salesOwner!: string;
  @IsArray() @ArrayMinSize(1) @ArrayUnique() @ArrayMaxSize(4) @IsString({ each: true })
  @IsIn(ENTERPRISE_PROJECTS, { each: true, message: '请选择有效的企业项目' })
  enterpriseProjects!: string[];
  @IsInt() @Min(2000) @Max(2100) preDeclarationYear!: number;
}

export class DistributeEnterpriseDto {
  @IsString() @Matches(/^[1-9]\d*$/) projectUserId!: string;
}

export class PreviewGovernanceExcelDto {
  @IsOptional() @IsString() @MaxLength(128) sheetName?: string;
  @IsOptional() @IsString() @Matches(/^(?:[1-9]|[12]\d|30)$/) headerRow?: string;
  @IsOptional() @IsString() @MaxLength(1024) mapping?: string;
}
export class ConfirmGovernanceExcelDto { @IsUUID('4') token!: string; }

export class ExportGovernanceExcelDto {
  @IsOptional() @IsString() @Matches(/^[1-9]\d*$/) regionId?: string;
  @IsOptional() @IsString() @MaxLength(256) keyword?: string;
  @IsOptional() @IsIn(['assigned', 'pending']) distribution?: string;
}
