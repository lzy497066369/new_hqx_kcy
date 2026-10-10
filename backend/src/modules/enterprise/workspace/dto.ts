import {
  Allow,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  Matches,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class EnterpriseWorkspaceShareholderDto {
  @Allow()
  @IsOptional()
  citizenType?: 1 | 2 | 3 | null;

  @Allow()
  @IsOptional()
  idCard?: null | string;

  @Allow()
  @IsOptional()
  investMoney?: null | number | string;

  @Allow()
  @IsOptional()
  name?: null | string;
}

export class EnterpriseWorkspaceBasicProfileDto {
  @Allow() @IsOptional() address?: null | string;
  @Allow() @IsOptional() companyIntro?: null | string;
  @Allow() @IsOptional() companyName?: null | string;
  @Allow() @IsOptional() contactEmail?: null | string;
  @Allow() @IsOptional() contactFax?: null | string;
  @Allow() @IsOptional() contactIdCard?: null | string;
  @Allow() @IsOptional() contactMobile?: null | string;
  @Allow() @IsOptional() contactName?: null | string;
  @Allow() @IsOptional() contactPhone?: null | string;
  @Allow() @IsOptional() isInvest?: 0 | 1 | null;
  @Allow() @IsOptional() isIpo?: 0 | 1 | null;
  @Allow() @IsOptional() legalPersonIdCard?: null | string;
  @Allow() @IsOptional() legalPersonName?: null | string;
  @Allow() @IsOptional() legalPersonPhone?: null | string;
  @Allow() @IsOptional() listedCode?: null | string;
  @Allow() @IsOptional() mainAreas?: null | string[];
  @Allow() @IsOptional() province?: null | string;
  @Allow() @IsOptional() city?: null | string;
  @Allow() @IsOptional() district?: null | string;
  @Allow() @IsOptional() registerCapital?: null | number | string;
  @Allow() @IsOptional() registerDate?: null | string;
  @Allow() @IsOptional() registerType?: null | string;
  @Allow() @IsOptional() taxId?: null | string;
  @Allow() @IsOptional() technologyArea?: null | string;
  @Allow() @IsOptional() vcAmount?: null | number | string;
  @Allow() @IsOptional() zipCode?: null | string;

  @IsArray()
  @IsOptional()
  shareholders?: EnterpriseWorkspaceShareholderDto[];
}

export class EnterpriseWorkspaceDeclarationReviewDto {
  @IsIn(['approve', 'return'])
  action!: 'approve' | 'return';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class EnterpriseWorkspaceContactDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(128)
  email?: null | string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsString()
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  position?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  roleName?: null | string;
}

export class EnterpriseWorkspaceFinancialRecordDto {
  @IsString()
  @Matches(/^\d{4}$/)
  year!: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) totalRevenue?: null | number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) netProfit?: null | number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) netAssets?: null | number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) rdExpense?: null | number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) highTechIncome?: null | number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) mainBusinessIncome?: null | number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) lrTotal?: null | number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) zxc?: null | number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) fz?: null | number;
  @IsOptional() @IsString() @MaxLength(64) fzl?: null | string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) xxsr?: null | number;
  @IsOptional() @IsString() @MaxLength(500) remark?: null | string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) rdPersonnelCost?: null | number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) rdDirectInput?: null | number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) rdDepreciation?: null | number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) rdIntangibleAmortization?: null | number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) rdDesignFee?: null | number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) rdEquipmentDebuggingFee?: null | number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) rdEntrustedDevelopment?: null | number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) rdOtherExpense?: null | number;
}

export class EnterpriseWorkspaceTaxAuditDto {
  @IsOptional() @IsInt() @Min(1) @Max(3) fileClass?: null | number;
  @IsOptional() @IsString() @MaxLength(500) filePath?: null | string;
  @IsOptional() @IsString() @MaxLength(500) remark?: null | string;
  @IsOptional() @IsString() @MaxLength(128) taxCategory?: null | string;
  @IsString() @Matches(/^\d{4}$/) year!: string;
}

export class EnterpriseWorkspaceEmployeeDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(366)
  annualWorkDays?: null | number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  department?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  entryDate?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  idCard?: null | string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isKjyf?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  position?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rdProjects?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: null | string;

  @IsOptional()
  @IsInt()
  ygXl?: null | number;

  @IsOptional()
  @IsInt()
  ygZc?: null | number;

  @IsOptional() @IsString() @MaxLength(500) educationFile?: null | string;
  @IsOptional() @IsString() @MaxLength(500) laborContractFile?: null | string;
  @IsOptional() @IsString() @MaxLength(500) socialSecurityFile?: null | string;
  @IsOptional() @IsString() @MaxLength(500) titleFile?: null | string;
  @IsOptional() @IsIn([1, 2, 3, 4]) ygLx?: null | number;
  @IsOptional() @IsBoolean() ygLxgg?: boolean;
  @IsOptional() @IsIn([1, 2, 3, 4]) ygNl?: null | number;
  @IsOptional() @IsBoolean() ygQr?: boolean;
  @IsOptional() @IsIn([1, 2]) ygSex?: null | number;
  @IsOptional() @IsBoolean() ygWj?: boolean;
  @IsOptional() @IsString() @MaxLength(500) ygFiles?: null | string;

  @IsString()
  @MaxLength(128)
  ygName!: string;
}

export class EnterpriseWorkspaceIntellectualPropertyDto {
  @IsOptional() @IsString() @MaxLength(255) advancedDegree?: null | string;
  @IsOptional() @IsString() @MaxLength(32) applyDate?: null | string;
  @IsOptional() @IsString() @MaxLength(32) authorizeDate?: null | string;
  @IsOptional() @IsString() @MaxLength(255) inventor?: null | string;
  @IsOptional() @IsString() @MaxLength(16) ipLevel?: null | string;
  @IsOptional() @IsBoolean() isCoreIp?: boolean;
  @IsOptional() @IsString() @MaxLength(128) obtainMethod?: null | string;
  @IsOptional() @IsString() @MaxLength(500) remark?: null | string;
  @IsOptional() @IsString() @MaxLength(255) rightHolder?: null | string;
  @IsOptional() @IsArray() @IsString({ each: true }) relatedPsIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) relatedRdIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) relatedTransformationIds?: string[];
  @IsOptional() @IsString() @MaxLength(500) softWorkFile?: null | string;
  @IsOptional() @IsString() @MaxLength(128) softWorkNum?: null | string;
  @IsOptional() @IsInt() softWorkStatus?: null | number;
  @IsString() @MaxLength(255) softWorkName!: string;
  @IsOptional() @IsInt() softWorkType?: null | number;
  @IsOptional() @IsString() @MaxLength(255) supportEffect?: null | string;
}

export class EnterpriseWorkspaceResearchProjectDto {
  @IsOptional() @IsInt() fundSource?: null | number;
  @IsOptional() @IsString() @MaxLength(255) coreTechnology?: null | string;
  @IsOptional() @IsString() @MaxLength(32) endDate?: null | string;
  @IsOptional() @IsString() @MaxLength(64) fundAmount?: null | string;
  @IsOptional() @IsString() @MaxLength(500) lxbgFile?: null | string;
  @IsOptional() @IsString() @MaxLength(1000) innovationPoints?: null | string;
  @IsOptional() @IsString() @MaxLength(32) initDate?: null | string;
  @IsOptional() @IsString() @MaxLength(5000) kyProjectDes?: null | string;
  @IsOptional() @IsString() @MaxLength(128) kyProjectLeader?: null | string;
  @IsString() @MaxLength(255) kyProjectName!: string;
  @IsOptional() @IsString() @MaxLength(128) kyProjectNum?: null | string;
  @IsOptional() @IsInt() kyProjectStatus?: null | number;
  @IsOptional() @IsString() @MaxLength(128) projectType?: null | string;
  @IsOptional() @IsString() @MaxLength(64) rdBudget?: null | string;
  @IsOptional() @IsString() @MaxLength(64) rdExpenseTotal?: null | string;
  @IsOptional() @IsString() @MaxLength(5000) rdOrganizationMethod?: null | string;
  @IsOptional() @IsArray() @IsString({ each: true }) relatedIpIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) relatedPsIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) relatedTransformationIds?: string[];
  @IsOptional() @IsString() @MaxLength(500) remark?: null | string;
  @IsOptional() @IsString() @MaxLength(1000) stageResult?: null | string;
}
export class EnterpriseWorkspaceProductServiceDto {
  @IsOptional() @IsString() @MaxLength(5000) competitiveAdvantage?: null | string;
  @IsOptional() @IsString() @MaxLength(64) highTechIncome?: null | string;
  @IsOptional() @IsString() @MaxLength(64) lastYearIncome?: null | string;
  @IsOptional() @IsString() @MaxLength(1000) proofFiles?: null | string;
  @IsOptional() @IsString() @MaxLength(64) psCode?: null | string;
  @IsOptional() @IsArray() @IsString({ each: true }) relatedContractIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) relatedInvoiceIds?: string[];
  @IsOptional() @IsString() @MaxLength(255) techField?: null | string;
  @IsOptional() @IsString() @MaxLength(255) techSource?: null | string;
  @IsOptional() @IsString() @MaxLength(500) techDescription?: null | string;
  @IsOptional() @IsString() @MaxLength(5000) techIndex?: null | string;
  @IsOptional() @IsString() @MaxLength(500) remark?: null | string;
  @IsOptional() @IsArray() @IsString({ each: true }) relatedIpIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) relatedRdIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) relatedTransformationIds?: string[];
  @IsString() @MaxLength(255) psName!: string;
}
export class EnterpriseWorkspaceTransformationDto {
  @IsOptional() @IsString() @MaxLength(500) applicationScene?: null | string;
  @IsOptional() @IsString() @MaxLength(255) customerName?: null | string;
  @IsOptional() @IsString() @MaxLength(1000) proofFiles?: null | string;
  @IsOptional() @IsArray() @IsString({ each: true }) relatedContractIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) relatedInvoiceIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) relatedIpIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) relatedPsIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) relatedRdIds?: string[];
  @IsOptional() @IsString() @MaxLength(500) remark?: null | string;
  @IsOptional() @IsString() @MaxLength(64) transformationIncome?: null | string;
  @IsOptional() @IsString() @MaxLength(255) transformationMethod?: null | string;
  @IsString() @MaxLength(255) transformationName!: string;
  @IsOptional() @IsString() @MaxLength(64) transformationCode?: null | string;
}

export class EnterpriseWorkspaceContractDto {
  @IsOptional() @IsString() @MaxLength(32) endDate?: null | string;
  @IsOptional() @IsString() @MaxLength(1000) htDes?: null | string;
  @IsOptional() @IsString() @MaxLength(64) htMoney?: null | string;
  @IsString() @MaxLength(255) htName!: string;
  @IsOptional() @IsString() @MaxLength(128) htNum?: null | string;
  @IsOptional() @IsString() @MaxLength(500) htPath?: null | string;
  @IsOptional() @IsIn([1, 2, 3]) htStatus?: null | number;
  @IsOptional() @IsString() @MaxLength(255) khName?: null | string;
  @IsOptional() @IsString() @MaxLength(32) qdDate?: null | string;
  @IsOptional() @IsString() @MaxLength(32) startDate?: null | string;
}

export class EnterpriseWorkspaceInvoiceDto {
  @IsOptional() @IsString() @MaxLength(32) fpDate?: null | string;
  @IsOptional() @IsString() @MaxLength(64) fpMoney?: null | string;
  @IsString() @MaxLength(128) fpNum!: string;
  @IsOptional() @IsString() @MaxLength(500) fpPath?: null | string;
  @IsOptional() @IsIn([1, 2, 3]) fpStatus?: null | number;
  @IsOptional() @IsString() @MaxLength(32) htId?: null | string;
  @IsOptional() @IsString() @MaxLength(500) remark?: null | string;
  @IsOptional() @IsString() @MaxLength(32) zfDate?: null | string;
}

export class EnterpriseWorkspaceDocumentDto {
  @IsOptional() @IsInt() fileClass?: null | number;
  @IsOptional() @IsString() @MaxLength(500) filePath?: null | string;
  @IsOptional() @IsString() @MaxLength(1000) fileRemark?: null | string;
  @IsOptional() @IsString() @MaxLength(32) fileStartDate?: null | string;
  @IsOptional() @IsInt() fileStatus?: null | number;
  @IsString() @MaxLength(255) fileTitle!: string;
  @IsOptional() @IsString() @MaxLength(64) fileVersion?: null | string;
}

export class EnterpriseWorkspaceAdoptGaoxinDocumentPackageDto {
  @IsArray() @IsOptional() @IsString({ each: true }) keys?: string[];
}

export class EnterpriseWorkspaceCertificateDto {
  @IsString() @MaxLength(64) qualificationCode!: string;
  @IsOptional() @IsString() @MaxLength(32) validUntil?: null | string;
  @IsOptional() @IsInt() zsClass?: null | number;
  @IsString() @MaxLength(255) zsName!: string;
  @IsOptional() @IsString() @MaxLength(1000) zsPath?: null | string;
}

export class EnterpriseWorkspaceBatchDeleteDto {
  @IsArray() @IsString({ each: true }) ids!: string[];
}

export class EnterpriseWorkspaceAccountDto {
  @IsOptional() @IsEmail() @MaxLength(128) bEmail?: null | string;
  @IsOptional() @IsString() @MaxLength(64) bPhone?: null | string;
  @IsOptional() @IsString() @MaxLength(128) charge?: null | string;
  @IsOptional() @IsString() @MaxLength(32) endDate?: null | string;
  @IsOptional() @IsString() @MaxLength(64) gsbm?: null | string;
  @IsString() @MaxLength(255) ptName!: string;
  @IsOptional() @IsString() @MaxLength(500) ptUrl?: null | string;
  @IsOptional() @IsString() @MaxLength(500) remark?: null | string;
  @IsString() @MaxLength(255) zhNumber!: string;
  @IsOptional() @IsString() @MaxLength(255) zhPassword?: null | string;
  @IsOptional() @IsInt() zhStatus?: null | number;
  @IsOptional() @IsInt() zhType?: null | number;
}

export class EnterpriseWorkspaceDeclarationDraftDto {
  @IsString()
  @MaxLength(32)
  projectId!: string;
}
