import {
  Allow,
  IsBoolean,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateClientMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  realName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  mobile?: null | string;

  @IsOptional()
  @IsEmail()
  @MaxLength(128)
  email?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  position?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  roleInCompany?: null | string;
}

export class SwitchCurrentCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  companyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  enterpriseId?: string;
}

export class BindCompanyDto {
  @IsString()
  @MaxLength(64)
  creditCode!: string;

  @IsString()
  @MaxLength(128)
  enterpriseName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  contactName?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: null | string;

  @IsOptional()
  @IsEmail()
  @MaxLength(128)
  contactEmail?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: null | string;
}

export class UpdateClientEnterpriseProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  shortName?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  creditCode?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  legalPerson?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  contactName?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: null | string;

  @IsOptional()
  @IsEmail()
  @MaxLength(128)
  contactEmail?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  industry?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  enterpriseType?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  province?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  district?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: null | string;
}

export class SaveClientEnterpriseContactDto {
  @IsString()
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: null | string;

  @IsOptional()
  @IsEmail()
  @MaxLength(128)
  email?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  position?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  roleName?: null | string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: null | string;
}

export class SaveClientEnterpriseShareholderDto {
  @Allow()
  @IsOptional()
  citizen_type?: null | number;

  @Allow()
  @IsOptional()
  id?: string;

  @Allow()
  @IsOptional()
  idcard?: null | string;

  @Allow()
  @IsOptional()
  invest_money?: null | number | string;

  @Allow()
  @IsOptional()
  xname?: null | string;
}

export class SaveClientEnterpriseBasicProfileDto {
  @Allow()
  @IsOptional()
  company_address?: null | string;

  @Allow()
  @IsOptional()
  company_name?: null | string;

  @Allow()
  @IsOptional()
  companyIntro?: null | string;

  @Allow()
  @IsOptional()
  contacts_email?: null | string;

  @Allow()
  @IsOptional()
  contacts_fax?: null | string;

  @Allow()
  @IsOptional()
  contacts_idcard?: null | string;

  @Allow()
  @IsOptional()
  contacts_mobile?: null | string;

  @Allow()
  @IsOptional()
  contacts_name?: null | string;

  @Allow()
  @IsOptional()
  contacts_phone?: null | string;

  @Allow()
  @IsOptional()
  is_invest?: 0 | 1 | null;

  @Allow()
  @IsOptional()
  is_ipo?: 0 | 1 | null;

  @Allow()
  @IsOptional()
  js_areas?: null | string;

  @Allow()
  @IsOptional()
  le_person_idcard?: null | string;

  @Allow()
  @IsOptional()
  le_person_name?: null | string;

  @Allow()
  @IsOptional()
  le_person_phone?: null | string;

  @Allow()
  @IsOptional()
  listedCode?: null | string;

  @Allow()
  @IsOptional()
  main_areas?: null | string | string[];

  @Allow()
  @IsOptional()
  register_capital?: null | number | string;

  @Allow()
  @IsOptional()
  register_date?: null | string;

  @Allow()
  @IsOptional()
  register_type?: null | string;

  @Allow()
  @IsOptional()
  shareholders?: SaveClientEnterpriseShareholderDto[];

  @Allow()
  @IsOptional()
  tax_id?: null | string;

  @Allow()
  @IsOptional()
  vcAmount?: null | number | string;

  @Allow()
  @IsOptional()
  zip_code?: null | string;
}

export class SaveClientEnterpriseRecordDto {
  @IsObject()
  data!: Record<string, unknown>;
}

export class UpdateClientAiDraftDto {
  @IsObject()
  data!: Record<string, unknown>;
}

export class ApproveClientAiDraftsDto {
  @IsArray()
  @IsOptional()
  ids?: Array<number | string>;
}

export class AdoptClientGaoxinDocumentPackageDto {
  @IsArray()
  @IsOptional()
  keys?: string[];
}

export class CreateClientIpRecognitionTaskDto {
  @IsArray()
  @IsOptional()
  ids?: Array<number | string>;

  @IsArray()
  @IsOptional()
  materialIds?: Array<number | string>;
}

export class CreateClientTransformationGenerationDto {
  @IsOptional()
  @IsIn(['auto', 'mixed', 'product', 'service'])
  businessMode?: 'auto' | 'mixed' | 'product' | 'service';

  @IsBoolean()
  @IsOptional()
  includeExisting?: boolean;

  @IsArray()
  @IsOptional()
  ipIds?: Array<number | string>;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(30)
  targetCount?: number;
}

export class CreateClientResearchGenerationDto {
  @IsString()
  @MaxLength(32)
  endDate!: string;

  @IsString()
  @MaxLength(32)
  initDate!: string;

  @IsArray()
  @IsOptional()
  ipIds?: Array<number | string>;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  leader?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  rdBudget?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  technicalField?: null | string;
}

export class CreateClientResearchAutoMatchDto {
  @IsArray()
  @IsOptional()
  ipIds?: Array<number | string>;

  @IsInt()
  @IsOptional()
  @Min(6)
  @Max(10)
  targetCount?: number;
}

export class CreateClientProductServiceGenerationDto {
  @IsOptional()
  @IsIn(['auto', 'mixed', 'product', 'service'])
  businessMode?: 'auto' | 'mixed' | 'product' | 'service';

  @IsBoolean()
  @IsOptional()
  includeExisting?: boolean;

  @IsArray()
  @IsOptional()
  rdIds?: Array<number | string>;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(10)
  targetCount?: number;
}

export class ClientProjectMaterialCheckDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  declarationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  regionId?: string;
}

export class SaveClientGaoxinBookDraftDto {
  @IsObject()
  @IsOptional()
  supplemental?: Record<string, unknown>;
}

export class ClientDeclarationFlowActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  action?: 'advance';
}
