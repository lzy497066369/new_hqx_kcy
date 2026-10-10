import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readdir, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { inflateSync } from 'node:zlib';
import { In, IsNull, Not, Repository } from 'typeorm';

import type { CurrentUser } from '../../common/interfaces/current-user.interface';
import { formatDateTimeInBjt } from '../../common/utils/date.util';
import { parseFlowDate } from '../../common/utils/flow-date.util';
import { parseChineseIdCard } from '../../common/utils/chinese-id-card.util';
import { isEnterpriseCertificateType } from '../../common/constants/enterprise-certificate-type';
import { ENTERPRISE_METRIC_CATALOG, ENTERPRISE_METRIC_KEYS } from '../../common/constants/enterprise-metric';
import { IamCompanyScopeService } from '../../common/auth/iam-company-scope.service';
import {
  buildUploadPublicUrl,
  getUploadRootAbsolutePath,
  normalizeStoredUploadPath,
  resolveStoredUploadAbsolutePath,
} from '../../common/utils/upload.util';
import { AiDraftEntity } from '../../infrastructure/database/entities/ai-draft.entity';
import { AiResultEntity } from '../../infrastructure/database/entities/ai-result.entity';
import { AiTaskEntity } from '../../infrastructure/database/entities/ai-task.entity';
import { ClientUserProfileEntity } from '../../infrastructure/database/entities/client-user-profile.entity';
import { ClientDeclarationEntity } from '../../infrastructure/database/entities/client-declaration.entity';
import { DeclarationSchemeEntity } from '../../infrastructure/database/entities/declaration-scheme.entity';
import { DeclarationPresetEntity } from '../../infrastructure/database/entities/declaration-preset.entity';
import { DeclarationMaterialCheckEntity } from '../../infrastructure/database/entities/declaration-material-check.entity';
import { DeclarationMaterialCheckItemEntity } from '../../infrastructure/database/entities/declaration-material-check-item.entity';
import { EnterpriseAccountRecordEntity } from '../../infrastructure/database/entities/enterprise-account-record.entity';
import { EnterpriseCertificateRecordEntity } from '../../infrastructure/database/entities/enterprise-certificate-record.entity';
import { EnterpriseContactEntity } from '../../infrastructure/database/entities/enterprise-contact.entity';
import { EnterpriseContractRecordEntity } from '../../infrastructure/database/entities/enterprise-contract-record.entity';
import { EnterpriseDocumentRecordEntity } from '../../infrastructure/database/entities/enterprise-document-record.entity';
import { EnterpriseEmployeeRecordEntity } from '../../infrastructure/database/entities/enterprise-employee-record.entity';
import { EnterpriseBasicInfoEntity } from '../../infrastructure/database/entities/enterprise-basic-info.entity';
import { EnterpriseEntity } from '../../infrastructure/database/entities/enterprise.entity';
import { EnterpriseFinanceRecordEntity } from '../../infrastructure/database/entities/enterprise-finance-record.entity';
import {
  normalizeFinanceAmount,
  normalizeFinanceAmountUnit,
  normalizeFinanceFileClass,
  normalizeFinanceTaxCategory,
  normalizeFinanceYear,
} from '../enterprise/workspace/finance-record-rules';
import { EnterpriseMaterialEntity } from '../../infrastructure/database/entities/enterprise-material.entity';
import { EnterpriseMaterialParseErrorEntity } from '../../infrastructure/database/entities/enterprise-material-parse-error.entity';
import { EnterpriseOwnerEntity } from '../../infrastructure/database/entities/enterprise-owner.entity';
import { EnterprisePersonEntity } from '../../infrastructure/database/entities/enterprise-person.entity';
import { EnterprisePhotoRecordEntity } from '../../infrastructure/database/entities/enterprise-photo-record.entity';
import { EnterpriseProfileStatEntity } from '../../infrastructure/database/entities/enterprise-profile-stat.entity';
import { EnterpriseProfileStatItemEntity } from '../../infrastructure/database/entities/enterprise-profile-stat-item.entity';
import { EnterprisePropertyRecordEntity } from '../../infrastructure/database/entities/enterprise-property-record.entity';
import { EnterpriseTeacherEntity } from '../../infrastructure/database/entities/enterprise-teacher.entity';
import { EnterpriseUserEntity } from '../../infrastructure/database/entities/enterprise-user.entity';
import { GaoxinBookDraftEntity } from '../../infrastructure/database/entities/gaoxin-book-draft.entity';
import { PolicyProjectEntity } from '../../infrastructure/database/entities/policy-project.entity';
import { PolicyCollectNotificationEntity } from '../../infrastructure/database/entities/policy-collect-notification.entity';
import { ProjectMaterialRequirementEntity } from '../../infrastructure/database/entities/project-material-requirement.entity';
import { ProjectMaterialRequirementItemEntity } from '../../infrastructure/database/entities/project-material-requirement-item.entity';
import { RegionEntity } from '../../infrastructure/database/entities/region.entity';
import { RegionPolicyFileEntity } from '../../infrastructure/database/entities/region-policy-file.entity';
import { UserEntity } from '../../infrastructure/database/entities/user.entity';
import { UserRoleEntity } from '../../infrastructure/database/entities/user-role.entity';
import { UserRepository } from '../../infrastructure/database/repositories/user.repository';
import { AiService } from '../ai/ai.service';
import { EnterpriseInput } from '../enterprise/profile/dto';
import { EnterpriseProfileService } from '../enterprise/profile/profile.service';
import {
  HIGH_TECH_FIELD_CATALOG,
  HIGH_TECH_FIELD_CATALOG_BY_NAME,
} from './high-tech-field-catalog';
import {
  ApproveClientAiDraftsDto,
  AdoptClientGaoxinDocumentPackageDto,
  BindCompanyDto,
  ClientProjectMaterialCheckDto,
  ClientDeclarationFlowActionDto,
  CreateClientIpRecognitionTaskDto,
  CreateClientProductServiceGenerationDto,
  CreateClientResearchAutoMatchDto,
  CreateClientResearchGenerationDto,
  CreateClientTransformationGenerationDto,
  SaveClientGaoxinBookDraftDto,
  SaveClientEnterpriseBasicProfileDto,
  SaveClientEnterpriseContactDto,
  SaveClientEnterpriseRecordDto,
  SaveClientEnterpriseShareholderDto,
  SwitchCurrentCompanyDto,
  UpdateClientAiDraftDto,
  UpdateClientEnterpriseProfileDto,
  UpdateClientMeDto,
} from './dto';

const execFileAsync = promisify(execFile);

type ClientCompanyItem = {
  salesOwner: string;
  preDeclarationYear: number | null;
  enterpriseProjects: string[];
  creditCode: null | string;
  id: string;
  industry: null | string;
  isCurrent: boolean;
  isDefault: boolean;
  name: string;
  profileStatus: string;
  roleName: string;
  shortName: null | string;
  status: 0 | 1;
};

type AccessibleCompany = {
  bindingDefault: boolean;
  enterprise: EnterpriseEntity;
  roleName: string;
};

type ClientEnterpriseShareholder = {
  citizen_type: null | number;
  id: string;
  idcard: null | string;
  invest_money: null | number;
  xname: null | string;
};

type ClientEnterpriseBasicProfile = {
  company_address: null | string;
  company_name: null | string;
  companyIntro: null | string;
  contacts_email: null | string;
  contacts_fax: null | string;
  contacts_idcard: null | string;
  contacts_mobile: null | string;
  contacts_name: null | string;
  contacts_phone: null | string;
  is_invest: 0 | 1 | null;
  is_ipo: 0 | 1 | null;
  js_areas: null | string;
  le_person_idcard: null | string;
  le_person_name: null | string;
  le_person_phone: null | string;
  listedCode: null | string;
  main_areas: string[];
  register_capital: null | number;
  register_date: null | string;
  register_type: null | string;
  shareholders: ClientEnterpriseShareholder[];
  tax_id: null | string;
  vcAmount: null | number;
  zip_code: null | string;
};

type BuiltinMaterialTemplate = {
  content?: string;
  description: string;
  fileName: string;
  id: string;
  materialType: string;
  name: string;
  required: boolean;
  version: string;
};

type EmployeeImportRow = Record<string, string>;

type EmployeeImportError = {
  fieldName: null | string;
  message: string;
  rawValue?: null | string;
  rowNumber: number;
  sheetName?: null | string;
  suggestion?: null | string;
};

type EmployeeImportSummary = {
  createCount?: number;
  employeeCount: number;
  errorCount: number;
  importableCount?: number;
  skippedCount?: number;
  status: 'invalid' | 'partial' | 'valid';
  updateCount?: number;
};

type EmployeeImportPayload = {
  annual_work_days: null | number;
  department: null | string;
  education_file: null | string;
  entry_date: null | string;
  id_card: null | string;
  is_active: null | number;
  is_kjyf: null | number;
  labor_contract_file: null | string;
  position: null | string;
  rd_projects: null | string;
  remark: null | string;
  social_security_file: null | string;
  title_file: null | string;
  yg_files: null | string;
  yg_lx: null | number;
  yg_lxgg: null | number;
  yg_name: string;
  yg_nl: null | number;
  yg_qr: null | number;
  yg_sex: null | number;
  yg_wj: null | number;
  yg_xl: null | number;
  yg_zc: null | number;
};

type EmployeeImportPreviewRow = {
  action: 'create' | 'error' | 'skip' | 'update';
  data: EmployeeImportPayload;
  errors: EmployeeImportError[];
  importable: boolean;
  key: string;
  matchedEmployeeId: null | string;
  rowNumber: number;
  sheetName: string;
};

type EmployeeImportPreviewSummary = {
  createCount: number;
  errorCount: number;
  importableCount: number;
  readCount: number;
  skippedCount: number;
  status: 'invalid' | 'partial' | 'valid';
  updateCount: number;
};

type EmployeeImportPreviewResult = {
  materialId: string;
  rows: EmployeeImportPreviewRow[];
  source: {
    companyName: null | string;
    creditCode: null | string;
    fileName: string;
    fileType: 'excel' | 'pdf' | 'unknown';
    queryPeriod: null | string;
    recognitionMode: 'excel' | 'pdf_text' | 'vision' | 'unknown';
  };
  summary: EmployeeImportPreviewSummary;
};

type FinanceImportRow = Record<string, string>;

type FinanceImportError = {
  fieldName: null | string;
  message: string;
  rawValue?: null | string;
  rowNumber: number;
  suggestion?: null | string;
};

type FinanceImportSummary = {
  errorCount: number;
  financialCount: number;
  status: 'invalid' | 'partial' | 'valid';
  taxAuditCount: number;
};

type FinanceAiParseDraftPayload = {
  confidence: number;
  documentType?: 'financial_statement' | 'tax_audit' | 'other';
  existingFinancial?: null | Record<string, unknown>;
  existingTaxAudit?: null | Record<string, unknown>;
  financial?: null | Record<string, unknown>;
  parseStatus: 'partial' | 'review_required' | 'success';
  reviewWarnings: string[];
  sourceFileName: string;
  sourceFilePath: string;
  sourceMaterialId?: null | string;
  sourcePreviewUrl?: null | string;
  taxAudit?: null | Record<string, unknown>;
  year: string;
};

type ExcelRuntime = {
  // The optional employee Excel importer loads exceljs at runtime.
  // P0 finance import stays dependency-free and uses CSV.
  Workbook: new () => any;
};

type ExcelWorkbook = InstanceType<ExcelRuntime['Workbook']>;
type ExcelRow = any;
type ExcelWorksheet = any;

type StoredUploadFile = {
  filename: string;
  originalname: string;
  path?: string;
  size: number;
};

type EnterpriseMaterialOwnershipScene =
  | 'contract'
  | 'employee'
  | 'finance'
  | 'invoice'
  | 'ip'
  | 'material';

type EnterpriseMaterialOwnershipCheck = {
  creditCodes: string[];
  status: 'matched' | 'mismatched' | 'unverified';
};

type ClientAiDraftItem = {
  approvedRecordId: null | string;
  createTime: string;
  draftPayload: Record<string, unknown>;
  draftType: string;
  id: string;
  reviewedAt: null | string;
  reviewedBy: null | string;
  sourceIds: string[];
  status: string;
  taskId: null | string;
  updateTime: string;
};

type ClientAiTaskItem = {
  createTime: string;
  drafts?: ClientAiDraftItem[];
  errorMessage: null | string;
  finishedAt: null | string;
  id: string;
  inputSnapshot: Record<string, unknown>;
  result: ClientAiTaskResultItem | null;
  resultId: null | string;
  scene: string;
  status: string;
  updateTime: string;
};

type ClientAiTaskResultItem = {
  confidence: null | string;
  id: string;
  scene: string;
  status: string;
  structuredResult: Record<string, unknown>;
  summary: null | string;
};

type ClientPropertyEvidenceNode = {
  id: string;
  name: string;
  number: null | string;
};

type ClientPropertyEvidenceChain = {
  gaps: string[];
  id: string;
  ip: ClientPropertyEvidenceNode[];
  name: string;
  number: null | string;
  ps: ClientPropertyEvidenceNode[];
  transformation: ClientPropertyEvidenceNode[];
};

type ClientHighTechFieldClassification = {
  confidence: 'high' | 'low' | 'medium';
  field: null | string;
  id: string;
  recordType: string;
  topLevel: null | string;
};

type ClientPropertyEvidenceChecklistItem = {
  detail: string;
  key: string;
  label: string;
  status: 'missing' | 'passed' | 'warning';
};

type ClientPropertyEvidenceSummary = {
  chains: ClientPropertyEvidenceChain[];
  generatedAt: string;
  gaps: string[];
  checklist: ClientPropertyEvidenceChecklistItem[];
  stats: {
    completeRdChains: number;
    gapTotal: number;
    intellectualPropertyTotal: number;
    ipUsedInChain: number;
    psTotal: number;
    psWithIp: number;
    psWithRd: number;
    rdTotal: number;
    rdWithIp: number;
    readinessPercent: number;
    transformationTotal: number;
    transformationWithIp: number;
  };
};

type ClientPropertyEvidenceRepairResult = {
  changedRecords: number;
  repairedAt: string;
  scannedRecords: number;
};

type ClientPropertyAiReadiness = {
  ai: {
    configured: boolean;
    enabled: boolean;
    message: string;
  };
  generatedAt: string;
  mode: 'ai_only' | 'fallback_only';
};

type ClientPropertyRecordKind = 'ip' | 'ps' | 'rd' | 'transformation';
type PropertyBusinessMode = 'auto' | 'mixed' | 'product' | 'service';

type ResearchAutoMatchCategory = {
  key: string;
  label: string;
  technicalField: string;
};

type ResearchAutoMatchPlan = {
  plannedYears: number[];
  targetCount: number;
  warning: null | string;
};

type ResearchAutoMatchCandidate = {
  activeRdDraftRows: AiDraftEntity[];
  availableRows: EnterprisePropertyRecordEntity[];
  blockedReasons: string[];
  existingRdRows: EnterprisePropertyRecordEntity[];
  skippedIpCount: number;
  sourceValidIpCount: number;
  sourceRows: EnterprisePropertyRecordEntity[];
  validRows: EnterprisePropertyRecordEntity[];
};

type IpPdfTextStatus = 'empty' | 'failed' | 'success' | 'unreadable';

type IpPdfTextExtractionResult = {
  errorMessage?: string;
  fieldHitScore: number;
  snippet: string;
  status: IpPdfTextStatus;
};

type PdfTextScene = 'finance' | 'ip' | 'social_security';

type PdfParseFunction = (data: Buffer) => Promise<{ text?: string }>;

type PdfParseConstructor = new (options: { data: Buffer | Uint8Array }) => {
  destroy?: () => Promise<void>;
  getText: () => Promise<{ text?: string }>;
};

type ClientPropertyRelationField =
  | 'relatedIpIds'
  | 'relatedPsIds'
  | 'relatedRdIds'
  | 'relatedTransformationIds';

type ClientPropertyReverseRelationRule = {
  field: ClientPropertyRelationField;
  ids: string[] | undefined;
  recordKind: ClientPropertyRecordKind;
};

type ClientPolicyFileItem = {
  applicationLevel: null | string;
  conditionText: null | string;
  content: null | string;
  createTime: string;
  endDate: null | string;
  fileName: null | string;
  fileUrl: null | string;
  id: string;
  materialText: null | string;
  officialFileUrl: null | string;
  ownerName: string;
  ownerUserId: string;
  projectId: string;
  projectName: string;
  regionId: null | string;
  regionName: string;
  remark: null | string;
  startDate: null | string;
  status: string;
  subsidyAmountMax: null | string;
  subsidyAmountMin: null | string;
  subsidyText: null | string;
  targetObjects: null | string;
  templateFileId: null | string;
  templateFileName: null | string;
  title: string;
  updateTime: string;
};

type ClientDeclareProjectItem = {
  applicableObjects: null | string;
  basicDescription: null | string;
  canCreateDeclaration: boolean;
  existingDeclaration: ExistingClientDeclarationSummary | null;
  id: string;
  matchedPolicies: ClientPolicyFileItem[];
  matchedPolicyCount: number;
  name: string;
  nearestDeadline: null | string;
  policyType: null | string;
  regionNames: string[];
  scheme: null | ResolvedDeclarationScheme;
  subsidyText: null | string;
};

type ExistingClientDeclarationSummary = {
  declarationNo: string;
  id: string;
  regionId: null | string;
  regionName: null | string;
  status: string;
  updateTime: string;
};

const ACTIVE_CLIENT_DECLARATION_STATUSES = [
  'draft',
  'preparing',
  'submitted',
  'reviewing',
  'rejected',
];

type DeclarationCapabilities = {
  exportPackage: boolean;
  gaoxinScore: boolean;
  score: boolean;
};

type QualificationRule =
  | { certificateType?: string; type: 'certificate_exists' }
  | { key?: string; operator?: string; type: 'metric'; value?: unknown }
  | { code?: string; name?: string; required?: boolean; type: 'certificate' };

type ResolvedFlowNodeTimeRule = {
  endDate?: string;
  endDay?: number;
  endMonth?: number;
  endOffsetDays?: number;
  maxHandleDays?: number;
  mode?: 'always' | 'annual_window' | 'date_range' | 'relative_days';
  startDate?: string;
  startDay?: number;
  startMonth?: number;
  startOffsetDays?: number;
};

type ResolvedFlowNodeYearScope = {
  mode?: 'current' | 'previous' | 'recent_years' | 'specified';
  recentYears?: number;
  specifiedYear?: number;
};

type ResolvedFlowNode = {
  code?: string;
  description?: string;
  name?: string;
  qualificationPresetIds?: string[];
  qualificationSnapshots?: Array<{ name?: string; rules?: Record<string, unknown> }>;
  role?: string;
  timeRule?: ResolvedFlowNodeTimeRule;
  type?: string;
  yearScope?: ResolvedFlowNodeYearScope;
};

type FlowNodeQualification = {
  missing: string[];
  presetNames: string[];
  status: 'eligible' | 'ineligible';
};

type QualificationEvaluationContext = {
  certificates: EnterpriseCertificateRecordEntity[];
  metrics: Record<string, number>;
};

type ResolvedDeclarationScheme = {
  capabilities: DeclarationCapabilities;
  flowTemplate: {
    nodes?: ResolvedFlowNode[];
  };
  id: string;
  materialRules: unknown;
  qualification: { missing: string[]; status: 'eligible' | 'ineligible' };
  qualificationRules: unknown;
  regionId: null | string;
  schemeName: string;
  scoreRules: unknown;
  version: string;
};

type SchemeScoreItem = {
  label: string;
  maxScore: number;
  score: number;
  source: string;
  value: number;
};

type SchemeScoreResult = {
  items: SchemeScoreItem[];
  passScore: number;
  passed: boolean;
  schemeId: string;
  schemeVersion: string;
  totalScore: number;
};

type ClientProjectReadiness = {
  canCreate: boolean;
  conditionTexts: string[];
  materialTexts: string[];
  matchedPolicyFileIds: string[];
  missingMaterials: Array<{
    code: string;
    name: string;
    required: boolean;
    sourceModule: string;
  }>;
  missingRequiredFields: string[];
  score: number;
  status: 'needs_profile' | 'ready';
};

type MaterialRequirementItemCheck = {
  attachmentMissing: boolean;
  checkStatus: 'missing' | 'partial' | 'passed';
  itemName: string;
  matchedCount: number;
  matchedRecordIds: string[];
  missingFields: string[];
  moduleKey: string;
  relationSummary?: Record<string, string[]>;
  requirementItemId: string | null;
  requiredCount: number;
  scoreWeight: number;
  score: number;
  suggestion: string | null;
  tabKey: string;
};

type ClientProjectMaterialReadiness = {
  checkId: string;
  checkedAt: string;
  checkStatus: 'missing' | 'partial' | 'passed';
  enterpriseId: string;
  items: MaterialRequirementItemCheck[];
  missingItems: number;
  passedItems: number;
  projectId: string;
  projectName: string;
  readinessScore: number;
  requirementId: string;
  requirementName: string;
  riskLevel: 'high' | 'low' | 'medium';
  totalItems: number;
  version: string;
};

type GaoxinScoreSuggestion = {
  moduleKey: string;
  tabKey: string;
  text: string;
};

type GaoxinScoreSubItem = {
  basis: string;
  expertReviewRequired: boolean;
  grade: string;
  key: string;
  label: string;
  maxScore: number;
  score: number;
  scoreRange: string;
};

type GaoxinScoreCategory = {
  deductions: string[];
  evidence: string[];
  evidenceChain: {
    complete: boolean;
    missing: string[];
    summary: string;
  };
  key: 'achievement' | 'growth' | 'ip' | 'rdManagement';
  label: string;
  maxScore: number;
  missingEvidenceCount: number;
  riskLevel: 'high' | 'low' | 'medium';
  ruleItems: string[];
  score: number;
  subItems: GaoxinScoreSubItem[];
  suggestions: GaoxinScoreSuggestion[];
};

type GaoxinScoreResult = {
  calculatedAt: string;
  categories: GaoxinScoreCategory[];
  passScore: number;
  passed: boolean;
  riskLevel: 'high' | 'low' | 'medium';
  ruleVersion: string;
  sourceCounts: Record<string, number>;
  summary: string;
  totalScore: number;
};

type GaoxinBookField = {
  editable: boolean;
  key: string;
  label: string;
  moduleKey?: string;
  source: 'enterprise_profile' | 'supplemental';
  tabKey?: string;
  value: null | string;
};

type GaoxinBookRecord = {
  fields: GaoxinBookField[];
  id: string;
  title: string;
};

type GaoxinBookSection = {
  description: string;
  fields: GaoxinBookField[];
  key: string;
  records: GaoxinBookRecord[];
  title: string;
};

type GaoxinBookDraftResult = {
  completionRate: number;
  declarationId: string;
  draftId: string;
  generatedAt: string;
  projectId: string;
  projectName: string;
  sections: GaoxinBookSection[];
  status: string;
  supplemental: Record<string, string>;
};

type GaoxinExportReadinessIssue = {
  actionText: string;
  blockingExport: boolean;
  description: string;
  key: string;
  level: 'error' | 'info' | 'warning';
  moduleKey?: string;
  source: 'book' | 'enterprise_profile' | 'evidence_chain' | 'material' | 'score';
  tabKey?: string;
  title: string;
};

type GaoxinExportReadinessResult = {
  bookCompletionRate: null | number;
  canExport: boolean;
  declarationId: string;
  generatedAt: string;
  gaoxinScore: null | number;
  hasGaoxinContent: boolean;
  issueCounts: Record<'error' | 'info' | 'warning', number>;
  issues: GaoxinExportReadinessIssue[];
  materialReadinessScore: number;
  projectId: string;
  projectName: string;
  riskLevel: 'high' | 'low' | 'medium';
  status: 'high_risk' | 'needs_completion' | 'ready';
  summary: string;
};

type GaoxinAiDiagnosisAction = {
  actionText: string;
  description: string;
  key: string;
  moduleKey?: string;
  priority: 'high' | 'low' | 'medium';
  tabKey?: string;
  title: string;
};

type GaoxinAiDiagnosisResult = {
  adapterError?: string;
  adapterStatus: 'fallback_after_error' | 'fallback_not_configured' | 'success';
  advantages: string[];
  aiModel?: string;
  aiTaskId?: string;
  bookCompletionRate?: number;
  conclusion: 'can_try' | 'not_ready' | 'recommended';
  generatedAt: string;
  materialReadinessScore: number;
  mode: 'ai' | 'rule';
  nextSteps: string[];
  priorityActions: GaoxinAiDiagnosisAction[];
  projectId: string;
  projectName: string;
  riskLevel: 'high' | 'low' | 'medium';
  risks: string[];
  scoreGap: number;
  summary: string;
  totalScore: number;
};

type MaterialCheckResult = ClientProjectMaterialReadiness;

type ClientDeclarationItem = {
  activeNodeNames: string[];
  capabilities: DeclarationCapabilities;
  companyId: string;
  currentNodeName: null | string;
  deadline: null | string;
  declarationNo: string;
  id: string;
  missingMaterialCount: number;
  policyType: null | string;
  progress: number;
  projectId: string;
  projectName: string;
  rejectedReason: null | string;
  regionId: null | string;
  regionName: null | string;
  schemeId: null | string;
  schemeVersion: null | string;
  status: string;
  submitTime: null | string;
  updateTime: string;
};

type ClientDeclarationFlowEvent = {
  description: string;
  nodeName: string;
  occurredAt: string;
  status: 'completed' | 'current' | 'pending' | 'rejected';
  title: string;
  type: 'audit' | 'material_snapshot' | 'replenishment' | 'submit';
};

type ClientDeclarationFlowNode = {
  description: string;
  nodeName: string;
  order: number;
  qualification: FlowNodeQualification;
  status: 'completed' | 'current' | 'pending' | 'rejected' | 'waiting';
  time: null | string;
  timeNodeDescription: string;
  timeRuleDescription: string;
};

type ClientDeclarationMaterialSnapshotItem = {
  attachmentMissing: boolean;
  checkStatus: 'missing' | 'partial' | 'passed';
  itemName: string;
  matchedCount: number;
  matchedRecordIds: string[];
  missingFields: string[];
  moduleKey: string;
  moduleName: string;
  relationSummary: Record<string, string[]>;
  requiredCount: number;
  suggestion: null | string;
  tabKey: string;
  tabName: string;
};

type ClientDeclarationReplenishment = {
  reason: string;
  requestedAt: string;
  status: 'pending' | 'resolved';
};

type ClientDeclarationFlow = {
  auditNodes: ClientDeclarationFlowNode[];
  events: ClientDeclarationFlowEvent[];
  materialSnapshot: {
    checkedAt: null | string;
    checkId: null | string;
    items: ClientDeclarationMaterialSnapshotItem[];
    readinessScore: number;
    source: 'declaration_snapshot' | 'latest_check';
  };
  replenishment: null | ClientDeclarationReplenishment;
  submitRecord: null | {
    declarationNo: string;
    nodeName: string;
    submitTime: string;
  };
};

type ClientDeclarationDetail = ClientDeclarationItem & {
  appliedScheme: null | {
    id: string;
    schemeName: string;
    version: string;
  };
  flow: ClientDeclarationFlow;
  matchedScheme: null | {
    id: string;
    qualificationStatus: 'eligible' | 'ineligible';
    regionId: null | string;
    regionName: string;
    schemeName: string;
    version: string;
  };
  qualification: { missing: string[]; status: 'eligible' | 'ineligible' } | null;
};

type EnterpriseProfileModuleKey =
  | 'account'
  | 'basic'
  | 'certificate'
  | 'contract'
  | 'document'
  | 'employee'
  | 'finance'
  | 'photo'
  | 'property';

type ProfileRecordConfig = {
  fields: Record<string, string>;
  recordType?: string;
  repository: Repository<any>;
};

type ProfileStatItemConfig = {
  attachmentFields?: string[];
  itemName: string;
  moduleKey: EnterpriseProfileModuleKey;
  moduleName: string;
  recordType?: string;
  repository: Repository<any>;
  requiredFields?: string[];
  requiredMinCount: number;
  tabKey: string;
};

type ProfileStatItemPayload = {
  attachmentCount: number;
  isCompleted: boolean;
  itemName: string;
  missingFields: string[];
  moduleKey: EnterpriseProfileModuleKey;
  moduleName: string;
  recordCount: number;
  requiredMinCount: number;
  score: number;
  summary: string;
  tabKey: string;
};

type HighTechProfileGap = {
  actionText: string;
  blocking: boolean;
  description: string;
  itemName: string;
  moduleKey: EnterpriseProfileModuleKey;
  tabKey: string;
};

type HighTechProfileReadiness = {
  gaps: HighTechProfileGap[];
  readyItems: number;
  readinessRate: number;
  status: 'high_risk' | 'needs_completion' | 'ready';
  summary: string;
  totalItems: number;
};

type GaoxinDocumentPackageDraft = {
  content: string;
  fileClass: number;
  key: string;
  missingEvidence: string[];
  recommended: boolean;
  scoreItem: string;
  scoreMax: number;
  title: string;
};

type GaoxinDocumentPackageResult = {
  drafts: GaoxinDocumentPackageDraft[];
  generatedAt: string;
  profileSummary: {
    documentCount: number;
    enterpriseName: string;
    financeYearCount: number;
    rdCount: number;
    researchEmployeeCount: number;
    totalEmployeeCount: number;
    transformationCount: number;
  };
  scoreRules: Array<{
    description: string;
    maxScore: number;
    title: string;
  }>;
  summary: string;
};

type GaoxinDocumentPackageSourceData = {
  basicInfo: EnterpriseBasicInfoEntity | null;
  employeeRows: EnterpriseEmployeeRecordEntity[];
  financeRows: EnterpriseFinanceRecordEntity[];
  rdRows: EnterprisePropertyRecordEntity[];
  transformationRows: EnterprisePropertyRecordEntity[];
};

type ProjectMaterialRequirementItemSeed = {
  attachmentRequired: number;
  isRequired: number;
  itemName: string;
  moduleKey: string;
  requiredCount: number;
  requiredFields: string[];
  requiredYears?: string[];
  requirementDesc: string;
  scoreWeight: number;
  sortOrder: number;
  tabKey: string;
};

type ResolvedProjectMaterialRequirement = {
  items: ProjectMaterialRequirementItemEntity[];
  requirementId: string;
  requirementName: string;
  version: string;
};

const BUILTIN_MATERIAL_TEMPLATES: BuiltinMaterialTemplate[] = [
  {
    description: '用于批量维护员工、科技人员和人力资源申报口径资料，当前版本支持 Excel 导入。',
    fileName: '员工花名册模板.xlsx',
    id: 'employee-info',
    materialType: 'employee_info',
    name: '员工花名册模板',
    required: true,
    version: 'v3',
  },
  {
    content:
      '\uFEFF企业名称,统一社会信用代码,记录类型,年度,销售收入,总资产,净资产,负债,负债率,利润总额,净利润,营业收入,研发费用,高新收入,人员人工,直接投入,折旧摊销,无形资产摊销,设计费,装备调试费,委托研发,其他费用,文件类型,税种/报告类别,文件路径,备注\r\n请填写当前企业名称,请填写18位统一社会信用代码,财务数据,2023,1000.00,2000.00,1200.00,800.00,40%,120.00,100.00,900.00,80.00,500.00,30.00,20.00,10.00,5.00,3.00,2.00,5.00,5.00,,,,示例：金额单位统一为万元，保留两位小数\r\n请填写当前企业名称,请填写18位统一社会信用代码,纳税审计,2023,,,,,,,,,,,,,,,,,,,审计报告,年度审计报告,,示例：附件可先填写文件说明，后续再上传原件\r\n',
    description: '用于批量维护三年财务数据和纳税审计清单，当前版本支持 CSV 导入。',
    fileName: '财务信息模板.csv',
    id: 'finance-info',
    materialType: 'finance_info',
    name: '财务信息模板',
    required: true,
    version: 'v2',
  },
  {
    content:
      '\uFEFF企业名称,统一社会信用代码,知识产权名称,类型,状态,登记号/专利号,申请日期,授权日期,I/II类,权利人,获得方式,发明人/著作权人,核心IP,技术先进程度,核心支持程度,关联RD,关联PS,关联成果,证书文件,备注\r\n请填写当前企业名称,请填写18位统一社会信用代码,示例发明专利,1,2,ZL202400000001,2024-01-01,2025-01-01,I类,本企业,自主研发,张三,是,国内领先,核心产品支撑,1,1,1,,示例行\r\n',
    description: '用于批量维护专利、软著等知识产权信息，当前版本支持 CSV 导入。',
    fileName: '知识产权模板.csv',
    id: 'ip-info',
    materialType: 'intellectual_property',
    name: '知识产权模板',
    required: false,
    version: 'v2',
  },
  {
    content:
      '\uFEFF企业名称,统一社会信用代码,项目名称,项目编号,项目状态,立项日期,结题日期,项目负责人,项目类型,资金来源,项目经费,研发预算,研发费用,组织实施方式,核心技术,创新点,阶段成果,关联IP,关联PS,关联成果,立项报告,项目描述\r\n请填写当前企业名称,请填写18位统一社会信用代码,示例研发项目,RD01,1,2024-01-01,2024-12-31,张三,自主研发,4,100,120,80,项目组制,核心算法,性能提升,形成样机,1,1,1,,示例行\r\n',
    description: '用于批量维护研发项目 RD 信息，当前版本支持 CSV 导入。',
    fileName: '研发项目RD模板.csv',
    id: 'rd-info',
    materialType: 'research_project',
    name: '研发项目 RD 模板',
    required: false,
    version: 'v2',
  },
  {
    content:
      '\uFEFF企业名称,统一社会信用代码,PS编号,产品/服务名称,技术领域,技术来源,上年度收入,高新收入,关键技术,技术指标,竞争优势,关联RD,关联IP,关联成果,关联合同,关联发票,证明材料,备注\r\n请填写当前企业名称,请填写18位统一社会信用代码,PS01,示例高新产品,电子信息,自主研发,500,450,核心技术说明,指标说明,优势说明,1,1,1,1,1,,示例行\r\n',
    description: '用于批量维护高新产品/服务 PS 信息，当前版本支持 CSV 导入。',
    fileName: '高新产品PS模板.csv',
    id: 'ps-info',
    materialType: 'product_service',
    name: '高新产品 PS 模板',
    required: false,
    version: 'v2',
  },
  {
    content:
      '\uFEFF企业名称,统一社会信用代码,成果编号,成果名称,转化方式,转化收入,客户名称,应用场景,关联RD,关联IP,关联PS,关联合同,关联发票,证明材料,备注\r\n请填写当前企业名称,请填写18位统一社会信用代码,CG01,示例成果,产品化,300,示例客户,应用场景说明,1,1,1,1,1,,示例行\r\n',
    description: '用于批量维护成果转化信息，当前版本支持 CSV 导入。',
    fileName: '成果转化模板.csv',
    id: 'transformation-info',
    materialType: 'transformation',
    name: '成果转化模板',
    required: false,
    version: 'v2',
  },
];

const EMPLOYEE_IMPORT_COLUMNS = [
  { header: '员工姓名', key: 'yg_name', width: 16 },
  { header: '性别', key: 'yg_sex', width: 10 },
  { header: '身份证号', key: 'id_card', width: 22 },
  { header: '部门', key: 'department', width: 16 },
  { header: '岗位', key: 'position', width: 16 },
  { header: '入职日期', key: 'entry_date', width: 14 },
  { header: '员工类型', key: 'yg_lx', width: 16 },
  { header: '是否在职', key: 'is_active', width: 12 },
  { header: '是否科技人员', key: 'is_kjyf', width: 14 },
  { header: '参与RD项目', key: 'rd_projects', width: 24 },
  { header: '全年工作天数', key: 'annual_work_days', width: 14 },
  { header: '学历', key: 'yg_xl', width: 14 },
  { header: '职称', key: 'yg_zc', width: 14 },
  { header: '年龄段', key: 'yg_nl', width: 14 },
  { header: '外籍人员', key: 'yg_wj', width: 12 },
  { header: '留学归国人员', key: 'yg_lxgg', width: 14 },
  { header: '千人计划人员', key: 'yg_qr', width: 14 },
  { header: '劳动合同附件', key: 'labor_contract_file', width: 24 },
  { header: '社保附件', key: 'social_security_file', width: 24 },
  { header: '学历附件', key: 'education_file', width: 24 },
  { header: '职称附件', key: 'title_file', width: 24 },
  { header: '员工综合附件', key: 'yg_files', width: 24 },
  { header: '备注', key: 'remark', width: 24 },
] as const;

const BUILTIN_PROJECT_MATERIAL_REQUIREMENT_ITEMS: ProjectMaterialRequirementItemSeed[] = [
  {
    attachmentRequired: 0,
    isRequired: 1,
    itemName: '基本信息',
    moduleKey: 'basic',
    requiredCount: 1,
    requiredFields: ['name', 'creditCode', 'legalPersonName', 'industry'],
    requirementDesc: '企业名称、统一社会信用代码、法定代表人和行业信息应完整。',
    scoreWeight: 1,
    sortOrder: 10,
    tabKey: 'info',
  },
  {
    attachmentRequired: 0,
    isRequired: 1,
    itemName: '财务数据',
    moduleKey: 'finance',
    requiredCount: 1,
    requiredFields: ['year'],
    requirementDesc: '至少需要一条财务年度数据。',
    scoreWeight: 1,
    sortOrder: 20,
    tabKey: 'financial',
  },
  {
    attachmentRequired: 1,
    isRequired: 1,
    itemName: '纳税审计',
    moduleKey: 'finance',
    requiredCount: 1,
    requiredFields: ['year'],
    requirementDesc: '纳税审计材料需要年度和附件文件。',
    scoreWeight: 1,
    sortOrder: 30,
    tabKey: 'taxAudit',
  },
  {
    attachmentRequired: 1,
    isRequired: 1,
    itemName: '员工资料',
    moduleKey: 'employee',
    requiredCount: 1,
    requiredFields: ['ygName'],
    requirementDesc: '需要员工姓名和附件资料。',
    scoreWeight: 1,
    sortOrder: 40,
    tabKey: 'employees',
  },
  {
    attachmentRequired: 1,
    isRequired: 1,
    itemName: '知识产权',
    moduleKey: 'property',
    requiredCount: 1,
    requiredFields: ['softWorkName'],
    requirementDesc: '需要知识产权名称及附件。',
    scoreWeight: 1,
    sortOrder: 50,
    tabKey: 'intellectualProperty',
  },
  {
    attachmentRequired: 1,
    isRequired: 1,
    itemName: '科研项目',
    moduleKey: 'property',
    requiredCount: 1,
    requiredFields: ['kyProjectName'],
    requirementDesc: '需要科研项目名称及附件。',
    scoreWeight: 1,
    sortOrder: 60,
    tabKey: 'researchProject',
  },
  {
    attachmentRequired: 1,
    isRequired: 1,
    itemName: '合同',
    moduleKey: 'contract',
    requiredCount: 1,
    requiredFields: ['htName'],
    requirementDesc: '需要合同名称和合同附件。',
    scoreWeight: 1,
    sortOrder: 70,
    tabKey: 'contracts',
  },
  {
    attachmentRequired: 0,
    isRequired: 1,
    itemName: '发票',
    moduleKey: 'contract',
    requiredCount: 1,
    requiredFields: ['fpNum'],
    requirementDesc: '需要发票号码等基础信息。',
    scoreWeight: 1,
    sortOrder: 80,
    tabKey: 'invoices',
  },
  {
    attachmentRequired: 1,
    isRequired: 1,
    itemName: '制度文件',
    moduleKey: 'document',
    requiredCount: 1,
    requiredFields: ['fileTitle'],
    requirementDesc: '需要制度文件名称和附件。',
    scoreWeight: 1,
    sortOrder: 90,
    tabKey: 'documents',
  },
  {
    attachmentRequired: 1,
    isRequired: 1,
    itemName: '企业证书',
    moduleKey: 'certificate',
    requiredCount: 1,
    requiredFields: ['zsName'],
    requirementDesc: '需要证书名称和附件。',
    scoreWeight: 1,
    sortOrder: 100,
    tabKey: 'certificates',
  },
  {
    attachmentRequired: 1,
    isRequired: 1,
    itemName: '企业照片',
    moduleKey: 'photo',
    requiredCount: 1,
    requiredFields: ['photoTitle'],
    requirementDesc: '需要照片标题和附件。',
    scoreWeight: 1,
    sortOrder: 110,
    tabKey: 'photos',
  },
  {
    attachmentRequired: 0,
    isRequired: 1,
    itemName: '企业账号',
    moduleKey: 'account',
    requiredCount: 1,
    requiredFields: ['ptName', 'zhNumber'],
    requirementDesc: '需要平台开户名称和账号信息。',
    scoreWeight: 1,
    sortOrder: 120,
    tabKey: 'accounts',
  },
];

@Injectable()
export class ClientService {
  constructor(
    @InjectRepository(AiDraftEntity)
    private readonly aiDraftRepo: Repository<AiDraftEntity>,
    @InjectRepository(AiResultEntity)
    private readonly aiResultRepo: Repository<AiResultEntity>,
    @InjectRepository(AiTaskEntity)
    private readonly aiTaskRepo: Repository<AiTaskEntity>,
    private readonly aiService: AiService,
    @InjectRepository(EnterpriseAccountRecordEntity)
    private readonly enterpriseAccountRecordRepo: Repository<EnterpriseAccountRecordEntity>,
    @InjectRepository(ClientDeclarationEntity)
    private readonly clientDeclarationRepo: Repository<ClientDeclarationEntity>,
    @InjectRepository(DeclarationSchemeEntity)
    private readonly declarationSchemeRepo: Repository<DeclarationSchemeEntity>,
    @InjectRepository(DeclarationPresetEntity)
    private readonly declarationPresetRepo: Repository<DeclarationPresetEntity>,
    @InjectRepository(DeclarationMaterialCheckEntity)
    private readonly declarationMaterialCheckRepo: Repository<DeclarationMaterialCheckEntity>,
    @InjectRepository(DeclarationMaterialCheckItemEntity)
    private readonly declarationMaterialCheckItemRepo: Repository<DeclarationMaterialCheckItemEntity>,
    @InjectRepository(EnterpriseCertificateRecordEntity)
    private readonly enterpriseCertificateRecordRepo: Repository<EnterpriseCertificateRecordEntity>,
    @InjectRepository(ClientUserProfileEntity)
    private readonly clientUserProfileRepo: Repository<ClientUserProfileEntity>,
    @InjectRepository(EnterpriseContactEntity)
    private readonly enterpriseContactRepo: Repository<EnterpriseContactEntity>,
    @InjectRepository(EnterpriseContractRecordEntity)
    private readonly enterpriseContractRecordRepo: Repository<EnterpriseContractRecordEntity>,
    @InjectRepository(EnterpriseDocumentRecordEntity)
    private readonly enterpriseDocumentRecordRepo: Repository<EnterpriseDocumentRecordEntity>,
    @InjectRepository(EnterpriseEmployeeRecordEntity)
    private readonly enterpriseEmployeeRecordRepo: Repository<EnterpriseEmployeeRecordEntity>,
    @InjectRepository(EnterpriseBasicInfoEntity)
    private readonly enterpriseBasicInfoRepo: Repository<EnterpriseBasicInfoEntity>,
    @InjectRepository(EnterpriseEntity)
    private readonly enterpriseRepo: Repository<EnterpriseEntity>,
    @InjectRepository(EnterpriseFinanceRecordEntity)
    private readonly enterpriseFinanceRecordRepo: Repository<EnterpriseFinanceRecordEntity>,
    @InjectRepository(EnterpriseMaterialEntity)
    private readonly enterpriseMaterialRepo: Repository<EnterpriseMaterialEntity>,
    @InjectRepository(EnterpriseMaterialParseErrorEntity)
    private readonly enterpriseMaterialParseErrorRepo: Repository<EnterpriseMaterialParseErrorEntity>,
    @InjectRepository(EnterpriseOwnerEntity)
    private readonly enterpriseOwnerRepo: Repository<EnterpriseOwnerEntity>,
    @InjectRepository(EnterprisePersonEntity)
    private readonly enterprisePersonRepo: Repository<EnterprisePersonEntity>,
    @InjectRepository(EnterprisePhotoRecordEntity)
    private readonly enterprisePhotoRecordRepo: Repository<EnterprisePhotoRecordEntity>,
    @InjectRepository(EnterpriseProfileStatEntity)
    private readonly enterpriseProfileStatRepo: Repository<EnterpriseProfileStatEntity>,
    @InjectRepository(EnterpriseProfileStatItemEntity)
    private readonly enterpriseProfileStatItemRepo: Repository<EnterpriseProfileStatItemEntity>,
    @InjectRepository(EnterprisePropertyRecordEntity)
    private readonly enterprisePropertyRecordRepo: Repository<EnterprisePropertyRecordEntity>,
    @InjectRepository(GaoxinBookDraftEntity)
    private readonly gaoxinBookDraftRepo: Repository<GaoxinBookDraftEntity>,
    @InjectRepository(EnterpriseTeacherEntity)
    private readonly enterpriseTeacherRepo: Repository<EnterpriseTeacherEntity>,
    @InjectRepository(EnterpriseUserEntity)
    private readonly enterpriseUserRepo: Repository<EnterpriseUserEntity>,
    @InjectRepository(PolicyProjectEntity)
    private readonly policyProjectRepo: Repository<PolicyProjectEntity>,
    @InjectRepository(PolicyCollectNotificationEntity)
    private readonly policyCollectNotificationRepo: Repository<PolicyCollectNotificationEntity>,
    @InjectRepository(ProjectMaterialRequirementEntity)
    private readonly projectMaterialRequirementRepo: Repository<ProjectMaterialRequirementEntity>,
    @InjectRepository(ProjectMaterialRequirementItemEntity)
    private readonly projectMaterialRequirementItemRepo: Repository<ProjectMaterialRequirementItemEntity>,
    @InjectRepository(RegionEntity)
    private readonly regionRepo: Repository<RegionEntity>,
    @InjectRepository(RegionPolicyFileEntity)
    private readonly regionPolicyFileRepo: Repository<RegionPolicyFileEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepo: Repository<UserRoleEntity>,
    private readonly userRepository: UserRepository,
    private readonly enterpriseProfileService: EnterpriseProfileService,
    private readonly iamCompanyScope: IamCompanyScopeService,
  ) {}

  async getClientMe(userId: number) {
    const [user, profile] = await Promise.all([
      this.requireUser(userId),
      this.getOrCreateClientUserProfile(userId),
    ]);

    return this.toClientMe(user, profile);
  }

  async updateClientMe(userId: number, input: UpdateClientMeDto) {
    const [user, profile] = await Promise.all([
      this.requireUser(userId),
      this.getOrCreateClientUserProfile(userId),
    ]);

    const nextRealName =
      input.realName !== undefined ? input.realName : input.name;
    if (nextRealName !== undefined) {
      user.realName = this.normalizeRequiredText(nextRealName, '姓名不能为空');
    }

    const nextPhone = input.phone !== undefined ? input.phone : input.mobile;
    if (nextPhone !== undefined) {
      const normalizedPhone = this.toNullableString(nextPhone);
      if (normalizedPhone && normalizedPhone !== user.phone) {
        const exists = await this.userRepository.findByPhone(normalizedPhone);
        if (exists && String(exists.id) !== String(user.id)) {
          throw new BadRequestException('手机号已被其他账号占用');
        }
      }
      user.phone = normalizedPhone;
    }

    if (input.email !== undefined) {
      const normalizedEmail = this.toNullableString(input.email);
      if (normalizedEmail && normalizedEmail !== user.email) {
        const exists = await this.userRepository.findByEmail(normalizedEmail);
        if (exists && String(exists.id) !== String(user.id)) {
          throw new BadRequestException('邮箱已被其他账号占用');
        }
      }
      user.email = normalizedEmail;
    }

    if (input.position !== undefined) {
      profile.position = this.toNullableString(input.position);
    }
    if (input.roleInCompany !== undefined) {
      profile.roleName = this.toNullableString(input.roleInCompany);
    }

    const [savedUser, savedProfile] = await Promise.all([
      this.userRepository.save(user),
      this.clientUserProfileRepo.save(profile),
    ]);

    return this.toClientMe(savedUser, savedProfile);
  }

  async getClientCompanies(userId: number): Promise<ClientCompanyItem[]> {
    const context = await this.resolveCompanyContext(userId);
    return context.companies.map((item) =>
      this.toClientCompany(item, context.currentEnterpriseId),
    );
  }

  async getCurrentClientCompany(
    userId: number,
  ): Promise<ClientCompanyItem | null> {
    const context = await this.resolveCompanyContext(userId);
    if (!context.currentEnterpriseId) {
      return null;
    }

    const currentCompany = context.companies.find(
      (item) => String(item.enterprise.id) === context.currentEnterpriseId,
    );
    return currentCompany
      ? this.toClientCompany(currentCompany, context.currentEnterpriseId)
      : null;
  }

  async switchCurrentClientCompany(
    user: CurrentUser,
    input: SwitchCurrentCompanyDto,
  ): Promise<ClientCompanyItem> {
    const companyId = input.companyId?.trim() || input.enterpriseId?.trim();
    if (!companyId) {
      throw new BadRequestException('缺少 companyId');
    }

    const context = await this.resolveCompanyContext(user.id);
    const target = context.companies.find(
      (item) => String(item.enterprise.id) === companyId,
    );
    if (!target) {
      throw new BadRequestException('当前账号无权切换到该企业');
    }

    await this.iamCompanyScope.setDefaultCompany(
      user,
      String(target.enterprise.id),
    );
    context.profile.currentEnterpriseId = String(target.enterprise.id);
    await this.clientUserProfileRepo.save(context.profile);

    return this.toClientCompany(target, String(target.enterprise.id));
  }

  async bindClientCompany(userId: number, input: BindCompanyDto, roles: string[] = []) {
    throw new ForbiddenException('企业档案由总负责人统一建档并分发，请联系管理人员');
  }

  async getClientEnterpriseProfile(userId: number) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.enterpriseProfileService.detail(enterpriseId);
  }

  async updateClientEnterpriseProfile(
    userId: number,
    input: UpdateClientEnterpriseProfileDto,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.enterpriseProfileService.update(
      enterpriseId,
      input as EnterpriseInput,
    );
  }

  async getClientEnterpriseBasicProfile(
    userId: number,
  ): Promise<ClientEnterpriseBasicProfile> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.getClientEnterpriseBasicProfileByEnterpriseId(enterpriseId);
  }

  async updateClientEnterpriseBasicProfile(
    userId: number,
    input: SaveClientEnterpriseBasicProfileDto,
  ): Promise<ClientEnterpriseBasicProfile> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const enterprise = await this.enterpriseRepo.findOne({
      where: { id: enterpriseId },
    });
    if (!enterprise) {
      throw new NotFoundException('企业不存在');
    }

    const basicInfo =
      (await this.enterpriseBasicInfoRepo.findOne({
        where: { enterpriseId },
      })) ??
      this.enterpriseBasicInfoRepo.create({
        enterpriseId,
        name: enterprise.name,
      });
    const extra = this.getClientBasicProfileExtra(basicInfo);

    const companyName = this.toNullableString(input.company_name) ?? enterprise.name;
    const taxId = this.toNullableString(input.tax_id) ?? enterprise.creditCode;
    const registerType = this.toNullableString(input.register_type);
    const address = this.toNullableString(input.company_address);
    const legalPersonName = this.toNullableString(input.le_person_name);
    const contactName = this.toNullableString(input.contacts_name);
    const contactPhone =
      this.toNullableString(input.contacts_phone) ??
      this.toNullableString(input.contacts_mobile);
    const contactEmail = this.toNullableString(input.contacts_email);
    const industry = this.toNullableString(input.js_areas);

    Object.assign(enterprise, {
      address,
      contactEmail,
      contactName,
      contactPhone,
      creditCode: taxId ?? undefined,
      enterpriseType: registerType,
      industry,
      legalPerson: legalPersonName,
      name: companyName,
    });
    await this.enterpriseProfileService.update(enterpriseId, {
      address,
      contactEmail,
      contactName,
      contactPhone,
      creditCode: taxId ?? undefined,
      enterpriseType: registerType,
      industry,
      legalPerson: legalPersonName,
      name: companyName,
    });

    Object.assign(basicInfo, {
      creditCode: taxId ?? undefined,
      email: contactEmail,
      establishTime: this.parseClientDate(input.register_date),
      industry,
      legalPersonName,
      name: companyName,
      phoneNumber: contactPhone,
      regCapital: this.toNullableNumericString(input.register_capital),
      regLocation: address,
      taxNumber: taxId,
      companyOrgType: registerType,
    });
    basicInfo.extraJson = JSON.stringify({
      ...this.parseJsonObject(basicInfo.extraJson),
      clientBasicProfile: {
        ...extra,
        companyIntro: this.toNullableString(input.companyIntro),
        contacts_fax: this.toNullableString(input.contacts_fax),
        contacts_idcard: this.toNullableString(input.contacts_idcard),
        contacts_mobile: this.toNullableString(input.contacts_mobile),
        is_invest: this.normalizeNullableFlag(input.is_invest),
        is_ipo: this.normalizeNullableFlag(input.is_ipo),
        le_person_idcard: this.toNullableString(input.le_person_idcard),
        le_person_phone: this.toNullableString(input.le_person_phone),
        listedCode: this.toNullableString(input.listedCode),
        main_areas: this.normalizeMainAreas(input.main_areas),
        vcAmount: this.toNullableNumber(input.vcAmount),
        zip_code: this.toNullableString(input.zip_code),
      },
    });
    await this.enterpriseBasicInfoRepo.save(basicInfo);

    await this.upsertDefaultEnterpriseContact(enterpriseId, {
      email: contactEmail,
      name: contactName,
      phone: contactPhone,
    });

    if (Array.isArray(input.shareholders)) {
      await this.replaceClientEnterpriseShareholders(
        enterpriseId,
        input.shareholders,
      );
    }

    await this.recalculateClientEnterpriseProfileStats(userId);
    return this.getClientEnterpriseBasicProfileByEnterpriseId(enterpriseId);
  }

  async listClientEnterpriseShareholders(
    userId: number,
  ): Promise<ClientEnterpriseShareholder[]> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const shareholders = await this.enterprisePersonRepo.find({
      order: { id: 'ASC' },
      where: {
        enterpriseId,
        personType: 'shareholder',
      },
    });

    return shareholders.map((item) => this.toClientEnterpriseShareholder(item));
  }

  async createClientEnterpriseShareholder(
    userId: number,
    input: SaveClientEnterpriseShareholderDto,
  ): Promise<ClientEnterpriseShareholder> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const saved = await this.enterprisePersonRepo.save(
      this.enterprisePersonRepo.create(
        this.toClientEnterpriseShareholderEntityData(enterpriseId, input),
      ),
    );
    await this.recalculateClientEnterpriseProfileStats(userId);
    return this.toClientEnterpriseShareholder(saved);
  }

  async updateClientEnterpriseShareholder(
    userId: number,
    id: string,
    input: SaveClientEnterpriseShareholderDto,
  ): Promise<ClientEnterpriseShareholder> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const shareholder = await this.requireClientEnterpriseShareholder(
      enterpriseId,
      id,
    );
    Object.assign(
      shareholder,
      this.toClientEnterpriseShareholderEntityData(enterpriseId, input),
    );
    const saved = await this.enterprisePersonRepo.save(shareholder);
    await this.recalculateClientEnterpriseProfileStats(userId);
    return this.toClientEnterpriseShareholder(saved);
  }

  async deleteClientEnterpriseShareholder(
    userId: number,
    id: string,
  ): Promise<void> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const shareholder = await this.requireClientEnterpriseShareholder(
      enterpriseId,
      id,
    );
    await this.enterprisePersonRepo.delete({ id: shareholder.id });
    await this.recalculateClientEnterpriseProfileStats(userId);
  }

  async getClientEnterpriseContacts(userId: number) {
    const enterpriseId = await this.getCurrentEnterpriseIdOrNull(userId);
    if (!enterpriseId) {
      return [];
    }

    const rows = await this.enterpriseContactRepo.find({
      order: {
        isDefault: 'DESC',
        id: 'ASC',
      },
      where: {
        enterpriseId,
        status: 1,
      },
    });

    return rows.map((item) => this.toClientEnterpriseContact(item));
  }

  async createClientEnterpriseContact(
    userId: number,
    input: SaveClientEnterpriseContactDto,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const shouldBeDefault =
      input.isDefault === true ||
      (await this.enterpriseContactRepo.count({
        where: {
          enterpriseId,
          status: 1,
        },
      })) === 0;

    if (shouldBeDefault) {
      await this.clearDefaultContacts(enterpriseId);
    }

    const saved = await this.enterpriseContactRepo.save(
      this.enterpriseContactRepo.create({
        email: this.toNullableString(input.email),
        enterpriseId,
        isDefault: shouldBeDefault ? 1 : 0,
        name: this.normalizeRequiredText(input.name, '联系人姓名不能为空'),
        phone: this.toNullableString(input.phone),
        position: this.toNullableString(input.position),
        remark: this.toNullableString(input.remark),
        roleName: this.toNullableString(input.roleName),
        status: 1,
      }),
    );

    return this.toClientEnterpriseContact(saved);
  }

  async updateClientEnterpriseContact(
    userId: number,
    id: string,
    input: SaveClientEnterpriseContactDto,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const entity = await this.enterpriseContactRepo.findOne({
      where: {
        enterpriseId,
        id,
        status: 1,
      },
    });
    if (!entity) {
      throw new NotFoundException('联系人不存在');
    }

    entity.name = this.normalizeRequiredText(input.name, '联系人姓名不能为空');
    entity.phone = this.toNullableString(input.phone);
    entity.email = this.toNullableString(input.email);
    entity.position = this.toNullableString(input.position);
    entity.roleName = this.toNullableString(input.roleName);
    entity.remark = this.toNullableString(input.remark);

    if (input.isDefault === true) {
      await this.clearDefaultContacts(enterpriseId, String(entity.id));
      entity.isDefault = 1;
    } else if (input.isDefault === false) {
      entity.isDefault = 0;
    }

    return this.toClientEnterpriseContact(
      await this.enterpriseContactRepo.save(entity),
    );
  }

  getClientMaterialTemplates() {
    return BUILTIN_MATERIAL_TEMPLATES.map((item) => ({
      description: item.description,
      fileName: item.fileName,
      id: item.id,
      materialType: item.materialType,
      name: item.name,
      required: item.required,
      updateTime: '',
      version: item.version,
    }));
  }

  async downloadClientMaterialTemplate(
    id: string,
    response: Response,
  ): Promise<void> {
    const template = this.requireBuiltinTemplate(id);
    if (template.id === 'employee-info') {
      await this.sendEmployeeTemplateWorkbook(response, template);
      return;
    }

    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(template.fileName)}`,
    );
    response.send(Buffer.from(template.content ?? '', 'utf8'));
  }

  async uploadClientMaterial(
    userId: number,
    templateId: string,
    file: StoredUploadFile,
    request?: Request,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const template = this.requireBuiltinTemplate(templateId);
    const filePath = normalizeStoredUploadPath(file.path);
    if (!filePath) {
      throw new BadRequestException('上传文件路径无效');
    }

    let saved = await this.enterpriseMaterialRepo.save(
      this.enterpriseMaterialRepo.create({
        enterpriseId,
        errorCount: 0,
        fileName: file.originalname,
        filePath,
        materialType: template.materialType,
        remark: null,
        status: 'uploaded',
        templateId: template.id,
        templateName: template.name,
      }),
    );

    if (template.id === 'finance-info') {
      await this.importFinanceMaterial(userId, enterpriseId, saved, file);
      saved = await this.enterpriseMaterialRepo.findOneOrFail({
        where: {
          id: saved.id,
        },
      });
    }

    if (template.id === 'employee-info') {
      await this.importEmployeeMaterial(userId, enterpriseId, saved, file);
      saved = await this.enterpriseMaterialRepo.findOneOrFail({
        where: {
          id: saved.id,
        },
      });
    }

    if (
      ['ip-info', 'rd-info', 'ps-info', 'transformation-info'].includes(
        template.id,
      )
    ) {
      await this.importPropertyMaterial(userId, enterpriseId, saved, file, template.id);
      saved = await this.enterpriseMaterialRepo.findOneOrFail({
        where: {
          id: saved.id,
        },
      });
    }

    return this.toClientMaterialRecord(saved, request);
  }

  async downloadEnterpriseMaterialTemplate(
    id: string,
    response: Response,
  ): Promise<void> {
    await this.downloadClientMaterialTemplate(id, response);
  }

  getEnterpriseMaterialTemplates() {
    return this.getClientMaterialTemplates();
  }

  async uploadEnterpriseMaterial(
    enterpriseId: string,
    templateId: string,
    file: StoredUploadFile,
    request?: Request,
  ) {
    await this.assertUploadedFilesBelongToEnterprise(enterpriseId, [file], 'material');
    const template = this.requireBuiltinTemplate(templateId);
    const filePath = normalizeStoredUploadPath(file.path);
    if (!filePath) {
      throw new BadRequestException('上传文件路径无效');
    }

    let saved = await this.enterpriseMaterialRepo.save(
      this.enterpriseMaterialRepo.create({
        enterpriseId,
        errorCount: 0,
        fileName: file.originalname,
        filePath,
        materialType: template.materialType,
        remark: null,
        status: 'uploaded',
        templateId: template.id,
        templateName: template.name,
      }),
    );

    if (template.id === 'finance-info') {
      await this.importFinanceMaterial(0, enterpriseId, saved, file);
    } else if (template.id === 'employee-info') {
      await this.importEmployeeMaterial(0, enterpriseId, saved, file);
    } else if (
      ['ip-info', 'rd-info', 'ps-info', 'transformation-info'].includes(
        template.id,
      )
    ) {
      await this.importPropertyMaterial(0, enterpriseId, saved, file, template.id);
    }

    saved = await this.enterpriseMaterialRepo.findOneOrFail({
      where: { id: saved.id },
    });
    await this.recalculateEnterpriseProfileStats(enterpriseId);
    return this.toClientMaterialRecord(saved, request);
  }

  async getEnterpriseMaterials(enterpriseId: string, request?: Request) {
    const rows = await this.enterpriseMaterialRepo.find({
      order: { id: 'DESC' },
      where: { enterpriseId },
    });
    return rows.map((item) => this.toClientMaterialRecord(item, request));
  }

  async previewClientEmployeeImport(
    userId: number,
    file: StoredUploadFile,
  ): Promise<EmployeeImportPreviewResult> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.previewEnterpriseEmployeeImport(enterpriseId, file);
  }

  async previewEnterpriseEmployeeImport(
    enterpriseId: string,
    file: StoredUploadFile,
  ): Promise<EmployeeImportPreviewResult> {
    await this.assertUploadedFilesBelongToEnterprise(enterpriseId, [file], 'employee');
    const template = this.requireBuiltinTemplate('employee-info');
    const filePath = normalizeStoredUploadPath(file.path);
    if (!filePath) {
      throw new BadRequestException('上传文件路径无效');
    }

    const material = await this.enterpriseMaterialRepo.save(
      this.enterpriseMaterialRepo.create({
        enterpriseId,
        errorCount: 0,
        fileName: file.originalname,
        filePath,
        materialType: template.materialType,
        remark: null,
        status: 'review_required',
        templateId: template.id,
        templateName: template.name,
      }),
    );

    return this.buildAndPersistEmployeeImportPreview(enterpriseId, material, file);
  }

  async confirmClientEmployeeImport(
    userId: number,
    input: { materialId?: string; skippedKeys?: string[] },
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.confirmEnterpriseEmployeeImport(enterpriseId, input);
  }

  async confirmEnterpriseEmployeeImport(
    enterpriseId: string,
    input: { materialId?: string; skippedKeys?: string[] },
  ) {
    const materialId = String(input.materialId ?? '').trim();
    if (!materialId) {
      throw new BadRequestException('缺少员工导入预览 ID');
    }

    const material = await this.enterpriseMaterialRepo.findOne({
      where: {
        enterpriseId,
        id: materialId,
        templateId: 'employee-info',
      },
    });
    if (!material) {
      throw new NotFoundException('员工导入预览不存在');
    }

    const preview = await this.buildEmployeeImportPreview(enterpriseId, {
      filename: basename(material.filePath ?? ''),
      originalname: material.fileName ?? '员工花名册.xlsx',
      path: material.filePath ?? undefined,
      size: 0,
    });

    const skippedKeys = new Set((input.skippedKeys ?? []).map(String));
    const rows = preview.rows.map((row) =>
      skippedKeys.has(row.key) && row.importable
        ? { ...row, action: 'skip' as const, importable: false }
        : row,
    );
    let employeeCount = 0;
    let createCount = 0;
    let updateCount = 0;

    for (const row of rows) {
      if (!row.importable || row.action === 'skip') {
        continue;
      }
      const result = await this.upsertEmployeeImportData(enterpriseId, row.data);
      employeeCount += 1;
      if (result.action === 'create') {
        createCount += 1;
      } else {
        updateCount += 1;
      }
    }

    const errorRows = rows.filter((row) => row.errors.length > 0);
    const skippedCount = rows.filter((row) => row.action === 'skip').length;
    const summary: EmployeeImportSummary = {
      createCount,
      employeeCount,
      errorCount: errorRows.length,
      importableCount: employeeCount,
      skippedCount,
      status:
        errorRows.length === 0
          ? 'valid'
          : employeeCount > 0
            ? 'partial'
            : 'invalid',
      updateCount,
    };

    await this.enterpriseMaterialParseErrorRepo.delete({
      enterpriseId,
      materialId: material.id,
    });
    await this.persistEmployeeImportResult(
      enterpriseId,
      material,
      errorRows.flatMap((row) => row.errors),
      summary,
    );
    if (employeeCount > 0) {
      await this.recalculateEnterpriseProfileStats(enterpriseId);
    }

    return {
      materialId: String(material.id),
      summary,
    };
  }

  async uploadClientFinanceAiParseFiles(
    userId: number,
    files: StoredUploadFile[],
    request?: Request,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.uploadEnterpriseFinanceAiParseFiles(
      enterpriseId,
      String(userId),
      files,
      request,
    );
  }

  async uploadEnterpriseFinanceAiParseFiles(
    enterpriseId: string,
    operatorId: string,
    files: StoredUploadFile[],
    request?: Request,
  ) {
    const validFiles = files.filter((file) => file.originalname);
    if (validFiles.length === 0) {
      throw new BadRequestException('请上传至少一个财税文件');
    }
    await this.assertUploadedFilesBelongToEnterprise(enterpriseId, validFiles, 'finance');

    const task = await this.aiTaskRepo.save(
      this.aiTaskRepo.create({
        bizId: enterpriseId,
        bizType: 'enterprise',
        createdBy: operatorId,
        inputSnapshot: JSON.stringify({
          files: validFiles.map((file) => ({
            name: file.originalname,
            size: file.size,
          })),
        }),
        scene: 'finance_ai_parse',
        status: 'processing',
      }),
    );

    const draftInputs: Array<{
      material: EnterpriseMaterialEntity;
      payload: FinanceAiParseDraftPayload;
    }> = [];
    for (const file of validFiles) {
      const filePath = normalizeStoredUploadPath(file.path);
      if (!filePath) {
        throw new BadRequestException(`上传文件路径无效：${file.originalname}`);
      }

      const material = await this.enterpriseMaterialRepo.save(
        this.enterpriseMaterialRepo.create({
          enterpriseId,
          errorCount: 0,
          fileName: file.originalname,
          filePath,
          materialType: 'finance_ai_parse',
          remark: JSON.stringify({
            source: 'finance_ai_parse',
            taskId: String(task.id),
          }),
          status: 'uploaded',
          templateId: 'finance-ai-parse',
          templateName: '财税 AI 解析文件',
        }),
      );
      const payload = await this.buildFinanceAiParseDraftPayload(
        enterpriseId,
        material,
        file,
        String(task.id),
        request,
      );
      if (!payload) {
        continue;
      }
      draftInputs.push({ material, payload });
    }

    const drafts: AiDraftEntity[] = [];
    for (const draftInput of this.mergeFinanceAiParseDraftInputs(draftInputs)) {
      drafts.push(
        await this.aiDraftRepo.save(
          this.aiDraftRepo.create({
            draftPayload: JSON.stringify(draftInput.payload),
            draftType: 'finance_ai_parse',
            enterpriseId,
            sourceIds: JSON.stringify(draftInput.sourceIds),
            status: 'reviewing',
            taskId: String(task.id),
          }),
        ),
      );
    }

    if (drafts.length === 0) {
      await this.markClientPropertyAiTaskFailed(
        task,
        '未识别到可写入的财务数据，请更换清晰图片、PDF 文本版或标准财务表格后重试',
      );
      throw new BadRequestException(
        '未识别到可写入的财务数据，请更换清晰图片、PDF 文本版或标准财务表格后重试',
      );
    }

    await this.saveClientPropertyAiResult(task, {
      confidence: this.resolveDraftsConfidenceLabel(
        drafts.map((draft) => this.parseJsonObject(draft.draftPayload)),
      ),
      structuredResult: {
        adapter: 'finance-file-parser',
        records: drafts.map((draft) => this.parseJsonObject(draft.draftPayload)),
      },
      summary: `已生成 ${drafts.length} 条财税待确认草稿`,
    });

    return {
      drafts: drafts.map((draft) => this.toClientFinanceAiDraftItem(draft, request)),
      taskId: String(task.id),
      total: drafts.length,
    };
  }

  private mergeFinanceAiParseDraftInputs(
    draftInputs: Array<{
      material: EnterpriseMaterialEntity;
      payload: FinanceAiParseDraftPayload;
    }>,
  ): Array<{ payload: FinanceAiParseDraftPayload; sourceIds: string[] }> {
    const grouped = new Map<string, typeof draftInputs>();

    for (const draftInput of draftInputs) {
      const { payload } = draftInput;
      const key = payload.documentType === 'financial_statement'
        ? `financial_statement:${payload.year}`
        : `single:${draftInput.material.id}`;
      grouped.set(key, [...(grouped.get(key) ?? []), draftInput]);
    }

    return [...grouped.values()].map((items) => {
      if (items.length === 1) {
        const item = items[0]!;
        return { payload: item.payload, sourceIds: [String(item.material.id)] };
      }

      const financial: Record<string, unknown> = {};
      const warnings = new Set<string>();
      for (const { payload } of items) {
        payload.reviewWarnings.forEach((warning) => warnings.add(warning));
        for (const [field, value] of Object.entries(payload.financial ?? {})) {
          if (!this.isFilledValue(financial[field]) && this.isFilledValue(value)) {
            financial[field] = value;
          }
        }
      }

      const sourceFileNames = [...new Set(items.map(({ payload }) => payload.sourceFileName))];
      warnings.add(`已合并同年度财务报表：${sourceFileNames.join('、')}。`);
      const first = items[0]!;
      const parseStatus = items.some(({ payload }) => payload.parseStatus === 'success')
        ? 'success'
        : items.some(({ payload }) => payload.parseStatus === 'partial')
          ? 'partial'
          : 'review_required';

      return {
        payload: {
          ...first.payload,
          confidence: Math.max(...items.map(({ payload }) => payload.confidence)),
          financial,
          parseStatus,
          reviewWarnings: [...warnings],
          sourceFileName: sourceFileNames.join('、'),
        },
        sourceIds: items.map(({ material }) => String(material.id)),
      };
    });
  }

  async listClientFinanceAiParseDrafts(userId: number, request?: Request) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.listEnterpriseFinanceAiParseDrafts(enterpriseId, request);
  }

  async listEnterpriseFinanceAiParseDrafts(
    enterpriseId: string,
    request?: Request,
  ) {
    const rows = await this.aiDraftRepo.find({
      order: {
        id: 'DESC',
      },
      where: {
        draftType: 'finance_ai_parse',
        enterpriseId,
        status: Not('approved'),
      },
    });

    return {
      items: rows.map((draft) => this.toClientFinanceAiDraftItem(draft, request)),
      total: rows.length,
    };
  }

  async updateEnterpriseFinanceAiParseDraft(
    enterpriseId: string,
    id: string,
    input: UpdateClientAiDraftDto,
    request?: Request,
  ): Promise<ClientAiDraftItem> {
    const draft = await this.requireClientAiDraft(enterpriseId, id, 'finance_ai_parse');
    if (draft.status === 'approved') {
      throw new BadRequestException('已入库的财税草稿不能修改');
    }

    const payload = {
      ...this.parseJsonObject(draft.draftPayload),
      ...input.data,
    } as FinanceAiParseDraftPayload;
    const year = String(payload.year ?? '').trim();
    if (!/^\d{4}$/u.test(year)) {
      throw new BadRequestException('年度必须为 4 位年份');
    }
    payload.year = year;
    payload.financial = this.readRecordObject(payload.financial);
    payload.taxAudit = this.readRecordObject(payload.taxAudit);
    payload.reviewWarnings = this.readStringArrayFromUnknown(payload.reviewWarnings, []);
    draft.draftPayload = JSON.stringify(payload);
    draft.status = 'reviewing';
    return this.toClientFinanceAiDraftItem(await this.aiDraftRepo.save(draft), request);
  }

  async rejectEnterpriseFinanceAiParseDrafts(
    enterpriseId: string,
    reviewedBy: string,
    input: ApproveClientAiDraftsDto,
  ) {
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)).filter(Boolean))];
    if (ids.length === 0) {
      throw new BadRequestException('请选择要作废的财税草稿');
    }

    const rows = await this.aiDraftRepo.find({
      where: { draftType: 'finance_ai_parse', enterpriseId, id: In(ids) },
    });
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    const failed = ids
      .filter((id) => !rowsById.has(id))
      .map((draftId) => ({ draftId, reason: '财税草稿不存在或已被删除' }));
    const success: Array<{ draftId: string }> = [];

    for (const draft of rows) {
      if (draft.status === 'approved') {
        failed.push({ draftId: String(draft.id), reason: '已入库草稿不能作废' });
        continue;
      }
      draft.reviewedAt = new Date();
      draft.reviewedBy = reviewedBy;
      draft.status = 'rejected';
      await this.aiDraftRepo.save(draft);
      success.push({ draftId: String(draft.id) });
    }

    return { failed, success, total: ids.length };
  }

  async retryEnterpriseFinanceAiParseDrafts(
    enterpriseId: string,
    input: ApproveClientAiDraftsDto,
    request?: Request,
  ) {
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)).filter(Boolean))];
    if (ids.length === 0) {
      throw new BadRequestException('请选择要重新识别的财税草稿');
    }

    const rows = await this.aiDraftRepo.find({
      where: { draftType: 'finance_ai_parse', enterpriseId, id: In(ids) },
    });
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    const failed = ids
      .filter((id) => !rowsById.has(id))
      .map((draftId) => ({ draftId, reason: '财税草稿不存在或已被删除' }));
    const success: ClientAiDraftItem[] = [];

    for (const draft of rows) {
      if (draft.status === 'approved') {
        failed.push({ draftId: String(draft.id), reason: '已入库草稿不能重新识别' });
        continue;
      }
      const currentPayload = this.parseJsonObject(draft.draftPayload) as FinanceAiParseDraftPayload;
      const materialIds = this.parseAiDraftSourceIds(draft.sourceIds);
      if (materialIds.length === 0 && currentPayload.sourceMaterialId) {
        materialIds.push(currentPayload.sourceMaterialId);
      }
      const materials = materialIds.length > 0
        ? await this.enterpriseMaterialRepo.find({ where: { enterpriseId, id: In(materialIds) } })
        : [];
      if (
        materials.length !== materialIds.length ||
        materials.some((material) => !material.filePath)
      ) {
        failed.push({ draftId: String(draft.id), reason: '未找到可重新识别的源文件' });
        continue;
      }
      if (!draft.taskId) {
        failed.push({ draftId: String(draft.id), reason: '草稿缺少可用的识别任务' });
        continue;
      }
      const draftInputs: Array<{
        material: EnterpriseMaterialEntity;
        payload: FinanceAiParseDraftPayload;
      }> = [];
      for (const material of materials) {
        const filePath = this.resolveStoredFileAbsolutePath(material.filePath!);
        if (!filePath) {
          continue;
        }
        const payload = await this.buildFinanceAiParseDraftPayload(
          enterpriseId,
          material,
          { originalname: material.fileName, path: filePath } as StoredUploadFile,
          String(draft.taskId),
          request,
        );
        if (payload) {
          draftInputs.push({ material, payload });
        }
      }
      const mergedDraft = this.mergeFinanceAiParseDraftInputs(draftInputs)[0];
      if (!mergedDraft) {
        failed.push({ draftId: String(draft.id), reason: '未识别到可用的财税字段' });
        continue;
      }
      draft.draftPayload = JSON.stringify(mergedDraft.payload);
      draft.sourceIds = JSON.stringify(mergedDraft.sourceIds);
      draft.status = 'reviewing';
      draft.reviewedAt = null;
      draft.reviewedBy = null;
      success.push(this.toClientFinanceAiDraftItem(await this.aiDraftRepo.save(draft), request));
    }

    return { failed, success, total: ids.length };
  }

  async deleteEnterpriseFinanceAiParseDraft(enterpriseId: string, id: string) {
    const draft = await this.requireClientAiDraft(enterpriseId, id, 'finance_ai_parse');
    await this.aiDraftRepo.delete({ enterpriseId, id: draft.id });
    return { draftId: String(draft.id), success: true };
  }

  async deleteEnterpriseWorkspaceAiTask(enterpriseId: string, id: string) {
    const task = await this.aiTaskRepo.findOne({
      where: { bizId: enterpriseId, bizType: 'enterprise', id },
    });
    if (!task) {
      throw new NotFoundException('后台任务不存在或不属于当前企业');
    }
    if (task.status !== 'failed') {
      throw new BadRequestException('仅处理失败的后台任务可以删除');
    }

    await this.aiTaskRepo.remove(task);
    return { taskId: String(task.id), success: true };
  }

  async rejectClientFinanceAiParseDrafts(
    userId: number,
    input: ApproveClientAiDraftsDto,
  ) {
    return this.rejectClientPropertyGenerationDrafts(
      userId,
      input,
      'finance_ai_parse',
      '财税解析草稿',
    );
  }

  async deleteClientFinanceAiParseDraft(userId: number, id: string) {
    return this.deleteClientPropertyGenerationDraft(
      userId,
      id,
      'finance_ai_parse',
      '财税解析草稿',
    );
  }

  async approveClientFinanceAiParseDrafts(
    userId: number,
    input: ApproveClientAiDraftsDto,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.approveEnterpriseFinanceAiParseDrafts(
      enterpriseId,
      String(userId),
      input,
    );
  }

  async approveEnterpriseFinanceAiParseDrafts(
    enterpriseId: string,
    reviewedBy: string,
    input: ApproveClientAiDraftsDto,
  ) {
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)).filter(Boolean))];
    if (ids.length === 0) {
      throw new BadRequestException('请选择要确认替换的财税解析草稿');
    }

    const rows = await this.aiDraftRepo.find({
      where: {
        draftType: 'finance_ai_parse',
        enterpriseId,
        id: In(ids),
      },
    });
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    const success: Array<{ draftId: string; recordIds: string[] }> = [];
    const failed: Array<{ draftId: string; reason: string }> = [];

    for (const id of ids) {
      const draft = rowsById.get(id);
      if (!draft) {
        failed.push({ draftId: id, reason: '财税解析草稿不存在或已被删除' });
        continue;
      }
      if (draft.status === 'approved') {
        failed.push({ draftId: id, reason: '草稿已确认替换' });
        continue;
      }
      if (draft.status === 'rejected') {
        failed.push({ draftId: id, reason: '草稿已标记不替换' });
        continue;
      }

      const payload = this.parseJsonObject(draft.draftPayload) as FinanceAiParseDraftPayload;
      if (!/^\d{4}$/u.test(String(payload.year ?? ''))) {
        failed.push({ draftId: id, reason: '缺少有效年度，无法替换年度数据' });
        continue;
      }

      const recordIds: string[] = [];
      if (payload.financial) {
        const saved = await this.upsertFinanceAiFinancialRecord(
          enterpriseId,
          payload.financial,
        );
        recordIds.push(String(saved.id));
      }
      if (payload.taxAudit) {
        const saved = await this.upsertFinanceAiTaxAuditRecord(
          enterpriseId,
          payload.taxAudit,
        );
        recordIds.push(String(saved.id));
      }

      if (recordIds.length === 0) {
        failed.push({ draftId: id, reason: '草稿没有可写入的财务或纳税审计数据' });
        continue;
      }

      draft.approvedRecordId = recordIds[0] ?? null;
      draft.reviewedAt = new Date();
      draft.reviewedBy = reviewedBy;
      draft.status = 'approved';
      await this.aiDraftRepo.save(draft);
      success.push({ draftId: id, recordIds });
    }

    if (success.length > 0) {
      await this.recalculateEnterpriseProfileStats(enterpriseId);
    }

    return {
      failed,
      success,
      total: ids.length,
    };
  }

  async uploadClientIpRecognitionPdfs(
    userId: number,
    files: StoredUploadFile[],
    request?: Request,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.uploadEnterpriseIpRecognitionPdfs(
      enterpriseId,
      String(userId),
      files,
      request,
    );
  }

  async uploadEnterpriseIpRecognitionPdfs(
    enterpriseId: string,
    operatorId: string,
    files: StoredUploadFile[],
    request?: Request,
  ) {
    const validFiles = files.filter((file) => file.originalname);
    if (validFiles.length === 0) {
      throw new BadRequestException('请上传至少一个 PDF 文件');
    }
    await this.assertUploadedFilesBelongToEnterprise(enterpriseId, validFiles, 'ip');

    const task = await this.aiTaskRepo.save(
      this.aiTaskRepo.create({
        bizId: enterpriseId,
        bizType: 'enterprise',
        createdBy: operatorId,
        inputSnapshot: JSON.stringify({
          files: validFiles.map((file) => ({
            name: file.originalname,
            size: file.size,
          })),
        }),
        scene: 'ip_recognition',
        status: 'pending',
      }),
    );

    const sources: Array<{
      draftId?: string;
      filePath: string;
      materialId: string;
      publicFilePath: string;
      sourceName: string;
    }> = [];
    for (const file of validFiles) {
      const filePath = normalizeStoredUploadPath(file.path);
      if (!filePath) {
        throw new BadRequestException(`上传文件路径无效：${file.originalname}`);
      }

      const material = await this.enterpriseMaterialRepo.save(
        this.enterpriseMaterialRepo.create({
          enterpriseId,
          errorCount: 0,
          fileName: file.originalname,
          filePath,
          materialType: 'property_ip_pdf',
          remark: JSON.stringify({
            source: 'ip_recognition',
            taskId: String(task.id),
          }),
          status: 'uploaded',
          templateId: 'ip-recognition-pdf',
          templateName: '知识产权 PDF 识别',
        }),
      );
      const publicFilePath = buildUploadPublicUrl(filePath, request) ?? filePath;
      const draft = await this.aiDraftRepo.save(
        this.aiDraftRepo.create({
          draftPayload: JSON.stringify({
            recognition_note: '后台识别中',
            review_warnings: [],
            soft_work_file: publicFilePath,
            source_file_name: file.originalname,
            source_file_path: filePath,
          }),
          draftType: 'ip',
          enterpriseId,
          sourceIds: JSON.stringify([String(material.id)]),
          status: 'processing',
          taskId: String(task.id),
        }),
      );
      sources.push({
        draftId: String(draft.id),
        filePath,
        materialId: String(material.id),
        publicFilePath,
        sourceName: file.originalname,
      });
    }

    task.inputSnapshot = JSON.stringify({
      files: sources.map((source) => ({
        materialId: source.materialId,
        name: source.sourceName,
        path: source.filePath,
      })),
    });
    await this.aiTaskRepo.save(task);

    setImmediate(() => {
      void this.runEnterpriseIpRecognitionTask(
        String(task.id),
        enterpriseId,
        sources,
      );
    });

    return {
      drafts: [],
      taskId: String(task.id),
      total: sources.length,
    };
  }

  private async runEnterpriseIpRecognitionTask(
    taskId: string,
    enterpriseId: string,
    sources: Array<{
      draftId?: string;
      filePath: string;
      materialId: string;
      publicFilePath: string;
      sourceName: string;
    }>,
  ): Promise<void> {
    const task = await this.aiTaskRepo.findOne({
      where: {
        bizId: enterpriseId,
        bizType: 'enterprise',
        id: taskId,
        scene: 'ip_recognition',
      },
    });
    if (!task) {
      return;
    }

    try {
      task.status = 'processing';
      await this.aiTaskRepo.save(task);

      const enterprise = await this.enterpriseRepo.findOne({
        where: { id: enterpriseId },
      });
      if (!enterprise) {
        throw new NotFoundException('企业不存在');
      }

      const drafts: AiDraftEntity[] = [];
      const rejectedRecords: Array<{ reason: string; sourceName: string }> = [];
      for (const source of sources) {
        const draft = source.draftId
          ? await this.aiDraftRepo.findOne({
              where: {
                enterpriseId,
                id: source.draftId,
                taskId: String(task.id),
              },
            })
          : await this.aiDraftRepo.save(
              this.aiDraftRepo.create({
                draftPayload: JSON.stringify({
                  recognition_note: '后台识别中',
                  review_warnings: [],
                  soft_work_file: source.publicFilePath,
                  source_file_name: source.sourceName,
                  source_file_path: source.filePath,
                }),
                draftType: 'ip',
                enterpriseId,
                sourceIds: JSON.stringify([source.materialId]),
                status: 'processing',
                taskId: String(task.id),
              }),
            );
        if (!draft) {
          continue;
        }
        try {
          const payload = await this.buildIpRecognitionDraftPayloadWithAi(
            task,
            source.sourceName,
            source.filePath,
            source.publicFilePath,
          );
          this.applyIpOwnerMatchHint(payload, enterprise);
          if (!this.isIpOwnerMatched(payload, enterprise)) {
            const reason = this.getIpOwnerMatchFailureReason(payload, enterprise);
            draft.status = 'failed';
            payload.recognition_note = '归属校验失败';
            payload.review_warnings = [reason];
            draft.draftPayload = JSON.stringify(payload);
            await this.aiDraftRepo.save(draft);
            rejectedRecords.push({ reason, sourceName: source.sourceName });
            continue;
          }
          draft.draftPayload = JSON.stringify(payload);
          draft.status = 'reviewing';
          drafts.push(await this.aiDraftRepo.save(draft));
        } catch (error) {
          const reason = this.resolveErrorMessage(error);
          draft.status = 'failed';
          draft.draftPayload = JSON.stringify({
            ...this.parseJsonObject(draft.draftPayload),
            recognition_note: '识别失败',
            review_warnings: [reason],
          });
          await this.aiDraftRepo.save(draft);
          rejectedRecords.push({ reason, sourceName: source.sourceName });
        }
      }

      await this.saveClientPropertyAiResult(task, {
        confidence: this.resolveDraftsConfidenceLabel(
          drafts.map((draft) => this.parseJsonObject(draft.draftPayload)),
        ),
        structuredResult: {
          adapter: 'filename-hint-parser',
          materialIds: sources.map((source) => source.materialId),
          records: drafts.map((draft) => this.parseJsonObject(draft.draftPayload)),
          rejectedRecords,
        },
        summary:
          rejectedRecords.length > 0
            ? `已从 ${sources.length} 个 PDF 生成 ${drafts.length} 条知识产权识别草稿；${rejectedRecords.length} 个未通过识别或归属校验`
            : `已从 ${sources.length} 个 PDF 生成 ${drafts.length} 条知识产权识别草稿`,
      });
    } catch (error) {
      await this.markClientPropertyAiTaskFailed(
        task,
        this.resolveErrorMessage(error),
      );
    }
  }

  async getClientIpRecognitionTask(
    userId: number,
    taskId: string,
  ): Promise<ClientAiTaskItem> {
    return this.getClientPropertyAiTaskByScene(
      userId,
      taskId,
      'ip_recognition',
      '识别任务不存在',
    );
  }

  async getClientPropertyGenerationTask(
    userId: number,
    taskId: string,
    scene:
      | 'product_service_generation'
      | 'research_generation'
      | 'transformation_generation',
  ): Promise<ClientAiTaskItem> {
    const labels: Record<typeof scene, string> = {
      product_service_generation: 'PS 生成任务不存在',
      research_generation: 'RD 生成任务不存在',
      transformation_generation: '成果转化生成任务不存在',
    };
    return this.getClientPropertyAiTaskByScene(
      userId,
      taskId,
      scene,
      labels[scene],
    );
  }

  private async getClientPropertyAiTaskByScene(
    userId: number,
    taskId: string,
    scene: string,
    notFoundMessage: string,
  ): Promise<ClientAiTaskItem> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const task = await this.aiTaskRepo.findOne({
      where: {
        bizId: enterpriseId,
        bizType: 'enterprise',
        id: taskId,
        scene,
      },
    });
    if (!task) {
      throw new NotFoundException(notFoundMessage);
    }

    const drafts = await this.aiDraftRepo.find({
      order: {
        id: 'DESC',
      },
      where: {
        enterpriseId,
        taskId: String(task.id),
      },
    });
    const result = task.resultId
      ? await this.aiResultRepo.findOne({ where: { id: task.resultId } })
      : null;

    return {
      ...this.toClientAiTaskItem(task, result),
      drafts: drafts.map((draft) => this.toClientAiDraftItem(draft)),
    };
  }

  async listClientPropertyAiTasks(userId: number) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const propertyScenes = new Set([
      'ip_recognition',
      'transformation_generation',
      'research_generation',
      'product_service_generation',
    ]);
    const taskResult = await this.listEnterpriseWorkspaceAiTasks(enterpriseId);
    const propertyTasks = taskResult.items.filter((task) =>
      propertyScenes.has(task.scene),
    );
    const taskIds = propertyTasks.map((task) => task.id);
    const drafts = taskIds.length
      ? await this.aiDraftRepo.find({
          order: { id: 'DESC' },
          where: { enterpriseId, taskId: In(taskIds) },
        })
      : [];
    const draftsByTaskId = new Map<string, AiDraftEntity[]>();
    drafts.forEach((draft) => {
      const taskId = draft.taskId ? String(draft.taskId) : '';
      draftsByTaskId.set(taskId, [...(draftsByTaskId.get(taskId) ?? []), draft]);
    });

    return {
      items: propertyTasks.map((task) => ({
        ...task,
        drafts: (draftsByTaskId.get(task.id) ?? []).map((draft) =>
          this.toClientAiDraftItem(draft),
        ),
      })),
      total: propertyTasks.length,
    };
  }

  async listEnterpriseWorkspaceAiTasks(enterpriseId: string) {
    const scenes = [
      'contract_recognition',
      'finance_ai_parse',
      'ip_recognition',
      'transformation_generation',
      'research_generation',
      'product_service_generation',
    ];
    const tasks = await this.aiTaskRepo.find({
      order: {
        id: 'DESC',
      },
      where: {
        bizId: enterpriseId,
        bizType: 'enterprise',
        scene: In(scenes),
      },
    });
    const resultIds = tasks
      .map((task) => (task.resultId ? String(task.resultId) : null))
      .filter((id): id is string => Boolean(id));
    const results = resultIds.length
      ? await this.aiResultRepo.find({
          where: {
            id: In(resultIds),
          },
        })
      : [];
    const resultsById = new Map(
      results.map((result) => [String(result.id), result]),
    );
    const items = tasks.map((task) =>
      this.toClientAiTaskItem(
        task,
        task.resultId ? (resultsById.get(String(task.resultId)) ?? null) : null,
      ),
    );

    return {
      items,
      total: items.length,
    };
  }

  async listClientIpRecognitionDrafts(
    userId: number,
    request?: Request,
  ): Promise<{ items: ClientAiDraftItem[]; total: number }> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.listEnterpriseIpRecognitionDrafts(enterpriseId, request);
  }

  async listEnterpriseIpRecognitionDrafts(
    enterpriseId: string,
    request?: Request,
  ): Promise<{ items: ClientAiDraftItem[]; total: number }> {
    const rows = await this.aiDraftRepo.find({
      order: {
        id: 'DESC',
      },
      where: {
        draftType: 'ip',
        enterpriseId,
        status: Not('approved'),
      },
    });

    return {
      items: await this.enrichClientIpDraftItemsWithDuplicateHints(
        enterpriseId,
        rows.map((row) =>
          this.toClientIpRecognitionDraftItem(row, request),
        ),
      ),
      total: rows.length,
    };
  }

  async createClientIpRecognitionTask(
    userId: number,
    input: CreateClientIpRecognitionTaskDto,
    request?: Request,
  ) {
    const materialIds = [
      ...new Set((input.materialIds ?? []).map((id) => String(id))),
    ];
    if (materialIds.length === 0) {
      if (input.ids?.length) {
        return this.retryClientIpRecognitionDrafts(userId, { ids: input.ids });
      }
      throw new BadRequestException('请选择已上传的知识产权 PDF 材料');
    }

    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const materials = await this.enterpriseMaterialRepo.find({
      order: {
        id: 'ASC',
      },
      where: {
        enterpriseId,
        id: In(materialIds),
        materialType: 'property_ip_pdf',
      },
    });
    if (materials.length === 0) {
      throw new BadRequestException('未找到可识别的知识产权 PDF 材料');
    }
    await this.assertStoredMaterialsBelongToEnterprise(enterpriseId, materials, 'ip');

    const task = await this.aiTaskRepo.save(
      this.aiTaskRepo.create({
        bizId: enterpriseId,
        bizType: 'enterprise',
        createdBy: String(userId),
        inputSnapshot: JSON.stringify({
          files: materials.map((material) => ({
            materialId: String(material.id),
            name: material.fileName,
            path: material.filePath,
          })),
          materialIds: materials.map((material) => String(material.id)),
        }),
        scene: 'ip_recognition',
        status: 'pending',
      }),
    );

    const sources = materials
      .filter((material) => material.filePath)
      .map((material) => {
        const filePath = material.filePath ?? '';
        return {
          filePath,
          materialId: String(material.id),
          publicFilePath: buildUploadPublicUrl(filePath, request) ?? filePath,
          sourceName: material.fileName ?? `知识产权PDF-${material.id}.pdf`,
        };
      });
    for (const material of materials) {
      material.remark = JSON.stringify({
        ...this.parseJsonObject(material.remark),
        recognitionTaskId: String(task.id),
        source: 'ip_recognition',
      });
      await this.enterpriseMaterialRepo.save(material);
    }

    if (sources.length === 0) {
      await this.markClientPropertyAiTaskFailed(
        task,
        '所选材料缺少可识别的 PDF 文件路径',
      );
      throw new BadRequestException('所选材料缺少可识别的 PDF 文件路径');
    }

    setImmediate(() => {
      void this.runEnterpriseIpRecognitionTask(
        String(task.id),
        enterpriseId,
        sources,
      );
    });

    return {
      drafts: [],
      taskId: String(task.id),
      total: sources.length,
    };
  }

  async retryClientIpRecognitionDrafts(
    userId: number,
    input: ApproveClientAiDraftsDto,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.retryEnterpriseIpRecognitionDrafts(
      enterpriseId,
      String(userId),
      input,
    );
  }

  async retryEnterpriseIpRecognitionDrafts(
    enterpriseId: string,
    operatorId: string,
    input: ApproveClientAiDraftsDto,
  ) {
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)))];
    if (ids.length === 0) {
      throw new BadRequestException('请选择要重新识别的草稿');
    }

    const rows = await this.aiDraftRepo.find({
      where: {
        draftType: 'ip',
        enterpriseId,
        id: In(ids),
      },
    });
    const enterprise = await this.enterpriseRepo.findOne({
      where: { id: enterpriseId },
    });
    if (!enterprise) {
      throw new NotFoundException('企业不存在');
    }
    const task = await this.aiTaskRepo.save(
      this.aiTaskRepo.create({
        bizId: enterpriseId,
        bizType: 'enterprise',
        createdBy: operatorId,
        inputSnapshot: JSON.stringify({
          retryDraftIds: ids,
        }),
        scene: 'ip_recognition',
        status: 'processing',
      }),
    );
    const success: ClientAiDraftItem[] = [];
    const failed: Array<{ draftId: string; reason: string }> = [];
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    ids
      .filter((id) => !rowsById.has(id))
      .forEach((id) => {
        failed.push({ draftId: id, reason: '识别草稿不存在或已被删除' });
      });

    for (const draft of rows) {
      if (draft.status === 'approved') {
        failed.push({ draftId: String(draft.id), reason: '已入库草稿不能重新识别' });
        continue;
      }

      const currentPayload = this.parseJsonObject(draft.draftPayload);
      const sourceName =
        this.toNullableStringFromUnknown(currentPayload.source_file_name) ??
        `知识产权草稿-${draft.id}.pdf`;
      const sourceFilePath =
        this.toNullableStringFromUnknown(currentPayload.source_file_path) ?? '';
      const payload = {
        ...currentPayload,
        ...(await this.buildIpRecognitionDraftPayloadWithAi(
          task,
          sourceName,
          sourceFilePath,
          this.toNullableStringFromUnknown(currentPayload.soft_work_file) ??
            sourceFilePath,
        )),
      };
      this.applyIpOwnerMatchHint(payload, enterprise);
      if (!this.isIpOwnerMatched(payload, enterprise)) {
        draft.draftPayload = JSON.stringify(payload);
        draft.status = 'rejected';
        draft.taskId = String(task.id);
        await this.aiDraftRepo.save(draft);
        failed.push({
          draftId: String(draft.id),
          reason: this.getIpOwnerMatchFailureReason(payload, enterprise),
        });
        continue;
      }
      draft.draftPayload = JSON.stringify(payload);
      draft.status = 'reviewing';
      draft.taskId = String(task.id);
      success.push(this.toClientAiDraftItem(await this.aiDraftRepo.save(draft)));
    }
    await this.saveClientPropertyAiResult(task, {
      confidence: this.resolveDraftsConfidenceLabel(
        success.map((draft) => draft.draftPayload),
      ),
      structuredResult: {
        adapter: 'filename-hint-parser',
        failed,
        records: success.map((draft) => draft.draftPayload),
        retryDraftIds: ids,
      },
      summary: `已重新识别 ${success.length} 条知识产权草稿，失败 ${failed.length} 条`,
    });

    return {
      failed,
      success: await this.enrichClientIpDraftItemsWithDuplicateHints(
        enterpriseId,
        success,
      ),
      taskId: String(task.id),
      total: ids.length,
    };
  }

  async updateClientIpRecognitionDraft(
    userId: number,
    id: string,
    input: UpdateClientAiDraftDto,
    request?: Request,
  ): Promise<ClientAiDraftItem> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.updateEnterpriseIpRecognitionDraft(
      enterpriseId,
      id,
      input,
      request,
    );
  }

  async updateEnterpriseIpRecognitionDraft(
    enterpriseId: string,
    id: string,
    input: UpdateClientAiDraftDto,
    request?: Request,
  ): Promise<ClientAiDraftItem> {
    const draft = await this.requireClientAiDraft(enterpriseId, id, 'ip');
    if (draft.status === 'approved') {
      throw new BadRequestException('已入库的草稿不能修改');
    }
    if (draft.status === 'processing') {
      throw new BadRequestException('草稿正在识别中，暂不能修改');
    }

    const payload = {
      ...this.parseJsonObject(draft.draftPayload),
      ...input.data,
    };
    const enterprise = await this.enterpriseRepo.findOne({
      where: { id: enterpriseId },
    });
    this.applyIpOwnerMatchHint(payload, enterprise);
    payload.review_warnings = this.buildIpRecognitionDraftReviewWarnings(payload);
    draft.draftPayload = JSON.stringify(payload);
    draft.status = 'reviewing';
    return this.toClientIpRecognitionDraftItem(
      await this.aiDraftRepo.save(draft),
      request,
    );
  }

  async rejectClientIpRecognitionDrafts(
    userId: number,
    input: ApproveClientAiDraftsDto,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.rejectEnterpriseIpRecognitionDrafts(
      enterpriseId,
      String(userId),
      input,
    );
  }

  async rejectEnterpriseIpRecognitionDrafts(
    enterpriseId: string,
    reviewedBy: string,
    input: ApproveClientAiDraftsDto,
  ) {
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)))];
    if (ids.length === 0) {
      throw new BadRequestException('请选择要标记无效的识别结果');
    }

    const rows = await this.aiDraftRepo.find({
      where: {
        draftType: 'ip',
        enterpriseId,
        id: In(ids),
      },
    });
    const success: Array<{ draftId: string }> = [];
    const failed: Array<{ draftId: string; reason: string }> = [];
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    ids
      .filter((id) => !rowsById.has(id))
      .forEach((id) => {
        failed.push({ draftId: id, reason: '识别草稿不存在或已被删除' });
      });

    for (const draft of rows) {
      if (draft.status === 'approved') {
        failed.push({ draftId: String(draft.id), reason: '已入库草稿不能标记无效' });
        continue;
      }

      draft.status = 'rejected';
      draft.reviewedAt = new Date();
      draft.reviewedBy = reviewedBy;
      await this.aiDraftRepo.save(draft);
      success.push({ draftId: String(draft.id) });
    }

    return {
      failed,
      success,
      total: ids.length,
    };
  }

  async deleteClientIpRecognitionDraft(userId: number, id: string) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.deleteEnterpriseIpRecognitionDraft(enterpriseId, id);
  }

  async deleteEnterpriseIpRecognitionDraft(enterpriseId: string, id: string) {
    const draft = await this.requireClientAiDraft(enterpriseId, id, 'ip');

    await this.aiDraftRepo.delete({ id: draft.id, enterpriseId });

    return {
      draftId: String(draft.id),
      success: true,
    };
  }

  async clearEnterprisePropertyResearchDrafts(enterpriseId: string) {
    const result = await this.aiDraftRepo.delete({
      enterpriseId,
      draftType: In([
        'ip',
        'research_project',
        'product_service',
        'transformation',
      ]),
    });
    return result.affected ?? 0;
  }

  async approveClientIpRecognitionDrafts(
    userId: number,
    input: ApproveClientAiDraftsDto,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.approveEnterpriseIpRecognitionDrafts(
      enterpriseId,
      String(userId),
      input,
    );
  }

  async approveEnterpriseIpRecognitionDrafts(
    enterpriseId: string,
    reviewedBy: string,
    input: ApproveClientAiDraftsDto,
  ) {
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)))];
    if (ids.length === 0) {
      throw new BadRequestException('请选择要入库的识别结果');
    }

    const config = this.getProfileRecordConfig('property', 'intellectualProperty');
    const rows = await this.aiDraftRepo.find({
      where: {
        draftType: 'ip',
        enterpriseId,
        id: In(ids),
      },
    });
    const success: Array<{ draftId: string; recordId: string }> = [];
    const failed: Array<{ draftId: string; reason: string }> = [];
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    ids
      .filter((id) => !rowsById.has(id))
      .forEach((id) => {
        failed.push({ draftId: id, reason: '识别草稿不存在或已被删除' });
      });

    for (const draft of rows) {
      if (draft.status === 'approved') {
        failed.push({ draftId: String(draft.id), reason: '草稿已入库' });
        continue;
      }
      if (draft.status === 'rejected') {
        failed.push({
          draftId: String(draft.id),
          reason: '草稿已标记无效，请重新识别后再入库',
        });
        continue;
      }
      if (draft.status !== 'reviewing') {
        failed.push({
          draftId: String(draft.id),
          reason: '草稿尚未识别成功，不能入库',
        });
        continue;
      }

      const payload = this.normalizeIpRecognitionDraftPayload(
        this.parseJsonObject(draft.draftPayload),
        draft,
      );
      const validationMessage = await this.validateIpDraftForApproval(
        enterpriseId,
        payload,
      );
      if (validationMessage) {
        failed.push({ draftId: String(draft.id), reason: validationMessage });
        continue;
      }
      const entity = this.enterprisePropertyRecordRepo.create({
        enterpriseId,
        recordType: config.recordType,
        status: 1,
      });
      Object.assign(entity, this.toProfileRecordEntityData(payload, config));
      const saved = await this.enterprisePropertyRecordRepo.save(entity);
      await this.syncClientPropertyReverseRelations(
        enterpriseId,
        'ip',
        String(saved.id),
        {
          psIds: this.parseRelationIds(saved.relatedPsIds),
          rdIds: this.parseRelationIds(saved.relatedRdIds),
          transformationIds: this.parseRelationIds(saved.relatedTransformationIds),
        },
      );

      draft.approvedRecordId = String(saved.id);
      draft.reviewedAt = new Date();
      draft.reviewedBy = reviewedBy;
      draft.status = 'approved';
      await this.aiDraftRepo.save(draft);
      success.push({ draftId: String(draft.id), recordId: String(saved.id) });
    }

    if (success.length > 0) {
      await this.refreshClientPropertyAutoCodesAfterChange(
        enterpriseId,
        'property',
        'intellectualProperty',
      );
      await this.recalculateEnterpriseProfileStats(enterpriseId);
    }

    return {
      failed,
      success,
      total: ids.length,
    };
  }

  async listClientTransformationGenerationSources(userId: number) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    await this.renumberClientIpCodes(enterpriseId);
    await this.renumberClientTransformationCodes(enterpriseId);
    const [ipRows, transformationRows] = await Promise.all([
      this.enterprisePropertyRecordRepo.find({
        where: {
          enterpriseId,
          recordType: 'intellectual_property',
          status: 1,
        },
      }),
      this.enterprisePropertyRecordRepo.find({
        where: {
          enterpriseId,
          recordType: 'transformation',
          status: 1,
        },
      }),
    ]);
    const orderedIpRows = this.sortClientIpRowsForNumbering(ipRows);
    const usedIpIds = this.collectRelatedIpIds(transformationRows);

    return {
      items: orderedIpRows.map((row) => ({
        authorizeDate: row.authorizeDate,
        hasTransformation: usedIpIds.has(String(row.id)),
        id: String(row.id),
        ipCode: row.ipCode,
        ipLevel: row.ipLevel,
        name: row.softWorkName,
        number: row.softWorkNum,
        rightHolder: row.rightHolder,
        type: row.softWorkType,
      })),
      total: ipRows.length,
    };
  }

  async getClientPropertyEvidenceSummary(
    userId: number,
  ): Promise<ClientPropertyEvidenceSummary> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    await this.renumberClientIpCodes(enterpriseId);
    const propertyAiScenes = [
      'ip_recognition',
      'transformation_generation',
      'research_generation',
      'product_service_generation',
    ];
    const [ipRows, rdRows, psRows, transformationRows, propertyAiTasks] =
      await Promise.all([
      this.enterprisePropertyRecordRepo.find({
        order: { id: 'ASC' },
        where: {
          enterpriseId,
          recordType: 'intellectual_property',
          status: 1,
        },
      }),
      this.enterprisePropertyRecordRepo.find({
        order: { id: 'ASC' },
        where: {
          enterpriseId,
          recordType: 'research_project',
          status: 1,
        },
      }),
      this.enterprisePropertyRecordRepo.find({
        order: { id: 'ASC' },
        where: {
          enterpriseId,
          recordType: 'product_service',
          status: 1,
        },
      }),
      this.enterprisePropertyRecordRepo.find({
        order: { id: 'ASC' },
        where: {
          enterpriseId,
          recordType: 'transformation',
          status: 1,
        },
      }),
      this.aiTaskRepo.find({
        where: {
          bizId: enterpriseId,
          bizType: 'enterprise',
          scene: In(propertyAiScenes),
        },
      }),
    ]);

    const orderedRdRows = this.sortClientPropertyRowsByRelatedIpCode(
      rdRows,
      ipRows,
    );
    const chains = orderedRdRows.map((rd) =>
      this.buildClientPropertyEvidenceChain(
        rd,
        ipRows,
        psRows,
        transformationRows,
      ),
    );
    const gaps = this.buildClientPropertyEvidenceGaps(
      chains,
      ipRows,
      rdRows,
      psRows,
      transformationRows,
    );
    const rdWithIp = chains.filter((chain) => chain.ip.length > 0).length;
    const psWithRd = psRows.filter((ps) =>
      this.hasClientPropertyEvidenceRdRelation(ps, rdRows),
    ).length;
    const psWithIp = psRows.filter((ps) =>
      this.hasClientPropertyEvidenceIpRelation(ps, ipRows),
    ).length;
    const transformationWithIp = transformationRows.filter((item) =>
      this.hasClientPropertyEvidenceTransformationIpRelation(item, ipRows),
    ).length;
    const ipUsedInChain = ipRows.filter((ip) =>
      this.isClientPropertyIpUsedInEvidenceChain(
        ip,
        rdRows,
        psRows,
        transformationRows,
      ),
    ).length;
    const completeRdChains = chains.filter(
      (chain) => chain.gaps.length === 0,
    ).length;
    const readinessItems = [
      rdRows.length === 0 ? 0 : rdWithIp / rdRows.length,
      psRows.length === 0 ? 0 : psWithRd / psRows.length,
      psRows.length === 0 ? 0 : psWithIp / psRows.length,
      transformationRows.length === 0
        ? 0
        : transformationWithIp / transformationRows.length,
      ipRows.length === 0 ? 0 : ipUsedInChain / ipRows.length,
      chains.length === 0 ? 0 : completeRdChains / chains.length,
    ];
    const readinessPercent = Math.round(
      (readinessItems.reduce((sum, item) => sum + item, 0) /
        readinessItems.length) *
        100,
    );
    const succeededAiScenes = new Set(
      propertyAiTasks
        .filter((task) => task.status === 'success')
        .map((task) => task.scene),
    );
    const checklist = this.buildClientPropertyEvidenceChecklist({
      completeRdChains,
      gaps,
      ipRows,
      ipUsedInChain,
      propertyAiScenes,
      psRows,
      psWithIp,
      psWithRd,
      rdRows,
      rdWithIp,
      succeededAiScenes,
      transformationRows,
      transformationWithIp,
    });

    return {
      chains,
      gaps,
      checklist,
      generatedAt: formatDateTimeInBjt(new Date()),
      stats: {
        completeRdChains,
        gapTotal: gaps.length,
        intellectualPropertyTotal: ipRows.length,
        ipUsedInChain,
        psTotal: psRows.length,
        psWithIp,
        psWithRd,
        rdTotal: rdRows.length,
        rdWithIp,
        readinessPercent,
        transformationTotal: transformationRows.length,
        transformationWithIp,
      },
    };
  }

  async repairClientPropertyEvidenceRelations(
    userId: number,
  ): Promise<ClientPropertyEvidenceRepairResult> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const rows = await this.enterprisePropertyRecordRepo.find({
      where: {
        enterpriseId,
        status: 1,
      },
    });
    let changedRecords = 0;

    for (const row of rows) {
      const sourceKind = this.getClientPropertyRecordKindByRecordType(
        row.recordType,
      );
      if (!sourceKind) {
        continue;
      }

      changedRecords += await this.syncClientPropertyReverseRelations(
        enterpriseId,
        sourceKind,
        String(row.id),
        {
          ipIds: this.parseRelationIds(row.relatedIpIds),
          psIds: this.parseRelationIds(row.relatedPsIds),
          rdIds: this.parseRelationIds(row.relatedRdIds),
          transformationIds: this.parseRelationIds(row.relatedTransformationIds),
        },
      );
    }

    return {
      changedRecords,
      repairedAt: formatDateTimeInBjt(new Date()),
      scannedRecords: rows.length,
    };
  }

  async getClientPropertyAiReadiness(
    userId: number,
  ): Promise<ClientPropertyAiReadiness> {
    await this.requireCurrentEnterpriseId(userId);
    const aiEnabled = process.env.AI_CLIENT_PROPERTY_ENABLE !== '0';
    const aiConfigured = aiEnabled && Boolean(process.env.AI_API_KEY);
    const aiReady = aiEnabled && aiConfigured;

    return {
      ai: {
        configured: aiConfigured,
        enabled: aiEnabled,
        message: !aiEnabled
          ? 'AI 生成已关闭，当前使用规则兜底'
          : aiConfigured
            ? 'AI 结构化生成已配置'
            : 'AI_API_KEY 未配置，当前使用规则兜底',
      },
      generatedAt: formatDateTimeInBjt(new Date()),
      mode: aiReady ? 'ai_only' : 'fallback_only',
    };
  }

  async createClientTransformationGenerationTask(
    userId: number,
    input: CreateClientTransformationGenerationDto,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.createEnterpriseTransformationGenerationTask(
      enterpriseId,
      String(userId),
      input,
    );
  }

  async createEnterpriseTransformationGenerationTask(
    enterpriseId: string,
    operatorId: string,
    input: CreateClientTransformationGenerationDto,
  ) {
    await this.renumberClientIpCodes(enterpriseId);
    const selectedIds = new Set((input.ipIds ?? []).map((id) => String(id)));
    const [ipRows, transformationRows, activeDrafts, activeTask] = await Promise.all([
      this.enterprisePropertyRecordRepo.find({
        where: {
          enterpriseId,
          recordType: 'intellectual_property',
          status: 1,
        },
      }),
      this.enterprisePropertyRecordRepo.find({
        where: {
          enterpriseId,
          recordType: 'transformation',
          status: 1,
        },
      }),
      this.aiDraftRepo.find({
        where: { draftType: 'transformation', enterpriseId, status: 'reviewing' },
      }),
      this.aiTaskRepo.findOne({
        where: {
          bizId: enterpriseId,
          bizType: 'enterprise',
          scene: 'transformation_generation',
          status: In(['pending', 'processing']),
        },
      }),
    ]);
    if (activeTask) {
      throw new BadRequestException('成果转化生成任务处理中，请稍候');
    }
    const orderedIpRows = this.sortClientIpRowsForNumbering(ipRows);
    const usedIpIds = this.collectRelatedIpIds(transformationRows);
    activeDrafts.forEach((draft) => {
      const payload = this.normalizeTransformationGenerationDraftPayload(
        this.parseJsonObject(draft.draftPayload),
      );
      this.parseRelationIds(
        this.toNullableStringFromUnknown(payload.related_ip_ids),
      ).forEach((id) => usedIpIds.add(id));
      this.parseRelationIds(draft.sourceIds).forEach((id) => usedIpIds.add(id));
    });
    const sourceRows = orderedIpRows.filter((row) => {
      const selected = selectedIds.size === 0 || selectedIds.has(String(row.id));
      return selected && !usedIpIds.has(String(row.id));
    });

    if (sourceRows.length === 0) {
      throw new BadRequestException('没有可生成成果转化的知识产权');
    }
    const requestedCount = this.resolveTargetCount(
      input.targetCount,
      1,
      30,
      sourceRows.length,
    );
    const targetCount = Math.min(
      sourceRows.length,
      requestedCount,
      Math.max(0, 30 - transformationRows.length - activeDrafts.length),
    );
    if (targetCount <= 0) {
      throw new BadRequestException('成果转化正式记录和待审核草稿已达到 30 条上限');
    }
    const plannedRows = sourceRows.slice(0, targetCount);

    const task = await this.aiTaskRepo.save(
      this.aiTaskRepo.create({
        bizId: enterpriseId,
        bizType: 'enterprise',
        createdBy: operatorId,
        inputSnapshot: JSON.stringify({
          businessMode: input.businessMode ?? 'auto',
          ipIds: plannedRows.map((row) => String(row.id)),
          targetCount,
        }),
        scene: 'transformation_generation',
        status: 'processing',
      }),
    );

    setImmediate(() => {
      void this.runTransformationGenerationTask(
        String(task.id),
        enterpriseId,
        plannedRows.map((row) => String(row.id)),
        input.businessMode ?? 'auto',
      );
    });

    return {
      drafts: [],
      taskId: String(task.id),
      total: targetCount,
    };
  }

  private async runTransformationGenerationTask(
    taskId: string,
    enterpriseId: string,
    sourceIds: string[],
    businessMode: PropertyBusinessMode,
  ): Promise<void> {
    let task: AiTaskEntity | null = null;
    try {
      task = await this.aiTaskRepo.findOne({
        where: {
          bizId: enterpriseId,
          bizType: 'enterprise',
          id: taskId,
          scene: 'transformation_generation',
        },
      });
      if (!task) {
        return;
      }

      const sourceRows = await this.enterprisePropertyRecordRepo.find({
        where: {
          enterpriseId,
          id: In(sourceIds),
          recordType: 'intellectual_property',
          status: 1,
        },
      });
      if (sourceRows.length === 0) {
        throw new BadRequestException('没有可生成成果转化的知识产权');
      }
      const orderedSourceRows = this.sortClientIpRowsForNumbering(sourceRows);

      const drafts: AiDraftEntity[] = [];
      for (const row of orderedSourceRows) {
        const payload = await this.buildTransformationGenerationDraftPayloadWithAi(
          task,
          row,
        );
        const resolvedBusinessMode = businessMode === 'mixed'
          ? this.resolveBusinessModeFromDraft(payload)
          : await this.resolvePropertyBusinessMode(enterpriseId, businessMode);
        payload.transformation_name = await this.resolveGeneratedPropertyName(
          enterpriseId,
          'transformation',
          'transformation_name',
          this.applyBusinessModeToPropertyName(
            this.toNullableStringFromUnknown(payload.transformation_name) ?? '',
            resolvedBusinessMode,
          ),
        );
        drafts.push(
          await this.aiDraftRepo.save(
            this.aiDraftRepo.create({
              draftPayload: JSON.stringify(payload),
              draftType: 'transformation',
              enterpriseId,
              sourceIds: JSON.stringify([String(row.id)]),
              status: 'reviewing',
              taskId: String(task.id),
            }),
          ),
        );
      }
      await this.saveClientPropertyAiResult(task, {
        confidence: 'medium',
        structuredResult: {
          adapter: 'rule-based-transformation-generator',
          records: drafts.map((draft) => this.parseJsonObject(draft.draftPayload)),
        },
        summary: `已基于 ${sourceRows.length} 条知识产权生成 ${drafts.length} 条成果转化草稿`,
      });
    } catch (error) {
      if (task) {
        await this.markClientPropertyAiTaskFailed(
          task,
          this.resolveErrorMessage(error),
        );
      }
    }
  }

  async listClientTransformationGenerationDrafts(
    userId: number,
  ): Promise<{ items: ClientAiDraftItem[]; total: number }> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.listEnterpriseTransformationGenerationDrafts(enterpriseId);
  }

  async listEnterpriseTransformationGenerationDrafts(
    enterpriseId: string,
  ): Promise<{ items: ClientAiDraftItem[]; total: number }> {
    const rows = await this.aiDraftRepo.find({
      order: {
        id: 'DESC',
      },
      where: {
        draftType: 'transformation',
        enterpriseId,
        status: Not('approved'),
      },
    });

    return this.listClientPropertyDraftsSortedByIpCode(enterpriseId, rows);
  }

  async updateClientTransformationGenerationDraft(
    userId: number,
    id: string,
    input: UpdateClientAiDraftDto,
  ): Promise<ClientAiDraftItem> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const draft = await this.requireClientAiDraft(
      enterpriseId,
      id,
      'transformation',
    );
    if (draft.status === 'approved') {
      throw new BadRequestException('已入库的草稿不能修改');
    }

    draft.draftPayload = JSON.stringify({
      ...this.parseJsonObject(draft.draftPayload),
      ...input.data,
    });
    draft.status = 'reviewing';
    return (
      await this.enrichClientPropertyDraftItemsWithReviewWarnings(enterpriseId, [
        this.toClientAiDraftItem(await this.aiDraftRepo.save(draft)),
      ])
    )[0];
  }

  async approveClientTransformationGenerationDrafts(
    userId: number,
    input: ApproveClientAiDraftsDto,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.approveEnterpriseTransformationGenerationDrafts(
      enterpriseId,
      String(userId),
      input,
    );
  }

  async approveEnterpriseTransformationGenerationDrafts(
    enterpriseId: string,
    reviewedBy: string,
    input: ApproveClientAiDraftsDto,
  ) {
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)))];
    if (ids.length === 0) {
      throw new BadRequestException('请选择要入库的成果转化草稿');
    }

    const config = this.getProfileRecordConfig('property', 'transformation');
    const rows = await this.aiDraftRepo.find({
      where: {
        draftType: 'transformation',
        enterpriseId,
        id: In(ids),
      },
    });
    const success: Array<{ draftId: string; recordId: string }> = [];
    const failed: Array<{ draftId: string; reason: string }> = [];
    const pendingIpIds = new Set<string>();
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    ids
      .filter((id) => !rowsById.has(id))
      .forEach((id) => {
        failed.push({ draftId: id, reason: '成果转化草稿不存在或已被删除' });
      });

    for (const draft of rows) {
      if (draft.status === 'approved') {
        failed.push({ draftId: String(draft.id), reason: '草稿已入库' });
        continue;
      }
      if (draft.status === 'rejected') {
        failed.push({
          draftId: String(draft.id),
          reason: '草稿已标记不入库，如需入库请先编辑后恢复待审核',
        });
        continue;
      }

      const payload = this.normalizeTransformationGenerationDraftPayload(
        this.parseJsonObject(draft.draftPayload),
      );
      const relatedIpIds = this.parseRelationIds(
        this.toNullableStringFromUnknown(payload.related_ip_ids),
      );
      const duplicatedIpId = relatedIpIds.find((id) => pendingIpIds.has(id));
      if (duplicatedIpId) {
        failed.push({
          draftId: String(draft.id),
          reason: `知识产权 ${duplicatedIpId} 在本次入库草稿中重复关联`,
        });
        continue;
      }
      const validationMessage = await this.validateTransformationDraftForApproval(
        enterpriseId,
        payload,
        null,
      );
      if (validationMessage) {
        failed.push({ draftId: String(draft.id), reason: validationMessage });
        continue;
      }

      const entity = this.enterprisePropertyRecordRepo.create({
        enterpriseId,
        recordType: config.recordType,
        status: 1,
      });
      Object.assign(entity, this.toProfileRecordEntityData(payload, config));
      relatedIpIds.forEach((id) => pendingIpIds.add(id));
      await this.applyTransformationCodeFromRelatedIp(enterpriseId, entity);
      const saved = await this.enterprisePropertyRecordRepo.save(entity);
      await this.syncClientPropertyReverseRelations(
        enterpriseId,
        'transformation',
        String(saved.id),
        {
          ipIds: this.parseRelationIds(saved.relatedIpIds),
          psIds: this.parseRelationIds(saved.relatedPsIds),
          rdIds: this.parseRelationIds(saved.relatedRdIds),
        },
      );

      draft.approvedRecordId = String(saved.id);
      draft.reviewedAt = new Date();
      draft.reviewedBy = reviewedBy;
      draft.status = 'approved';
      await this.aiDraftRepo.save(draft);
      success.push({ draftId: String(draft.id), recordId: String(saved.id) });
    }

    if (success.length > 0) {
      await this.recalculateEnterpriseProfileStats(enterpriseId);
    }

    return {
      failed,
      success,
      total: ids.length,
    };
  }

  async rejectClientTransformationGenerationDrafts(
    userId: number,
    input: ApproveClientAiDraftsDto,
  ) {
    return this.rejectClientPropertyGenerationDrafts(
      userId,
      input,
      'transformation',
      '成果转化草稿',
    );
  }

  async deleteClientTransformationGenerationDraft(userId: number, id: string) {
    return this.deleteClientPropertyGenerationDraft(
      userId,
      id,
      'transformation',
      '成果转化草稿',
    );
  }

  async listClientResearchGenerationSources(userId: number) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    await this.renumberClientIpCodes(enterpriseId);
    await this.renumberClientTransformationCodes(enterpriseId);
    const [ipRows, researchRows] = await Promise.all([
      this.enterprisePropertyRecordRepo.find({
        order: {
          id: 'DESC',
        },
        where: {
          enterpriseId,
          recordType: 'intellectual_property',
          status: 1,
        },
      }),
      this.enterprisePropertyRecordRepo.find({
        where: {
          enterpriseId,
          recordType: 'research_project',
          status: 1,
        },
      }),
    ]);
    const usedIpIds = this.collectRelatedIpIds(researchRows);

    const orderedIpRows = this.sortClientIpRowsForNumbering(ipRows);
    return {
      items: orderedIpRows.map((row) => ({
        authorizeDate: row.authorizeDate,
        hasResearchProject: usedIpIds.has(String(row.id)),
        id: String(row.id),
        ipCode: row.ipCode,
        ipLevel: row.ipLevel,
        name: row.softWorkName,
        number: row.softWorkNum,
        rightHolder: row.rightHolder,
        type: row.softWorkType,
      })),
      total: ipRows.length,
    };
  }

  async createClientResearchGenerationTask(
    userId: number,
    input: CreateClientResearchGenerationDto,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    await this.renumberClientIpCodes(enterpriseId);
    const initDate = this.toNullableStringFromUnknown(input.initDate);
    const endDate = this.toNullableStringFromUnknown(input.endDate);
    if (!initDate || !endDate) {
      throw new BadRequestException('请选择研发起止时间');
    }
    const initTime = Date.parse(initDate);
    const endTime = Date.parse(endDate);
    if (!Number.isNaN(initTime) && !Number.isNaN(endTime) && initTime > endTime) {
      throw new BadRequestException('研发开始时间不能晚于结束时间');
    }

    const selectedIds = new Set((input.ipIds ?? []).map((id) => String(id)));
    if (selectedIds.size === 0) {
      throw new BadRequestException('请选择关联知识产权');
    }

    const ipRows = await this.enterprisePropertyRecordRepo.find({
      order: {
        id: 'DESC',
      },
      where: {
        enterpriseId,
        recordType: 'intellectual_property',
        status: 1,
      },
    });
    const sourceRows = this.sortClientIpRowsForNumbering(
      ipRows.filter((row) => selectedIds.has(String(row.id))),
    );
    if (sourceRows.length === 0) {
      throw new BadRequestException('未找到可关联的知识产权');
    }
    const dateValidationMessage = this.validateResearchPeriodBeforeIpDates(
      initDate,
      endDate,
      sourceRows,
    );
    if (dateValidationMessage) {
      throw new BadRequestException(dateValidationMessage);
    }

    const task = await this.aiTaskRepo.save(
      this.aiTaskRepo.create({
        bizId: enterpriseId,
        bizType: 'enterprise',
        createdBy: String(userId),
        inputSnapshot: JSON.stringify({
          endDate,
          initDate,
          ipIds: sourceRows.map((row) => String(row.id)),
          leader: input.leader ?? '',
          rdBudget: input.rdBudget ?? '',
          remark: input.remark ?? '',
          technicalField: input.technicalField ?? '',
        }),
        scene: 'research_generation',
        status: 'processing',
      }),
    );

    setImmediate(() => {
      void this.runResearchGenerationTask(
        String(task.id),
        enterpriseId,
        sourceRows.map((row) => String(row.id)),
        {
          ...input,
          endDate,
          initDate,
        },
      );
    });

    return {
      drafts: [],
      taskId: String(task.id),
      total: 1,
    };
  }

  async createClientResearchAutoMatchTask(
    userId: number,
    input: CreateClientResearchAutoMatchDto = {},
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.createEnterpriseResearchAutoMatchTask(
      enterpriseId,
      String(userId),
      input,
    );
  }

  async classifyClientPropertyTechnologyFields(userId: number) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const [propertyRows, contractRows] = await Promise.all([
      this.enterprisePropertyRecordRepo.find({
        where: { enterpriseId, status: 1 },
      }),
      this.enterpriseContractRecordRepo.find({
        where: { enterpriseId, status: 1 },
      }),
    ]);
    const targets = propertyRows
      .map((row) => {
        if (row.recordType === 'intellectual_property') {
          return {
            currentField: row.ipTechCategory,
            fieldKey: 'ipTechCategory' as const,
            id: String(row.id),
            name: row.softWorkName,
            recordType: row.recordType,
          };
        }
        if (row.recordType === 'research_project') {
          return {
            currentField: row.projectType,
            fieldKey: 'projectType' as const,
            id: String(row.id),
            name: row.kyProjectName,
            recordType: row.recordType,
          };
        }
        if (row.recordType === 'product_service') {
          return {
            currentField: row.techField,
            fieldKey: 'techField' as const,
            id: String(row.id),
            name: row.psName,
            recordType: row.recordType,
          };
        }
        return null;
      })
      .filter(
        (
          item,
        ): item is {
          currentField: null | string;
          fieldKey: 'ipTechCategory' | 'projectType' | 'techField';
          id: string;
          name: null | string;
          recordType: string;
        } => item !== null && !item.currentField && Boolean(item.name),
      );
    if (targets.length === 0) {
      return { adapterStatus: 'skipped', items: [], total: 0, updated: 0 };
    }

    const evidenceText = contractRows
      .filter((row) => row.recordType === 'contract' || row.recordType === 'invoice')
      .map((row) => [row.htName, row.htDes, row.remark].filter(Boolean).join('；'))
      .filter(Boolean)
      .join('\n')
      .slice(0, 6000);
    const fallbackItems = targets.map((target) => ({
      ...this.resolveHighTechFieldByKeywords(target.name ?? ''),
      id: target.id,
      recordType: target.recordType,
    }));
    let adapterStatus = 'rule';
    let classifiedItems = fallbackItems;
    const task = await this.aiTaskRepo.save(
      this.aiTaskRepo.create({
        bizId: enterpriseId,
        bizType: 'enterprise',
        inputSnapshot: JSON.stringify({ targetCount: targets.length }),
        scene: 'property_technology_field_classification',
        status: 'processing',
      }),
    );

    if (this.canUseClientPropertyAi()) {
      try {
        const aiResult = await this.aiService.runStructuredJsonCompletion({
          input: {
            catalog: HIGH_TECH_FIELD_CATALOG_BY_NAME,
            contractAndInvoiceEvidence: evidenceText || '无可用销售合同或发票文本',
            targets: targets.map((target) => ({
              id: target.id,
              name: target.name,
              recordType: target.recordType,
            })),
          },
          outputSchema: {
            records: [
              {
                confidence: 'high|medium|low',
                evidence: '仅列出实际命中的名称或合同/发票关键词',
                field: '目录中的二级领域名称',
                id: '目标记录 ID',
                topLevel: '目录中的一级领域名称',
              },
            ],
          },
          scene: 'property_technology_field_classification',
          systemPrompt:
            '你是高新技术领域分类助手。必须从提供的《国家重点支持的高新技术领域》目录中选择一级和二级领域；优先依据知识产权、研发或PS名称，合同和发票仅作为辅助证据。不得杜撰证据；无法判断时返回 low 置信度且 field 为空。输出 JSON 对象。',
          taskId: String(task.id),
        });
        classifiedItems = this.resolveAiHighTechFieldItems(
          aiResult.structuredResult,
          fallbackItems,
        );
        adapterStatus = 'ai';
      } catch {
        adapterStatus = 'rule_after_ai_error';
      }
    }

    const itemsById = new Map(classifiedItems.map((item) => [item.id, item]));
    const changedRows: EnterprisePropertyRecordEntity[] = [];
    targets.forEach((target) => {
      const classification = itemsById.get(target.id);
      if (!classification?.topLevel) {
        return;
      }
      const row = propertyRows.find((item) => String(item.id) === target.id);
      if (!row) {
        return;
      }
      row[target.fieldKey] = classification.field
        ? `${classification.topLevel} / ${classification.field}`
        : classification.topLevel;
      changedRows.push(row);
    });
    if (changedRows.length > 0) {
      await this.enterprisePropertyRecordRepo.save(changedRows);
    }
    await this.saveClientPropertyAiResult(task, {
      confidence: adapterStatus === 'ai' ? 'medium' : 'low',
      structuredResult: { adapterStatus, items: classifiedItems },
      summary: `已识别 ${changedRows.length}/${targets.length} 条技术领域`,
    });

    return {
      adapterStatus,
      items: classifiedItems,
      taskId: String(task.id),
      total: targets.length,
      updated: changedRows.length,
    };
  }

  private resolveHighTechFieldByKeywords(
    value: string,
  ): Omit<ClientHighTechFieldClassification, 'id' | 'recordType'> {
    const normalized = value.toLowerCase();
    const ranked = HIGH_TECH_FIELD_CATALOG.map((item) => ({
      ...item,
      score: item.keywords.filter((keyword) =>
        normalized.includes(keyword.toLowerCase()),
      ).length,
    })).sort((left, right) => right.score - left.score);
    const matched = ranked[0];
    if (!matched || matched.score === 0) {
      return { confidence: 'low', field: null, topLevel: null };
    }
    return {
      confidence: matched.score > 1 ? 'high' : 'medium',
      field: matched.field,
      topLevel: matched.topLevel,
    };
  }

  private resolveAiHighTechFieldItems(
    value: Record<string, unknown>,
    fallbackItems: ClientHighTechFieldClassification[],
  ): ClientHighTechFieldClassification[] {
    const records = Array.isArray(value.records) ? value.records : [];
    const aiItemsById = new Map(
      records
        .filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === 'object' && !Array.isArray(item),
        )
        .map((item) => [String(item.id ?? ''), item]),
    );
    return fallbackItems.map((fallback) => {
      const item = aiItemsById.get(fallback.id);
      const topLevel = this.toNullableStringFromUnknown(item?.topLevel);
      const field = this.toNullableStringFromUnknown(item?.field);
      const matched = HIGH_TECH_FIELD_CATALOG.find(
        (catalogItem) =>
          catalogItem.topLevel === topLevel && catalogItem.field === field,
      );
      if (!matched) {
        return fallback;
      }
      const confidence = this.toNullableStringFromUnknown(item?.confidence);
      return {
        ...fallback,
        confidence:
          confidence === 'high' || confidence === 'medium' || confidence === 'low'
            ? confidence
            : 'medium',
        field: matched.field,
        topLevel: matched.topLevel,
      };
    });
  }

  async previewClientResearchAutoMatch(
    userId: number,
    input: CreateClientResearchAutoMatchDto = {},
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    await this.renumberClientIpCodes(enterpriseId);
    await this.renumberClientTransformationCodes(enterpriseId);
    const candidate = await this.resolveResearchAutoMatchCandidate(
      enterpriseId,
      input,
    );
    if (candidate.validRows.length === 0) {
      return {
        availableIpCount: candidate.availableRows.length,
        blockedReasons: candidate.blockedReasons,
        candidateCount: 0,
        items: [],
        skippedIpCount: candidate.skippedIpCount,
        targetCount: 0,
      };
    }

    const transformationRows = await this.enterprisePropertyRecordRepo.find({
      where: { enterpriseId, recordType: 'transformation', status: 1 },
    });
    const ipById = new Map(
      candidate.validRows.map((row) => [String(row.id), row]),
    );
    const groups = this.buildResearchAutoMatchGroups(
      candidate.validRows,
      transformationRows,
      10,
    );
    const plan = this.resolveResearchAutoMatchPlan(
      candidate,
      groups.length,
      input.targetCount,
    );
    const items = await Promise.all(
      groups.slice(0, plan.targetCount).map(async (group, index) => {
        const ips = group
          .map((id) => ipById.get(id))
          .filter((row): row is EnterprisePropertyRecordEntity => Boolean(row));
        const category = this.describeResearchAutoMatchGroup(ips);
        return {
          category: category.label,
          ipIds: group,
          ipNames: ips.map(
            (ip) => ip.softWorkName || ip.softWorkNum || `知识产权${ip.id}`,
          ),
          plannedYear: plan.plannedYears[index] ?? plan.plannedYears[0],
          technicalField: category.technicalField,
          transformationIds: await this.resolveTransformationIdsByIpIds(
            enterpriseId,
            group,
          ),
        };
      }),
    );

    return {
      availableIpCount: candidate.availableRows.length,
      blockedReasons: [...candidate.blockedReasons, ...(plan.warning ? [plan.warning] : [])],
      candidateCount: items.length,
      items,
      skippedIpCount: candidate.skippedIpCount,
      targetCount: plan.targetCount,
    };
  }

  async createEnterpriseResearchAutoMatchTask(
    enterpriseId: string,
    operatorId: string,
    input: CreateClientResearchAutoMatchDto = {},
  ) {
    await this.renumberClientIpCodes(enterpriseId);
    await this.renumberClientTransformationCodes(enterpriseId);
    const activeTask = await this.aiTaskRepo.findOne({
      where: {
        bizId: enterpriseId,
        bizType: 'enterprise',
        scene: 'research_generation',
        status: In(['pending', 'processing']),
      },
    });
    if (activeTask) {
      throw new BadRequestException('RD 自动匹配任务处理中，请稍候');
    }

    const candidate = await this.resolveResearchAutoMatchCandidate(
      enterpriseId,
      input,
    );
    if (candidate.sourceRows.length === 0) {
      throw new BadRequestException('暂无可自动匹配的知识产权');
    }
    if (candidate.availableRows.length === 0) {
      throw new BadRequestException(
        '所选知识产权均已关联正式 RD 或待审核 RD 草稿，请选择未占用的知识产权。',
      );
    }
    if (candidate.validRows.length === 0) {
      throw new BadRequestException(
        '知识产权缺少登记/授权日期，无法自动规划早于登记日的 RD 时间',
      );
    }

    const transformationRows = await this.enterprisePropertyRecordRepo.find({
      where: { enterpriseId, recordType: 'transformation', status: 1 },
    });
    const groups = this.buildResearchAutoMatchGroups(
      candidate.validRows,
      transformationRows,
      10,
    );
    const plan = this.resolveResearchAutoMatchPlan(
      candidate,
      groups.length,
      input.targetCount,
    );
    if (plan.targetCount <= 0) {
      throw new BadRequestException(
        '现有正式 RD 和待审核 RD 草稿已达到自动匹配上限，无需继续生成。',
      );
    }
    const task = await this.aiTaskRepo.save(
      this.aiTaskRepo.create({
        bizId: enterpriseId,
        bizType: 'enterprise',
        createdBy: operatorId,
        inputSnapshot: JSON.stringify({
          adapter: 'auto-match-rd-planner',
          existingRdCount: candidate.existingRdRows.length,
          activeRdDraftCount: candidate.activeRdDraftRows.length,
          ipIds: candidate.validRows.map((row) => String(row.id)),
          matchingStrategy: 'software-copyright-first',
          plannedYears: plan.plannedYears,
          skippedReasons: candidate.blockedReasons,
          softwareCopyrightCount: candidate.validRows.filter(
            (row) => row.softWorkType === 3,
          ).length,
          sourceValidIpCount: candidate.sourceValidIpCount,
          targetCount: plan.targetCount,
          requestedTargetCount: input.targetCount ?? null,
          warning: plan.warning,
        }),
        scene: 'research_generation',
        status: 'processing',
      }),
    );

    setImmediate(() => {
      void this.runResearchAutoMatchTask(
        String(task.id),
        enterpriseId,
        groups.slice(0, plan.targetCount),
        plan,
      );
    });

    return {
      drafts: [],
      taskId: String(task.id),
      total: plan.targetCount,
      warning: plan.warning,
    };
  }

  private async runResearchGenerationTask(
    taskId: string,
    enterpriseId: string,
    sourceIds: string[],
    input: CreateClientResearchGenerationDto,
  ): Promise<void> {
    let task: AiTaskEntity | null = null;
    try {
      task = await this.aiTaskRepo.findOne({
        where: {
          bizId: enterpriseId,
          bizType: 'enterprise',
          id: taskId,
          scene: 'research_generation',
        },
      });
      if (!task) {
        return;
      }

      const sourceRows = await this.enterprisePropertyRecordRepo.find({
        where: {
          enterpriseId,
          id: In(sourceIds),
          recordType: 'intellectual_property',
          status: 1,
        },
      });
      if (sourceRows.length === 0) {
        throw new BadRequestException('未找到可关联的知识产权');
      }
      const orderedSourceRows = this.sortClientIpRowsForNumbering(sourceRows);

      const initDate = this.toNullableStringFromUnknown(input.initDate) ?? '';
      const endDate = this.toNullableStringFromUnknown(input.endDate) ?? '';
      const dateValidationMessage = this.validateResearchPeriodBeforeIpDates(
        initDate,
        endDate,
        orderedSourceRows,
      );
      if (dateValidationMessage) {
        throw new BadRequestException(dateValidationMessage);
      }
      const nextRdCode = await this.getNextClientPropertySequentialCode(
        enterpriseId,
        'research_project',
        'kyProjectNum',
        'RD',
      );
      const payload = await this.buildResearchGenerationDraftPayloadWithAi(
        task,
        orderedSourceRows,
        input,
        nextRdCode,
      );
      payload.ky_project_name = await this.resolveGeneratedPropertyName(
        enterpriseId,
        'research_project',
        'ky_project_name',
        this.toNullableStringFromUnknown(payload.ky_project_name) ?? `研发项目${nextRdCode}`,
      );

      const draft = await this.aiDraftRepo.save(
        this.aiDraftRepo.create({
          draftPayload: JSON.stringify(payload),
          draftType: 'research_project',
          enterpriseId,
          sourceIds: JSON.stringify(sourceRows.map((row) => String(row.id))),
          status: 'reviewing',
          taskId: String(task.id),
        }),
      );
      await this.saveClientPropertyAiResult(task, {
        confidence: 'medium',
        structuredResult: {
          adapter: 'rule-based-rd-proposal-generator',
          input: {
            endDate,
            initDate,
            ipIds: sourceRows.map((row) => String(row.id)),
            technicalField: input.technicalField ?? '',
          },
          record: this.parseJsonObject(draft.draftPayload),
        },
        summary: `已基于 ${sourceRows.length} 条知识产权生成 1 条研发立项报告草稿`,
      });
    } catch (error) {
      if (task) {
        await this.markClientPropertyAiTaskFailed(
          task,
          this.resolveErrorMessage(error),
        );
      }
    }
  }

  private async runResearchAutoMatchTask(
    taskId: string,
    enterpriseId: string,
    groups: string[][],
    plan: ResearchAutoMatchPlan,
  ): Promise<void> {
    let task: AiTaskEntity | null = null;
    try {
      task = await this.aiTaskRepo.findOne({
        where: {
          bizId: enterpriseId,
          bizType: 'enterprise',
          id: taskId,
          scene: 'research_generation',
        },
      });
      if (!task) {
        return;
      }

      const [sourceRows, employeeRows] = await Promise.all([
        this.enterprisePropertyRecordRepo.find({
          where: {
            enterpriseId,
            id: In([...new Set(groups.flat())]),
            recordType: 'intellectual_property',
            status: 1,
          },
        }),
        this.enterpriseEmployeeRecordRepo.find({
          order: {
            id: 'ASC',
          },
          where: {
            enterpriseId,
            status: 1,
          },
        }),
      ]);
      if (sourceRows.length === 0) {
        throw new BadRequestException('未找到可自动匹配的知识产权');
      }

      const researchLeaders = employeeRows
        .filter((row) => row.isKjyf === 1 && this.toNullableStringFromUnknown(row.ygName))
        .map((row) => this.toNullableStringFromUnknown(row.ygName) as string);
      const firstRdCode = await this.getNextClientPropertySequentialCode(
        enterpriseId,
        'research_project',
        'kyProjectNum',
        'RD',
      );
      const firstIndex = Number(firstRdCode.match(/^RD(\d+)$/u)?.[1] ?? 1);
      const ipById = new Map(sourceRows.map((row) => [String(row.id), row]));
      const drafts: AiDraftEntity[] = [];
      const records: Array<Record<string, unknown>> = [];

      for (let index = 0; index < groups.length; index += 1) {
        const groupIps = groups[index]
          ?.map((id) => ipById.get(id))
          .filter((row): row is EnterprisePropertyRecordEntity => Boolean(row));
        if (!groupIps || groupIps.length === 0) {
          continue;
        }

        const year =
          plan.plannedYears[index] ??
          plan.plannedYears[plan.plannedYears.length - 1];
        if (!year) {
          continue;
        }
        const durationMonths = 6 + (index % 5);
        const period = this.resolveAutoMatchedResearchPeriod(
          year,
          durationMonths,
          index,
          groupIps,
        );
        const technicalField = this.inferResearchTechnicalField(groupIps);
        const category = this.describeResearchAutoMatchGroup(groupIps);
        const leader =
          researchLeaders.length > 0
            ? researchLeaders[index % researchLeaders.length]
            : '';
        const input: CreateClientResearchGenerationDto = {
          endDate: period.endDate,
          initDate: period.initDate,
          ipIds: groupIps.map((row) => String(row.id)),
          leader,
          rdBudget: '',
          remark:
            `自动匹配：按${category.label}规划，基于当前知识产权与成果转化关系生成；入库前请结合真实研发过程、人员和费用台账核对补充。`,
          technicalField,
        };
        const rdCode = this.formatSequentialCode('RD', firstIndex + index);
        const payload = await this.buildResearchGenerationDraftPayloadWithAi(
          task,
          groupIps,
          input,
          rdCode,
        );
        payload.ky_project_name = await this.resolveGeneratedPropertyName(
          enterpriseId,
          'research_project',
          'ky_project_name',
          this.toNullableStringFromUnknown(payload.ky_project_name) ?? `研发项目${rdCode}`,
        );
        const transformationIds = await this.resolveTransformationIdsByIpIds(
          enterpriseId,
          groupIps.map((row) => String(row.id)),
        );
        payload.related_transformation_ids = transformationIds.join(',');
        payload.remark =
          `自动匹配 RD 草稿，分类：${category.label}；已按 IP/成果关系、下证日前三年年度和 6-10 个月研发周期生成。`;

        const draft = await this.aiDraftRepo.save(
          this.aiDraftRepo.create({
            draftPayload: JSON.stringify(payload),
            draftType: 'research_project',
            enterpriseId,
            sourceIds: JSON.stringify(groupIps.map((row) => String(row.id))),
            status: 'reviewing',
            taskId: String(task.id),
          }),
        );
        drafts.push(draft);
        records.push({
          draftId: String(draft.id),
          endDate: period.endDate,
          initDate: period.initDate,
          ipIds: groupIps.map((row) => String(row.id)),
          rdCode,
          transformationIds,
          category: category.label,
          year,
        });
      }

      await this.saveClientPropertyAiResult(task, {
        confidence: 'medium',
        structuredResult: {
          adapter: 'auto-match-rd-planner',
          records,
          softwareCopyrightCount: sourceRows.filter(
            (row) => row.softWorkType === 3,
          ).length,
          strategy: 'software-copyright-first',
        },
        summary:
          drafts.length === plan.targetCount
            ? `已按软著优先分类生成 ${drafts.length} 条研发立项报告草稿`
            : `已按软著优先分类生成 ${drafts.length} 条研发立项报告草稿，目标 ${plan.targetCount} 条；剩余数量需补充更多未关联 RD 的知识产权后再生成。`,
      });
    } catch (error) {
      if (task) {
        await this.markClientPropertyAiTaskFailed(
          task,
          this.resolveErrorMessage(error),
        );
      }
    }
  }

  async listClientResearchGenerationDrafts(
    userId: number,
  ): Promise<{ items: ClientAiDraftItem[]; total: number }> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.listEnterpriseResearchGenerationDrafts(enterpriseId);
  }

  async listEnterpriseResearchGenerationDrafts(
    enterpriseId: string,
  ): Promise<{ items: ClientAiDraftItem[]; total: number }> {
    const rows = await this.aiDraftRepo.find({
      order: {
        id: 'DESC',
      },
      where: {
        draftType: 'research_project',
        enterpriseId,
        status: Not('approved'),
      },
    });

    return this.listClientPropertyDraftsSortedByIpCode(enterpriseId, rows);
  }

  async updateClientResearchGenerationDraft(
    userId: number,
    id: string,
    input: UpdateClientAiDraftDto,
  ): Promise<ClientAiDraftItem> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const draft = await this.requireClientAiDraft(
      enterpriseId,
      id,
      'research_project',
    );
    if (draft.status === 'approved') {
      throw new BadRequestException('已入库的草稿不能修改');
    }

    draft.draftPayload = JSON.stringify({
      ...this.parseJsonObject(draft.draftPayload),
      ...input.data,
    });
    draft.status = 'reviewing';
    return (
      await this.enrichClientPropertyDraftItemsWithReviewWarnings(enterpriseId, [
        this.toClientAiDraftItem(await this.aiDraftRepo.save(draft)),
      ])
    )[0];
  }

  async approveClientResearchGenerationDrafts(
    userId: number,
    input: ApproveClientAiDraftsDto,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.approveEnterpriseResearchGenerationDrafts(
      enterpriseId,
      String(userId),
      input,
    );
  }

  async approveEnterpriseResearchGenerationDrafts(
    enterpriseId: string,
    reviewedBy: string,
    input: ApproveClientAiDraftsDto,
  ) {
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)))];
    if (ids.length === 0) {
      throw new BadRequestException('请选择要入库的 RD 草稿');
    }

    const config = this.getProfileRecordConfig('property', 'researchProject');
    const pendingResearchNames = new Set<string>();
    const rows = await this.aiDraftRepo.find({
      where: {
        draftType: 'research_project',
        enterpriseId,
        id: In(ids),
      },
    });
    const success: Array<{ draftId: string; recordId: string }> = [];
    const failed: Array<{ draftId: string; reason: string }> = [];
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    ids
      .filter((id) => !rowsById.has(id))
      .forEach((id) => {
        failed.push({ draftId: id, reason: 'RD 草稿不存在或已被删除' });
      });

    for (const draft of rows) {
      if (draft.status === 'approved') {
        failed.push({ draftId: String(draft.id), reason: '草稿已入库' });
        continue;
      }
      if (draft.status === 'rejected') {
        failed.push({
          draftId: String(draft.id),
          reason: '草稿已标记不入库，如需入库请先编辑后恢复待审核',
        });
        continue;
      }

      const payload = this.normalizeResearchGenerationDraftPayload(
        this.parseJsonObject(draft.draftPayload),
      );
      const projectName = this.toNullableStringFromUnknown(payload.ky_project_name) ?? '';
      const normalizedProjectName = this.normalizePropertyName(projectName);
      if (pendingResearchNames.has(normalizedProjectName)) {
        failed.push({
          draftId: String(draft.id),
          reason: '本次入库的 RD 草稿名称重复',
        });
        continue;
      }
      const validationMessage = await this.validateResearchDraftForApproval(
        enterpriseId,
        payload,
      );
      if (validationMessage) {
        failed.push({ draftId: String(draft.id), reason: validationMessage });
        continue;
      }
      pendingResearchNames.add(normalizedProjectName);

      const entity = this.enterprisePropertyRecordRepo.create({
        enterpriseId,
        recordType: config.recordType,
        status: 1,
      });
      Object.assign(entity, this.toProfileRecordEntityData(payload, config));
      await this.applyResearchTransformationRelationsFromIps(enterpriseId, entity);
      if (!this.isClientRdCode(entity.kyProjectNum)) {
        entity.kyProjectNum = await this.getNextClientPropertySequentialCode(
          enterpriseId,
          'research_project',
          'kyProjectNum',
          'RD',
        );
      }
      const saved = await this.enterprisePropertyRecordRepo.save(entity);
      await this.syncClientPropertyReverseRelations(
        enterpriseId,
        'rd',
        String(saved.id),
        {
          ipIds: this.parseRelationIds(saved.relatedIpIds),
          psIds: this.parseRelationIds(saved.relatedPsIds),
          transformationIds: this.parseRelationIds(saved.relatedTransformationIds),
        },
      );

      draft.approvedRecordId = String(saved.id);
      draft.reviewedAt = new Date();
      draft.reviewedBy = reviewedBy;
      draft.status = 'approved';
      await this.aiDraftRepo.save(draft);
      success.push({ draftId: String(draft.id), recordId: String(saved.id) });
    }

    if (success.length > 0) {
      await this.recalculateEnterpriseProfileStats(enterpriseId);
    }

    return {
      failed,
      success,
      total: ids.length,
    };
  }

  async rejectClientResearchGenerationDrafts(
    userId: number,
    input: ApproveClientAiDraftsDto,
  ) {
    return this.rejectClientPropertyGenerationDrafts(
      userId,
      input,
      'research_project',
      'RD 草稿',
    );
  }

  async deleteClientResearchGenerationDraft(userId: number, id: string) {
    return this.deleteClientPropertyGenerationDraft(
      userId,
      id,
      'research_project',
      'RD 草稿',
    );
  }

  async deleteClientResearchGenerationDrafts(
    userId: number,
    input: ApproveClientAiDraftsDto,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.deleteEnterpriseResearchGenerationDrafts(
      enterpriseId,
      input,
    );
  }

  async deleteEnterpriseResearchGenerationDrafts(
    enterpriseId: string,
    input: ApproveClientAiDraftsDto,
  ) {
    return this.deleteEnterprisePropertyGenerationDrafts(
      enterpriseId,
      input,
      'research_project',
      'RD 草稿',
    );
  }

  async listClientProductServiceGenerationSources(userId: number) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    await this.renumberClientIpCodes(enterpriseId);
    const [ipRows, rdRows, psRows] = await Promise.all([
      this.enterprisePropertyRecordRepo.find({
        where: {
          enterpriseId,
          recordType: 'intellectual_property',
          status: 1,
        },
      }),
      this.enterprisePropertyRecordRepo.find({
        order: {
          id: 'DESC',
        },
        where: {
          enterpriseId,
          recordType: 'research_project',
          status: 1,
        },
      }),
      this.enterprisePropertyRecordRepo.find({
        where: {
          enterpriseId,
          recordType: 'product_service',
          status: 1,
        },
      }),
    ]);
    const usedRdIds = this.collectRelatedRdIds(psRows);
    const ipLabels = new Map(
      ipRows.map((ip) => [
        String(ip.id),
        this.formatClientPropertyRelationLabel(ip.ipCode, ip.softWorkName),
      ]),
    );

    const orderedRdRows = this.sortClientPropertyRowsByRelatedIpCode(
      rdRows,
      ipRows,
    );
    return {
      items: orderedRdRows.map((row) => ({
        endDate: row.endDate,
        hasProductService: usedRdIds.has(String(row.id)),
        id: String(row.id),
        initDate: row.initDate,
        name: row.kyProjectName,
        number: row.kyProjectNum,
        projectType: row.projectType,
        relatedIpIds: row.relatedIpIds,
        relatedIpLabels: this.parseRelationIds(row.relatedIpIds)
          .map((id) => ipLabels.get(id) ?? id)
          .join('、'),
      })),
      total: rdRows.length,
    };
  }

  async createClientProductServiceGenerationTask(
    userId: number,
    input: CreateClientProductServiceGenerationDto,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.createEnterpriseProductServiceGenerationTask(
      enterpriseId,
      String(userId),
      input,
    );
  }

  async createEnterpriseProductServiceGenerationTask(
    enterpriseId: string,
    operatorId: string,
    input: CreateClientProductServiceGenerationDto,
  ) {
    await this.renumberClientIpCodes(enterpriseId);
    const activeTask = await this.aiTaskRepo.findOne({
      where: {
        bizId: enterpriseId,
        bizType: 'enterprise',
        scene: 'product_service_generation',
        status: In(['pending', 'processing']),
      },
    });
    if (activeTask) {
      throw new BadRequestException('PS 草稿生成任务处理中，请稍候');
    }
    const selectedIds = new Set((input.rdIds ?? []).map((id) => String(id)));
    const [ipRows, rdRows, psRows, activeDrafts, transformationRows] = await Promise.all([
      this.enterprisePropertyRecordRepo.find({
        where: {
          enterpriseId,
          recordType: 'intellectual_property',
          status: 1,
        },
      }),
      this.enterprisePropertyRecordRepo.find({
        order: {
          id: 'DESC',
        },
        where: {
          enterpriseId,
          recordType: 'research_project',
          status: 1,
        },
      }),
      this.enterprisePropertyRecordRepo.find({
        where: {
          enterpriseId,
          recordType: 'product_service',
          status: 1,
        },
      }),
      this.aiDraftRepo.find({
        where: { draftType: 'product_service', enterpriseId, status: 'reviewing' },
      }),
      this.enterprisePropertyRecordRepo.find({
        where: { enterpriseId, recordType: 'transformation', status: 1 },
      }),
    ]);
    const usedRdIds = this.collectRelatedRdIds(psRows);
    const sourceRows = this.sortClientPropertyRowsByRelatedIpCode(
      rdRows.filter((row) => {
        const selected = selectedIds.size === 0 || selectedIds.has(String(row.id));
        const notGenerated = input.includeExisting || !usedRdIds.has(String(row.id));
        const rdIpIds = this.parseRelationIds(row.relatedIpIds);
        const hasTransformation =
          this.parseRelationIds(row.relatedTransformationIds).length > 0 ||
          transformationRows.some((item) =>
            this.parseRelationIds(item.relatedIpIds).some((id) =>
              rdIpIds.includes(id),
            ),
          );
        return selected && notGenerated && hasTransformation;
      }),
      ipRows,
    );

    if (sourceRows.length === 0) {
      throw new BadRequestException('没有已关联成果转化的 RD 项目，请先生成并审核成果转化');
    }
    const existingPsCount = psRows.length;
    const maxDraftCount = Math.min(
      this.resolveTargetCount(input.targetCount, 1, 10, 5),
      Math.max(0, 10 - existingPsCount - activeDrafts.length),
    );
    if (maxDraftCount <= 0) {
      throw new BadRequestException(
        `当前已存在 ${existingPsCount} 条正式 PS 和 ${activeDrafts.length} 条待审核草稿，已达到 10 条上限。`,
      );
    }

    const task = await this.aiTaskRepo.save(
      this.aiTaskRepo.create({
        bizId: enterpriseId,
        bizType: 'enterprise',
        createdBy: operatorId,
        inputSnapshot: JSON.stringify({
          existingPsCount,
          businessMode: input.businessMode ?? 'auto',
          includeExisting: Boolean(input.includeExisting),
          maxDraftCount,
          rdIds: sourceRows.map((row) => String(row.id)),
        }),
        scene: 'product_service_generation',
        status: 'processing',
      }),
    );

    const plannedGroups = this.groupResearchRowsForProductService(
      sourceRows,
      maxDraftCount,
    );
    setImmediate(() => {
      void this.runProductServiceGenerationTask(
        String(task.id),
        enterpriseId,
        sourceRows.map((row) => String(row.id)),
        Boolean(input.includeExisting),
        maxDraftCount,
        existingPsCount,
        input.businessMode ?? 'auto',
      );
    });

    return {
      drafts: [],
      taskId: String(task.id),
      total: plannedGroups.length,
    };
  }

  private async runProductServiceGenerationTask(
    taskId: string,
    enterpriseId: string,
    sourceIds: string[],
    includeExisting: boolean,
    maxDraftCount: number,
    existingPsCount: number,
    businessMode: PropertyBusinessMode,
  ): Promise<void> {
    let task: AiTaskEntity | null = null;
    try {
      task = await this.aiTaskRepo.findOne({
        where: {
          bizId: enterpriseId,
          bizType: 'enterprise',
          id: taskId,
          scene: 'product_service_generation',
        },
      });
      if (!task) {
        return;
      }

      const [rdRows, ipRows, transformationRows] = await Promise.all([
        this.enterprisePropertyRecordRepo.find({
          order: {
            id: 'DESC',
          },
          where: {
            enterpriseId,
            id: In(sourceIds),
            recordType: 'research_project',
            status: 1,
          },
        }),
        this.enterprisePropertyRecordRepo.find({
          where: {
            enterpriseId,
            recordType: 'intellectual_property',
            status: 1,
          },
        }),
        this.enterprisePropertyRecordRepo.find({
          where: {
            enterpriseId,
            recordType: 'transformation',
            status: 1,
          },
        }),
      ]);
      if (rdRows.length === 0) {
        throw new BadRequestException('娌℃湁鍙敓鎴?PS 鐨?RD 椤圭洰');
      }

      const orderedRdRows = this.sortClientPropertyRowsByRelatedIpCode(
        rdRows,
        ipRows,
      );
      const drafts: AiDraftEntity[] = [];
      const groups = this.groupResearchRowsForProductService(
        orderedRdRows,
        maxDraftCount,
      );
      for (const [index, groupRows] of groups.entries()) {
        const payload = await this.buildProductServiceGenerationDraftPayloadWithAi(
          task,
          groupRows,
          ipRows,
          transformationRows,
          index + 1,
          existingPsCount,
        );
        const resolvedBusinessMode = businessMode === 'mixed'
          ? this.resolveBusinessModeFromDraft(payload)
          : await this.resolvePropertyBusinessMode(enterpriseId, businessMode);
        payload.ps_name = await this.resolveGeneratedPropertyName(
          enterpriseId,
          'product_service',
          'ps_name',
          this.applyBusinessModeToPropertyName(
            this.toNullableStringFromUnknown(payload.ps_name) ?? '',
            resolvedBusinessMode,
          ),
        );
        drafts.push(
          await this.aiDraftRepo.save(
            this.aiDraftRepo.create({
              draftPayload: JSON.stringify(payload),
              draftType: 'product_service',
              enterpriseId,
              sourceIds: JSON.stringify(groupRows.map((row) => String(row.id))),
              status: 'reviewing',
              taskId: String(task.id),
            }),
          ),
        );
      }
      await this.saveClientPropertyAiResult(task, {
        confidence: 'medium',
        structuredResult: {
          adapter: 'field-grouping-ps-generator',
          existingPsCount,
          groupCount: groups.length,
          includeExisting,
          records: drafts.map((draft) => this.parseJsonObject(draft.draftPayload)),
        },
        summary: `宸叉寜 RD 棰嗗煙鍒嗙粍鐢熸垚 ${drafts.length} 鏉?PS 鑽夌`,
      });
    } catch (error) {
      if (task) {
        await this.markClientPropertyAiTaskFailed(
          task,
          this.resolveErrorMessage(error),
        );
      }
    }
  }

  async listClientProductServiceGenerationDrafts(
    userId: number,
  ): Promise<{ items: ClientAiDraftItem[]; total: number }> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.listEnterpriseProductServiceGenerationDrafts(enterpriseId);
  }

  async listEnterpriseProductServiceGenerationDrafts(
    enterpriseId: string,
  ): Promise<{ items: ClientAiDraftItem[]; total: number }> {
    const rows = await this.aiDraftRepo.find({
      order: {
        id: 'DESC',
      },
      where: {
        draftType: 'product_service',
        enterpriseId,
        status: Not('approved'),
      },
    });

    return this.listClientPropertyDraftsSortedByIpCode(enterpriseId, rows);
  }

  async updateClientProductServiceGenerationDraft(
    userId: number,
    id: string,
    input: UpdateClientAiDraftDto,
  ): Promise<ClientAiDraftItem> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const draft = await this.requireClientAiDraft(
      enterpriseId,
      id,
      'product_service',
    );
    if (draft.status === 'approved') {
      throw new BadRequestException('已入库的草稿不能修改');
    }

    const payload = {
      ...this.parseJsonObject(draft.draftPayload),
      ...input.data,
    };
    draft.draftPayload = JSON.stringify(payload);
    const relatedRdIds = this.parseDelimitedIds(payload.related_rd_ids);
    draft.sourceIds = JSON.stringify(relatedRdIds);
    draft.status = 'reviewing';
    return (
      await this.enrichClientPropertyDraftItemsWithReviewWarnings(enterpriseId, [
        this.toClientAiDraftItem(await this.aiDraftRepo.save(draft)),
      ])
    )[0];
  }

  async duplicateClientProductServiceGenerationDraft(
    userId: number,
    id: string,
  ): Promise<ClientAiDraftItem> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const draft = await this.requireClientAiDraft(
      enterpriseId,
      id,
      'product_service',
    );
    if (draft.status === 'approved') {
      throw new BadRequestException('已入库的草稿不能拆分');
    }

    const payload = this.parseJsonObject(draft.draftPayload);
    const sourceIds = this.parseDelimitedIds(payload.related_rd_ids);
    const duplicate = await this.aiDraftRepo.save(
      this.aiDraftRepo.create({
        draftPayload: JSON.stringify({
          ...payload,
          ps_code: null,
          ps_name: `${this.toNullableStringFromUnknown(payload.ps_name) ?? '未命名 PS'}（拆分草稿）`,
        }),
        draftType: 'product_service',
        enterpriseId,
        sourceIds:
          sourceIds.length > 0
            ? JSON.stringify(sourceIds)
            : draft.sourceIds,
        status: 'reviewing',
        taskId: draft.taskId,
      }),
    );

    return (
      await this.enrichClientPropertyDraftItemsWithReviewWarnings(enterpriseId, [
        this.toClientAiDraftItem(duplicate),
      ])
    )[0];
  }

  async deleteClientProductServiceGenerationDraft(userId: number, id: string) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const draft = await this.requireClientAiDraft(
      enterpriseId,
      id,
      'product_service',
    );
    if (draft.status === 'approved') {
      throw new BadRequestException('已入库的草稿不能删除');
    }

    await this.aiDraftRepo.delete({ id: draft.id, enterpriseId });
    return {
      id: String(draft.id),
      success: true,
    };
  }

  async rejectClientProductServiceGenerationDrafts(
    userId: number,
    input: ApproveClientAiDraftsDto,
  ) {
    return this.rejectClientPropertyGenerationDrafts(
      userId,
      input,
      'product_service',
      'PS 草稿',
    );
  }

  async approveClientProductServiceGenerationDrafts(
    userId: number,
    input: ApproveClientAiDraftsDto,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.approveEnterpriseProductServiceGenerationDrafts(
      enterpriseId,
      String(userId),
      input,
    );
  }

  async approveEnterpriseProductServiceGenerationDrafts(
    enterpriseId: string,
    reviewedBy: string,
    input: ApproveClientAiDraftsDto,
  ) {
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)))];
    if (ids.length === 0) {
      throw new BadRequestException('请选择要入库的 PS 草稿');
    }

    const config = this.getProfileRecordConfig('property', 'productService');
    const rows = await this.aiDraftRepo.find({
      where: {
        draftType: 'product_service',
        enterpriseId,
        id: In(ids),
      },
    });
    const success: Array<{ draftId: string; recordId: string }> = [];
    const failed: Array<{ draftId: string; reason: string }> = [];
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    ids
      .filter((id) => !rowsById.has(id))
      .forEach((id) => {
        failed.push({ draftId: id, reason: 'PS 草稿不存在或已被删除' });
      });

    for (const draft of rows) {
      if (draft.status === 'approved') {
        failed.push({ draftId: String(draft.id), reason: '草稿已入库' });
        continue;
      }
      if (draft.status === 'rejected') {
        failed.push({
          draftId: String(draft.id),
          reason: '草稿已标记不入库，如需入库请先编辑后恢复待审核',
        });
        continue;
      }

      const payload = this.normalizeProductServiceGenerationDraftPayload(
        this.parseJsonObject(draft.draftPayload),
      );
      const validationMessage = await this.validateProductServiceDraftForApproval(
        enterpriseId,
        payload,
      );
      if (validationMessage) {
        failed.push({ draftId: String(draft.id), reason: validationMessage });
        continue;
      }

      const entity = this.enterprisePropertyRecordRepo.create({
        enterpriseId,
        recordType: config.recordType,
        status: 1,
      });
      Object.assign(entity, this.toProfileRecordEntityData(payload, config));
      const saved = await this.enterprisePropertyRecordRepo.save(entity);
      await this.syncClientPropertyReverseRelations(
        enterpriseId,
        'ps',
        String(saved.id),
        {
          ipIds: this.parseRelationIds(saved.relatedIpIds),
          rdIds: this.parseRelationIds(saved.relatedRdIds),
          transformationIds: this.parseRelationIds(saved.relatedTransformationIds),
        },
      );

      draft.approvedRecordId = String(saved.id);
      draft.reviewedAt = new Date();
      draft.reviewedBy = reviewedBy;
      draft.status = 'approved';
      await this.aiDraftRepo.save(draft);
      success.push({ draftId: String(draft.id), recordId: String(saved.id) });
    }

    if (success.length > 0) {
      await this.recalculateEnterpriseProfileStats(enterpriseId);
    }

    return {
      failed,
      success,
      total: ids.length,
    };
  }

  async getClientMaterials(userId: number, request?: Request) {
    const enterpriseId = await this.getCurrentEnterpriseIdOrNull(userId);
    if (!enterpriseId) {
      return [];
    }

    const rows = await this.enterpriseMaterialRepo.find({
      order: {
        id: 'DESC',
      },
      where: {
        enterpriseId,
      },
    });

    return rows.map((item) => this.toClientMaterialRecord(item, request));
  }

  async previewClientEnterpriseMaterial(
    userId: number,
    materialId: string,
    response: Response,
  ): Promise<void> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    await this.previewEnterpriseMaterial(enterpriseId, materialId, response);
  }

  async previewEnterpriseMaterial(
    enterpriseId: string,
    materialId: string,
    response: Response,
  ): Promise<void> {
    const material = await this.enterpriseMaterialRepo.findOne({
      where: {
        enterpriseId,
        id: materialId,
      },
    });
    if (!material?.filePath) {
      throw new NotFoundException('材料文件不存在');
    }

    const { absolutePath, storedPath } = resolveStoredUploadAbsolutePath(
      material.filePath,
    );
    const fileStat = await stat(absolutePath).catch(() => null);
    if (!fileStat?.isFile()) {
      throw new NotFoundException('材料文件不存在');
    }

    const filename = material.fileName || basename(storedPath);
    response.setHeader('Content-Length', String(fileStat.size));
    response.setHeader('Content-Type', this.resolveUploadPreviewContentType(filename));
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(filename)}"`,
    );
    await pipeline(createReadStream(absolutePath), response);
  }

  async getClientMaterialErrors(userId: number, materialId: string) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const material = await this.enterpriseMaterialRepo.findOne({
      where: {
        enterpriseId,
        id: materialId,
      },
    });
    if (!material) {
      throw new NotFoundException('材料记录不存在');
    }

    const errors = await this.enterpriseMaterialParseErrorRepo.find({
      order: {
        rowNumber: 'ASC',
        id: 'ASC',
      },
      where: {
        enterpriseId,
        materialId: material.id,
      },
    });

    return errors.map((error) => ({
      fieldName: error.fieldName,
      id: String(error.id),
      message: error.errorMessage,
      rawValue: error.rawValue,
      rowNumber: error.rowNumber,
      sheetName: error.sheetName,
      suggestion: error.suggestion,
    }));
  }

  async getClientEmployeeStats(userId: number) {
    const enterpriseId = await this.getCurrentEnterpriseIdOrNull(userId);
    if (!enterpriseId) {
      return this.emptyEmployeeStats();
    }

    const rows = await this.enterpriseEmployeeRecordRepo.find({
      where: {
        enterpriseId,
        status: 1,
      },
    });
    const total = rows.length;
    const activeCount = rows.filter((row) => row.isActive !== 0).length;
    const researchCount = rows.filter((row) => row.isKjyf === 1).length;
    const attachmentCount = rows.filter((row) =>
      [
        row.educationFile,
        row.laborContractFile,
        row.socialSecurityFile,
        row.titleFile,
        row.ygFiles,
      ].some((value) => this.isFilledValue(value)),
    ).length;

    return {
      activeCount,
      attachmentCount,
      education: this.countEmployeeOption(rows.map((row) => row.ygXl)),
      researchCount,
      researchRatio: this.roundStatNumber(
        total > 0 ? (researchCount / total) * 100 : 0,
      ),
      title: this.countEmployeeOption(rows.map((row) => row.ygZc)),
      total,
    };
  }

  async exportClientEmployees(userId: number, response: Response): Promise<void> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    await this.exportEnterpriseEmployees(enterpriseId, response);
  }

  async exportEnterpriseEmployees(
    enterpriseId: string,
    response: Response,
  ): Promise<void> {
    const [enterprise, rows] = await Promise.all([
      this.enterpriseRepo.findOne({ where: { id: enterpriseId } }),
      this.enterpriseEmployeeRecordRepo.find({
        order: {
          id: 'ASC',
        },
        where: {
          enterpriseId,
          status: 1,
        },
      }),
    ]);
    if (!enterprise) {
      throw new NotFoundException('企业不存在');
    }

    const ExcelJS = this.requireExcelRuntime();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'new-kjqb';
    workbook.created = new Date();

    const enterpriseSheet = workbook.addWorksheet('企业信息');
    enterpriseSheet.columns = [
      { header: '企业名称', key: 'name', width: 32 },
      { header: '统一社会信用代码', key: 'creditCode', width: 28 },
    ];
    enterpriseSheet.getRow(1).font = { bold: true };
    enterpriseSheet.addRow({
      creditCode: enterprise.creditCode,
      name: enterprise.name,
    });

    const sheet = workbook.addWorksheet('员工花名册');
    sheet.columns = EMPLOYEE_IMPORT_COLUMNS.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width,
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    rows.forEach((row) => {
      sheet.addRow({
        annual_work_days: row.annualWorkDays ?? '',
        department: row.department ?? '',
        education_file: row.educationFile ?? '',
        entry_date: row.entryDate ?? '',
        id_card: row.idCard ?? '',
        is_active: this.formatEmployeeYesNo(row.isActive),
        is_kjyf: this.formatEmployeeYesNo(row.isKjyf),
        labor_contract_file: row.laborContractFile ?? '',
        major: '',
        position: row.position ?? '',
        rd_projects: row.rdProjects ?? '',
        remark: row.remark ?? '',
        social_security_file: row.socialSecurityFile ?? '',
        title_file: row.titleFile ?? '',
        yg_files: row.ygFiles ?? '',
        yg_lx: this.formatEmployeeType(row.ygLx),
        yg_lxgg: this.formatEmployeeYesNo(row.ygLxgg),
        yg_name: row.ygName ?? '',
        yg_nl: this.formatEmployeeAgeRange(row.ygNl),
        yg_qr: this.formatEmployeeYesNo(row.ygQr),
        yg_sex: this.formatEmployeeGender(row.ygSex),
        yg_wj: this.formatEmployeeYesNo(row.ygWj),
        yg_xl: this.formatEmployeeEducation(row.ygXl),
        yg_zc: this.formatEmployeeJobTitle(row.ygZc),
      });
    });

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent('员工花名册.xlsx')}`,
    );
    const buffer = await workbook.xlsx.writeBuffer();
    response.send(Buffer.from(buffer));
  }

  async downloadEmployeeImportTemplate(response: Response): Promise<void> {
    await this.sendEmployeeTemplateWorkbook(
      response,
      this.requireBuiltinTemplate('employee-info'),
    );
  }

  async downloadClientEmployeeTemplate(response: Response): Promise<void> {
    return this.downloadEmployeeImportTemplate(response);
  }

  private async importFinanceMaterial(
    userId: number,
    enterpriseId: string,
    material: EnterpriseMaterialEntity,
    file: StoredUploadFile,
  ): Promise<void> {
    await this.enterpriseMaterialParseErrorRepo.delete({
      enterpriseId,
      materialId: material.id,
    });

    const extension = extname(file.originalname || '').toLowerCase();
    if (extension !== '.csv') {
      const errors = [
        {
          fieldName: 'file',
          message: '当前版本财税导入仅支持 CSV 文件',
          rawValue: file.originalname,
          rowNumber: 1,
          suggestion: '请先下载财务信息模板，使用 Excel 填写后另存为 CSV 再上传。',
        },
      ];
      await this.persistFinanceImportResult(enterpriseId, material, errors, {
        errorCount: errors.length,
        financialCount: 0,
        status: 'invalid',
        taxAuditCount: 0,
      });
      return;
    }

    const filePath = this.resolveUploadedFileAbsolutePath(file);
    if (!filePath || !existsSync(filePath)) {
      const errors = [
        {
          fieldName: 'file',
          message: '上传文件不存在或无法读取',
          rawValue: file.originalname,
          rowNumber: 1,
          suggestion: '请重新上传财税模板文件。',
        },
      ];
      await this.persistFinanceImportResult(enterpriseId, material, errors, {
        errorCount: errors.length,
        financialCount: 0,
        status: 'invalid',
        taxAuditCount: 0,
      });
      return;
    }

    const content = readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, '');
    const { errors, rows } = this.parseFinanceCsv(content);
    let financialCount = 0;
    let taxAuditCount = 0;

    for (const row of rows) {
      const rowErrors = this.validateFinanceImportRow(row);
      errors.push(...rowErrors);
      if (rowErrors.length > 0) {
        continue;
      }

      const recordType = this.normalizeFinanceRecordType(
        this.getFinanceImportCell(row, ['记录类型', 'record_type']),
      );
      if (recordType === 'financial') {
        await this.upsertFinancialImportRow(enterpriseId, row);
        financialCount += 1;
      }
      if (recordType === 'tax_audit') {
        await this.upsertTaxAuditImportRow(enterpriseId, row);
        taxAuditCount += 1;
      }
    }

    const summary: FinanceImportSummary = {
      errorCount: errors.length,
      financialCount,
      status:
        errors.length === 0
          ? 'valid'
          : financialCount + taxAuditCount > 0
            ? 'partial'
            : 'invalid',
      taxAuditCount,
    };
    await this.persistFinanceImportResult(enterpriseId, material, errors, summary);
    if (userId > 0 && financialCount + taxAuditCount > 0) {
      await this.recalculateClientEnterpriseProfileStats(userId);
    }
  }

  private async runEnterpriseContractRecognitionTask(
    taskId: string,
    enterpriseId: string,
    sources: Array<{
      draftId: string;
      filePath: string;
      materialId: string;
      sourceName: string;
    }>,
  ): Promise<void> {
    const task = await this.aiTaskRepo.findOne({
      where: { bizId: enterpriseId, bizType: 'enterprise', id: taskId, scene: 'contract_recognition' },
    });
    if (!task) {
      return;
    }
    try {
      task.status = 'processing';
      await this.aiTaskRepo.save(task);
      const drafts: AiDraftEntity[] = [];
      const failedRecords: Array<{ reason: string; sourceName: string }> = [];
      for (const source of sources) {
        const draft = await this.aiDraftRepo.findOne({
          where: { enterpriseId, id: source.draftId, taskId: String(task.id) },
        });
        if (!draft) {
          continue;
        }
        try {
          const payload = await this.buildContractRecognitionDraftPayloadWithAi(
            task,
            source.sourceName,
            source.filePath,
          );
          draft.draftPayload = JSON.stringify(payload);
          draft.status = 'reviewing';
          drafts.push(await this.aiDraftRepo.save(draft));
        } catch (error) {
          const reason = this.resolveErrorMessage(error);
          draft.status = 'failed';
          draft.draftPayload = JSON.stringify({
            ...this.parseJsonObject(draft.draftPayload),
            recognition_note: '识别失败',
            review_warnings: [reason],
          });
          await this.aiDraftRepo.save(draft);
          failedRecords.push({ reason, sourceName: source.sourceName });
        }
      }
      await this.saveClientPropertyAiResult(task, {
        confidence: this.resolveDraftsConfidenceLabel(
          drafts.map((draft) => this.parseJsonObject(draft.draftPayload)),
        ),
        structuredResult: {
          failedRecords,
          materialIds: sources.map((source) => source.materialId),
          records: drafts.map((draft) => this.parseJsonObject(draft.draftPayload)),
        },
        summary: `已从 ${sources.length} 个 PDF 生成 ${drafts.length} 条合同识别草稿，失败 ${failedRecords.length} 条`,
      });
    } catch (error) {
      await this.markClientPropertyAiTaskFailed(task, this.resolveErrorMessage(error));
    }
  }

  private async buildContractRecognitionDraftPayloadWithAi(
    task: AiTaskEntity,
    sourceName: string,
    filePath: string,
  ): Promise<Record<string, unknown>> {
    const pdfText = await this.extractPdfTextFromStoredPath(filePath, 'finance');
    const fallback = this.buildContractRecognitionDraftPayloadFromSource(
      sourceName,
      filePath,
      pdfText,
    );
    const textAiPayload = pdfText.status !== 'success'
      ? {
        ...fallback,
        ai_adapter: 'pdf-text-parser',
        ai_adapter_status: 'fallback_only',
        pdf_text_error: pdfText.errorMessage ?? null,
      }
      : await this.generateClientPropertyDraftWithAi({
        fallback,
        fallbackAdapter: 'pdf-text-rule',
        input: {
          fileName: sourceName,
          pdfText: pdfText.snippet,
          textQuality: { fieldHitScore: pdfText.fieldHitScore, status: pdfText.status },
        },
        outputSchema: {
          record: {
            confidence: '0-100 数字',
            end_date: '合同截止日期，YYYY-MM-DD 或空字符串',
            ht_des: '合同内容摘要，缺失则为空字符串',
            ht_money: '合同金额，只保留数字和小数点，缺失则为空字符串',
            ht_name: '合同名称',
            ht_num: '合同编号，缺失则为空字符串',
            kh_name: '甲方或客户名称，缺失则为空字符串',
            qd_date: '签订日期，YYYY-MM-DD 或空字符串',
            recognition_note: '不超过12字的识别说明',
            start_date: '合同生效日期，YYYY-MM-DD 或空字符串',
          },
        },
        protectedKeys: ['ht_path', 'source_file_name', 'source_file_path'],
        sceneLabel: '合同 PDF 识别',
        systemPrompt: '你是企业合同资料助手。请只根据 PDF 真实可读文本和文件名识别合同字段：合同名称、合同编号、甲方/客户名称、签订日期、生效日期、截止日期、合同金额和合同摘要。合同名称必须优先使用首页的项目、产品、标的或服务全称；不得只输出“合同”“购销合同”“服务合同”“技术开发合同”等泛化文种。若标题只有文种，应结合项目/产品/服务名称组成完整名称；仍无法确定时使用去除盖章标记后的文件名。无法确认的字段必须为空字符串，绝不能编造合同编号、客户、日期或金额。金额只输出阿拉伯数字和小数点。recognition_note使用不超过12字的业务短句。输出必须是JSON对象。',
        task,
      });
    const normalizedTextPayload = this.normalizeContractRecognitionDraftPayload(textAiPayload);
    if (!this.shouldUseContractVisionFallback(normalizedTextPayload, pdfText)) {
      return normalizedTextPayload;
    }

    return (await this.tryBuildContractRecognitionDraftFromVision(
      task,
      sourceName,
      filePath,
      normalizedTextPayload,
    )) ?? normalizedTextPayload;
  }

  private shouldUseContractVisionFallback(
    payload: Record<string, unknown>,
    pdfText: IpPdfTextExtractionResult,
  ): boolean {
    if (pdfText.status !== 'success') {
      return true;
    }
    const recognizedCount = [
      payload.ht_num,
      payload.kh_name,
      payload.qd_date,
      payload.ht_money,
    ].filter((value) => Boolean(this.toNullableStringFromUnknown(value))).length;
    return recognizedCount < 3 || (this.toNullableNumber(payload.confidence) ?? 0) < 70;
  }

  private async tryBuildContractRecognitionDraftFromVision(
    task: AiTaskEntity,
    sourceName: string,
    filePath: string,
    fallback: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    if (
      process.env.AI_CONTRACT_VISION_ENABLE === '0' ||
      !process.env.AI_API_KEY ||
      !process.env.AI_VISION_MODEL
    ) {
      return null;
    }
    const absolutePath = this.resolveStoredFileAbsolutePath(filePath);
    if (!absolutePath || extname(filePath || sourceName).toLowerCase() !== '.pdf') {
      return null;
    }

    try {
      const maxPages = this.resolvePositiveIntegerEnv(
        'AI_CONTRACT_VISION_MAX_PAGES',
        4,
        1,
        6,
      );
      const imageDataUrls = await this.renderPdfPagesToImageDataUrls(
        absolutePath,
        maxPages,
      );
      if (imageDataUrls.length === 0) {
        return null;
      }
      const results = await Promise.all(
        imageDataUrls.map((imageDataUrl, index) =>
          this.aiService.runVisionJsonCompletion({
            imageDataUrl,
            outputSchema: this.getContractVisionOutputSchema(),
            scene: 'contract_recognition_vision',
            systemPrompt: this.getContractVisionSystemPrompt(),
            taskId: String(task.id),
            userPrompt: [
              `文件名：${sourceName}`,
              `当前为第 ${index + 1} 页。`,
              '请只识别合同真实可见字段。若不是合同，请在 document_type 中明确标记。',
              '只返回 JSON，不要输出 Markdown。无法确认的字段返回空字符串或 null。',
            ].join('\n'),
          }),
        ),
      );
      const merged = this.mergeContractVisionResults(
        results.map((result) => result.structuredResult),
      );
      return this.normalizeContractRecognitionVisionResult(
        merged,
        fallback,
        results[0]?.model ?? '视觉模型',
        imageDataUrls.length,
      );
    } catch (error) {
      console.warn(
        '[CONTRACT_RECOGNITION_VISION_FAILED]',
        this.resolveErrorMessage(error),
      );
      return null;
    }
  }

  private getContractVisionOutputSchema(): Record<string, unknown> {
    return {
      confidence: '0-100 数字',
      document_type: 'contract=合同，invoice=发票，other=其他',
      record: {
        end_date: '合同截止日期，YYYY-MM-DD 或空字符串',
        ht_des: '合同服务或项目内容摘要，缺失则为空字符串',
        ht_money: '合同金额，只保留数字和小数点，缺失则为空字符串',
        ht_name: '合同名称，必须包含项目/产品/服务等具体标的，不能只写购销合同、服务合同等泛化文种',
        ht_num: '合同编号，缺失则为空字符串',
        kh_name: '甲方或客户名称，缺失则为空字符串',
        qd_date: '签订日期，YYYY-MM-DD 或空字符串',
        recognition_note: '不超过12字的识别说明',
        start_date: '合同生效日期，YYYY-MM-DD 或空字符串',
      },
      warnings: ['需要人工核对的问题'],
    };
  }

  private getContractVisionSystemPrompt(): string {
    return [
      '你是企业合同资料视觉识别助手。',
      '只根据提供的合同页面图片识别字段，看不清或页面不存在的内容必须为空。',
      '识别合同名称、合同编号、甲方或客户名称、签订日期、生效日期、截止日期、合同金额和合同内容摘要。',
      '合同名称必须包含具体项目、产品、标的或服务名称；不得只输出“合同”“购销合同”“服务合同”“技术开发合同”等泛化文种。标题只有文种时，请从首页项目或标的内容补全。',
      '金额只保留阿拉伯数字和小数点；日期统一为 YYYY-MM-DD。',
      '严禁编造合同编号、客户、日期、金额或盖章信息。若文件不是合同，document_type 必须为 invoice 或 other。',
      '必须只返回 JSON 对象，不要输出 Markdown。',
    ].join('\n');
  }

  private mergeContractVisionResults(
    values: Record<string, unknown>[],
  ): Record<string, unknown> {
    const records = values
      .map((value) =>
        this.compactRecord(
          this.normalizeContractVisionRecord(
            this.resolveClientPropertyAiRecord(value),
          ),
        ),
      )
      .filter((value) => Object.keys(value).length > 0);
    const record = records.reduce(
      (result, value) => ({ ...value, ...result }),
      {} as Record<string, unknown>,
    );
    const documentType = values
      .map((value) => this.toNullableStringFromUnknown(value.document_type))
      .find((value) => value === 'contract')
      ?? values
        .map((value) => this.toNullableStringFromUnknown(value.document_type))
        .find(Boolean)
      ?? 'other';
    const modelConfidence = Math.max(
      ...[...values, ...records]
        .map((value) => this.toNullableNumber(value.confidence))
        .filter((value): value is number => value !== null),
      0,
    );
    const recognizedFieldCount = ['ht_name', 'ht_num', 'kh_name', 'ht_money']
      .filter((field) => records.some((recordItem) => this.toNullableStringFromUnknown(recordItem[field])))
      .length;
    const fieldConfidence =
      recognizedFieldCount >= 4
        ? 88
        : recognizedFieldCount >= 3
          ? 78
          : recognizedFieldCount >= 2
            ? 65
            : recognizedFieldCount >= 1
              ? 50
              : 0;
    const confidence = Math.max(modelConfidence, fieldConfidence);
    const warnings = values.flatMap((value) =>
      this.readStringArrayFromUnknown(value.warnings, []),
    );
    return { ...record, confidence, document_type: documentType, warnings };
  }

  private normalizeContractVisionRecord(
    value: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalized = { ...value };
    const aliases: Record<string, string[]> = {
      end_date: ['expiry_date', 'expiration_date'],
      ht_des: ['contract_summary', 'contract_content_summary'],
      ht_money: ['contract_amount', 'amount'],
      ht_name: ['contract_name', 'agreement_name'],
      ht_num: ['contract_number', 'contract_no', 'agreement_number'],
      kh_name: [
        'party_a_or_customer_name',
        'party_a_or_client',
        'party_a_name',
        'client_name',
      ],
      qd_date: ['signing_date', 'contract_date'],
      start_date: ['effective_date', 'start_effective_date'],
    };

    for (const [field, fieldAliases] of Object.entries(aliases)) {
      if (this.toNullableStringFromUnknown(normalized[field])) {
        continue;
      }
      const aliasValue = fieldAliases
        .map((alias) => this.toNullableStringFromUnknown(normalized[alias]))
        .find((item): item is string => Boolean(item));
      if (aliasValue) {
        normalized[field] = aliasValue;
      }
    }

    return normalized;
  }

  private normalizeContractRecognitionVisionResult(
    result: Record<string, unknown>,
    fallback: Record<string, unknown>,
    model: string,
    pageCount: number,
  ): Record<string, unknown> {
    const documentType = this.toNullableStringFromUnknown(result.document_type) ?? 'other';
    const normalized = this.normalizeContractRecognitionDraftPayload({
      ...fallback,
      ...this.removeEmptyAiDraftValues(result),
      ai_adapter: `${process.env.AI_PROVIDER || 'psydo'}-vision`,
      ai_adapter_status: 'success',
      ai_model: model,
      confidence: Math.max(
        this.normalizeConfidenceScore(fallback.confidence, 0),
        this.normalizeConfidenceScore(result.confidence, 0, 40, 95),
      ),
      document_type: documentType,
      recognition_note: this.toShortRecognitionNote(
        result.recognition_note,
        documentType === 'contract' ? '视觉识别' : '非合同待核对',
      ),
      review_warnings: [
        `已使用 ${model} 视觉模型识别 ${pageCount} 页，请核对合同编号、客户和金额后再确认。`,
        ...this.readStringArrayFromUnknown(result.warnings, []),
        ...(documentType === 'contract' ? [] : ['视觉识别结果非合同，不能直接入库。']),
        ...this.readStringArrayFromUnknown(fallback.review_warnings, []),
      ],
      source_file_name: fallback.source_file_name,
      source_file_path: fallback.source_file_path,
      ht_path: fallback.ht_path,
    });
    return normalized;
  }

  private buildContractRecognitionDraftPayloadFromSource(
    sourceName: string,
    filePath: string,
    pdfText: IpPdfTextExtractionResult,
  ): Record<string, unknown> {
    const text = pdfText.status === 'success' ? pdfText.snippet.replace(/\s+/gu, ' ').trim() : '';
    const contractTitle = this.extractContractRecognitionField(text, ['合同名称', '协议名称']);
    const projectName = this.extractContractRecognitionField(text, [
      '项目名称',
      '产品名称',
      '标的名称',
      '服务名称',
    ]);
    const htName = this.resolveContractRecognitionName(
      contractTitle,
      sourceName,
      projectName,
    ) || '待确认合同';
    const htNum = this.extractContractRecognitionField(text, ['合同编号', '合同号', '协议编号', '编号']).slice(0, 128);
    const khName = this.extractContractRecognitionField(text, ['甲方', '采购人', '买方', '客户'])
      .replace(/^(?:名称|单位名称)\s*[:：]?\s*/u, '')
      .replace(/(?:乙方|联系人|地址|统一社会信用代码).*$/u, '')
      .trim()
      .slice(0, 255);
    const qdDate = this.extractContractRecognitionDate(text, ['签订日期', '合同签订日期', '签约日期']);
    const startDate = this.extractContractRecognitionDate(text, ['生效日期', '起始日期', '开始日期']);
    const endDate = this.extractContractRecognitionDate(text, ['截止日期', '终止日期', '结束日期']);
    const htMoney = this.extractContractRecognitionAmount(text);
    const recognizedCount = [htNum, khName, qdDate, htMoney].filter(Boolean).length;
    const reviewWarnings = this.buildContractRecognitionReviewWarnings({
      end_date: endDate,
      ht_money: htMoney,
      ht_name: htName,
      ht_num: htNum,
      kh_name: khName,
      qd_date: qdDate,
      start_date: startDate,
    });
    return {
      confidence: recognizedCount >= 3 ? 88 : recognizedCount >= 1 ? 68 : 40,
      end_date: endDate || null,
      ht_des: recognizedCount ? `已识别 ${recognizedCount} 项合同关键信息，请人工核对。` : '未识别到明确合同字段，请人工补全。',
      ht_money: htMoney || null,
      ht_name: htName,
      ht_num: htNum || null,
      ht_path: filePath,
      ht_status: 1,
      kh_name: khName || null,
      qd_date: qdDate || null,
      recognition_note: pdfText.status === 'success' ? (recognizedCount >= 3 ? '识别成功' : '部分识别') : '需人工补全',
      review_warnings: reviewWarnings,
      source_file_name: sourceName,
      source_file_path: filePath,
      start_date: startDate || null,
    };
  }

  private normalizeContractRecognitionDraftPayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const htName = this.resolveContractRecognitionName(
      this.toNullableStringFromUnknown(payload.ht_name),
      this.toNullableStringFromUnknown(payload.source_file_name),
    );
    const normalized = {
      ...payload,
      confidence: this.normalizeConfidenceScore(payload.confidence, 0),
      end_date: this.toNullableStringFromUnknown(payload.end_date)?.slice(0, 32) ?? null,
      ht_des: this.toNullableStringFromUnknown(payload.ht_des)?.slice(0, 1000) ?? null,
      ht_money: this.toNullableStringFromUnknown(payload.ht_money)?.slice(0, 64) ?? null,
      ht_name: htName?.slice(0, 255) ?? null,
      ht_num: this.toNullableStringFromUnknown(payload.ht_num)?.slice(0, 128) ?? null,
      ht_path: this.toNullableStringFromUnknown(payload.ht_path)?.slice(0, 500) ?? null,
      ht_status: this.toNullableNumber(payload.ht_status) ?? 1,
      kh_name: this.toNullableStringFromUnknown(payload.kh_name)?.slice(0, 255) ?? null,
      qd_date: this.toNullableStringFromUnknown(payload.qd_date)?.slice(0, 32) ?? null,
      recognition_note: this.toShortRecognitionNote(payload.recognition_note, '部分识别'),
      source_file_name: this.toNullableStringFromUnknown(payload.source_file_name)?.slice(0, 255) ?? null,
      source_file_path: this.toNullableStringFromUnknown(payload.source_file_path)?.slice(0, 500) ?? null,
      start_date: this.toNullableStringFromUnknown(payload.start_date)?.slice(0, 32) ?? null,
    };
    return {
      ...normalized,
      review_warnings: [
        ...new Set([
          ...this.readStringArrayFromUnknown(payload.review_warnings, []),
          ...this.buildContractRecognitionReviewWarnings(normalized),
        ]),
      ],
    };
  }

  private resolveContractRecognitionName(
    name: null | string,
    sourceName: null | string,
    projectName?: null | string,
  ): null | string {
    const normalizedName = this.toNullableStringFromUnknown(name);
    const normalizedProjectName = this.toNullableStringFromUnknown(projectName);
    const normalizedSourceName = this.normalizeContractRecognitionSourceName(sourceName);
    if (normalizedName && !this.isGenericContractRecognitionName(normalizedName)) {
      return normalizedName;
    }
    if (normalizedProjectName && !this.isGenericContractRecognitionName(normalizedProjectName)) {
      return normalizedName
        ? `${normalizedProjectName}${normalizedName}`.slice(0, 255)
        : normalizedProjectName;
    }
    if (normalizedSourceName && !this.isGenericContractRecognitionName(normalizedSourceName)) {
      return normalizedSourceName;
    }
    return normalizedName ?? normalizedSourceName;
  }

  private normalizeContractRecognitionSourceName(sourceName: null | string): null | string {
    const normalized = this.toNullableStringFromUnknown(sourceName)
      ?.replace(/\.[^.]+$/u, '')
      .replace(/[【[][^】\]]{0,30}(?:盖章|签章|扫描件|已签署)[^】\]]*[】\]]/gu, '')
      .replace(/\s+/gu, ' ')
      .trim();
    return normalized || null;
  }

  private isGenericContractRecognitionName(value: string): boolean {
    return new Set([
      '合同',
      '合同书',
      '协议',
      '协议书',
      '购销合同',
      '采购合同',
      '销售合同',
      '服务合同',
      '技术服务合同',
      '技术开发合同',
      '合作协议',
    ]).has(value.replace(/[\s《》【】\[\]()（）_-]/gu, ''));
  }

  private buildContractRecognitionReviewWarnings(payload: Record<string, unknown>): string[] {
    const warnings: string[] = [];
    if (!this.toNullableStringFromUnknown(payload.ht_name)) warnings.push('合同名称待确认');
    if (!this.toNullableStringFromUnknown(payload.ht_num)) warnings.push('合同编号待确认');
    if (!this.toNullableStringFromUnknown(payload.kh_name)) warnings.push('客户名称待确认');
    if (!this.toNullableStringFromUnknown(payload.ht_money)) warnings.push('合同金额待确认');
    return warnings;
  }

  private async runEnterpriseInvoiceRecognitionTask(
    taskId: string,
    enterpriseId: string,
    sources: Array<{
      draftId: string;
      filePath: string;
      materialId: string;
      sourceName: string;
    }>,
  ): Promise<void> {
    const task = await this.aiTaskRepo.findOne({
      where: { bizId: enterpriseId, bizType: 'enterprise', id: taskId, scene: 'invoice_recognition' },
    });
    if (!task) return;
    try {
      task.status = 'processing';
      await this.aiTaskRepo.save(task);
      const drafts: AiDraftEntity[] = [];
      const failedRecords: Array<{ reason: string; sourceName: string }> = [];
      for (const source of sources) {
        const draft = await this.aiDraftRepo.findOne({
          where: { enterpriseId, id: source.draftId, taskId: String(task.id) },
        });
        if (!draft) continue;
        try {
          const payload = await this.buildInvoiceRecognitionDraftPayloadWithAi(
            task,
            enterpriseId,
            source.sourceName,
            source.filePath,
          );
          draft.draftPayload = JSON.stringify(payload);
          draft.status = 'reviewing';
          drafts.push(await this.aiDraftRepo.save(draft));
        } catch (error) {
          const reason = this.resolveErrorMessage(error);
          draft.status = 'failed';
          draft.draftPayload = JSON.stringify({
            ...this.parseJsonObject(draft.draftPayload),
            recognition_note: '识别失败',
            review_warnings: [reason],
          });
          await this.aiDraftRepo.save(draft);
          failedRecords.push({ reason, sourceName: source.sourceName });
        }
      }
      await this.saveClientPropertyAiResult(task, {
        confidence: this.resolveDraftsConfidenceLabel(
          drafts.map((draft) => this.parseJsonObject(draft.draftPayload)),
        ),
        structuredResult: {
          failedRecords,
          materialIds: sources.map((source) => source.materialId),
          records: drafts.map((draft) => this.parseJsonObject(draft.draftPayload)),
        },
        summary: `已从 ${sources.length} 个 PDF 生成 ${drafts.length} 条发票识别草稿，失败 ${failedRecords.length} 条`,
      });
    } catch (error) {
      await this.markClientPropertyAiTaskFailed(task, this.resolveErrorMessage(error));
    }
  }

  private async buildInvoiceRecognitionDraftPayloadWithAi(
    task: AiTaskEntity,
    enterpriseId: string,
    sourceName: string,
    filePath: string,
  ): Promise<Record<string, unknown>> {
    const pdfText = await this.extractPdfTextFromStoredPath(filePath, 'finance');
    const fallback = this.buildInvoiceRecognitionDraftPayloadFromSource(
      sourceName,
      filePath,
      pdfText,
    );
    const textAiPayload = pdfText.status !== 'success'
      ? { ...fallback, ai_adapter: 'pdf-text-parser', ai_adapter_status: 'fallback_only' }
      : await this.generateClientPropertyDraftWithAi({
        fallback,
        fallbackAdapter: 'pdf-text-rule',
        input: {
          fileName: sourceName,
          pdfText: pdfText.snippet,
          textQuality: { fieldHitScore: pdfText.fieldHitScore, status: pdfText.status },
        },
        outputSchema: this.getInvoiceRecognitionOutputSchema(),
        protectedKeys: ['fp_path', 'source_file_name', 'source_file_path'],
        sceneLabel: '发票 PDF 识别',
        systemPrompt: this.getInvoiceRecognitionSystemPrompt(),
        task,
      });
    const normalizedTextPayload = this.normalizeInvoiceRecognitionDraftPayload(textAiPayload);
    const payload = this.shouldUseInvoiceVisionFallback(normalizedTextPayload, pdfText)
      ? (await this.tryBuildInvoiceRecognitionDraftFromVision(
          task,
          sourceName,
          filePath,
          normalizedTextPayload,
        )) ?? normalizedTextPayload
      : normalizedTextPayload;
    return this.applyInvoiceRecognitionContractMatch(enterpriseId, payload);
  }

  private buildInvoiceRecognitionDraftPayloadFromSource(
    sourceName: string,
    filePath: string,
    pdfText: IpPdfTextExtractionResult,
  ): Record<string, unknown> {
    const text = pdfText.status === 'success' ? pdfText.snippet.replace(/\s+/gu, ' ').trim() : '';
    const fpNum = this.extractInvoiceRecognitionField(
      text,
      ['发票号码', '发票号', '号码'],
    ) || this.extractInvoiceNumberFromFileName(sourceName);
    const fpDate = this.extractInvoiceRecognitionDate(text);
    const fpMoney = this.extractInvoiceRecognitionAmount(text);
    const recognizedCount = [fpNum, fpDate, fpMoney].filter(Boolean).length;
    return {
      confidence: recognizedCount >= 3 ? 88 : recognizedCount >= 2 ? 70 : recognizedCount ? 50 : 40,
      fp_date: fpDate || null,
      fp_money: fpMoney || null,
      fp_num: fpNum || null,
      fp_path: filePath,
      fp_status: 1,
      recognition_note: pdfText.status === 'success' ? (recognizedCount >= 2 ? '部分识别' : '需人工补全') : '需人工补全',
      review_warnings: this.buildInvoiceRecognitionReviewWarnings({ fp_money: fpMoney, fp_num: fpNum }),
      source_file_name: sourceName,
      source_file_path: filePath,
    };
  }

  private getInvoiceRecognitionOutputSchema(): Record<string, unknown> {
    return {
      record: {
        contract_number: '关联的合同编号，无法确认则为空字符串',
        confidence: '0-100 数字',
        fp_date: '开票日期，YYYY-MM-DD 或空字符串',
        fp_money: '价税合计金额，只保留数字和小数点，缺失则为空字符串',
        fp_num: '发票号码',
        purchaser_name: '购买方/客户名称，缺失则为空字符串',
        recognition_note: '不超过12字的识别说明',
        remark: '发票内容或货物服务名称摘要，缺失则为空字符串',
      },
    };
  }

  private getInvoiceRecognitionSystemPrompt(): string {
    return [
      '你是企业增值税发票资料识别助手。',
      '只根据 PDF 真实可见内容识别发票号码、开票日期、价税合计金额、购买方名称、货物或服务摘要和合同编号。',
      '发票号码、日期、金额、合同编号看不清时必须为空，不得猜测；金额只输出阿拉伯数字和小数点，日期统一为 YYYY-MM-DD。',
      '合同编号仅在发票中真实出现时输出，用于系统自动关联现有合同。',
      '必须只返回 JSON 对象，不要输出 Markdown。',
    ].join('\n');
  }

  private shouldUseInvoiceVisionFallback(
    payload: Record<string, unknown>,
    pdfText: IpPdfTextExtractionResult,
  ): boolean {
    if (pdfText.status !== 'success') return true;
    const recognizedCount = [payload.fp_num, payload.fp_date, payload.fp_money]
      .filter((value) => Boolean(this.toNullableStringFromUnknown(value))).length;
    return recognizedCount < 3 || (this.toNullableNumber(payload.confidence) ?? 0) < 70;
  }

  private async tryBuildInvoiceRecognitionDraftFromVision(
    task: AiTaskEntity,
    sourceName: string,
    filePath: string,
    fallback: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    if (
      process.env.AI_INVOICE_VISION_ENABLE === '0' ||
      !process.env.AI_API_KEY ||
      !process.env.AI_VISION_MODEL
    ) return null;
    const absolutePath = this.resolveStoredFileAbsolutePath(filePath);
    if (!absolutePath || extname(filePath || sourceName).toLowerCase() !== '.pdf') return null;
    try {
      const imageDataUrls = await this.renderPdfPagesToImageDataUrls(
        absolutePath,
        this.resolvePositiveIntegerEnv('AI_INVOICE_VISION_MAX_PAGES', 1, 1, 3),
      );
      if (imageDataUrls.length === 0) return null;
      const results = await Promise.all(
        imageDataUrls.map((imageDataUrl, index) => this.aiService.runVisionJsonCompletion({
          imageDataUrl,
          outputSchema: this.getInvoiceVisionOutputSchema(),
          scene: 'invoice_recognition_vision',
          systemPrompt: this.getInvoiceRecognitionSystemPrompt(),
          taskId: String(task.id),
          userPrompt: [
            `文件名：${sourceName}`,
            `当前为第 ${index + 1} 页。`,
            '请只识别真实可见的发票字段；若不是发票，document_type 必须标记为 contract 或 other。',
            '只返回 JSON，不要输出 Markdown。',
          ].join('\n'),
        })),
      );
      return this.normalizeInvoiceRecognitionVisionResult(
        this.mergeInvoiceVisionResults(results.map((result) => result.structuredResult)),
        fallback,
        results[0]?.model ?? '视觉模型',
        imageDataUrls.length,
      );
    } catch (error) {
      console.warn('[INVOICE_RECOGNITION_VISION_FAILED]', this.resolveErrorMessage(error));
      return null;
    }
  }

  private getInvoiceVisionOutputSchema(): Record<string, unknown> {
    return {
      confidence: '0-100 数字',
      document_type: 'invoice=发票，contract=合同，other=其他',
      record: this.getInvoiceRecognitionOutputSchema().record,
      warnings: ['需要人工核对的问题'],
    };
  }

  private mergeInvoiceVisionResults(values: Record<string, unknown>[]): Record<string, unknown> {
    const records = values
      .map((value) => this.compactRecord(this.normalizeInvoiceRecognitionRecord(this.resolveClientPropertyAiRecord(value))))
      .filter((value) => Object.keys(value).length > 0);
    const record = records.reduce(
      (result, value) => ({ ...value, ...result }),
      {} as Record<string, unknown>,
    );
    const documentType = values
      .map((value) => this.toNullableStringFromUnknown(value.document_type))
      .find((value) => value === 'invoice')
      ?? values.map((value) => this.toNullableStringFromUnknown(value.document_type)).find(Boolean)
      ?? 'other';
    const modelConfidence = Math.max(
      ...[...values, ...records]
        .map((value) => this.toNullableNumber(value.confidence))
        .filter((value): value is number => value !== null),
      0,
    );
    const fieldCount = ['fp_num', 'fp_date', 'fp_money']
      .filter((field) => records.some((item) => this.toNullableStringFromUnknown(item[field])))
      .length;
    const fieldConfidence = fieldCount >= 3 ? 88 : fieldCount >= 2 ? 70 : fieldCount ? 50 : 0;
    return {
      ...record,
      confidence: Math.max(modelConfidence, fieldConfidence),
      document_type: documentType,
      warnings: values.flatMap((value) => this.readStringArrayFromUnknown(value.warnings, [])),
    };
  }

  private normalizeInvoiceRecognitionRecord(value: Record<string, unknown>): Record<string, unknown> {
    const normalized = { ...value };
    const aliases: Record<string, string[]> = {
      contract_number: ['related_contract_number', 'contract_no', 'ht_num'],
      fp_date: ['invoice_date', 'issue_date', 'billing_date'],
      fp_money: ['invoice_amount', 'total_amount', 'tax_inclusive_amount', 'amount'],
      fp_num: ['invoice_number', 'invoice_no', 'number'],
      purchaser_name: ['buyer_name', 'customer_name', 'party_a_name'],
      remark: ['invoice_summary', 'goods_or_service_name', 'item_summary'],
    };
    for (const [field, fieldAliases] of Object.entries(aliases)) {
      if (this.toNullableStringFromUnknown(normalized[field])) continue;
      const aliasValue = fieldAliases
        .map((alias) => this.toNullableStringFromUnknown(normalized[alias]))
        .find((item): item is string => Boolean(item));
      if (aliasValue) normalized[field] = aliasValue;
    }
    return normalized;
  }

  private normalizeInvoiceRecognitionVisionResult(
    result: Record<string, unknown>,
    fallback: Record<string, unknown>,
    model: string,
    pageCount: number,
  ): Record<string, unknown> {
    const documentType = this.toNullableStringFromUnknown(result.document_type) ?? 'other';
    return this.normalizeInvoiceRecognitionDraftPayload({
      ...fallback,
      ...this.removeEmptyAiDraftValues(result),
      ai_adapter: `${process.env.AI_PROVIDER || 'psydo'}-vision`,
      ai_adapter_status: 'success',
      ai_model: model,
      confidence: Math.max(
        this.normalizeConfidenceScore(fallback.confidence, 0),
        this.normalizeConfidenceScore(result.confidence, 0, 40, 95),
      ),
      document_type: documentType,
      fp_path: fallback.fp_path,
      recognition_note: this.toShortRecognitionNote(
        result.recognition_note,
        documentType === 'invoice' ? '视觉识别' : '非发票待核对',
      ),
      review_warnings: [
        `已使用 ${model} 视觉模型识别 ${pageCount} 页，请核对发票号码、日期和金额后再确认。`,
        ...this.readStringArrayFromUnknown(result.warnings, []),
        ...(documentType === 'invoice' ? [] : ['视觉识别结果非发票，不能直接入库。']),
        ...this.readStringArrayFromUnknown(fallback.review_warnings, []),
      ],
      source_file_name: fallback.source_file_name,
      source_file_path: fallback.source_file_path,
    });
  }

  private normalizeInvoiceRecognitionDraftPayload(payload: Record<string, unknown>): Record<string, unknown> {
    const normalized = this.normalizeInvoiceRecognitionRecord(payload);
    return {
      ...normalized,
      confidence: this.normalizeConfidenceScore(normalized.confidence, 0),
      fp_date: this.toNullableStringFromUnknown(normalized.fp_date)?.slice(0, 32) ?? null,
      fp_money: this.toNullableStringFromUnknown(normalized.fp_money)?.slice(0, 64) ?? null,
      fp_num: this.toNullableStringFromUnknown(normalized.fp_num)?.slice(0, 128) ?? null,
      fp_path: this.toNullableStringFromUnknown(normalized.fp_path)?.slice(0, 500) ?? null,
      fp_status: this.toNullableNumber(normalized.fp_status) ?? 1,
      ht_id: this.toNullableStringFromUnknown(normalized.ht_id)?.slice(0, 32) ?? null,
      recognition_note: this.toShortRecognitionNote(normalized.recognition_note, '部分识别'),
      remark: this.toNullableStringFromUnknown(normalized.remark)?.slice(0, 500) ?? null,
      source_file_name: this.toNullableStringFromUnknown(normalized.source_file_name)?.slice(0, 255) ?? null,
      source_file_path: this.toNullableStringFromUnknown(normalized.source_file_path)?.slice(0, 500) ?? null,
      zf_date: this.toNullableStringFromUnknown(normalized.zf_date)?.slice(0, 32) ?? null,
    };
  }

  private buildInvoiceRecognitionReviewWarnings(payload: Record<string, unknown>): string[] {
    const warnings: string[] = [];
    if (!this.toNullableStringFromUnknown(payload.fp_num)) warnings.push('发票号码待确认');
    if (!this.toNullableStringFromUnknown(payload.fp_date)) warnings.push('开票日期待确认');
    if (!this.toNullableStringFromUnknown(payload.fp_money)) warnings.push('发票金额待确认');
    return warnings;
  }

  private async applyInvoiceRecognitionContractMatch(
    enterpriseId: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const normalized = this.normalizeInvoiceRecognitionDraftPayload(payload);
    if (normalized.ht_id) return normalized;
    const contractNo = this.toNullableStringFromUnknown(normalized.contract_number);
    if (!contractNo) return normalized;
    const matched = await this.enterpriseContractRecordRepo.findOne({
      where: { enterpriseId, htNum: contractNo, recordType: 'contract', status: 1 },
    });
    if (!matched) return normalized;
    const relationNote = `已按合同编号自动关联：${matched.htName ?? contractNo}`;
    return {
      ...normalized,
      ht_id: String(matched.id),
      remark: [this.toNullableStringFromUnknown(normalized.remark), relationNote]
        .filter(Boolean)
        .join('；')
        .slice(0, 500),
    };
  }

  private async validateInvoiceRecognitionDraftForApproval(
    enterpriseId: string,
    draft: AiDraftEntity,
    payload: Record<string, unknown>,
  ): Promise<null | string> {
    const documentType = this.toNullableStringFromUnknown(payload.document_type);
    if (documentType && documentType !== 'invoice') return '识别结果不是发票，请确认文件后再入库';
    const reviewWarnings = this.buildInvoiceRecognitionReviewWarnings(payload);
    if (reviewWarnings.length > 0) return `${reviewWarnings.join('、')}，请补充后再入库`;
    const filePath = normalizeStoredUploadPath(this.toNullableStringFromUnknown(payload.fp_path));
    if (!filePath) return '发票 PDF 路径无效';
    const materialId = this.parseAiDraftSourceIds(draft.sourceIds)[0];
    const material = materialId ? await this.enterpriseMaterialRepo.findOne({
      where: { enterpriseId, id: materialId, materialType: 'invoice_pdf' },
    }) : null;
    if (!material || normalizeStoredUploadPath(material.filePath) !== filePath) {
      return '发票 PDF 不属于当前企业材料台账';
    }
    if (payload.ht_id) {
      await this.requireEnterpriseContractRecordForInvoice(enterpriseId, String(payload.ht_id));
    }
    return null;
  }

  private async requireEnterpriseContractRecordForInvoice(enterpriseId: string, id: string) {
    const contract = await this.enterpriseContractRecordRepo.findOne({
      where: { enterpriseId, id, recordType: 'contract', status: 1 },
    });
    if (!contract) throw new BadRequestException('关联合同不存在或不属于当前企业');
    return contract;
  }

  private async rejectEnterpriseRecognitionDrafts(
    enterpriseId: string,
    reviewedBy: string,
    input: ApproveClientAiDraftsDto,
    draftType: string,
    label: string,
  ) {
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)))];
    if (ids.length === 0) throw new BadRequestException(`请选择要标记无效的${label}草稿`);
    const rows = await this.aiDraftRepo.find({ where: { draftType, enterpriseId, id: In(ids) } });
    const success: Array<{ draftId: string }> = [];
    const failed: Array<{ draftId: string; reason: string }> = [];
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    ids.filter((id) => !rowsById.has(id)).forEach((id) => {
      failed.push({ draftId: id, reason: `${label}识别草稿不存在或已被删除` });
    });
    for (const draft of rows) {
      if (draft.status === 'approved') {
        failed.push({ draftId: String(draft.id), reason: '已入库草稿不能标记无效' });
        continue;
      }
      draft.status = 'rejected';
      draft.reviewedAt = new Date();
      draft.reviewedBy = reviewedBy;
      await this.aiDraftRepo.save(draft);
      success.push({ draftId: String(draft.id) });
    }
    return { failed, success, total: ids.length };
  }

  private extractInvoiceRecognitionField(text: string, labels: string[]): string {
    if (!text) return '';
    const pattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return text.match(new RegExp(`(?:${pattern})\\s*[:：]?\\s*([0-9A-Z-]{6,32})`, 'iu'))?.[1]?.trim() ?? '';
  }

  private extractInvoiceNumberFromFileName(sourceName: string): string {
    return sourceName.match(/(?:发票|fp)[^0-9A-Z]*([0-9A-Z]{8,20})/iu)?.[1] ?? '';
  }

  private extractInvoiceRecognitionDate(text: string): string {
    const matched = text.match(/(?:开票日期|日期)\\s*[:：]?\\s*(20\\d{2})[.年/-](\\d{1,2})[.月/-](\\d{1,2})/u);
    return matched?.[1] && matched[2] && matched[3]
      ? `${matched[1]}-${matched[2].padStart(2, '0')}-${matched[3].padStart(2, '0')}`
      : '';
  }

  private extractInvoiceRecognitionAmount(text: string): string {
    return text.match(/(?:价税合计|合计金额|金额)\\s*[:：]?\\s*(?:人民币|RMB|￥)?\\s*([\\d,]+(?:\\.\\d{1,2})?)/iu)?.[1]?.replaceAll(',', '') ?? '';
  }

  private async validateContractRecognitionDraftForApproval(
    enterpriseId: string,
    draft: AiDraftEntity,
    payload: Record<string, unknown>,
  ): Promise<null | string> {
    const documentType = this.toNullableStringFromUnknown(payload.document_type);
    if (documentType && documentType !== 'contract') {
      return '识别结果不是合同，请确认文件后再入库';
    }
    const reviewWarnings = this.buildContractRecognitionReviewWarnings(payload);
    if (reviewWarnings.length > 0) {
      return `${reviewWarnings.join('、')}，请补充后再入库`;
    }
    const filePath = normalizeStoredUploadPath(this.toNullableStringFromUnknown(payload.ht_path));
    if (!filePath) {
      return '合同 PDF 路径无效';
    }
    const materialId = this.parseAiDraftSourceIds(draft.sourceIds)[0];
    const material = materialId ? await this.enterpriseMaterialRepo.findOne({
      where: { enterpriseId, id: materialId, materialType: 'contract_pdf' },
    }) : null;
    if (!material || normalizeStoredUploadPath(material.filePath) !== filePath) {
      return '合同 PDF 不属于当前企业材料台账';
    }
    return null;
  }

  private extractContractRecognitionField(text: string, labels: string[]): string {
    if (!text) return '';
    const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const match = text.match(new RegExp(`(?:${labelPattern})\\s*[:：]\\s*([^\\n]{1,160})`, 'u'));
    return match?.[1]?.replace(/\s+/gu, ' ').trim() ?? '';
  }

  private extractContractRecognitionDate(text: string, labels: string[]): string {
    if (!text) return '';
    const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const match = text.match(new RegExp(`(?:${labelPattern})\\s*[:：]?\\s*(20\\d{2})[.年/-](\\d{1,2})[.月/-](\\d{1,2})`, 'u'));
    if (!match?.[1] || !match[2] || !match[3]) return '';
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }

  private extractContractRecognitionAmount(text: string): string {
    const match = text.match(/(?:合同金额|含税金额|合同价款|金额)\s*[:：]?\s*(?:人民币|RMB|￥)?\s*([\d,]+(?:\.\d{1,2})?)/iu);
    return match?.[1]?.replaceAll(',', '') ?? '';
  }

  private buildIpRecognitionDraftPayload(
    file: StoredUploadFile,
    filePath: string,
    request?: Request,
  ): Record<string, unknown> {
    const sourceName = file.originalname || file.filename;
    return this.buildIpRecognitionDraftPayloadFromSource(
      sourceName,
      filePath,
      buildUploadPublicUrl(filePath, request) ?? filePath,
    );
  }

  private async buildIpRecognitionDraftPayloadWithAi(
    task: AiTaskEntity,
    sourceName: string,
    filePath: string,
    publicFilePath: string,
  ): Promise<Record<string, unknown>> {
    const pdfText = await this.extractPdfTextFromStoredPath(filePath);
    const pdfTextSnippet = pdfText.status === 'success' ? pdfText.snippet : '';
    const fallback = this.buildIpRecognitionDraftPayloadFromSource(
      sourceName,
      filePath,
      publicFilePath,
      '',
      pdfText,
    );
    const protectedKeys = ['soft_work_file', 'source_file_name', 'source_file_path'];
    const fallbackCertificateNo = this.toNullableStringFromUnknown(
      fallback.soft_work_num,
    );
    if (
      fallbackCertificateNo &&
      !this.isPlaceholderIpNumber(fallbackCertificateNo)
    ) {
      protectedKeys.push('soft_work_num');
    }
    if (this.toNullableNumber(fallback.soft_work_type)) {
      protectedKeys.push('ip_level', 'soft_work_type');
    }
    if (this.shouldUseIpVisionFallback(pdfText)) {
      const visionPayload = await this.tryBuildIpRecognitionDraftFromVision(
        task,
        sourceName,
        filePath,
        publicFilePath,
        fallback,
        pdfText,
      );
      if (visionPayload) {
        return visionPayload;
      }
    }

    if (pdfText.status !== 'success') {
      return {
        ...fallback,
        ai_adapter: pdfText.status === 'failed' ? 'pdf-text-parser' : 'filename-rule',
        ai_adapter_status: 'fallback_only',
        pdf_text_error: pdfText.errorMessage ?? null,
      };
    }

    return this.generateClientPropertyDraftWithAi({
      fallback: {
        ...fallback,
      },
      fallbackAdapter: 'pdf-text-filename-rule',
      input: {
        fileName: sourceName,
        pdfText: pdfTextSnippet,
        textQuality: {
          fieldHitScore: pdfText.fieldHitScore,
          status: pdfText.status,
        },
      },
      outputSchema: {
        record: {
          advanced_degree: '技术先进程度，缺失则为空字符串',
          apply_date: '专利申请日期或软著开发完成/首次发表日期，YYYY-MM-DD 或空字符串',
          authorize_date: '专利授权公告日或软著登记日期，YYYY-MM-DD 或空字符串',
          confidence: '0-100 数字',
          inventor: '发明人/设计人/开发者，缺失则为空字符串',
          ip_level: 'I类或II类',
          obtain_method: '自主研发、受让、许可等，缺失则为空字符串',
          recognition_note: '短句：识别成功、部分识别、需人工核对',
          remark: '技术摘要或证书摘要',
          right_holder: '权利人/著作权人',
          soft_work_name: '知识产权名称',
          soft_work_num: '证书号/专利号/登记号',
          soft_work_status: '状态数字，默认2',
          soft_work_type: '1发明专利、2实用新型、3软件著作权、4外观设计',
          support_effect: '对RD、成果转化、PS的支撑说明',
        },
      },
      protectedKeys,
      sceneLabel: '知识产权 PDF 识别',
      systemPrompt:
        '你是高新技术企业申报资料助手。请只根据文件名和PDF真实可读文本识别知识产权证书字段。专利重点识别发明专利、实用新型或外观设计类型、名称、专利号、专利权人、发明人/设计人、申请日期和授权公告日；软著重点识别登记号、软件名称、著作权人、开发完成日期、首次发表日期、登记日期。无法确认的字段必须写空字符串，不得编造证书号、权利人、日期、合同、收入或客户。recognition_note必须是不超过12字的业务短句，不要解释PDF乱码、OCR、兜底或AI状态。输出必须是JSON对象。',
      task,
    });
  }

  private async resolveResearchAutoMatchCandidate(
    enterpriseId: string,
    input: CreateClientResearchAutoMatchDto,
  ): Promise<ResearchAutoMatchCandidate> {
    const selectedIds = new Set((input.ipIds ?? []).map((id) => String(id)));
    const [ipRows, existingRdRows, existingRdDraftRows] = await Promise.all([
      this.enterprisePropertyRecordRepo.find({
        order: { id: 'ASC' },
        where: {
          enterpriseId,
          recordType: 'intellectual_property',
          status: 1,
        },
      }),
      this.enterprisePropertyRecordRepo.find({
        where: {
          enterpriseId,
          recordType: 'research_project',
          status: 1,
        },
      }),
      this.aiDraftRepo.find({
        where: { draftType: 'research_project', enterpriseId },
      }),
    ]);
    const sourceRows = this.sortClientIpRowsForNumbering(
      selectedIds.size > 0
        ? ipRows.filter((row) => selectedIds.has(String(row.id)))
        : ipRows,
    );
    const sourceValidIpCount = sourceRows.filter((row) =>
      this.parseDateOnlyTime(row.authorizeDate),
    ).length;
    const existingRdIpIds = this.collectRelatedIpIds(existingRdRows);
    const pendingRdDraftIpIds = new Set(
      existingRdDraftRows
        .filter((draft) => !['approved', 'failed', 'rejected'].includes(draft.status))
        .flatMap((draft) => this.parseRelationIds(draft.sourceIds)),
    );
    const availableRows = sourceRows.filter(
      (row) =>
        !existingRdIpIds.has(String(row.id)) &&
        !pendingRdDraftIpIds.has(String(row.id)),
    );
    const validRows = availableRows.filter((row) =>
      this.parseDateOnlyTime(row.authorizeDate),
    );
    const blockedReasons = [
      ...sourceRows
        .filter((row) => existingRdIpIds.has(String(row.id)))
        .map((row) => `IP ${row.ipCode ?? row.id} 已关联正式 RD`),
      ...sourceRows
        .filter((row) => pendingRdDraftIpIds.has(String(row.id)))
        .map((row) => `IP ${row.ipCode ?? row.id} 已存在待审核 RD 草稿`),
      ...availableRows
        .filter((row) => !this.parseDateOnlyTime(row.authorizeDate))
        .map((row) => `IP ${row.ipCode ?? row.id} 缺少登记/授权日期`),
    ];

    return {
      activeRdDraftRows: existingRdDraftRows.filter(
        (draft) => !['approved', 'failed', 'rejected'].includes(draft.status),
      ),
      availableRows,
      blockedReasons,
      existingRdRows,
      skippedIpCount: sourceRows.length - validRows.length,
      sourceValidIpCount,
      sourceRows,
      validRows,
    };
  }

  private shouldUseIpVisionFallback(pdfText: IpPdfTextExtractionResult): boolean {
    return pdfText.status !== 'success' || pdfText.fieldHitScore < 3;
  }

  private async tryBuildIpRecognitionDraftFromVision(
    task: AiTaskEntity,
    sourceName: string,
    filePath: string,
    publicFilePath: string,
    fallback: Record<string, unknown>,
    pdfText: IpPdfTextExtractionResult,
  ): Promise<Record<string, unknown> | null> {
    if (process.env.AI_IP_VISION_ENABLE === '0') {
      return null;
    }
    if (!process.env.AI_API_KEY || !process.env.AI_VISION_MODEL) {
      return null;
    }
    if (extname(filePath || sourceName).toLowerCase() !== '.pdf') {
      return null;
    }

    const absolutePath = this.resolveStoredFileAbsolutePath(filePath);
    if (!absolutePath) {
      return null;
    }

    try {
      const imageDataUrl = await this.renderFirstPdfPageToImageDataUrl(absolutePath);
      const aiResult = await this.aiService.runVisionJsonCompletion({
        imageDataUrl,
        outputSchema: this.getIpVisionOutputSchema(),
        scene: 'ip_recognition_vision',
        systemPrompt: this.getIpVisionSystemPrompt(),
        taskId: String(task.id),
        userPrompt: [
          `文件名：${sourceName}`,
          '请识别该 PDF 首页图片中的知识产权、审计报告、合同、发票或其他申报材料信息。',
          '如果不是知识产权证书，请在 document_type 和 warnings 中说明，并且不要编造知识产权字段。',
          '只返回 JSON，不要输出 Markdown。没有识别到的字段用空字符串或 null。',
        ].join('\n'),
      });
      const record = this.normalizeIpVisionResult(aiResult.structuredResult);
      const nonIpDocument = this.isNonIpVisionDocument(record);
      const basePayload = nonIpDocument
        ? this.clearIpRecognitionFieldsForNonIpDocument(fallback)
        : fallback;
      const protectedPayload = this.pickProtectedPayloadFields(fallback, [
        'soft_work_file',
        'source_file_name',
        'source_file_path',
      ]);
      const warnings = [
        `已使用 ${aiResult.model} 视觉模型识别，请核对证书号、权利人和日期后再确认。`,
        ...(nonIpDocument
          ? ['视觉识别为非知识产权材料，未生成知识产权字段。']
          : []),
        ...this.readStringArrayFromUnknown(aiResult.structuredResult.warnings, []),
      ];

      return {
        ...basePayload,
        ...record,
        ...protectedPayload,
        ai_adapter: `${process.env.AI_PROVIDER || 'psydo'}-vision`,
        ai_adapter_status: 'success',
        ai_model: aiResult.model,
        confidence: this.normalizeConfidenceScore(
          record.confidence,
          this.normalizeConfidenceScore(fallback.confidence, 0),
        ),
        needs_review: true,
        pdf_text_error: pdfText.errorMessage ?? null,
        pdf_text_field_hit_score: pdfText.fieldHitScore,
        pdf_text_status: pdfText.status,
        recognition_note: this.toShortRecognitionNote(
          record.recognition_note,
          '视觉识别',
        ),
        review_warnings: [...new Set(warnings)],
        soft_work_file: publicFilePath,
        source_file_name: sourceName,
        source_file_path: filePath,
      };
    } catch (error) {
      const errorMessage = this.resolveErrorMessage(error);
      console.warn('[IP_RECOGNITION_VISION_FAILED]', errorMessage);
      return null;
    }
  }

  private async renderFirstPdfPageToImageDataUrl(pdfPath: string): Promise<string> {
    const [firstPage] = await this.renderPdfPagesToImageDataUrls(pdfPath, 1);
    if (!firstPage) {
      throw new Error('PDF 渲染未生成图片');
    }
    return firstPage;
  }

  private async renderPdfPagesToImageDataUrls(
    pdfPath: string,
    maxPages: number,
  ): Promise<string[]> {
    const tempDir = join(tmpdir(), 'new-kjqb-ip-vision', randomUUID());
    mkdirSync(tempDir, { recursive: true });
    try {
      const outputPrefix = join(tempDir, 'page');
      const dpi = this.resolvePositiveIntegerEnv('PDF_RENDER_DPI', 180, 72, 300);
      const pdfToPpmPath = this.resolvePdfToPpmExecutable();
      await execFileAsync(
        pdfToPpmPath,
        ['-png', '-f', '1', '-l', String(maxPages), '-r', String(dpi), pdfPath, outputPrefix],
        { timeout: 60_000 },
      );
      const files = (await readdir(tempDir))
        .filter((file) => file.toLowerCase().endsWith('.png'))
        .sort((left, right) => left.localeCompare(right, 'en-US', { numeric: true }));
      return files
        .map((file) => join(tempDir, file))
        .filter((file) => existsSync(file))
        .map((file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  }

  private getIpVisionOutputSchema(): Record<string, unknown> {
    return {
      record: {
        advanced_degree: '技术先进程度，缺失则为空字符串',
        apply_date: '专利申请日期或软著开发完成/首次发表日期，YYYY-MM-DD 或空字符串',
        authorize_date: '专利授权公告日或软著登记日期，YYYY-MM-DD 或空字符串',
        confidence: '0-100 数字',
        document_type: '软著证书、专利证书、审计报告、合同、发票、其他',
        inventor: '发明人/设计人/开发者，缺失则为空字符串',
        ip_level: 'I类或II类，无法判断则为空字符串',
        obtain_method: '自主研发、受让、许可等，缺失则为空字符串',
        recognition_note: '短句：识别成功、部分识别、需人工核对',
        remark: '证书或材料摘要',
        right_holder: '权利人/著作权人/专利权人',
        soft_work_name: '知识产权名称',
        soft_work_num: '登记号/专利号/证书号',
        soft_work_status: '状态数字，默认2',
        soft_work_type: '1发明专利、2实用新型、3软件著作权、4外观设计；非知识产权为空',
        support_effect: '对RD、成果转化、PS的支撑说明',
      },
      warnings: ['需要人工核对的问题'],
    };
  }

  private getIpVisionSystemPrompt(): string {
    return [
      '你是高新技术企业申报资料视觉识别助手。',
      '请只根据用户提供的 PDF 页面图片识别字段，看不清或页面不存在的内容必须留空。',
      '优先识别知识产权证书。专利识别类型、名称、专利号、专利权人、发明人/设计人、申请日期、授权公告日；软件著作权识别登记号、软件名称、著作权人、开发完成日期、首次发表日期、登记日期。',
      '同时识别页面类型是否为审计报告、合同、发票或其他申报材料；如果不是知识产权证书，不要编造登记号、权利人、日期、合同、收入或客户。',
      '日期统一输出 YYYY-MM-DD；只能确定年月时可输出 YYYY-MM；无法确定则输出空字符串。',
      '必须只返回 JSON 对象，不要输出 Markdown。',
    ].join('\n');
  }

  private normalizeIpVisionResult(
    value: Record<string, unknown>,
  ): Record<string, unknown> {
    const record = this.resolveClientPropertyAiRecord(value);
    const documentType = this.toNullableStringFromUnknown(record.document_type);
    const softWorkType = this.toNullableNumber(record.soft_work_type);
    const normalized = this.removeEmptyAiDraftValues({
      advanced_degree: this.toNullableStringFromUnknown(record.advanced_degree),
      apply_date: this.toNullableStringFromUnknown(record.apply_date),
      authorize_date: this.toNullableStringFromUnknown(record.authorize_date),
      confidence: this.normalizeOptionalConfidenceScore(record.confidence),
      document_type: documentType,
      inventor: this.toNullableStringFromUnknown(record.inventor),
      ip_level: this.toNullableStringFromUnknown(record.ip_level),
      obtain_method: this.toNullableStringFromUnknown(record.obtain_method),
      recognition_note: this.toNullableStringFromUnknown(record.recognition_note),
      remark: this.toNullableStringFromUnknown(record.remark),
      right_holder: this.toNullableStringFromUnknown(record.right_holder),
      soft_work_name: this.toNullableStringFromUnknown(record.soft_work_name),
      soft_work_num: this.toNullableStringFromUnknown(record.soft_work_num),
      soft_work_status: this.toNullableNumber(record.soft_work_status) ?? 2,
      soft_work_type: softWorkType,
      support_effect: this.toNullableStringFromUnknown(record.support_effect),
    });

    if (!normalized.ip_level && softWorkType) {
      normalized.ip_level = softWorkType === 1 ? 'I类' : 'II类';
    }
    if (normalized.confidence === undefined) {
      const fieldCount = [
        normalized.soft_work_name,
        normalized.soft_work_num,
        normalized.right_holder,
        normalized.apply_date,
        normalized.authorize_date,
      ].filter(Boolean).length;
      normalized.confidence = Math.min(90, 45 + fieldCount * 10);
    }
    if (!normalized.recognition_note && documentType && !/证书|专利|软著|软件著作权/u.test(documentType)) {
      normalized.recognition_note = '非知识产权';
    }

    return normalized;
  }

  private isNonIpVisionDocument(record: Record<string, unknown>): boolean {
    const documentType = this.toNullableStringFromUnknown(record.document_type);
    if (!documentType) {
      return false;
    }
    if (/软著|软件著作权|专利|知识产权|证书/u.test(documentType)) {
      return false;
    }
    return /审计|合同|发票|报表|财税|其他/u.test(documentType);
  }

  private clearIpRecognitionFieldsForNonIpDocument(
    fallback: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...fallback,
      advanced_degree: '',
      apply_date: '',
      authorize_date: '',
      inventor: '',
      ip_level: '',
      obtain_method: '',
      remark: '',
      right_holder: '',
      soft_work_name: '',
      soft_work_num: '',
      soft_work_type: '',
      support_effect: '',
    };
  }

  private resolvePositiveIntegerEnv(
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const value = Number(process.env[key]);
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.floor(value)));
  }

  private resolvePdfToPpmExecutable(): string {
    const configuredPath = this.toNullableStringFromUnknown(process.env.PDFTOPPM_PATH);
    if (configuredPath) {
      return configuredPath;
    }
    if (process.platform !== 'win32') {
      return 'pdftoppm';
    }

    const codexBundledExecutable = join(
      homedir(),
      '.cache',
      'codex-runtimes',
      'codex-primary-runtime',
      'dependencies',
      'native',
      'poppler',
      'Library',
      'bin',
      'pdftoppm.exe',
    );
    if (existsSync(codexBundledExecutable)) {
      return codexBundledExecutable;
    }

    const pathExecutable = this.findExecutableOnPath('pdftoppm.exe');
    if (pathExecutable) {
      return pathExecutable;
    }

    const commandWrapper = this.findExecutableOnPath('pdftoppm.cmd');
    if (commandWrapper) {
      const bundledExecutable = [
        join(dirname(commandWrapper), '..', 'Library', 'bin', 'pdftoppm.exe'),
        join(
          dirname(dirname(commandWrapper)),
          'native',
          'poppler',
          'Library',
          'bin',
          'pdftoppm.exe',
        ),
      ].find((candidate) => existsSync(candidate));
      if (bundledExecutable) {
        return bundledExecutable;
      }
    }

    return 'pdftoppm';
  }

  private findExecutableOnPath(fileName: string): null | string {
    return (process.env.PATH ?? process.env.Path ?? '')
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => join(entry, fileName))
      .find((candidate) => existsSync(candidate)) ?? null;
  }

  private buildIpRecognitionDraftPayloadFromSource(
    sourceName: string,
    filePath: string,
    publicFilePath: string,
    extraText = '',
    pdfText?: IpPdfTextExtractionResult,
  ): Record<string, unknown> {
    const hints = this.extractIpRecognitionHints(
      [sourceName, extraText].filter(Boolean).join(' '),
    );
    const pdfHints =
      pdfText?.status === 'success'
        ? this.extractIpRecognitionHintsFromPdfText(pdfText.snippet)
        : {};
    const recognitionNote = this.resolveIpRecognitionNote(hints, pdfText);
    const recognizedPdfFields = Object.values(pdfHints).filter(Boolean).length;

    return {
      apply_date: pdfHints.applyDate ?? hints.applyDate,
      authorize_date: pdfHints.authorizeDate ?? hints.authorizeDate,
      confidence:
        recognizedPdfFields > 0
          ? Math.min(92, 45 + recognizedPdfFields * 10)
          : hints.confidence,
      inventor: hints.inventor,
      ip_level:
        (pdfHints.ipType ?? hints.ipType) === 1
          ? 'I类'
          : (pdfHints.ipType ?? hints.ipType)
            ? 'II类'
            : hints.ipLevel,
      is_core_ip: 0,
      needs_review: true,
      obtain_method: pdfHints.obtainMethod ?? hints.obtainMethod,
      pdf_text_field_hit_score: pdfText?.fieldHitScore ?? 0,
      pdf_text_status: pdfText?.status ?? 'empty',
      recognition_note: recognitionNote,
      remark: hints.remark,
      right_holder: pdfHints.rightHolder ?? hints.rightHolder,
      soft_work_file: publicFilePath,
      soft_work_name: pdfHints.name ?? hints.name,
      soft_work_num: pdfHints.certificateNo ?? hints.certificateNo,
      soft_work_status: 2,
      soft_work_type: pdfHints.ipType ?? hints.ipType,
      source_file_name: sourceName,
      source_file_path: filePath,
      support_effect: hints.supportEffect,
    };
  }

  private inferIpTypeFromFileName(fileName: string): number {
    if (/软著|软件|software/i.test(fileName)) {
      return 3;
    }
    if (/外观|design/i.test(fileName)) {
      return 4;
    }
    if (/实用|utility/i.test(fileName)) {
      return 2;
    }
    return 1;
  }

  private extractIpRecognitionHints(sourceName: string) {
    const baseName = sourceName.replace(/\.[^.]+$/u, '').trim();
    const normalizedName = this.normalizeIpRecognitionFileName(baseName);
    const certificateNo = this.extractIpCertificateNo(normalizedName);
    const applyDate = this.extractDateNearKeyword(normalizedName, [
      '申请',
      '申报',
      '受理',
    ]);
    const authorizeDate = this.extractDateNearKeyword(normalizedName, [
      '授权',
      '登记',
      '发证',
      '证书',
    ]);
    const ipType = this.inferIpTypeFromFileName(normalizedName);
    const rightHolder = this.extractRightHolderFromFileName(normalizedName);
    const name = this.extractIpNameFromFileName(normalizedName, certificateNo);
    const ipLevel = ipType === 1 ? 'I类' : 'II类';
    const recognizedFields = [
      certificateNo ? '证书编号' : '',
      applyDate ? '申请日期' : '',
      authorizeDate ? '授权/登记日期' : '',
      rightHolder ? '权利人' : '',
      name ? '名称' : '',
    ].filter(Boolean);
    const confidence = Math.min(88, 35 + recognizedFields.length * 10);
    const typeName = this.formatIpType(ipType);

    return {
      applyDate,
      authorizeDate,
      certificateNo,
      confidence,
      inventor: '',
      ipLevel,
      ipType,
      name,
      obtainMethod: /受让|转让|许可/u.test(normalizedName)
        ? '受让/许可'
        : /自主|原始|自研/u.test(normalizedName)
          ? '自主研发'
          : '',
      recognitionNote:
        recognizedFields.length > 0
          ? `已识别：${recognizedFields.join('、')}`
          : '请人工补全',
      recognizedFieldCount: recognizedFields.length,
      remark: `系统推断类型为${typeName}`,
      rightHolder,
      supportEffect: name
        ? `该${typeName}可作为研发项目、成果转化和高新产品的技术支撑材料，具体支撑关系请审核后补充。`
        : '',
    };
  }

  private normalizeIpRecognitionFileName(value: string) {
    return value
      .replace(/[【】()[\]（）]/gu, ' ')
      .replace(/[_\-—]+/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim();
  }

  private extractIpCertificateNo(value: string) {
    const patterns = [
      /ZL\s*(?:\d\s*){12}(?:[.．]?\s*[0-9X])?/iu,
      /(?:申请号\s*\/\s*专利号|专利号|申请号)\s*[:：]?\s*((?:\d\s*){12}(?:[.．]?\s*[0-9X])?)/iu,
      /\(\s*21\s*\)\s*申请\s*号\s*((?:\d\s*){12}(?:[.．]?\s*[0-9X])?)/iu,
      /(?:\d\s*){12}[.．]\s*[0-9X]/iu,
      /CN\s?\d{8,14}(?:\.\d)?/iu,
      /\d{4}SR\d{4,8}/iu,
      /(?:登记号|证书号|专利号|申请号|著作权号)[:：\s]*([A-Z0-9.\-]{6,24})/iu,
    ];
    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (match) {
        return this.normalizeIpCertificateNo(match[1] ?? match[0]);
      }
    }
    return '';
  }

  private normalizeIpCertificateNo(value: string) {
    const compact = value
      .replace(/．/gu, '.')
      .replace(/\s+/gu, '')
      .trim()
      .toUpperCase();
    const prefix = compact.startsWith('ZL') ? 'ZL' : '';
    const body = prefix ? compact.slice(2) : compact;
    const normalizedBody = body.replace(
      /^((?:19|20)\d{10})([0-9X])$/u,
      '$1.$2',
    );
    return `${prefix}${normalizedBody}`;
  }

  private extractDateNearKeyword(value: string, keywords: string[]) {
    for (const keyword of keywords) {
      const match = value.match(
        new RegExp(`${keyword}[^0-9]{0,8}(20\\d{2})[.年/-]?(\\d{1,2})?[.月/-]?(\\d{1,2})?`, 'u'),
      );
      if (match) {
        return this.formatRecognizedDate(match[1], match[2], match[3]);
      }
    }
    return '';
  }

  private formatRecognizedDate(
    year: string | undefined,
    month: string | undefined,
    day: string | undefined,
  ) {
    if (!year) {
      return '';
    }
    if (!month) {
      return year;
    }
    const normalizedMonth = month.padStart(2, '0');
    if (!day) {
      return `${year}-${normalizedMonth}`;
    }
    return `${year}-${normalizedMonth}-${day.padStart(2, '0')}`;
  }

  private extractRightHolderFromFileName(value: string) {
    const match = value.match(
      /(?:权利人|著作权人|申请人)[:：\s]*([\u4E00-\u9FA5A-Za-z0-9（）()·]{2,40})/u,
    );
    return match?.[1]?.trim() ?? '';
  }

  private extractIpNameFromFileName(value: string, certificateNo: string) {
    return value
      .replace(certificateNo, '')
      .replace(/(?:发明专利|实用新型|外观设计|软件著作权|软著|专利|证书|扫描件|副本|原件)/gu, ' ')
      .replace(/(?:权利人|著作权人|申请人|登记号|证书号|专利号|申请号)[:：][^\s]+/gu, ' ')
      .replace(/20\d{2}[.年/-]?\d{0,2}[.月/-]?\d{0,2}/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim()
      .slice(0, 120);
  }

  private normalizeIpRecognitionDraftPayload(
    payload: Record<string, unknown>,
    draft?: AiDraftEntity,
  ): Record<string, unknown> {
    const originalFileUrl = this.resolveIpRecognitionOriginalFileUrl(
      payload,
      draft,
    );

    return {
      advanced_degree: this.toNullableStringFromUnknown(payload.advanced_degree),
      apply_date: this.toNullableStringFromUnknown(payload.apply_date) ?? '',
      authorize_date:
        this.toNullableStringFromUnknown(payload.authorize_date) ?? '',
      inventor: this.toNullableStringFromUnknown(payload.inventor),
      ip_level: this.toNullableStringFromUnknown(payload.ip_level),
      is_core_ip: this.toNullableNumber(payload.is_core_ip) ?? 0,
      obtain_method: this.toNullableStringFromUnknown(payload.obtain_method),
      related_ps_ids: this.toNullableStringFromUnknown(payload.related_ps_ids),
      related_rd_ids: this.toNullableStringFromUnknown(payload.related_rd_ids),
      related_transformation_ids: this.toNullableStringFromUnknown(
        payload.related_transformation_ids,
      ),
      remark: this.toNullableStringFromUnknown(payload.remark),
      right_holder: this.toNullableStringFromUnknown(payload.right_holder),
      soft_work_file: originalFileUrl,
      soft_work_name: this.toNullableStringFromUnknown(payload.soft_work_name),
      soft_work_num: this.toNullableStringFromUnknown(payload.soft_work_num),
      soft_work_status: this.toNullableNumber(payload.soft_work_status) ?? 2,
      soft_work_type: this.toNullableNumber(payload.soft_work_type) ?? 1,
      support_effect: this.toNullableStringFromUnknown(payload.support_effect),
    };
  }

  private resolveIpRecognitionOriginalFileUrl(
    payload: Record<string, unknown>,
    draft?: AiDraftEntity,
  ): null | string {
    const sourceFilePath = this.toNullableStringFromUnknown(
      payload.source_file_path,
    );
    const sourcePublicUrl = buildUploadPublicUrl(sourceFilePath) ?? sourceFilePath;
    const sourceMaterialId = this.getFirstJsonStringValue(draft?.sourceIds);
    const protectedSourceUrl = sourceMaterialId
      ? `/client/enterprise/materials/${sourceMaterialId}/preview`
      : null;
    return (
      sourcePublicUrl ??
      protectedSourceUrl ??
      this.toNullableStringFromUnknown(payload.soft_work_file)
    );
  }

  private getFirstJsonStringValue(value?: null | string): null | string {
    if (!value) {
      return null;
    }

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? this.toNullableStringFromUnknown(parsed[0])
        : null;
    } catch {
      return null;
    }
  }

  private async enrichClientIpDraftItemsWithDuplicateHints(
    enterpriseId: string,
    items: ClientAiDraftItem[],
  ): Promise<ClientAiDraftItem[]> {
    const enterprise = await this.enterpriseRepo.findOne({
      where: {
        id: enterpriseId,
      },
    });
    const draftNumbers = items
      .map((item) =>
        this.toNullableStringFromUnknown(item.draftPayload.soft_work_num),
      )
      .filter((number): number is string => Boolean(number))
      .filter((number) => !this.isPlaceholderIpNumber(number));
    const uniqueNumbers = [...new Set(draftNumbers)];
    const existingRows = uniqueNumbers.length
      ? await this.enterprisePropertyRecordRepo.find({
          where: {
            enterpriseId,
            recordType: 'intellectual_property',
            softWorkNum: In(uniqueNumbers),
            status: 1,
          },
        })
      : [];
    const existingByNumber = new Map(
      existingRows.map((row) => [String(row.softWorkNum), row]),
    );
    const draftCountByNumber = draftNumbers.reduce((map, number) => {
      map.set(number, (map.get(number) ?? 0) + 1);
      return map;
    }, new Map<string, number>());

    return items.map((item) => {
      const number = this.toNullableStringFromUnknown(
        item.draftPayload.soft_work_num,
      );
      const payload = { ...item.draftPayload };
      this.applyIpOwnerMatchHint(payload, enterprise);
      if (!number || this.isPlaceholderIpNumber(number)) {
        payload.duplicate_status = 'unchecked';
        payload.duplicate_warning = null;
        payload.duplicate_record_id = null;
        payload.review_warnings = this.buildIpRecognitionDraftReviewWarnings(payload);
        return {
          ...item,
          draftPayload: payload,
        };
      }

      const existing = existingByNumber.get(number);
      if (existing) {
        payload.duplicate_status = 'existing_record';
        payload.duplicate_warning = '正式记录重复';
        payload.duplicate_record_id = String(existing.id);
        payload.review_warnings = this.buildIpRecognitionDraftReviewWarnings(payload);
        return {
          ...item,
          draftPayload: payload,
        };
      }

      if ((draftCountByNumber.get(number) ?? 0) > 1) {
        payload.duplicate_status = 'draft_duplicate';
        payload.duplicate_warning = '草稿重复';
        payload.duplicate_record_id = null;
        payload.review_warnings = this.buildIpRecognitionDraftReviewWarnings(payload);
        return {
          ...item,
          draftPayload: payload,
        };
      }

      payload.duplicate_status = 'none';
      payload.duplicate_warning = null;
      payload.duplicate_record_id = null;
      payload.review_warnings = this.buildIpRecognitionDraftReviewWarnings(payload);
      return {
        ...item,
        draftPayload: payload,
      };
    });
  }

  private buildIpRecognitionDraftReviewWarnings(
    payload: Record<string, unknown>,
  ): string[] {
    const warnings: string[] = [];
    const name = this.toNullableStringFromUnknown(payload.soft_work_name);
    const number = this.toNullableStringFromUnknown(payload.soft_work_num);
    const rightHolder = this.toNullableStringFromUnknown(payload.right_holder);
    const confidence = this.toNullableNumber(payload.confidence) ?? 0;
    const duplicateWarning = this.toNullableStringFromUnknown(
      payload.duplicate_warning,
    );
    const aiAdapterStatus = this.toNullableStringFromUnknown(
      payload.ai_adapter_status,
    );

    if (!name) {
      warnings.push('知识产权名称不能为空');
    }
    if (!number || this.isPlaceholderIpNumber(number)) {
      warnings.push('缺少编号');
    }
    if (!rightHolder || /待核对/u.test(rightHolder)) {
      warnings.push('缺少权利人');
    }
    if (payload.right_holder_match_status === 'mismatched') {
      warnings.push('权利人与当前企业不匹配');
    } else if (payload.right_holder_match_status === 'unchecked') {
      warnings.push('待确认权利人归属');
    }
    if (confidence > 0 && confidence < 60) {
      warnings.push('低置信度');
    }
    if (duplicateWarning) {
      warnings.push(duplicateWarning);
    }
    if (aiAdapterStatus === 'fallback_after_error') {
      warnings.push('需人工核对');
    } else if (aiAdapterStatus === 'fallback_not_configured') {
      warnings.push('智能识别暂不可用');
    }

    return warnings;
  }

  private applyIpOwnerMatchHint(
    payload: Record<string, unknown>,
    enterprise: EnterpriseEntity | null,
  ): void {
    const status = this.getIpOwnerMatchStatus(payload, enterprise);
    payload.right_holder_match_status = status;
    payload.right_holder_match_text =
      status === 'matched' ? '本公司' : status === 'mismatched' ? '不匹配' : '待核对';
  }

  private getIpOwnerMatchStatus(
    payload: Record<string, unknown>,
    enterprise: EnterpriseEntity | null,
  ): 'matched' | 'mismatched' | 'unchecked' {
    const rightHolder = this.toNullableStringFromUnknown(payload.right_holder);
    const enterpriseName = this.normalizeCompanyNameForMatch(enterprise?.name);
    const enterpriseShortName = this.normalizeCompanyNameForMatch(
      enterprise?.shortName,
    );

    if (!rightHolder || (!enterpriseName && !enterpriseShortName)) {
      return 'unchecked';
    }

    const normalizedHolder = this.normalizeCompanyNameForMatch(rightHolder);
    const matched =
      Boolean(enterpriseName && normalizedHolder.includes(enterpriseName)) ||
      Boolean(
        enterpriseShortName && normalizedHolder === enterpriseShortName,
      );
    return matched ? 'matched' : 'mismatched';
  }

  private isIpOwnerMatched(
    payload: Record<string, unknown>,
    enterprise: EnterpriseEntity | null,
  ): boolean {
    return this.getIpOwnerMatchStatus(payload, enterprise) === 'matched';
  }

  private getIpOwnerMatchFailureReason(
    payload: Record<string, unknown>,
    enterprise: EnterpriseEntity | null,
  ): string {
    return this.getIpOwnerMatchStatus(payload, enterprise) === 'mismatched'
      ? '权利人与当前企业不匹配，不能添加'
      : '未能确认权利人为当前企业，不能添加';
  }

  private normalizeCompanyNameForMatch(value?: null | string): string {
    return String(value ?? '')
      .replace(/[（）()\s,，.。·_—-]/gu, '')
      .trim()
      .toLowerCase();
  }

  private isPlaceholderIpNumber(value: string) {
    return /^待核对[-_：:\s]?/u.test(value.trim());
  }

  private async validateIpDraftForApproval(
    enterpriseId: string,
    payload: Record<string, unknown>,
  ): Promise<null | string> {
    const name = this.toNullableStringFromUnknown(payload.soft_work_name);
    const number = this.toNullableStringFromUnknown(payload.soft_work_num);
    const rightHolder = this.toNullableStringFromUnknown(payload.right_holder);
    if (!name) {
      return '知识产权名称不能为空';
    }
    if (!number) {
      return '登记号/专利号不能为空';
    }
    if (!rightHolder) {
      return '权利人不能为空';
    }

    const enterprise = await this.enterpriseRepo.findOne({
      where: { id: enterpriseId },
    });
    if (!this.isIpOwnerMatched(payload, enterprise)) {
      return this.getIpOwnerMatchFailureReason(payload, enterprise);
    }

    const existing = await this.enterprisePropertyRecordRepo.findOne({
      where: {
        enterpriseId,
        recordType: 'intellectual_property',
        softWorkNum: number,
        status: 1,
      },
    });
    return existing ? '登记号/专利号已存在' : null;
  }

  private collectRelatedIpIds(rows: EnterprisePropertyRecordEntity[]): Set<string> {
    const ids = new Set<string>();
    rows.forEach((row) => {
      this.parseRelationIds(row.relatedIpIds).forEach((id) => ids.add(id));
    });
    return ids;
  }

  private collectRelatedRdIds(rows: EnterprisePropertyRecordEntity[]): Set<string> {
    const ids = new Set<string>();
    rows.forEach((row) => {
      this.parseRelationIds(row.relatedRdIds).forEach((id) => ids.add(id));
    });
    return ids;
  }

  private async syncClientPropertyReverseRelations(
    enterpriseId: string,
    sourceKind: ClientPropertyRecordKind,
    sourceId: string,
    relations: {
      ipIds?: string[];
      psIds?: string[];
      rdIds?: string[];
      transformationIds?: string[];
    },
  ): Promise<number> {
    if (!sourceId) {
      return 0;
    }

    let changedRecords = 0;
    for (const rule of this.getClientPropertyReverseRelationRules(
      sourceKind,
      relations,
    )) {
      changedRecords += await this.appendClientPropertyRelationToRecords(
        enterpriseId,
        this.getClientPropertyRecordType(rule.recordKind),
        rule.ids ?? [],
        rule.field,
        sourceId,
      );
    }
    return changedRecords;
  }

  private async reconcileClientPropertyReverseRelationsFromRecord(
    enterpriseId: string,
    moduleKey: string,
    tabKey: string,
    record: Record<string, unknown>,
  ): Promise<void> {
    if (moduleKey !== 'property') {
      return;
    }

    const sourceKind = this.getClientPropertyRecordKindByTabKey(tabKey);
    if (!sourceKind) {
      return;
    }

    const sourceId = String(record.id ?? '');
    const relations = {
      ipIds: this.parseRelationIds(record.relatedIpIds as null | string),
      psIds: this.parseRelationIds(record.relatedPsIds as null | string),
      rdIds: this.parseRelationIds(record.relatedRdIds as null | string),
      transformationIds: this.parseRelationIds(
        record.relatedTransformationIds as null | string,
      ),
    };
    const rules = this.getClientPropertyReverseRelationRules(
      sourceKind,
      relations,
    );

    await this.syncClientPropertyReverseRelations(
      enterpriseId,
      sourceKind,
      sourceId,
      relations,
    );
    for (const rule of rules) {
      await this.removeClientPropertyRelationFromUnselectedRecords(
        enterpriseId,
        this.getClientPropertyRecordType(rule.recordKind),
        rule.ids ?? [],
        rule.field,
        sourceId,
      );
    }
  }

  private async clearClientPropertyReverseRelationsFromRecord(
    enterpriseId: string,
    moduleKey: string,
    tabKey: string,
    record: Record<string, unknown>,
  ): Promise<void> {
    if (moduleKey !== 'property') {
      return;
    }

    const sourceKind = this.getClientPropertyRecordKindByTabKey(tabKey);
    const sourceId = String(record.id ?? '');
    if (!sourceKind || !sourceId) {
      return;
    }

    for (const rule of this.getClientPropertyReverseRelationRules(sourceKind, {})) {
      await this.removeClientPropertyRelationFromUnselectedRecords(
        enterpriseId,
        this.getClientPropertyRecordType(rule.recordKind),
        [],
        rule.field,
        sourceId,
      );
    }
  }

  private getClientPropertyReverseRelationRules(
    sourceKind: ClientPropertyRecordKind,
    relations: {
      ipIds?: string[];
      psIds?: string[];
      rdIds?: string[];
      transformationIds?: string[];
    },
  ): ClientPropertyReverseRelationRule[] {
    const rules: ClientPropertyReverseRelationRule[] = [];

    if (sourceKind !== 'ip') {
      rules.push({
        field: this.getClientPropertyReverseRelationField(sourceKind),
        ids: relations.ipIds,
        recordKind: 'ip',
      });
    }
    if (sourceKind !== 'rd') {
      rules.push({
        field: this.getClientPropertyReverseRelationField(sourceKind),
        ids: relations.rdIds,
        recordKind: 'rd',
      });
    }
    if (sourceKind !== 'ps') {
      rules.push({
        field: this.getClientPropertyReverseRelationField(sourceKind),
        ids: relations.psIds,
        recordKind: 'ps',
      });
    }
    if (sourceKind !== 'transformation') {
      rules.push({
        field: this.getClientPropertyReverseRelationField(sourceKind),
        ids: relations.transformationIds,
        recordKind: 'transformation',
      });
    }

    return rules;
  }

  private async appendClientPropertyRelationToRecords(
    enterpriseId: string,
    recordType: string,
    targetIds: string[],
    field: ClientPropertyRelationField,
    relationId: string,
  ): Promise<number> {
    const ids = this.uniqueRelationIds(targetIds).filter(
      (id) => id !== relationId,
    );
    if (ids.length === 0) {
      return 0;
    }

    const rows = await this.enterprisePropertyRecordRepo.find({
      where: {
        enterpriseId,
        id: In(ids),
        recordType,
        status: 1,
      },
    });
    const changedRows = rows.filter((row) => {
      const nextValue = this.appendRelationId(row[field], relationId);
      if (nextValue === row[field]) {
        return false;
      }
      row[field] = nextValue;
      return true;
    });

    if (changedRows.length > 0) {
      await this.enterprisePropertyRecordRepo.save(changedRows);
    }
    return changedRows.length;
  }

  private async removeClientPropertyRelationFromUnselectedRecords(
    enterpriseId: string,
    recordType: string,
    keepTargetIds: string[],
    field: ClientPropertyRelationField,
    relationId: string,
  ): Promise<void> {
    const keepIds = new Set(this.uniqueRelationIds(keepTargetIds));
    const rows = await this.enterprisePropertyRecordRepo.find({
      where: {
        enterpriseId,
        recordType,
        status: 1,
      },
    });
    const changedRows = rows.filter((row) => {
      const rowId = String(row.id ?? '');
      if (keepIds.has(rowId)) {
        return false;
      }

      const nextIds = this.parseRelationIds(row[field]).filter(
        (id) => id !== relationId,
      );
      if (nextIds.length === this.parseRelationIds(row[field]).length) {
        return false;
      }

      row[field] = nextIds.length > 0 ? nextIds.join(',') : null;
      return true;
    });

    if (changedRows.length > 0) {
      await this.enterprisePropertyRecordRepo.save(changedRows);
    }
  }

  private appendRelationId(
    value: null | string | undefined,
    relationId: string,
  ): null | string {
    const nextIds = this.uniqueRelationIds([
      ...this.parseRelationIds(value),
      relationId,
    ]);
    return nextIds.length > 0 ? nextIds.join(',') : null;
  }

  private getClientPropertyRecordType(kind: ClientPropertyRecordKind): string {
    const map: Record<ClientPropertyRecordKind, string> = {
      ip: 'intellectual_property',
      ps: 'product_service',
      rd: 'research_project',
      transformation: 'transformation',
    };
    return map[kind];
  }

  private getClientPropertyRecordKindByTabKey(
    tabKey: string,
  ): ClientPropertyRecordKind | null {
    const map: Record<string, ClientPropertyRecordKind> = {
      intellectualProperty: 'ip',
      productService: 'ps',
      researchProject: 'rd',
      transformation: 'transformation',
    };
    return map[tabKey] ?? null;
  }

  private getClientPropertyRecordKindByRecordType(
    recordType: string,
  ): ClientPropertyRecordKind | null {
    const map: Record<string, ClientPropertyRecordKind> = {
      intellectual_property: 'ip',
      product_service: 'ps',
      research_project: 'rd',
      transformation: 'transformation',
    };
    return map[recordType] ?? null;
  }

  private getClientPropertyReverseRelationField(
    sourceKind: ClientPropertyRecordKind,
  ): ClientPropertyRelationField {
    const map: Record<ClientPropertyRecordKind, ClientPropertyRelationField> = {
      ip: 'relatedIpIds',
      ps: 'relatedPsIds',
      rd: 'relatedRdIds',
      transformation: 'relatedTransformationIds',
    };
    return map[sourceKind];
  }

  private buildClientPropertyEvidenceChain(
    rd: EnterprisePropertyRecordEntity,
    ipRows: EnterprisePropertyRecordEntity[],
    psRows: EnterprisePropertyRecordEntity[],
    transformationRows: EnterprisePropertyRecordEntity[],
  ): ClientPropertyEvidenceChain {
    const rdId = String(rd.id ?? '');
    const ipIds = this.uniqueRelationIds([
      ...this.parseRelationIds(rd.relatedIpIds),
      ...ipRows
        .filter((ip) => this.includesRelationId(ip.relatedRdIds, rdId))
        .map((ip) => String(ip.id ?? '')),
    ]);
    const psIds = this.uniqueRelationIds([
      ...this.parseRelationIds(rd.relatedPsIds),
      ...psRows
        .filter((ps) => {
          const psIpIds = this.parseRelationIds(ps.relatedIpIds);
          return (
            this.includesRelationId(ps.relatedRdIds, rdId) ||
            psIpIds.some((id) => ipIds.includes(id))
          );
        })
        .map((ps) => String(ps.id ?? '')),
    ]);
    const transformationIds = this.uniqueRelationIds([
      ...this.parseRelationIds(rd.relatedTransformationIds),
      ...transformationRows
        .filter((item) => {
          const transformationIpIds = this.parseRelationIds(item.relatedIpIds);
          return (
            this.includesRelationId(item.relatedRdIds, rdId) ||
            transformationIpIds.some((id) => ipIds.includes(id))
          );
        })
        .map((item) => String(item.id ?? '')),
    ]);

    return {
      gaps: [
        ...(ipIds.length > 0 ? [] : ['未关联 IP']),
        ...(psIds.length > 0 ? [] : ['未关联 PS']),
        ...(transformationIds.length > 0 ? [] : ['未关联成果']),
      ],
      id: rdId || String(rd.kyProjectNum ?? rd.kyProjectName ?? ''),
      ip: this.toClientPropertyEvidenceNodes(
        this.sortClientRelationIdsByRelatedIpCode(
          ipIds,
          'intellectual_property',
          ipRows,
          ipRows,
        ),
        ipRows,
        'softWorkName',
        'ipCode',
      ),
      name: rd.kyProjectName ?? rd.kyProjectNum ?? '未命名RD项目',
      number: rd.kyProjectNum,
      ps: this.toClientPropertyEvidenceNodes(
        this.sortClientRelationIdsByRelatedIpCode(
          psIds,
          'product_service',
          psRows,
          ipRows,
        ),
        psRows,
        'psName',
        'psCode',
      ),
      transformation: this.toClientPropertyEvidenceNodes(
        this.sortClientRelationIdsByRelatedIpCode(
          transformationIds,
          'transformation',
          transformationRows,
          ipRows,
        ),
        transformationRows,
        'transformationName',
        'transformationCode',
      ),
    };
  }

  private buildClientPropertyEvidenceGaps(
    chains: ClientPropertyEvidenceChain[],
    ipRows: EnterprisePropertyRecordEntity[],
    rdRows: EnterprisePropertyRecordEntity[],
    psRows: EnterprisePropertyRecordEntity[],
    transformationRows: EnterprisePropertyRecordEntity[],
  ): string[] {
    return [
      ...chains.flatMap((chain) =>
        chain.gaps.map((gap) => `${chain.name} ${gap}`),
      ),
      ...psRows.flatMap((ps) =>
        [
          this.hasClientPropertyEvidenceRdRelation(ps, rdRows)
            ? ''
            : `${ps.psName ?? '未命名 PS'} 未关联 RD`,
          this.hasClientPropertyEvidenceIpRelation(ps, ipRows)
            ? ''
            : `${ps.psName ?? '未命名 PS'} 未关联 IP`,
          this.hasClientPropertyEvidenceTransformationRelation(
            ps,
            transformationRows,
          )
            ? ''
            : `${ps.psName ?? '未命名 PS'} 未关联成果转化`,
          this.hasRelationValue(ps.relatedContractIds) ||
          this.hasRelationValue(ps.relatedInvoiceIds)
            ? ''
            : `${ps.psName ?? '未命名 PS'} 未关联合同/发票证明`,
        ].filter(Boolean),
      ),
      ...transformationRows
        .filter(
          (item) =>
            !this.hasClientPropertyEvidenceTransformationIpRelation(
              item,
              ipRows,
            ),
        )
        .map(
          (item) =>
            `${item.transformationName ?? '未命名成果'} 未关联 IP`,
        ),
      ...transformationRows
        .filter(
          (item) =>
            !this.hasRelationValue(item.relatedContractIds) &&
            !this.hasRelationValue(item.relatedInvoiceIds),
        )
        .map(
          (item) =>
            `${item.transformationName ?? '未命名成果'} 未关联合同/发票证明`,
        ),
      ...ipRows
        .filter(
          (ip) =>
            !this.isClientPropertyIpUsedInEvidenceChain(
              ip,
              rdRows,
              psRows,
              transformationRows,
            ),
        )
        .map((ip) => `${ip.softWorkName ?? '未命名 IP'} 尚未进入 RD/PS/成果链路`),
    ];
  }

  private buildClientPropertyEvidenceChecklist(input: {
    completeRdChains: number;
    gaps: string[];
    ipRows: EnterprisePropertyRecordEntity[];
    ipUsedInChain: number;
    propertyAiScenes: string[];
    psRows: EnterprisePropertyRecordEntity[];
    psWithIp: number;
    psWithRd: number;
    rdRows: EnterprisePropertyRecordEntity[];
    rdWithIp: number;
    succeededAiScenes: Set<string>;
    transformationRows: EnterprisePropertyRecordEntity[];
    transformationWithIp: number;
  }): ClientPropertyEvidenceChecklistItem[] {
    const aiPassedCount = input.propertyAiScenes.filter((scene) =>
      input.succeededAiScenes.has(scene),
    ).length;

    return [
      {
        detail:
          input.ipRows.length > 0
            ? `${input.ipRows.length} 条知识产权已入库，${input.ipUsedInChain} 条进入证据链`
            : '尚未入库知识产权',
        key: 'ip',
        label: '知识产权入库',
        status:
          input.ipRows.length === 0
            ? 'missing'
            : input.ipUsedInChain < input.ipRows.length
              ? 'warning'
              : 'passed',
      },
      {
        detail:
          input.transformationRows.length > 0
            ? `${input.transformationWithIp}/${input.transformationRows.length} 条成果已关联 IP`
            : '尚未入库成果转化',
        key: 'transformation',
        label: '成果转化关联',
        status:
          input.transformationRows.length === 0
            ? 'missing'
            : input.transformationWithIp < input.transformationRows.length
              ? 'warning'
              : 'passed',
      },
      {
        detail:
          input.rdRows.length > 0
            ? `${input.rdWithIp}/${input.rdRows.length} 条 RD 已关联 IP`
            : '尚未入库 RD 研发项目',
        key: 'rd',
        label: 'RD 立项链路',
        status:
          input.rdRows.length === 0
            ? 'missing'
            : input.rdWithIp < input.rdRows.length
              ? 'warning'
              : 'passed',
      },
      {
        detail:
          input.psRows.length > 0
            ? `${input.psWithRd}/${input.psRows.length} 条 PS 关联 RD，${input.psWithIp}/${input.psRows.length} 条 PS 关联 IP`
            : '尚未入库 PS 高新产品/服务',
        key: 'ps',
        label: 'PS 聚合链路',
        status:
          input.psRows.length === 0
            ? 'missing'
            : input.psWithRd < input.psRows.length ||
                input.psWithIp < input.psRows.length
              ? 'warning'
              : 'passed',
      },
      {
        detail:
          input.rdRows.length > 0
            ? `${input.completeRdChains}/${input.rdRows.length} 条 RD 链路完整，${input.gaps.length} 个缺口`
            : '需要先生成或录入 RD 后再验证完整链路',
        key: 'evidence_chain',
        label: '证据链完整度',
        status:
          input.rdRows.length === 0
            ? 'missing'
            : input.completeRdChains === input.rdRows.length &&
                input.gaps.length === 0
              ? 'passed'
              : 'warning',
      },
      {
        detail: `已完成 ${aiPassedCount}/${input.propertyAiScenes.length} 类 AI 任务成功记录`,
        key: 'ai_audit',
        label: 'AI 审计记录',
        status:
          aiPassedCount === 0
            ? 'missing'
            : aiPassedCount < input.propertyAiScenes.length
              ? 'warning'
              : 'passed',
      },
    ];
  }

  private toClientPropertyEvidenceNodes(
    ids: string[],
    rows: EnterprisePropertyRecordEntity[],
    nameKey: keyof EnterprisePropertyRecordEntity,
    numberKey: keyof EnterprisePropertyRecordEntity,
  ): ClientPropertyEvidenceNode[] {
    return ids
      .map((id) => {
        const row = rows.find((item) => String(item.id ?? '') === id);
        if (!row) {
          return null;
        }
        const name = this.toNullableStringFromUnknown(row[nameKey]);
        const number = this.toNullableStringFromUnknown(row[numberKey]);
        return {
          id,
          name: name ?? number ?? `记录 ${id}`,
          number,
        };
      })
      .filter((item): item is ClientPropertyEvidenceNode => item !== null);
  }

  private hasClientPropertyEvidenceRdRelation(
    ps: EnterprisePropertyRecordEntity,
    rdRows: EnterprisePropertyRecordEntity[],
  ): boolean {
    const psId = String(ps.id ?? '');
    return (
      this.hasRelationValue(ps.relatedRdIds) ||
      rdRows.some((rd) => this.includesRelationId(rd.relatedPsIds, psId))
    );
  }

  private hasClientPropertyEvidenceIpRelation(
    ps: EnterprisePropertyRecordEntity,
    ipRows: EnterprisePropertyRecordEntity[],
  ): boolean {
    const psId = String(ps.id ?? '');
    return (
      this.hasRelationValue(ps.relatedIpIds) ||
      ipRows.some((ip) => this.includesRelationId(ip.relatedPsIds, psId))
    );
  }

  private hasClientPropertyEvidenceTransformationRelation(
    ps: EnterprisePropertyRecordEntity,
    transformationRows: EnterprisePropertyRecordEntity[],
  ): boolean {
    const psId = String(ps.id ?? '');
    return (
      this.hasRelationValue(ps.relatedTransformationIds) ||
      transformationRows.some((item) =>
        this.includesRelationId(item.relatedPsIds, psId),
      )
    );
  }

  private hasClientPropertyEvidenceTransformationIpRelation(
    transformation: EnterprisePropertyRecordEntity,
    ipRows: EnterprisePropertyRecordEntity[],
  ): boolean {
    const transformationId = String(transformation.id ?? '');
    return (
      this.hasRelationValue(transformation.relatedIpIds) ||
      ipRows.some((ip) =>
        this.includesRelationId(ip.relatedTransformationIds, transformationId),
      )
    );
  }

  private isClientPropertyIpUsedInEvidenceChain(
    ip: EnterprisePropertyRecordEntity,
    rdRows: EnterprisePropertyRecordEntity[],
    psRows: EnterprisePropertyRecordEntity[],
    transformationRows: EnterprisePropertyRecordEntity[],
  ): boolean {
    const ipId = String(ip.id ?? '');
    return (
      this.hasRelationValue(ip.relatedRdIds) ||
      this.hasRelationValue(ip.relatedPsIds) ||
      this.hasRelationValue(ip.relatedTransformationIds) ||
      rdRows.some((rd) => this.includesRelationId(rd.relatedIpIds, ipId)) ||
      psRows.some((ps) => this.includesRelationId(ps.relatedIpIds, ipId)) ||
      transformationRows.some((item) =>
        this.includesRelationId(item.relatedIpIds, ipId),
      )
    );
  }

  private hasRelationValue(value: null | string | undefined): boolean {
    return this.parseRelationIds(value).length > 0;
  }

  private includesRelationId(
    value: null | string | undefined,
    id: string,
  ): boolean {
    return Boolean(id) && this.parseRelationIds(value).includes(id);
  }

  private parseRelationIds(value: null | string | undefined): string[] {
    return String(value ?? '')
      .split(/[,，\s]+/u)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private uniqueRelationIds(values: string[]): string[] {
    return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
  }

  private normalizePropertyName(value: string): string {
    return value
      .normalize('NFKC')
      .replace(/[（）]/gu, '(')
      .replace(/\s+/gu, ' ')
      .trim()
      .toLocaleLowerCase();
  }

  private resolveTargetCount(
    value: unknown,
    min: number,
    max: number,
    fallback: number,
  ): number {
    return typeof value === 'number' && Number.isInteger(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;
  }

  private isForbiddenProductServiceName(value: string): boolean {
    return /^(产品（服务）|产品\/?服务|产品服务|高新产品|技术服务产品|未命名产品)$/u.test(
      value.trim(),
    );
  }

  private applyBusinessModeToPropertyName(
    value: string,
    businessMode: Exclude<PropertyBusinessMode, 'auto' | 'mixed'>,
  ): string {
    const fallback = businessMode === 'service' ? '技术服务' : '技术产品';
    const base = value
      .replace(/产品（服务）|产品\/?服务|产品服务|高新产品|技术服务产品/gu, '')
      .replace(/(产品|服务)$/u, '')
      .trim() || fallback.replace(/(产品|服务)$/u, '');
    return `${base}${businessMode === 'service' ? '服务' : '产品'}`;
  }

  private async resolvePropertyBusinessMode(
    enterpriseId: string,
    requestedMode: PropertyBusinessMode,
  ): Promise<Exclude<PropertyBusinessMode, 'auto' | 'mixed'>> {
    if (requestedMode === 'product' || requestedMode === 'service') {
      return requestedMode;
    }
    const [enterprise, basicInfo] = await Promise.all([
      this.enterpriseRepo.findOne({ where: { id: enterpriseId } }),
      this.enterpriseBasicInfoRepo.findOne({ where: { enterpriseId } }),
    ]);
    const context = [
      enterprise?.enterpriseType,
      enterprise?.industry,
      enterprise?.remark,
      basicInfo?.businessScope,
      basicInfo?.industry,
    ].filter(Boolean).join(' ');
    const serviceScore = (context.match(/服务|咨询|运维|检测|设计|代理|培训|租赁|软件开发/gu) ?? []).length;
    const productScore = (context.match(/生产|制造|设备|材料|产品|销售|加工|装配/gu) ?? []).length;
    return serviceScore > productScore ? 'service' : 'product';
  }

  private resolveBusinessModeFromDraft(
    payload: Record<string, unknown>,
  ): Exclude<PropertyBusinessMode, 'auto' | 'mixed'> {
    const context = JSON.stringify(payload);
    const serviceScore = (context.match(/服务|咨询|运维|检测|设计|代理|培训/gu) ?? []).length;
    const productScore = (context.match(/生产|制造|设备|材料|产品|销售|加工|装配/gu) ?? []).length;
    return serviceScore > productScore ? 'service' : 'product';
  }

  private async resolveGeneratedPropertyName(
    enterpriseId: string,
    draftType: 'product_service' | 'research_project' | 'transformation',
    payloadKey: 'ky_project_name' | 'ps_name' | 'transformation_name',
    proposedName: string,
  ): Promise<string> {
    const recordType = draftType;
    const recordField = draftType === 'research_project'
      ? 'kyProjectName'
      : draftType === 'product_service'
        ? 'psName'
        : 'transformationName';
    const [records, drafts] = await Promise.all([
      this.enterprisePropertyRecordRepo.find({
        where: { enterpriseId, recordType, status: 1 },
      }),
      this.aiDraftRepo.find({ where: { draftType, enterpriseId } }),
    ]);
    const occupied = new Set<string>();
    records.forEach((record) => {
      const value = recordField === 'kyProjectName'
        ? record.kyProjectName
        : recordField === 'psName'
          ? record.psName
          : record.transformationName;
      if (value) occupied.add(this.normalizePropertyName(value));
    });
    drafts
      .filter((draft) => draft.status !== 'rejected')
      .forEach((draft) => {
        const value = this.toNullableStringFromUnknown(
          this.parseJsonObject(draft.draftPayload)[payloadKey],
        );
        if (value) occupied.add(this.normalizePropertyName(value));
      });
    const base = proposedName.trim() || '未命名技术项目';
    let candidate = base;
    let index = 2;
    while (occupied.has(this.normalizePropertyName(candidate))) {
      candidate = `${base}（${index}）`;
      index += 1;
    }
    return candidate;
  }

  private async validatePropertyNameUnique(
    enterpriseId: string,
    recordType: 'product_service' | 'research_project' | 'transformation',
    name: string,
  ): Promise<null | string> {
    const target = this.normalizePropertyName(name);
    const records = await this.enterprisePropertyRecordRepo.find({
      where: { enterpriseId, recordType, status: 1 },
    });
    const duplicate = records.some((record) => this.normalizePropertyName(
      recordType === 'research_project'
        ? record.kyProjectName ?? ''
        : recordType === 'product_service'
          ? record.psName ?? ''
          : record.transformationName ?? '',
    ) === target);
    return duplicate ? '名称已存在，请修改后再入库' : null;
  }

  private buildTransformationGenerationDraftPayload(
    ip: EnterprisePropertyRecordEntity,
  ): Record<string, unknown> {
    const ipName = ip.softWorkName ?? ip.softWorkNum ?? `知识产权${ip.id}`;
    const ipTypeText = this.formatIpType(ip.softWorkType);
    return {
      application_scene: `围绕“${ipName}”形成可用于企业产品、服务或内部技术能力提升的成果，后续可补充具体应用场景、客户案例、验收记录或产品证明。`,
      customer_name: '',
      proof_files: '待补充合同、发票、验收报告、检测报告、产品照片等证明材料。',
      related_contract_ids: '',
      related_invoice_ids: '',
      related_ip_ids: String(ip.id),
      related_ps_ids: '',
      related_rd_ids: '',
      remark: `技术内容：以${ipTypeText}“${ipName}”为基础，提炼其核心技术方案、解决的技术问题、创新点和实施效果；请结合实际业务补充技术指标和转化成效。`,
      source_ip_code: ip.ipCode,
      source_ip_name: ipName,
      source_ip_num: ip.softWorkNum,
      transformation_code: '',
      transformation_income: '',
      transformation_method: '自行实施',
      transformation_name: ipName,
    };
  }

  private async buildTransformationGenerationDraftPayloadWithAi(
    task: AiTaskEntity,
    ip: EnterprisePropertyRecordEntity,
  ): Promise<Record<string, unknown>> {
    const fallback = this.buildTransformationGenerationDraftPayload(ip);
    return this.generateClientPropertyDraftWithAi({
      fallback,
      fallbackAdapter: 'rule-based-transformation-generator',
      input: {
        sourceIp: {
          authorizeDate: ip.authorizeDate,
          id: String(ip.id),
          name: ip.softWorkName,
          number: ip.softWorkNum,
          remark: ip.remark,
          rightHolder: ip.rightHolder,
          type: this.formatIpType(ip.softWorkType),
        },
      },
      outputSchema: {
        record: {
          application_scene: '成果内容，描述从技术到应用的转化过程和应用价值',
          proof_files: '证明材料建议，不得编造已存在材料',
          remark: '技术内容/技术描述，突出核心技术、创新点、技术效果',
          transformation_method: '转化方式，默认自行实施或待核对',
          transformation_name: '成果名称，不能直接复制知识产权名称',
        },
      },
      protectedKeys: [
        'related_ip_ids',
        'source_ip_code',
        'source_ip_name',
        'source_ip_num',
      ],
      sceneLabel: '成果转化批量生成',
      systemPrompt:
        '你是高企成果转化材料助手。请基于单个知识产权生成一条成果转化草稿，必须体现技术到应用的转化，不得编造合同、收入、客户、发票、验收结论。输出必须是JSON对象。',
      task,
    });
  }

  private normalizeTransformationGenerationDraftPayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      application_scene: this.toNullableStringFromUnknown(
        payload.application_scene,
      ),
      customer_name: this.toNullableStringFromUnknown(payload.customer_name),
      proof_files: this.toNullableStringFromUnknown(payload.proof_files),
      related_contract_ids: this.toNullableStringFromUnknown(
        payload.related_contract_ids,
      ),
      related_invoice_ids: this.toNullableStringFromUnknown(
        payload.related_invoice_ids,
      ),
      related_ip_ids: this.toNullableStringFromUnknown(payload.related_ip_ids),
      related_ps_ids: this.toNullableStringFromUnknown(payload.related_ps_ids),
      related_rd_ids: this.toNullableStringFromUnknown(payload.related_rd_ids),
      remark: this.toNullableStringFromUnknown(payload.remark),
      transformation_code: this.toNullableStringFromUnknown(
        payload.transformation_code,
      ),
      transformation_income: this.toNullableStringFromUnknown(
        payload.transformation_income,
      ),
      transformation_method: this.toNullableStringFromUnknown(
        payload.transformation_method,
      ),
      transformation_name: this.toNullableStringFromUnknown(
        payload.transformation_name,
      ),
    };
  }

  private async validateTransformationDraftForApproval(
    enterpriseId: string,
    payload: Record<string, unknown>,
    excludeTransformationId: null | string = null,
  ): Promise<null | string> {
    const name = this.toNullableStringFromUnknown(payload.transformation_name);
    const relatedIpIds = this.parseRelationIds(
      this.toNullableStringFromUnknown(payload.related_ip_ids),
    );
    if (!name) {
      return '成果名称不能为空';
    }
    if (this.isForbiddenProductServiceName(name)) {
      return '成果名称不能使用“产品（服务）”等泛化名称';
    }
    const nameValidationMessage = await this.validatePropertyNameUnique(
      enterpriseId,
      'transformation',
      name,
    );
    if (nameValidationMessage) {
      return nameValidationMessage;
    }
    if (relatedIpIds.length === 0) {
      return '至少需要关联一个知识产权';
    }

    return this.validateTransformationRelationUniqueness(
      enterpriseId,
      relatedIpIds,
      excludeTransformationId,
    );
  }

  private async validateTransformationRelationUniqueness(
    enterpriseId: string,
    relatedIpIds: string[],
    excludeTransformationId: null | string,
  ): Promise<null | string> {
    const uniqueIpIds = this.uniqueRelationIds(relatedIpIds);
    if (uniqueIpIds.length !== relatedIpIds.length) {
      return '同一个成果中不能重复关联同一个 IP';
    }

    const existingRows = await this.enterprisePropertyRecordRepo.find({
      where: {
        enterpriseId,
        recordType: 'transformation',
        status: 1,
      },
    });
    const duplicatedRow = existingRows
      .filter((row) => String(row.id) !== String(excludeTransformationId ?? ''))
      .find((row) =>
        this.parseRelationIds(row.relatedIpIds).some((id) => uniqueIpIds.includes(id)),
      );
    if (!duplicatedRow) {
      return null;
    }

    const duplicatedIpId = this.parseRelationIds(duplicatedRow.relatedIpIds).find((id) =>
      uniqueIpIds.includes(id),
    );
    return duplicatedIpId ? `知识产权 ${duplicatedIpId} 已有关联成果` : null;
  }

  private formatIpType(value: null | number): string {
    const labels: Record<number, string> = {
      1: '发明专利',
      2: '实用新型',
      3: '软件著作权',
      4: '外观设计',
    };
    return value ? labels[value] ?? '知识产权' : '知识产权';
  }

  private buildResearchGenerationDraftPayload(
    ips: EnterprisePropertyRecordEntity[],
    input: CreateClientResearchGenerationDto,
    rdCode?: string,
  ): Record<string, unknown> {
    const initDate = this.toNullableStringFromUnknown(input.initDate) ?? '';
    const endDate = this.toNullableStringFromUnknown(input.endDate) ?? '';
    const year = this.resolveResearchProjectYear(initDate);
    const technicalField =
      this.toNullableStringFromUnknown(input.technicalField) ||
      this.inferResearchTechnicalField(ips);
    const ipNames = ips.map(
      (ip) => ip.softWorkName || ip.softWorkNum || `知识产权${ip.id}`,
    );
    const researchTheme = this.extractResearchProjectTheme(ipNames, technicalField);
    const projectName = `${researchTheme}关键技术研发与应用项目`;
    const ipDescription = ipNames
      .map((name, index) => `${index + 1}. ${name}`)
      .join('\n');
    const leader = this.toNullableStringFromUnknown(input.leader) || '待补充';
    const rdBudget = this.toNullableStringFromUnknown(input.rdBudget) || '待补充';
    const remark = this.toNullableStringFromUnknown(input.remark) || '暂无补充说明';
    const schedulePlan = [
      `第一阶段（${initDate} 起）：完成业务需求调研、研发目标分解、总体技术方案设计和关键指标确认。`,
      '第二阶段：开展核心模块研发、关键算法/工艺/结构验证、联调测试和阶段性问题闭环。',
      `第三阶段（至 ${endDate}）：完成系统优化、测试验证、研发总结、知识产权与成果转化材料归档。`,
    ].join('\n');
    const coreTechnology = `围绕“${researchTheme}”研发方向，开展${technicalField}领域关键技术研发，重点研究需求建模、核心模块设计、数据/流程处理、系统集成、性能优化、可靠性验证和应用场景适配。`;
    const innovationPoints = [
      `围绕“${researchTheme}”建立从研发需求、技术方案、实现验证到成果归档的完整研发链路。`,
      `针对${technicalField}应用场景优化核心算法、结构、流程或系统模块，提升稳定性、效率和可扩展性。`,
      '通过研发过程形成阶段测试记录、技术总结、知识产权线索和成果转化支撑材料。',
    ].join('\n');
    const expectedResults = `预计形成研发立项报告、阶段测试记录、技术总结、研发成果归档材料，并支撑相关知识产权、成果转化和高新产品/服务认定。`;
    const proposalReport = [
      `研发立项报告`,
      `一、项目名称：${projectName}`,
      `二、研发周期：${initDate} 至 ${endDate}`,
      `三、技术领域：${technicalField}`,
      `四、项目背景：企业围绕“${researchTheme}”方向开展研发，需要通过立项明确研发目标、技术路线、阶段计划、人员组织和成果归档要求，提升技术成熟度和高企申报证据链完整性。`,
      `五、立项目的：通过本项目形成可验证、可应用、可归档的研发成果，并为后续知识产权登记、成果转化和高新产品/服务认定提供研发过程支撑。`,
      `六、主要研究内容：${coreTechnology}`,
      `七、技术路线：需求分析 -> 技术方案设计 -> 核心模块研发 -> 测试验证 -> 应用优化 -> 资料归档。`,
      `八、创新点：\n${innovationPoints}`,
      `九、研发计划：\n${schedulePlan}`,
      `十、预期成果：${expectedResults}`,
      `十一、拟关联知识产权成果：\n${ipDescription}`,
      `十二、预算与人员：项目负责人 ${leader}，预算 ${rdBudget}，具体人员、费用科目和凭证后续按实际研发投入补充。`,
      `十三、补充说明：${remark}`,
    ].join('\n\n');

    return {
      core_technology: coreTechnology,
      end_date: endDate,
      fund_amount: this.toNullableStringFromUnknown(input.rdBudget),
      fund_source: 4,
      innovation_points: innovationPoints,
      init_date: initDate,
      ky_project_des: proposalReport,
      ky_project_leader: this.toNullableStringFromUnknown(input.leader),
      ky_project_name: projectName,
      ky_project_num: rdCode ?? `RD${year}-${ips[0]?.id ?? Date.now()}`,
      ky_project_status: 1,
      lxbg_file: '',
      project_type: technicalField,
      rd_budget: this.toNullableStringFromUnknown(input.rdBudget),
      rd_expense_total: '',
      rd_organization_method: `由研发负责人牵头，组织技术、测试、产品及资料归档人员推进；预算和人员投入以企业实际研发台账为准。`,
      related_ip_ids: ips.map((ip) => String(ip.id)).join(','),
      related_ps_ids: '',
      related_transformation_ids: '',
      remark: 'AI 生成研发立项报告草稿，入库前请结合企业真实研发过程核对。',
      source_ip_names: ipNames,
      stage_result: expectedResults,
    };
  }

  private async buildResearchGenerationDraftPayloadWithAi(
    task: AiTaskEntity,
    ips: EnterprisePropertyRecordEntity[],
    input: CreateClientResearchGenerationDto,
    rdCode?: string,
  ): Promise<Record<string, unknown>> {
    const fallback = this.buildResearchGenerationDraftPayload(ips, input, rdCode);
    return this.generateClientPropertyDraftWithAi({
      fallback,
      fallbackAdapter: 'rule-based-rd-proposal-generator',
      input: {
        ipList: ips.map((ip) => ({
          authorizeDate: ip.authorizeDate,
          id: String(ip.id),
          name: ip.softWorkName,
          number: ip.softWorkNum,
          remark: ip.remark,
          type: this.formatIpType(ip.softWorkType),
        })),
        rdInput: input,
      },
      outputSchema: {
        record: {
          core_technology: '核心技术说明',
          innovation_points: '创新点，按条目换行',
          ky_project_des: '详细研发立项报告正文，包含背景、目的、内容、路线、计划、成果',
          ky_project_name: '独立研发项目名称，不能直接复制知识产权或软著名称',
          project_type: '技术领域',
          rd_organization_method: '组织实施方式',
          stage_result: '阶段成果/预期成果',
        },
      },
      protectedKeys: [
        'end_date',
        'init_date',
        'ky_project_name',
        'ky_project_num',
        'related_ip_ids',
        'related_ps_ids',
        'related_transformation_ids',
      ],
      sceneLabel: '研发立项报告生成',
      systemPrompt:
        '你是高企研发立项报告助手。请基于关联知识产权和研发起止时间生成可人工审核的研发立项报告草稿，内容要详细、可归档。RD 是独立研发项目，不是软著/专利内容复述，项目名称和正文不得直接复制知识产权名称；知识产权只能作为拟形成或支撑成果引用。研发过程必须早于或覆盖知识产权登记前的技术形成过程，不能写成先取得证书再启动研发；不能编造真实费用凭证、人员投入、客户或收入。输出必须是JSON对象。',
      task,
    });
  }

  private normalizeResearchGenerationDraftPayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      core_technology: this.toNullableStringFromUnknown(payload.core_technology),
      end_date: this.toNullableStringFromUnknown(payload.end_date),
      fund_amount: this.toNullableStringFromUnknown(payload.fund_amount),
      fund_source: this.toNullableNumber(payload.fund_source) ?? 4,
      innovation_points: this.toNullableStringFromUnknown(
        payload.innovation_points,
      ),
      init_date: this.toNullableStringFromUnknown(payload.init_date),
      ky_project_des: this.toNullableStringFromUnknown(payload.ky_project_des),
      ky_project_leader: this.toNullableStringFromUnknown(
        payload.ky_project_leader,
      ),
      ky_project_name: this.toNullableStringFromUnknown(payload.ky_project_name),
      ky_project_num: this.toNullableStringFromUnknown(payload.ky_project_num),
      ky_project_status: this.toNullableNumber(payload.ky_project_status) ?? 1,
      lxbg_file: this.toNullableStringFromUnknown(payload.lxbg_file),
      project_type: this.toNullableStringFromUnknown(payload.project_type),
      rd_budget: this.toNullableStringFromUnknown(payload.rd_budget),
      rd_expense_total: this.toNullableStringFromUnknown(
        payload.rd_expense_total,
      ),
      rd_organization_method: this.toNullableStringFromUnknown(
        payload.rd_organization_method,
      ),
      related_ip_ids: this.toNullableStringFromUnknown(payload.related_ip_ids),
      related_ps_ids: this.toNullableStringFromUnknown(payload.related_ps_ids),
      related_transformation_ids: this.toNullableStringFromUnknown(
        payload.related_transformation_ids,
      ),
      remark: this.toNullableStringFromUnknown(payload.remark),
      stage_result: this.toNullableStringFromUnknown(payload.stage_result),
    };
  }

  private async validateResearchDraftForApproval(
    enterpriseId: string,
    payload: Record<string, unknown>,
  ): Promise<null | string> {
    const name = this.toNullableStringFromUnknown(payload.ky_project_name);
    const initDate = this.toNullableStringFromUnknown(payload.init_date);
    const endDate = this.toNullableStringFromUnknown(payload.end_date);
    const relatedIpIds = this.parseRelationIds(
      this.toNullableStringFromUnknown(payload.related_ip_ids),
    );
    if (!name) {
      return '研发项目名称不能为空';
    }
    const nameValidationMessage = await this.validatePropertyNameUnique(
      enterpriseId,
      'research_project',
      name,
    );
    if (nameValidationMessage) {
      return nameValidationMessage;
    }
    if (!initDate || !endDate) {
      return '研发起止时间不能为空';
    }
    const initTime = Date.parse(initDate);
    const endTime = Date.parse(endDate);
    if (!Number.isNaN(initTime) && !Number.isNaN(endTime) && initTime > endTime) {
      return '研发开始时间不能晚于结束时间';
    }
    if (relatedIpIds.length === 0) {
      return '至少需要关联一个知识产权';
    }
    const relatedIps = await this.enterprisePropertyRecordRepo.find({
      where: {
        enterpriseId,
        id: In(relatedIpIds),
        recordType: 'intellectual_property',
        status: 1,
      },
    });
    if (relatedIps.length !== relatedIpIds.length) {
      return '关联知识产权不存在或已被删除';
    }
    const dateValidationMessage = this.validateResearchPeriodBeforeIpDates(
      initDate,
      endDate,
      relatedIps,
    );
    if (dateValidationMessage) {
      return dateValidationMessage;
    }
    return null;
  }

  private validateResearchPeriodBeforeIpDates(
    initDate: string,
    endDate: string,
    ips: EnterprisePropertyRecordEntity[],
  ): null | string {
    const endTime = Date.parse(endDate);
    if (Number.isNaN(endTime)) {
      return '研发结束时间格式不正确';
    }

    const missingDateIps = ips.filter(
      (ip) => !this.parseDateOnlyTime(ip.authorizeDate),
    );
    if (missingDateIps.length > 0) {
      return `所选知识产权缺少登记/授权日期：${this.formatIpNamesForMessage(
        missingDateIps,
      )}`;
    }

    const conflictIps = ips.filter((ip) => {
      const authorizeTime = this.parseDateOnlyTime(ip.authorizeDate);
      return authorizeTime !== null && endTime >= authorizeTime;
    });
    if (conflictIps.length > 0) {
      return `研发结束时间必须早于知识产权登记/授权日期：${this.formatIpNamesForMessage(
        conflictIps,
      )}`;
    }

    const initTime = Date.parse(initDate);
    if (!Number.isNaN(initTime) && initTime > endTime) {
      return '研发开始时间不能晚于结束时间';
    }

    return null;
  }

  private parseDateOnlyTime(value: null | string | undefined): null | number {
    if (!value) {
      return null;
    }
    const match = value.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/u);
    const normalized = match
      ? `${match[1]}-${match[2]?.padStart(2, '0')}-${match[3]?.padStart(2, '0')}`
      : value.slice(0, 10);
    const time = Date.parse(normalized);
    return Number.isNaN(time) ? null : time;
  }

  private formatDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatIpNamesForMessage(ips: EnterprisePropertyRecordEntity[]): string {
    return ips
      .slice(0, 3)
      .map((ip) => ip.softWorkName || ip.softWorkNum || `IP ${ip.id}`)
      .join('、');
  }

  private resolveResearchProjectYear(initDate: string): string {
    const yearMatch = initDate.match(/\d{4}/u);
    return yearMatch?.[0] ?? String(new Date().getFullYear());
  }

  private inferResearchTechnicalField(ips: EnterprisePropertyRecordEntity[]) {
    const configuredCategories = [
      ...new Set(
        ips
          .map((ip) => this.toNullableStringFromUnknown(ip.ipTechCategory))
          .filter((category): category is string => Boolean(category)),
      ),
    ];
    if (configuredCategories.length === 1) {
      return configuredCategories[0];
    }
    const names = ips
      .map((ip) => `${ip.softWorkName ?? ''}${ip.remark ?? ''}`)
      .join(' ');
    if (/软件|系统|平台|数据|算法|智能|模型/u.test(names)) {
      return '电子信息';
    }
    if (/材料|涂层|合金|复合/u.test(names)) {
      return '新材料';
    }
    if (/节能|环保|治理|回收|排放/u.test(names)) {
      return '资源与环境';
    }
    return '企业核心技术';
  }

  private extractResearchProjectTheme(
    ipNames: string[],
    technicalField: string,
  ): string {
    const base = ipNames[0] ?? technicalField;
    const cleaned = base
      .replace(/(?:软件著作权|软著|发明专利|实用新型|外观设计|专利|证书|登记|原件)/gu, '')
      .replace(/(?:软件|系统|平台|装置|方法|模块|管理|V\d+(?:\.\d+)*|v\d+(?:\.\d+)*)/gu, '')
      .replace(/[《》【】()[\]（）_\-—:：,，.。]/gu, ' ')
      .replace(/\s+/gu, '')
      .trim();
    const theme = cleaned.slice(0, 14);
    if (theme) {
      return theme;
    }

    const fieldThemeMap: Record<string, string> = {
      企业核心技术: '企业核心技术体系',
      新材料: '新材料应用',
      电子信息: '智能信息化应用',
      资源与环境: '绿色低碳应用',
    };
    return fieldThemeMap[technicalField] ?? `${technicalField}应用`;
  }

  private resolveAutoMatchedResearchPeriod(
    year: number,
    durationMonths: number,
    index: number,
    ips: EnterprisePropertyRecordEntity[],
  ): { endDate: string; initDate: string } {
    const startMonth = 1 + ((index * 2) % 6);
    let initDate = new Date(year, startMonth - 1, 1);
    let endDate = new Date(year, startMonth - 1 + durationMonths, 0);
    const earliestIpTime = Math.min(
      ...ips
        .map((ip) => this.parseDateOnlyTime(ip.authorizeDate))
        .filter((time): time is number => time !== null),
    );

    if (Number.isFinite(earliestIpTime) && endDate.getTime() >= earliestIpTime) {
      endDate = new Date(earliestIpTime);
      endDate.setDate(endDate.getDate() - 1);
      initDate = new Date(
        endDate.getFullYear(),
        endDate.getMonth() - durationMonths + 1,
        1,
      );
    }

    return {
      endDate: this.formatDateOnly(endDate),
      initDate: this.formatDateOnly(initDate),
    };
  }

  private buildResearchAutoMatchGroups(
    ips: EnterprisePropertyRecordEntity[],
    transformations: EnterprisePropertyRecordEntity[],
    targetCount: number,
  ): string[][] {
    const sortedIps = this.sortClientIpRowsForNumbering(ips);
    const ipById = new Map(sortedIps.map((ip) => [String(ip.id), ip]));
    const usedIpIds = new Set<string>();
    let groups: string[][] = [];

    transformations.forEach((transformation) => {
      const group = this.parseRelationIds(transformation.relatedIpIds).filter(
        (id) => ipById.has(id) && !usedIpIds.has(id),
      );
      if (group.length === 0) {
        return;
      }
      const sortedGroup = this.sortResearchAutoMatchGroup(group, ipById);
      sortedGroup.forEach((id) => usedIpIds.add(id));
      groups.push(...this.groupResearchAutoMatchIdsByCategory(sortedGroup, ipById));
    });

    const remainingIds = sortedIps
      .map((ip) => String(ip.id))
      .filter((id) => !usedIpIds.has(id));
    groups.push(...this.groupResearchAutoMatchIdsByCategory(remainingIds, ipById));

    while (groups.length < targetCount && groups.length > 0) {
      const splitIndex = groups.findIndex(
        (group) =>
          group.length > 1 &&
          ipById.get(group[0] ?? '')?.softWorkType === 3,
      );
      const fallbackSplitIndex = groups.findIndex((group) => group.length > 1);
      const resolvedSplitIndex =
        splitIndex >= 0 ? splitIndex : fallbackSplitIndex;
      if (resolvedSplitIndex < 0) {
        break;
      }
      const group = groups[resolvedSplitIndex] ?? [];
      const splitAt = Math.ceil(group.length / 2);
      groups[resolvedSplitIndex] = group.slice(0, splitAt);
      groups.push(group.slice(splitAt));
    }

    return groups
      .sort((left, right) => {
        const leftIp = ipById.get(left[0] ?? '');
        const rightIp = ipById.get(right[0] ?? '');
        return this.resolveClientIpCodeRank(leftIp) - this.resolveClientIpCodeRank(rightIp);
      })
      .slice(0, targetCount);
  }

  private sortResearchAutoMatchGroup(
    ids: string[],
    ipById: Map<string, EnterprisePropertyRecordEntity>,
  ): string[] {
    return [...ids].sort((left, right) => {
      const leftIp = ipById.get(left);
      const rightIp = ipById.get(right);
      return this.resolveClientIpCodeRank(leftIp) - this.resolveClientIpCodeRank(rightIp);
    });
  }

  private groupResearchAutoMatchIdsByCategory(
    ids: string[],
    ipById: Map<string, EnterprisePropertyRecordEntity>,
  ): string[][] {
    const categoryGroups = new Map<string, string[]>();
    ids.forEach((id) => {
      const ip = ipById.get(id);
      if (!ip) {
        return;
      }
      const category = this.resolveResearchAutoMatchCategory(ip);
      categoryGroups.set(category.key, [...(categoryGroups.get(category.key) ?? []), id]);
    });

    return [...categoryGroups.values()]
      .map((group) => this.sortResearchAutoMatchGroup(group, ipById))
      .sort((left, right) => {
        const leftIp = ipById.get(left[0] ?? '');
        const rightIp = ipById.get(right[0] ?? '');
        return this.resolveClientIpCodeRank(leftIp) - this.resolveClientIpCodeRank(rightIp);
      });
  }

  private resolveResearchAutoMatchCategory(
    ip: EnterprisePropertyRecordEntity,
  ): ResearchAutoMatchCategory {
    const type = this.formatIpType(ip.softWorkType);
    const level = ip.ipLevel || (ip.softWorkType === 1 ? 'I类' : 'II类');
    const technicalField =
      this.toNullableStringFromUnknown(ip.ipTechCategory) ||
      this.inferResearchTechnicalField([ip]);
    return {
      key: `${ip.softWorkType ?? 0}|${level}|${technicalField}`,
      label: `${type} / ${level} / ${technicalField}`,
      technicalField,
    };
  }

  private describeResearchAutoMatchGroup(
    ips: EnterprisePropertyRecordEntity[],
  ): ResearchAutoMatchCategory {
    const categories = ips.map((ip) => this.resolveResearchAutoMatchCategory(ip));
    const primary = categories[0] ?? {
      key: 'unknown',
      label: '未分类知识产权',
      technicalField: '企业核心技术',
    };
    const labels = [...new Set(categories.map((category) => category.label))];
    return {
      ...primary,
      label: labels.join('；'),
    };
  }

  private resolveResearchAutoMatchPlan(
    candidate: ResearchAutoMatchCandidate,
    groupCount: number,
    requestedTotal?: number,
  ): ResearchAutoMatchPlan {
    const years = this.resolveResearchAutoMatchYears(candidate.validRows);
    const existingCountByYear = new Map(years.map((year) => [year, 0]));
    candidate.existingRdRows.forEach((row) => {
      const year = Number(this.resolveResearchProjectYear(row.initDate ?? ''));
      if (existingCountByYear.has(year)) {
        existingCountByYear.set(year, (existingCountByYear.get(year) ?? 0) + 1);
      }
    });
    candidate.activeRdDraftRows.forEach((draft) => {
      const payload = this.parseJsonObject(draft.draftPayload);
      const year = Number(
        this.resolveResearchProjectYear(
          this.toNullableStringFromUnknown(payload.init_date) ?? '',
        ),
      );
      if (existingCountByYear.has(year)) {
        existingCountByYear.set(year, (existingCountByYear.get(year) ?? 0) + 1);
      }
    });

    const existingTotal =
      candidate.existingRdRows.length + candidate.activeRdDraftRows.length;
    const recommendedTotal = Math.min(
      10,
      Math.max(6, candidate.sourceValidIpCount),
    );
    const annualDeficits = years.flatMap((year) =>
      Array.from(
        { length: Math.max(0, 2 - (existingCountByYear.get(year) ?? 0)) },
        () => year,
      ),
    );
    const hasRequestedTotal = Number.isInteger(requestedTotal);
    const desiredTotal = hasRequestedTotal
      ? this.resolveTargetCount(requestedTotal, 6, 10, recommendedTotal)
      : recommendedTotal;
    const requiredCount = hasRequestedTotal
      ? Math.max(0, desiredTotal - existingTotal)
      : Math.max(0, recommendedTotal - existingTotal, annualDeficits.length);
    const targetCount = Math.min(
      groupCount,
      Math.max(0, 10 - existingTotal),
      requiredCount,
    );
    const plannedYears = annualDeficits.slice(0, targetCount);

    while (plannedYears.length < targetCount) {
      const nextYear = [...years].sort((left, right) => {
        const leftCount =
          (existingCountByYear.get(left) ?? 0) +
          plannedYears.filter((year) => year === left).length;
        const rightCount =
          (existingCountByYear.get(right) ?? 0) +
          plannedYears.filter((year) => year === right).length;
        return leftCount - rightCount || left - right;
      })[0];
      if (!nextYear) {
        break;
      }
      plannedYears.push(nextYear);
    }

    return {
      plannedYears,
      targetCount,
      warning:
        targetCount < requiredCount
          ? `可分配 IP 分组仅 ${groupCount} 个，或现有 RD 已接近 10 条上限；本次只能生成 ${targetCount} 条。`
          : null,
    };
  }

  private resolveResearchAutoMatchYears(
    ips: EnterprisePropertyRecordEntity[],
  ): number[] {
    const authorizationYears = ips
      .map((ip) => this.parseDateOnlyTime(ip.authorizeDate))
      .filter((time): time is number => time !== null)
      .map((time) => new Date(time).getFullYear());
    const latestAllowedYear = Math.min(
      new Date().getFullYear() - 1,
      Math.min(...authorizationYears) - 1,
    );
    return [latestAllowedYear - 2, latestAllowedYear - 1, latestAllowedYear];
  }

  private groupResearchRowsForProductService(
    rows: EnterprisePropertyRecordEntity[],
    maxGroupCount = 5,
  ): EnterprisePropertyRecordEntity[][] {
    const groups = new Map<string, EnterprisePropertyRecordEntity[]>();
    rows.forEach((row) => {
      const key = this.resolveProductServiceTechField([row]);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });
    return this.limitProductServiceGroups(
      [...groups.entries()]
        .map(([field, groupRows]) => ({ field, rows: groupRows })),
      maxGroupCount,
    ).map((group) => group.rows);
  }

  private limitProductServiceGroups(
    groups: Array<{ field: string; rows: EnterprisePropertyRecordEntity[] }>,
    maxGroupCount: number,
  ): Array<{ field: string; rows: EnterprisePropertyRecordEntity[] }> {
    const normalizedGroups = groups
      .map((group) => ({
        field: group.field || '企业核心技术',
        rows: [...group.rows],
      }))
      .filter((group) => group.rows.length > 0);
    while (normalizedGroups.length > Math.max(1, maxGroupCount)) {
      normalizedGroups.sort((left, right) => left.rows.length - right.rows.length);
      const source = normalizedGroups.shift();
      if (!source) {
        break;
      }
      const targetIndex = this.pickProductServiceGroupMergeTarget(
        source,
        normalizedGroups,
      );
      if (targetIndex < 0) {
        normalizedGroups.push(source);
        break;
      }
      const target = normalizedGroups[targetIndex];
      normalizedGroups[targetIndex] = {
        field:
          target.field === '企业核心技术' && source.field !== '企业核心技术'
            ? source.field
            : target.field,
        rows: [...target.rows, ...source.rows],
      };
    }
    return normalizedGroups;
  }

  private pickProductServiceGroupMergeTarget(
    source: { field: string; rows: EnterprisePropertyRecordEntity[] },
    groups: Array<{ field: string; rows: EnterprisePropertyRecordEntity[] }>,
  ): number {
    if (groups.length === 0) {
      return -1;
    }
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    groups.forEach((group, index) => {
      const score = this.resolveProductServiceGroupSimilarity(source, group);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  private resolveProductServiceGroupSimilarity(
    source: { field: string; rows: EnterprisePropertyRecordEntity[] },
    target: { field: string; rows: EnterprisePropertyRecordEntity[] },
  ): number {
    const sourceTokens = this.extractProductServiceTokens(source.rows);
    const targetTokens = this.extractProductServiceTokens(target.rows);
    const overlapScore = sourceTokens.filter((token) =>
      targetTokens.includes(token),
    ).length;
    let score = overlapScore;
    if (
      source.field === '企业核心技术' ||
      target.field === '企业核心技术'
    ) {
      score += 2;
    }
    const sourceInferredField = this.inferProductServiceField(source.rows);
    const targetInferredField = this.inferProductServiceField(target.rows);
    if (sourceInferredField === target.field || source.field === targetInferredField) {
      score += 3;
    }
    score += target.rows.length * 0.01;
    return score;
  }

  private buildProductServiceGenerationDraftPayload(
    rdRows: EnterprisePropertyRecordEntity[],
    ipRows: EnterprisePropertyRecordEntity[],
    transformationRows: EnterprisePropertyRecordEntity[],
    index: number,
    existingPsCount = 0,
  ): Record<string, unknown> {
    const rdIds = rdRows.map((row) => String(row.id));
    const rdNames = rdRows.map(
      (row) => row.kyProjectName || row.kyProjectNum || `RD${row.id}`,
    );
    const relatedIpIds = [
      ...new Set(rdRows.flatMap((row) => this.parseRelationIds(row.relatedIpIds))),
    ];
    const relatedTransformationIds = [
      ...new Set([
        ...rdRows.flatMap((row) =>
          this.parseRelationIds(row.relatedTransformationIds),
        ),
        ...transformationRows
          .filter((row) =>
            this.parseRelationIds(row.relatedIpIds).some((id) =>
              relatedIpIds.includes(id),
            ),
          )
          .map((row) => String(row.id)),
      ]),
    ];
    const relatedTransformationRows = transformationRows.filter((row) =>
      relatedTransformationIds.includes(String(row.id)),
    );
    const ipNameMap = new Map(
      ipRows.map((row) => [
        String(row.id),
        row.softWorkName || row.softWorkNum || `知识产权${row.id}`,
      ]),
    );
    const ipNames = relatedIpIds.map((id) => ipNameMap.get(id) ?? `知识产权${id}`);
    const transformationNames = relatedTransformationRows.map(
      (row) => row.transformationName || row.transformationCode || `成果${row.id}`,
    );
    const transformationScenes = relatedTransformationRows
      .map((row) => row.applicationScene || row.customerName || '')
      .filter(Boolean);
    const techField = this.resolveProductServiceTechField(rdRows);
    const keyword = this.extractProductServiceKeyword(
      rdNames,
      ipNames,
      transformationNames,
      transformationScenes,
    );
    const nameCandidates = this.buildProductServiceNameCandidates(
      techField,
      keyword,
      transformationScenes,
      rdRows,
    );
    const psName = nameCandidates[0] ?? `${keyword}应用解决方案`;
    const year = this.resolveResearchProjectYear(
      rdRows[0]?.initDate || String(new Date().getFullYear()),
    );
    const stageResults = rdRows
      .map((row) => this.toNullableStringFromUnknown(row.stageResult))
      .filter(Boolean) as string[];
    const coreTechnology = [
      `围绕${keyword}方向，整合 ${rdNames.join('、')} 等研发项目形成的核心技术能力。`,
      ipNames.length > 0
        ? `相关知识产权包括 ${ipNames.join('、')}，可作为产品化与技术先进性的支撑材料。`
        : '当前未自动匹配到知识产权，建议补齐能支撑该产品/服务的核心 IP。',
      stageResults.length > 0
        ? `阶段成果可归纳为：${stageResults.slice(0, 3).join('；')}。`
        : null,
      transformationScenes.length > 0
        ? `现有成果转化场景主要集中在：${transformationScenes
            .slice(0, 2)
            .join('；')}。`
        : null,
    ]
      .filter(Boolean)
      .join('');
    const techIndex = this.buildProductServiceTechIndex(
      keyword,
      relatedTransformationRows,
    );
    const competitiveAdvantage = [
      '以企业自主研发项目为基础，研发过程、知识产权和成果转化关系可追溯。',
      stageResults.length > 0 ? '已具备阶段成果沉淀，便于后续补齐测试、验收和客户应用材料。' : null,
      relatedTransformationRows.length > 0
        ? '已有成果转化线索，可继续补齐合同、发票、案例和收入口径。'
        : '建议尽快补齐成果转化、合同发票或客户应用证明，增强高新收入支撑。 ',
    ]
      .filter(Boolean)
      .join('');

    return {
      competitive_advantage: competitiveAdvantage,
      high_tech_income: '',
      last_year_income: '',
      proof_files: '待补充合同、发票、检测报告、验收记录、产品截图、用户案例等证明材料。',
      ps_code: `PS${year}-${String(existingPsCount + index).padStart(2, '0')}`,
      ps_name: psName,
      ps_name_candidates: nameCandidates,
      related_contract_ids: '',
      related_invoice_ids: '',
      related_ip_ids: relatedIpIds.join(','),
      related_rd_ids: rdIds.join(','),
      related_transformation_ids: relatedTransformationIds.join(','),
      remark: 'AI 生成 PS 草稿，收入、客户、合同和发票请按真实材料补充。',
      source_ip_names: ipNames,
      source_rd_names: rdNames,
      tech_description: coreTechnology,
      tech_field: techField,
      tech_index: techIndex,
      tech_source: '自主研发',
    };
  }

  private async buildProductServiceGenerationDraftPayloadWithAi(
    task: AiTaskEntity,
    rdRows: EnterprisePropertyRecordEntity[],
    ipRows: EnterprisePropertyRecordEntity[],
    transformationRows: EnterprisePropertyRecordEntity[],
    index: number,
    existingPsCount = 0,
  ): Promise<Record<string, unknown>> {
    const fallback = this.buildProductServiceGenerationDraftPayload(
      rdRows,
      ipRows,
      transformationRows,
      index,
      existingPsCount,
    );
    const relatedTransformationIds = this.parseRelationIds(
      this.toNullableStringFromUnknown(fallback.related_transformation_ids),
    );
    const relatedTransformationRows = transformationRows.filter((row) =>
      relatedTransformationIds.includes(String(row.id)),
    );
    return this.generateClientPropertyDraftWithAi({
      fallback,
      fallbackAdapter: 'field-grouping-ps-generator',
      input: {
        relatedIpNames: fallback.source_ip_names ?? [],
        relatedRdNames: fallback.source_rd_names ?? [],
        relatedTransformationNames: relatedTransformationRows.map(
          (row) => row.transformationName || row.transformationCode || '',
        ),
        relatedTransformationScenes: relatedTransformationRows
          .map((row) => row.applicationScene || row.customerName || '')
          .filter(Boolean),
        rdList: rdRows.map((row) => ({
          coreTechnology: row.coreTechnology,
          id: String(row.id),
          innovationPoints: row.innovationPoints,
          name: row.kyProjectName,
          projectType: row.projectType,
          stageResult: row.stageResult,
        })),
        techFieldHint: fallback.tech_field,
      },
      outputSchema: {
        record: {
          competitive_advantage: '竞争优势，结合RD创新点和IP支撑',
          proof_files: '证明材料建议，不得编造已存在材料',
          ps_name: '高新产品/服务名称',
          ps_name_candidates: '3个候选名称数组',
          tech_description: '关键技术，汇总RD和IP',
          tech_field: '技术领域',
          tech_index: '主要技术指标，只给待确认草稿，不编造具体数值',
          tech_source: '技术来源',
        },
      },
      protectedKeys: [
        'ps_code',
        'related_contract_ids',
        'related_invoice_ids',
        'related_ip_ids',
        'related_rd_ids',
        'related_transformation_ids',
        'source_ip_names',
        'source_rd_names',
      ],
      sceneLabel: 'PS 高新产品批量生成',
      systemPrompt:
        '你是高企高新产品/服务PS材料助手。请基于同一领域RD、知识产权和成果转化线索生成PS草稿，名称要像真实产品或服务，避免空泛的“平台/系统”套话，不要直接堆叠RD/IP名称，不得编造收入、合同、客户、发票或检测结论。输出必须是JSON对象。',
      task,
    });
  }

  private normalizeProductServiceGenerationDraftPayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      competitive_advantage: this.toNullableStringFromUnknown(
        payload.competitive_advantage,
      ),
      high_tech_income: this.toNullableStringFromUnknown(payload.high_tech_income),
      last_year_income: this.toNullableStringFromUnknown(payload.last_year_income),
      proof_files: this.toNullableStringFromUnknown(payload.proof_files),
      ps_code: this.toNullableStringFromUnknown(payload.ps_code),
      ps_name: this.toNullableStringFromUnknown(payload.ps_name),
      related_contract_ids: this.toNullableStringFromUnknown(
        payload.related_contract_ids,
      ),
      related_invoice_ids: this.toNullableStringFromUnknown(
        payload.related_invoice_ids,
      ),
      related_ip_ids: this.toNullableStringFromUnknown(payload.related_ip_ids),
      related_rd_ids: this.toNullableStringFromUnknown(payload.related_rd_ids),
      related_transformation_ids: this.toNullableStringFromUnknown(
        payload.related_transformation_ids,
      ),
      remark: this.toNullableStringFromUnknown(payload.remark),
      tech_description: this.toNullableStringFromUnknown(payload.tech_description),
      tech_field: this.toNullableStringFromUnknown(payload.tech_field),
      tech_index: this.toNullableStringFromUnknown(payload.tech_index),
      tech_source: this.toNullableStringFromUnknown(payload.tech_source),
    };
  }

  private async validateProductServiceDraftForApproval(
    enterpriseId: string,
    payload: Record<string, unknown>,
  ): Promise<null | string> {
    const name = this.toNullableStringFromUnknown(payload.ps_name);
    const relatedRdIds = this.parseRelationIds(
      this.toNullableStringFromUnknown(payload.related_rd_ids),
    );
    const relatedIpIds = this.parseRelationIds(
      this.toNullableStringFromUnknown(payload.related_ip_ids),
    );
    const relatedTransformationIds = this.parseRelationIds(
      this.toNullableStringFromUnknown(payload.related_transformation_ids),
    );
    if (!name) {
      return '产品/服务名称不能为空';
    }
    if (this.isForbiddenProductServiceName(name)) {
      return 'PS 名称不能使用“产品（服务）”等泛化名称';
    }
    const nameValidationMessage = await this.validatePropertyNameUnique(
      enterpriseId,
      'product_service',
      name,
    );
    if (nameValidationMessage) {
      return nameValidationMessage;
    }
    if (relatedRdIds.length === 0) {
      return '至少需要关联一个 RD 项目';
    }
    if (relatedIpIds.length === 0) {
      return '至少需要关联一个知识产权';
    }
    const relatedRows = await this.enterprisePropertyRecordRepo.find({
      where: {
        enterpriseId,
        id: In([
          ...this.uniqueRelationIds(relatedRdIds),
          ...this.uniqueRelationIds(relatedIpIds),
          ...this.uniqueRelationIds(relatedTransformationIds),
        ]),
        status: 1,
      },
    });
    const relatedIdsByType = new Map<string, Set<string>>();
    relatedRows.forEach((row) => {
      const ids = relatedIdsByType.get(row.recordType) ?? new Set<string>();
      ids.add(String(row.id));
      relatedIdsByType.set(row.recordType, ids);
    });
    const relationChecks: Array<{
      ids: string[];
      label: string;
      recordType: string;
    }> = [
      { ids: relatedRdIds, label: 'RD 项目', recordType: 'research_project' },
      {
        ids: relatedIpIds,
        label: '知识产权',
        recordType: 'intellectual_property',
      },
      { ids: relatedTransformationIds, label: '成果转化', recordType: 'transformation' },
    ];
    const missingRelation = relationChecks.find(({ ids, recordType }) =>
      ids.some((id) => !relatedIdsByType.get(recordType)?.has(id)),
    );
    if (missingRelation) {
      return `关联${missingRelation.label}不存在、已删除或不属于当前企业`;
    }
    return null;
  }

  private async enrichClientPropertyDraftItemsWithReviewWarnings(
    enterpriseId: string,
    items: ClientAiDraftItem[],
  ): Promise<ClientAiDraftItem[]> {
    if (items.length === 0) {
      return items;
    }

    const needsTransformationCheck = items.some(
      (item) => item.draftType === 'transformation',
    );
    const usedIpIds = needsTransformationCheck
      ? this.collectRelatedIpIds(
          await this.enterprisePropertyRecordRepo.find({
            where: {
              enterpriseId,
              recordType: 'transformation',
              status: 1,
            },
          }),
        )
      : new Set<string>();

    const enrichedItems = items.map((item) => ({
      ...item,
      draftPayload: {
        ...item.draftPayload,
        review_warnings: this.buildClientPropertyDraftReviewWarnings(
          item.draftType,
          item.draftPayload,
          usedIpIds,
        ),
      },
    }));
    await this.enrichClientPropertyDraftRelationLabels(
      enterpriseId,
      enrichedItems,
    );
    return enrichedItems;
  }

  private buildClientPropertyDraftReviewWarnings(
    draftType: string,
    payload: Record<string, unknown>,
    usedIpIds: Set<string>,
  ): string[] {
    if (draftType === 'transformation') {
      return this.buildTransformationDraftReviewWarnings(payload, usedIpIds);
    }
    if (draftType === 'research_project') {
      return this.buildResearchDraftReviewWarnings(payload);
    }
    if (draftType === 'product_service') {
      return this.buildProductServiceDraftReviewWarnings(payload);
    }
    return [];
  }

  private buildTransformationDraftReviewWarnings(
    payload: Record<string, unknown>,
    usedIpIds: Set<string>,
  ): string[] {
    const warnings: string[] = [];
    const relatedIpIds = this.parseRelationIds(
      this.toNullableStringFromUnknown(payload.related_ip_ids),
    );
    if (!this.toNullableStringFromUnknown(payload.transformation_name)) {
      warnings.push('成果名称不能为空');
    }
    if (relatedIpIds.length === 0) {
      warnings.push('至少需要关联一个知识产权');
    }
    const duplicatedIp = relatedIpIds.find((id) => usedIpIds.has(id));
    if (duplicatedIp) {
      warnings.push(`知识产权 ${duplicatedIp} 已有关联成果，入库前请确认是否重复生成`);
    }
    if (!this.toNullableStringFromUnknown(payload.application_scene)) {
      warnings.push('成果内容/应用场景为空，建议补充转化过程和应用价值');
    }
    if (!this.toNullableStringFromUnknown(payload.remark)) {
      warnings.push('技术描述为空，建议补充核心技术、创新点和技术效果');
    }
    if (!this.toNullableStringFromUnknown(payload.transformation_method)) {
      warnings.push('转化方式为空，建议填写自行实施、许可、转让等方式');
    }
    if (this.isTodoLikeText(payload.proof_files)) {
      warnings.push('证明材料仍为待补充，后续需补合同、发票、验收或产品证明');
    }
    return warnings;
  }

  private buildResearchDraftReviewWarnings(
    payload: Record<string, unknown>,
  ): string[] {
    const warnings: string[] = [];
    const initDate = this.toNullableStringFromUnknown(payload.init_date);
    const endDate = this.toNullableStringFromUnknown(payload.end_date);
    const relatedIpIds = this.parseRelationIds(
      this.toNullableStringFromUnknown(payload.related_ip_ids),
    );
    if (!this.toNullableStringFromUnknown(payload.ky_project_name)) {
      warnings.push('研发项目名称不能为空');
    }
    if (!initDate || !endDate) {
      warnings.push('研发起止时间不能为空');
    } else {
      const initTime = Date.parse(initDate);
      const endTime = Date.parse(endDate);
      if (!Number.isNaN(initTime) && !Number.isNaN(endTime) && initTime > endTime) {
        warnings.push('研发开始时间不能晚于结束时间');
      }
    }
    if (relatedIpIds.length === 0) {
      warnings.push('至少需要关联一个知识产权');
    }
    if (!this.toNullableStringFromUnknown(payload.project_type)) {
      warnings.push('技术领域为空，建议补充高企领域口径');
    }
    if (!this.toNullableStringFromUnknown(payload.ky_project_des)) {
      warnings.push('立项报告正文为空，无法支撑 RD 立项材料');
    }
    if (!this.toNullableStringFromUnknown(payload.core_technology)) {
      warnings.push('核心技术为空，建议补充研发内容和技术路线');
    }
    if (!this.toNullableStringFromUnknown(payload.innovation_points)) {
      warnings.push('创新点为空，建议补充与关联 IP 对应的创新说明');
    }
    if (this.isTodoLikeText(payload.ky_project_leader)) {
      warnings.push('研发负责人待补充，后续需与研发人员/组织材料一致');
    }
    if (this.isTodoLikeText(payload.rd_budget)) {
      warnings.push('研发预算待补充，后续需与研发费用台账一致');
    }
    return warnings;
  }

  private buildProductServiceDraftReviewWarnings(
    payload: Record<string, unknown>,
  ): string[] {
    const warnings: string[] = [];
    const relatedRdIds = this.parseRelationIds(
      this.toNullableStringFromUnknown(payload.related_rd_ids),
    );
    const relatedIpIds = this.parseRelationIds(
      this.toNullableStringFromUnknown(payload.related_ip_ids),
    );
    const relatedTransformationIds = this.parseRelationIds(
      this.toNullableStringFromUnknown(payload.related_transformation_ids),
    );
    if (!this.toNullableStringFromUnknown(payload.ps_name)) {
      warnings.push('产品/服务名称不能为空');
    }
    if (relatedRdIds.length === 0) {
      warnings.push('至少需要关联一个 RD 项目');
    }
    if (relatedIpIds.length === 0) {
      warnings.push('未关联知识产权，证据链中 PS -> RD -> IP 支撑不足');
    }
    if (relatedTransformationIds.length === 0) {
      warnings.push('未匹配成果转化，建议补齐 PS 与成果转化关系');
    }
    if (!this.toNullableStringFromUnknown(payload.tech_field)) {
      warnings.push('技术领域为空，建议按 RD 领域或高企领域补充');
    }
    if (!this.toNullableStringFromUnknown(payload.tech_description)) {
      warnings.push('关键技术为空，建议汇总 RD 和 IP 的核心技术');
    }
    if (this.isTodoLikeText(payload.tech_index)) {
      warnings.push('技术指标仍为待补充，后续需补可验证指标且不能编造数值');
    }
    if (!this.toNullableStringFromUnknown(payload.competitive_advantage)) {
      warnings.push('竞争优势为空，建议结合 RD 创新点和 IP 支撑补充');
    }
    if (this.isTodoLikeText(payload.proof_files)) {
      warnings.push('证明材料仍为待补充，后续需补合同、发票、检测报告或产品截图');
    }
    return warnings;
  }

  private isTodoLikeText(value: unknown): boolean {
    const text = this.toNullableStringFromUnknown(value);
    return !text || /待补|待核对|暂无补充|不编造具体数值/u.test(text);
  }

  private async generateClientPropertyDraftWithAi(input: {
    fallback: Record<string, unknown>;
    fallbackAdapter: string;
    input: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    protectedKeys?: string[];
    sceneLabel: string;
    systemPrompt: string;
    task: AiTaskEntity;
  }): Promise<Record<string, unknown>> {
    if (!this.canUseClientPropertyAi()) {
      return {
        ...input.fallback,
      ai_adapter: input.fallbackAdapter,
      ai_adapter_status: 'fallback_not_configured',
    };
    }

    try {
      const aiResult = await this.aiService.runStructuredJsonCompletion({
        input: input.input,
        outputSchema: input.outputSchema,
        scene: String(input.task.scene),
        systemPrompt: input.systemPrompt,
        taskId: String(input.task.id),
      });
      const record = this.resolveClientPropertyAiRecord(aiResult.structuredResult);
      const confidence = this.normalizeOptionalConfidenceScore(
        record.confidence,
        input.fallback.confidence,
      );
      const protectedPayload = this.pickProtectedPayloadFields(
        input.fallback,
        input.protectedKeys ?? [],
      );

      return {
        ...input.fallback,
        ...record,
        ...(confidence === null ? {} : { confidence }),
        ...protectedPayload,
        ai_adapter: `${process.env.AI_PROVIDER || 'psydo'}-json`,
        ai_adapter_status: 'success',
        ai_model: aiResult.model,
        needs_review: true,
        recognition_note: this.toShortRecognitionNote(
          record.recognition_note,
          '部分识别',
        ),
      };
    } catch (error) {
      return {
        ...input.fallback,
        ai_adapter: input.fallbackAdapter,
        ai_adapter_error: this.resolveErrorMessage(error),
        ai_adapter_status: 'fallback_after_error',
        ai_scene_label: input.sceneLabel,
        recognition_note: '需人工核对',
      };
    }
  }

  private canUseClientPropertyAi(): boolean {
    return (
      process.env.AI_CLIENT_PROPERTY_ENABLE !== '0' &&
      Boolean(process.env.AI_API_KEY)
    );
  }

  private resolveClientPropertyAiRecord(
    value: Record<string, unknown>,
  ): Record<string, unknown> {
    const record = value.record;
    if (record && typeof record === 'object' && !Array.isArray(record)) {
      return this.removeEmptyAiDraftValues(record as Record<string, unknown>);
    }

    const records = value.records;
    if (Array.isArray(records)) {
      const firstRecord = records.find(
        (item) => item && typeof item === 'object' && !Array.isArray(item),
      );
      if (firstRecord) {
        return this.removeEmptyAiDraftValues(firstRecord as Record<string, unknown>);
      }
    }

    return this.removeEmptyAiDraftValues(value);
  }

  private removeEmptyAiDraftValues(
    value: Record<string, unknown>,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, item]) => item !== undefined && item !== null && item !== '',
      ),
    );
  }

  private pickProtectedPayloadFields(
    payload: Record<string, unknown>,
    keys: string[],
  ): Record<string, unknown> {
    return Object.fromEntries(
      keys
        .filter((key) => Object.prototype.hasOwnProperty.call(payload, key))
        .map((key) => [key, payload[key]]),
    );
  }

  private resolveErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private resolveIpRecognitionNote(
    hints: ReturnType<typeof this.extractIpRecognitionHints>,
    pdfText?: IpPdfTextExtractionResult,
  ): string {
    if (pdfText?.status === 'success') {
      return hints.recognizedFieldCount >= 3 ? '识别成功' : '部分识别';
    }
    if (pdfText?.status === 'failed') {
      return 'PDF解析失败';
    }
    if (pdfText?.status === 'unreadable') {
      return 'PDF无可提取文本';
    }
    return hints.certificateNo ? '仅识别编号' : '需人工补全';
  }

  private toShortRecognitionNote(value: unknown, fallback: string): string {
    const text = this.toNullableStringFromUnknown(value);
    if (!text) {
      return fallback;
    }
    if (/乱码|OCR|兜底|AI|pdf文本片段|PDF文本片段/iu.test(text)) {
      return fallback;
    }
    return text.replace(/\s+/gu, '').slice(0, 12) || fallback;
  }

  private resolveStoredFileAbsolutePath(storedPath: string): null | string {
    if (!storedPath) {
      return null;
    }

    const candidatePaths = [
      isAbsolute(storedPath) ? storedPath : join(process.cwd(), storedPath),
      join(getUploadRootAbsolutePath(), storedPath),
    ];
    return candidatePaths.find((path) => existsSync(path)) ?? null;
  }

  private async extractPdfTextFromStoredPath(
    storedPath: string,
    scene: PdfTextScene = 'ip',
  ): Promise<IpPdfTextExtractionResult> {
    if (!storedPath || extname(storedPath).toLowerCase() !== '.pdf') {
      return this.createPdfTextResult('', scene, 'empty');
    }

    const filePath = this.resolveStoredFileAbsolutePath(storedPath);
    if (!filePath) {
      return this.createPdfTextResult('', scene, 'failed', '文件不存在');
    }

    try {
      const buffer = readFileSync(filePath);
      const parsedText =
        (await this.extractPdfTextWithOptionalParser(buffer)) ||
        this.extractPdfTextWithToUnicodeMap(buffer);
      return this.createPdfTextResult(parsedText, scene);
    } catch (error) {
      return this.createPdfTextResult(
        '',
        scene,
        'failed',
        this.resolveErrorMessage(error),
      );
    }
  }

  private async extractPdfTextWithOptionalParser(buffer: Buffer): Promise<string> {
    try {
      const requireFromHere = createRequire(__filename);
      const loaded = requireFromHere('pdf-parse') as {
        default?: PdfParseFunction;
        PDFParse?: PdfParseConstructor;
      } | PdfParseFunction;
      const parsePdf =
        typeof loaded === 'function'
          ? loaded
          : typeof loaded.default === 'function'
            ? loaded.default
            : null;
      if (parsePdf) {
        const result = await parsePdf(buffer);
        return this.normalizeExtractedPdfText(result.text ?? '');
      }

      const pdfParseClass =
        typeof loaded === 'object' && typeof loaded.PDFParse === 'function'
          ? loaded.PDFParse
          : null;
      if (pdfParseClass) {
        const parser = new pdfParseClass({ data: buffer });
        try {
          const result = await parser.getText();
          return this.normalizeExtractedPdfText(result.text ?? '');
        } finally {
          await parser.destroy?.();
        }
      }
      return '';
    } catch {
      return '';
    }
  }

  private extractPdfTextWithToUnicodeMap(buffer: Buffer): string {
    const streams = this.extractFlateDecodedPdfStreams(buffer);
    const unicodeMap = this.buildPdfToUnicodeMap(streams);
    if (unicodeMap.size === 0) {
      return '';
    }

    const text = streams
      .filter((stream) => /(?:<[\dA-Fa-f]+>|\((?:\\.|[^\\()])*\))\s*Tj/u.test(stream))
      .flatMap((stream) => [
        ...[...stream.matchAll(/<([\dA-Fa-f]+)>\s*Tj/gu)].map((match) =>
          this.decodePdfHexText(match[1] ?? '', unicodeMap),
        ),
        ...[...stream.matchAll(/\(((?:\\.|[^\\()])*)\)\s*Tj/gu)].map((match) =>
          this.decodePdfLiteralText(match[1] ?? '', unicodeMap),
        ),
      ])
      .filter(Boolean)
      .join(' ');

    return this.normalizeExtractedPdfText(text);
  }

  private extractFlateDecodedPdfStreams(buffer: Buffer): string[] {
    const rawPdf = buffer.toString('latin1');
    const streams: string[] = [];
    const streamPattern =
      /<<(?:.|\r|\n)*?\/Filter\s*\/FlateDecode(?:.|\r|\n)*?>>\s*stream\r?\n/gu;
    let match: null | RegExpExecArray;

    while ((match = streamPattern.exec(rawPdf))) {
      const start = streamPattern.lastIndex;
      const end = rawPdf.indexOf('endstream', start);
      if (end <= start) {
        continue;
      }

      try {
        streams.push(inflateSync(buffer.subarray(start, end)).toString('latin1'));
      } catch {
        // Some compressed streams are images or fonts; they are not useful here.
      }
    }

    return streams;
  }

  private buildPdfToUnicodeMap(streams: string[]): Map<string, string> {
    const unicodeMap = new Map<string, string>();
    const cmapStreams = streams.filter((stream) => stream.includes('begincmap'));

    for (const stream of cmapStreams) {
      for (const match of stream.matchAll(
        /<([\dA-Fa-f]+)>\s*<([\dA-Fa-f]+)>\s*<([\dA-Fa-f]+)>/gu,
      )) {
        const startCode = Number.parseInt(match[1] ?? '', 16);
        const endCode = Number.parseInt(match[2] ?? '', 16);
        const startUnicode = Number.parseInt(match[3] ?? '', 16);
        if (
          !Number.isFinite(startCode) ||
          !Number.isFinite(endCode) ||
          !Number.isFinite(startUnicode) ||
          endCode < startCode ||
          endCode - startCode > 2000
        ) {
          continue;
        }

        for (let code = startCode; code <= endCode; code += 1) {
          unicodeMap.set(
            code.toString(16).padStart(4, '0'),
            String.fromCodePoint(startUnicode + code - startCode),
          );
        }
      }
    }

    return unicodeMap;
  }

  private decodePdfHexText(
    hexText: string,
    unicodeMap: Map<string, string>,
  ): string {
    const chars: string[] = [];
    for (let index = 0; index < hexText.length; index += 4) {
      const code = hexText.slice(index, index + 4).toLowerCase();
      chars.push(unicodeMap.get(code) ?? '');
    }

    return chars.join('');
  }

  private decodePdfLiteralText(
    value: string,
    unicodeMap: Map<string, string>,
  ): string {
    const bytes = this.decodePdfLiteralBytes(value);
    const chars: string[] = [];
    for (let index = 0; index + 1 < bytes.length; index += 2) {
      const code = ((bytes[index] ?? 0) << 8) | (bytes[index + 1] ?? 0);
      chars.push(unicodeMap.get(code.toString(16).padStart(4, '0')) ?? '');
    }
    return chars.join('');
  }

  private decodePdfLiteralBytes(value: string): number[] {
    const bytes: number[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const charCode = value.charCodeAt(index);
      if (charCode !== 92) {
        bytes.push(charCode & 0xff);
        continue;
      }

      index += 1;
      if (index >= value.length) {
        break;
      }
      const escaped = value[index] ?? '';
      if (/[0-7]/u.test(escaped)) {
        let octal = escaped;
        for (
          let count = 0;
          count < 2 && index + 1 < value.length && /[0-7]/u.test(value[index + 1] ?? '');
          count += 1
        ) {
          index += 1;
          octal += value[index] ?? '';
        }
        bytes.push(Number.parseInt(octal, 8) & 0xff);
        continue;
      }

      const escapedBytes: Record<string, number> = {
        b: 8,
        f: 12,
        n: 10,
        r: 13,
        t: 9,
        '(': 40,
        ')': 41,
        '\\': 92,
      };
      bytes.push(escapedBytes[escaped] ?? (escaped.charCodeAt(0) & 0xff));
    }
    return bytes;
  }

  private createPdfTextResult(
    text: string,
    scene: PdfTextScene,
    forcedStatus?: IpPdfTextStatus,
    errorMessage?: string,
  ): IpPdfTextExtractionResult {
    const textLimit = scene === 'social_security' ? 100_000 : 12_000;
    const snippetLimit = scene === 'social_security' ? 100_000 : 8_000;
    const normalized = this.normalizeExtractedPdfText(text).slice(0, textLimit);
    const fieldHitScore = scene === 'social_security'
      ? this.countSocialSecurityPdfFieldHits(normalized)
      : this.countIpPdfFieldHits(normalized);
    const status =
      forcedStatus ??
      (this.isReadablePdfText(normalized, scene, fieldHitScore)
        ? 'success'
        : normalized
          ? 'unreadable'
          : 'empty');

    return {
      errorMessage,
      fieldHitScore,
      snippet: status === 'success' ? normalized.slice(0, snippetLimit) : '',
      status,
    };
  }

  private extractIpRecognitionHintsFromPdfText(text: string): {
    applyDate?: string;
    authorizeDate?: string;
    certificateNo?: string;
    ipType?: number;
    name?: string;
    obtainMethod?: string;
    rightHolder?: string;
  } {
    const normalized = this.normalizeIpCertificateText(text);
    const name = this.extractTextBetweenLabels(normalized, [
      '软件名称',
      '作品名称',
      '知识产权名称',
      '发明名称',
      '实用新型名称',
      '外观设计名称',
    ], [
      '著作权人',
      '权利人',
      '专利权人',
      '发明人',
      '设计人',
      '权利取得方式',
      '权利范围',
      '登记号',
      '证书号',
      '专利号',
      '专利申请日',
      '申请日',
    ]);
    const rightHolder = this.extractTextBetweenLabels(normalized, [
      '著作权人',
      '权利人',
      '专利权人',
      '申请人',
    ], [
      '地址',
      '权利取得方式',
      '权利范围',
      '登记号',
      '证书号',
      '授权公告日',
      '授权公告号',
    ]);
    const patentCertificateNo = /实用新型|发明专利|外观设计|专利号|申请号/u.test(
      normalized,
    )
      ? this.extractIpCertificateNo(normalized)
      : '';
    const certificateNo =
      patentCertificateNo ||
      this.extractTextBetweenLabels(normalized, ['登记号'], [
        '根据',
        '证书号',
        '登记日期',
      ]) ||
      this.extractTextBetweenLabels(normalized, ['专利号'], [
        '专利申请日',
        '申请日',
        '专利权人',
        '地址',
        '授权公告日',
      ]) ||
      this.extractIpCertificateNo(normalized);
    const obtainMethod = this.extractTextBetweenLabels(normalized, [
      '权利取得方式',
      '取得方式',
    ], ['权利范围', '登记号', '证书号']);
    const authorizeDate =
      this.extractDateAfterLabel(normalized, [
        '登记日期',
        '发证日期',
        '授权公告日',
        '授权日',
      ]) ||
      this.extractRegistrationDateFromCertificateText(normalized);
    const applyDate = this.extractDateAfterLabel(normalized, [
      '开发完成日期',
      '首次发表日期',
      '申请日期',
      '专利申请日',
      '申请日',
    ]);

    return {
      applyDate,
      authorizeDate,
      certificateNo: certificateNo.replace(/[^A-Z0-9.\-]/giu, ''),
      ipType: this.inferIpTypeFromPdfText(normalized),
      name: name.replace(/\s+/gu, ' ').trim(),
      obtainMethod: obtainMethod.replace(/\s+/gu, '').trim(),
      rightHolder: rightHolder.replace(/\s+/gu, '').trim(),
    };
  }

  private inferIpTypeFromPdfText(text: string): number | undefined {
    if (/软件著作权|计算机软件|软著/u.test(text)) {
      return 3;
    }
    if (/外观设计/u.test(text)) {
      return 4;
    }
    if (/实用新型/u.test(text)) {
      return 2;
    }
    if (/发明专利|发明名称/u.test(text)) {
      return 1;
    }
    return undefined;
  }

  private normalizeIpCertificateText(text: string): string {
    let normalized = text.replace(/\s+/gu, ' ').trim();
    for (let index = 0; index < 3; index += 1) {
      normalized = normalized.replace(/([\u4E00-\u9FA5])\s+(?=[\u4E00-\u9FA5])/gu, '$1');
    }
    return normalized;
  }

  private extractTextBetweenLabels(
    text: string,
    labels: string[],
    nextLabels: string[],
  ): string {
    const labelPattern = labels.map((label) => this.escapeRegExp(label)).join('|');
    const nextLabelPattern = nextLabels
      .map((label) => this.escapeRegExp(label))
      .join('|');
    const match = text.match(
      new RegExp(
        `(?:${labelPattern})\\s*[:：]\\s*(.+?)(?=${nextLabelPattern}\\s*[:：]|$)`,
        'u',
      ),
    );
    return match?.[1]?.trim() ?? '';
  }

  private extractDateAfterLabel(text: string, labels: string[]): string {
    const labelPattern = labels.map((label) => this.escapeRegExp(label)).join('|');
    const match = text.match(
      new RegExp(
        `(?:${labelPattern})\\s*[:：]?\\s*(20\\d{2})[.年/-](\\d{1,2})[.月/-](\\d{1,2})`,
        'u',
      ),
    );
    return this.formatRecognizedDate(match?.[1], match?.[2], match?.[3]);
  }

  private extractRegistrationDateFromCertificateText(text: string): string {
    if (!/予以登记|登记证书|版权保护中心/u.test(text)) {
      return '';
    }
    const matches = [
      ...text.matchAll(/(20\d{2})[.年/-](\d{1,2})[.月/-](\d{1,2})/gu),
    ];
    const lastMatch = matches.at(-1);
    return this.formatRecognizedDate(lastMatch?.[1], lastMatch?.[2], lastMatch?.[3]);
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private normalizeExtractedPdfText(value: string): string {
    return value
      .replace(/\u0000/gu, '')
      .replace(/[ \t\r\f\v]+/gu, ' ')
      .replace(/\n{2,}/gu, '\n')
      .trim();
  }

  private countIpPdfFieldHits(value: string): number {
    const keywords = [
      /软件\s*名\s*称/u,
      /著作权\s*人|权利\s*人/u,
      /登记号/u,
      /开发完成日期/u,
      /首次发表日期/u,
      /登记日期/u,
      /中华人民共和国国家版权局/u,
      /计算机软件著作权登记证书/u,
      /软著|软件著作权/u,
      /\d{4}SR\d{4,8}/iu,
      /(?:发明专利|实用新型|外观设计)(?:专利)?证书/u,
      /(?:发明名称|实用新型名称|外观设计名称)/u,
      /专利号|申请号/u,
      /专利申请日|申请日期/u,
      /授权公告日|授权公告号|授权日/u,
      /专利权人/u,
      /ZL\s?\d{4}\s?\d{1,2}\s?\d{5,8}(?:\.\d)?/iu,
    ];
    return keywords.reduce((count, keyword) => count + (keyword.test(value) ? 1 : 0), 0);
  }

  private countSocialSecurityPdfFieldHits(value: string): number {
    const keywords = [
      /社会保险权益记录单/u,
      /参保单位/u,
      /公民身份号码|社会保障号/u,
      /缴费起止年月/u,
      /缴费月数/u,
      /统一社会信用代码/u,
    ];
    return keywords.reduce((count, keyword) => count + (keyword.test(value) ? 1 : 0), 0);
  }

  private isReadablePdfText(
    value: string,
    scene: PdfTextScene,
    fieldHitScore: number,
  ): boolean {
    if (value.length < 80) {
      return false;
    }
    const pdfInternalHits = (
      value.match(/\/Filter|FlateDecode|endstream|endobj|xref|trailer/giu) ?? []
    ).length;
    const chineseChars = (value.match(/[\u4E00-\u9FA5]/gu) ?? []).length;
    const chineseRatio = chineseChars / Math.max(value.length, 1);

    if (pdfInternalHits >= 3 || chineseRatio <= 0.08) {
      return false;
    }

    if (scene === 'finance') {
      return true;
    }
    return scene === 'social_security' ? fieldHitScore >= 3 : fieldHitScore >= 2;
  }

  private inferProductServiceField(rows: EnterprisePropertyRecordEntity[]) {
    return this.resolveProductServiceFieldByText(
      rows
        .map(
          (row) =>
            `${row.kyProjectName ?? ''} ${row.coreTechnology ?? ''} ${row.innovationPoints ?? ''} ${row.stageResult ?? ''}`,
        )
        .join(' '),
    );
  }

  private resolveProductServiceTechField(
    rows: EnterprisePropertyRecordEntity[],
  ): string {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const field = this.normalizeProductServiceField(row.projectType, [row]);
      counts.set(field, (counts.get(field) ?? 0) + 1);
    });
    const ranked = [...counts.entries()].sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      if (left[0] === '企业核心技术') {
        return 1;
      }
      if (right[0] === '企业核心技术') {
        return -1;
      }
      return left[0].localeCompare(right[0], 'zh-Hans-CN');
    });
    return ranked[0]?.[0] ?? this.inferProductServiceField(rows);
  }

  private normalizeProductServiceField(
    value: null | string | undefined,
    rows: EnterprisePropertyRecordEntity[],
  ): string {
    return this.resolveProductServiceFieldByText(
      `${value ?? ''} ${rows
        .map(
          (row) =>
            `${row.kyProjectName ?? ''} ${row.coreTechnology ?? ''} ${row.innovationPoints ?? ''} ${row.stageResult ?? ''}`,
        )
        .join(' ')}`,
    );
  }

  private resolveProductServiceFieldByText(text: string): string {
    const normalized = text.replace(/\s+/gu, '');
    if (/电子|信息|软件|系统|平台|数据|算法|智能|模型|网络|云|物联网/u.test(normalized)) {
      return '电子信息';
    }
    if (/制造|装备|设备|装置|机器人|机床|自动化|工艺|产线|控制/u.test(normalized)) {
      return '智能制造';
    }
    if (/材料|涂层|合金|复合|高分子|纤维|薄膜/u.test(normalized)) {
      return '新材料';
    }
    if (/节能|环保|治理|回收|排放|监测|净化|水处理|固废/u.test(normalized)) {
      return '资源与环境';
    }
    if (/生物|医药|药物|医疗|诊断|菌种|蛋白/u.test(normalized)) {
      return '生物医药';
    }
    return '企业核心技术';
  }

  private extractProductServiceTokens(
    rows: EnterprisePropertyRecordEntity[],
  ): string[] {
    return [
      ...new Set(
        rows.flatMap((row) =>
          [
            row.kyProjectName,
            row.coreTechnology,
            row.innovationPoints,
            row.stageResult,
          ].flatMap((text) => this.collectProductServicePhrases(text)),
        ),
      ),
    ];
  }

  private collectProductServicePhrases(value: null | string | undefined): string[] {
    const text = this.toNullableStringFromUnknown(value);
    if (!text) {
      return [];
    }
    return text
      .replace(
        /研发项目|研发课题|研发|项目|系统平台|服务平台|应用平台|产品服务|高新产品|产品|服务|技术/gu,
        ' ',
      )
      .split(/[，,。；;、/\s()\[\]（）\-]+/u)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && item.length <= 12);
  }

  private extractProductServiceKeyword(
    rdNames: string[],
    ipNames: string[],
    transformationNames: string[] = [],
    transformationScenes: string[] = [],
  ) {
    const phrases = [
      ...transformationNames,
      ...rdNames,
      ...ipNames,
      ...transformationScenes,
    ].flatMap((item) => this.collectProductServicePhrases(item));
    const base = phrases.find(
      (item) =>
        !/电子信息|智能制造|新材料|资源与环境|生物医药|企业核心/u.test(item),
    );
    return base?.slice(0, 12) || '技术应用';
  }

  private buildProductServiceNameCandidates(
    techField: string,
    keyword: string,
    transformationScenes: string[],
    rdRows: EnterprisePropertyRecordEntity[],
  ): string[] {
    const normalizedKeyword =
      keyword.replace(/产品|服务|系统|平台|软件|方案|材料|装备$/u, '').trim() ||
      techField;
    const contextText = [
      ...transformationScenes,
      ...rdRows.map(
        (row) =>
          `${row.kyProjectName ?? ''} ${row.coreTechnology ?? ''} ${row.innovationPoints ?? ''}`,
      ),
    ].join(' ');
    const suffix = this.resolveProductServiceNameSuffix(contextText);
    const audience = this.resolveProductServiceAudience(
      transformationScenes,
      rdRows,
    );
    return [
      `${normalizedKeyword}${suffix}`,
      audience
        ? `面向${audience}的${normalizedKeyword}${suffix}`
        : `${techField}${normalizedKeyword}${suffix}`,
      `${techField}${normalizedKeyword}${suffix}`,
    ].filter((item, index, list) => Boolean(item) && list.indexOf(item) === index);
  }

  private resolveProductServiceNameSuffix(text: string): string {
    if (/材料|涂层|合金|复合|薄膜/u.test(text)) {
      return '功能材料';
    }
    if (/设备|装置|制造|产线|机器人|控制/u.test(text)) {
      return '智能装备';
    }
    if (/检测|监测|采集|预警/u.test(text)) {
      return '监测系统';
    }
    if (/分析|算法|数据|模型|识别/u.test(text)) {
      return '分析软件';
    }
    if (/服务|运维|管理|咨询|支撑/u.test(text)) {
      return '技术服务';
    }
    return '应用解决方案';
  }

  private resolveProductServiceAudience(
    transformationScenes: string[],
    rdRows: EnterprisePropertyRecordEntity[],
  ): null | string {
    const text = [
      ...transformationScenes,
      ...rdRows.map(
        (row) =>
          `${row.kyProjectName ?? ''} ${row.stageResult ?? ''} ${row.innovationPoints ?? ''}`,
      ),
    ].join(' ');
    if (/生产|车间|制造/u.test(text)) {
      return '生产制造场景';
    }
    if (/环保|排放|水处理|治理/u.test(text)) {
      return '环保治理场景';
    }
    if (/医疗|诊断|医药/u.test(text)) {
      return '医疗应用场景';
    }
    if (/检测|监测/u.test(text)) {
      return '监测应用场景';
    }
    if (/企业|园区|经营|客户/u.test(text)) {
      return '企业运营场景';
    }
    return null;
  }

  private buildProductServiceTechIndex(
    keyword: string,
    transformationRows: EnterprisePropertyRecordEntity[],
  ): string {
    const scenes = transformationRows
      .map((row) => this.toNullableStringFromUnknown(row.applicationScene))
      .filter(Boolean) as string[];
    const sceneText =
      scenes.length > 0
        ? `，并结合 ${scenes.slice(0, 2).join('、')} 等场景补充测试或应用验证结果`
        : '';
    return `建议围绕${keyword}补充性能、稳定性、处理效率、准确率、响应时间、适配范围等可验证指标${sceneText}；当前草稿不编造具体数值。`;
  }

  private async rejectClientPropertyGenerationDrafts(
    userId: number,
    input: ApproveClientAiDraftsDto,
    draftType: string,
    label: string,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)))];
    if (ids.length === 0) {
      throw new BadRequestException(`请选择要标记不入库的${label}`);
    }

    const rows = await this.aiDraftRepo.find({
      where: {
        draftType,
        enterpriseId,
        id: In(ids),
      },
    });
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    const success: Array<{ draftId: string }> = [];
    const failed: Array<{ draftId: string; reason: string }> = [];

    for (const id of ids) {
      const draft = rowsById.get(id);
      if (!draft) {
        failed.push({ draftId: id, reason: `${label}不存在` });
        continue;
      }
      if (draft.status === 'approved') {
        failed.push({ draftId: id, reason: '已入库草稿不能标记不入库' });
        continue;
      }

      draft.status = 'rejected';
      draft.reviewedAt = new Date();
      draft.reviewedBy = String(userId);
      await this.aiDraftRepo.save(draft);
      success.push({ draftId: id });
    }

    return {
      failed,
      success,
      total: ids.length,
    };
  }

  private async deleteClientPropertyGenerationDraft(
    userId: number,
    id: string,
    draftType: string,
    label: string,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const draft = await this.requireClientAiDraft(enterpriseId, id, draftType);
    if (draft.status === 'approved') {
      throw new BadRequestException(`已入库的${label}不能删除`);
    }

    await this.aiDraftRepo.delete({ id: draft.id, enterpriseId });
    return {
      id: String(draft.id),
      success: true,
    };
  }

  private async deleteEnterprisePropertyGenerationDrafts(
    enterpriseId: string,
    input: ApproveClientAiDraftsDto,
    draftType: string,
    label: string,
  ) {
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)))];
    if (ids.length === 0) {
      throw new BadRequestException(`请选择要删除的${label}`);
    }

    const rows = await this.aiDraftRepo.find({
      where: {
        draftType,
        enterpriseId,
        id: In(ids),
      },
    });
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    const success: Array<{ draftId: string }> = [];
    const failed: Array<{ draftId: string; reason: string }> = [];

    for (const id of ids) {
      const draft = rowsById.get(id);
      if (!draft) {
        failed.push({ draftId: id, reason: `${label}不存在或已被删除` });
        continue;
      }
      if (draft.status === 'approved') {
        failed.push({ draftId: id, reason: `已入库的${label}不能删除` });
        continue;
      }
      await this.aiDraftRepo.delete({ id: draft.id, enterpriseId });
      success.push({ draftId: id });
    }

    return {
      failed,
      success,
      total: ids.length,
    };
  }

  async uploadEnterpriseContractRecognitionPdfs(
    enterpriseId: string,
    operatorId: string,
    files: StoredUploadFile[],
  ) {
    const validFiles = files.filter((file) => file.originalname);
    if (validFiles.length === 0) {
      throw new BadRequestException('请上传至少一个合同 PDF 文件');
    }
    await this.assertUploadedFilesBelongToEnterprise(enterpriseId, validFiles, 'contract');

    const task = await this.aiTaskRepo.save(
      this.aiTaskRepo.create({
        bizId: enterpriseId,
        bizType: 'enterprise',
        createdBy: operatorId,
        inputSnapshot: JSON.stringify({
          files: validFiles.map((file) => ({ name: file.originalname, size: file.size })),
        }),
        scene: 'contract_recognition',
        status: 'pending',
      }),
    );
    const sources: Array<{
      draftId: string;
      filePath: string;
      materialId: string;
      sourceName: string;
    }> = [];
    for (const file of validFiles) {
      const filePath = normalizeStoredUploadPath(file.path);
      if (!filePath) {
        throw new BadRequestException(`上传文件路径无效：${file.originalname}`);
      }
      const material = await this.enterpriseMaterialRepo.save(
        this.enterpriseMaterialRepo.create({
          enterpriseId,
          errorCount: 0,
          fileName: file.originalname,
          filePath,
          materialType: 'contract_pdf',
          remark: JSON.stringify({ source: 'contract_recognition', taskId: String(task.id) }),
          status: 'uploaded',
          templateId: 'contract-recognition-pdf',
          templateName: '合同 PDF 识别',
        }),
      );
      const draft = await this.aiDraftRepo.save(
        this.aiDraftRepo.create({
          draftPayload: JSON.stringify({
            ht_path: filePath,
            recognition_note: '后台识别中',
            review_warnings: [],
            source_file_name: file.originalname,
            source_file_path: filePath,
          }),
          draftType: 'contract_recognition',
          enterpriseId,
          sourceIds: JSON.stringify([String(material.id)]),
          status: 'processing',
          taskId: String(task.id),
        }),
      );
      sources.push({
        draftId: String(draft.id),
        filePath,
        materialId: String(material.id),
        sourceName: file.originalname,
      });
    }

    task.inputSnapshot = JSON.stringify({
      files: sources.map((source) => ({
        materialId: source.materialId,
        name: source.sourceName,
        path: source.filePath,
      })),
    });
    await this.aiTaskRepo.save(task);
    setImmediate(() => {
      void this.runEnterpriseContractRecognitionTask(String(task.id), enterpriseId, sources);
    });

    return { drafts: [], taskId: String(task.id), total: sources.length };
  }

  async listEnterpriseContractRecognitionDrafts(enterpriseId: string) {
    const rows = await this.aiDraftRepo.find({
      order: { id: 'DESC' },
      where: {
        draftType: 'contract_recognition',
        enterpriseId,
        status: Not('approved'),
      },
    });
    return { items: rows.map((row) => this.toClientAiDraftItem(row)), total: rows.length };
  }

  async approveEnterpriseContractRecognitionDrafts(
    enterpriseId: string,
    reviewedBy: string,
    input: ApproveClientAiDraftsDto,
  ) {
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)))];
    if (ids.length === 0) {
      throw new BadRequestException('请选择要入库的合同草稿');
    }
    const rows = await this.aiDraftRepo.find({
      where: { draftType: 'contract_recognition', enterpriseId, id: In(ids) },
    });
    const success: Array<{ draftId: string; recordId: string }> = [];
    const failed: Array<{ draftId: string; reason: string }> = [];
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    ids.filter((id) => !rowsById.has(id)).forEach((id) => {
      failed.push({ draftId: id, reason: '合同识别草稿不存在或已被删除' });
    });

    for (const draft of rows) {
      if (draft.status === 'approved') {
        failed.push({ draftId: String(draft.id), reason: '草稿已入库' });
        continue;
      }
      if (draft.status === 'rejected') {
        failed.push({ draftId: String(draft.id), reason: '草稿已标记无效，请重新识别后再入库' });
        continue;
      }
      if (draft.status !== 'reviewing') {
        failed.push({ draftId: String(draft.id), reason: '草稿尚未识别成功，不能入库' });
        continue;
      }

      const payload = this.normalizeContractRecognitionDraftPayload(
        this.parseJsonObject(draft.draftPayload),
      );
      const validationMessage = await this.validateContractRecognitionDraftForApproval(
        enterpriseId,
        draft,
        payload,
      );
      if (validationMessage) {
        failed.push({ draftId: String(draft.id), reason: validationMessage });
        continue;
      }
      const saved = await this.enterpriseContractRecordRepo.save(
        this.enterpriseContractRecordRepo.create({
          endDate: this.toNullableStringFromUnknown(payload.end_date),
          enterpriseId,
          htDes: this.toNullableStringFromUnknown(payload.ht_des),
          htMoney: this.toNullableStringFromUnknown(payload.ht_money),
          htName: this.toNullableStringFromUnknown(payload.ht_name),
          htNum: this.toNullableStringFromUnknown(payload.ht_num),
          htPath: this.toNullableStringFromUnknown(payload.ht_path),
          htStatus: this.toNullableNumber(payload.ht_status) ?? 1,
          khName: this.toNullableStringFromUnknown(payload.kh_name),
          qdDate: this.toNullableStringFromUnknown(payload.qd_date),
          recordType: 'contract',
          startDate: this.toNullableStringFromUnknown(payload.start_date),
          status: 1,
        }),
      );
      draft.approvedRecordId = String(saved.id);
      draft.reviewedAt = new Date();
      draft.reviewedBy = reviewedBy;
      draft.status = 'approved';
      await this.aiDraftRepo.save(draft);
      success.push({ draftId: String(draft.id), recordId: String(saved.id) });
    }
    if (success.length > 0) {
      await this.renumberClientTransformationCodes(enterpriseId);
      await this.recalculateEnterpriseProfileStats(enterpriseId);
    }
    return { failed, success, total: ids.length };
  }

  async updateEnterpriseContractRecognitionDraft(
    enterpriseId: string,
    id: string,
    input: UpdateClientAiDraftDto,
  ): Promise<ClientAiDraftItem> {
    const draft = await this.requireClientAiDraft(enterpriseId, id, 'contract_recognition');
    if (draft.status === 'approved') {
      throw new BadRequestException('已入库的草稿不能修改');
    }
    if (draft.status === 'processing') {
      throw new BadRequestException('草稿正在识别中，暂不能修改');
    }
    const payload = this.normalizeContractRecognitionDraftPayload({
      ...this.parseJsonObject(draft.draftPayload),
      ...input.data,
    });
    payload.review_warnings = this.buildContractRecognitionReviewWarnings(payload);
    draft.draftPayload = JSON.stringify(payload);
    draft.status = 'reviewing';
    return this.toClientAiDraftItem(await this.aiDraftRepo.save(draft));
  }

  async rejectEnterpriseContractRecognitionDrafts(
    enterpriseId: string,
    reviewedBy: string,
    input: ApproveClientAiDraftsDto,
  ) {
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)))];
    if (ids.length === 0) {
      throw new BadRequestException('请选择要标记无效的合同草稿');
    }
    const rows = await this.aiDraftRepo.find({
      where: { draftType: 'contract_recognition', enterpriseId, id: In(ids) },
    });
    const success: Array<{ draftId: string }> = [];
    const failed: Array<{ draftId: string; reason: string }> = [];
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    ids.filter((id) => !rowsById.has(id)).forEach((id) => {
      failed.push({ draftId: id, reason: '合同识别草稿不存在或已被删除' });
    });
    for (const draft of rows) {
      if (draft.status === 'approved') {
        failed.push({ draftId: String(draft.id), reason: '已入库草稿不能标记无效' });
        continue;
      }
      draft.status = 'rejected';
      draft.reviewedAt = new Date();
      draft.reviewedBy = reviewedBy;
      await this.aiDraftRepo.save(draft);
      success.push({ draftId: String(draft.id) });
    }
    return { failed, success, total: ids.length };
  }

  async retryEnterpriseContractRecognitionDrafts(
    enterpriseId: string,
    operatorId: string,
    input: ApproveClientAiDraftsDto,
  ) {
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)))];
    if (ids.length === 0) {
      throw new BadRequestException('请选择要重新识别的合同草稿');
    }
    const rows = await this.aiDraftRepo.find({
      where: { draftType: 'contract_recognition', enterpriseId, id: In(ids) },
    });
    const task = await this.aiTaskRepo.save(this.aiTaskRepo.create({
      bizId: enterpriseId,
      bizType: 'enterprise',
      createdBy: operatorId,
      inputSnapshot: JSON.stringify({ retryDraftIds: ids }),
      scene: 'contract_recognition',
      status: 'processing',
    }));
    const success: ClientAiDraftItem[] = [];
    const failed: Array<{ draftId: string; reason: string }> = [];
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    ids.filter((id) => !rowsById.has(id)).forEach((id) => {
      failed.push({ draftId: id, reason: '合同识别草稿不存在或已被删除' });
    });
    for (const draft of rows) {
      if (draft.status === 'approved') {
        failed.push({ draftId: String(draft.id), reason: '已入库草稿不能重新识别' });
        continue;
      }
      const currentPayload = this.parseJsonObject(draft.draftPayload);
      const sourceName = this.toNullableStringFromUnknown(currentPayload.source_file_name) ?? `合同草稿-${draft.id}.pdf`;
      const sourceFilePath = this.toNullableStringFromUnknown(currentPayload.source_file_path) ?? '';
      const payload = await this.buildContractRecognitionDraftPayloadWithAi(task, sourceName, sourceFilePath);
      draft.draftPayload = JSON.stringify(payload);
      draft.status = 'reviewing';
      draft.taskId = String(task.id);
      success.push(this.toClientAiDraftItem(await this.aiDraftRepo.save(draft)));
    }
    await this.saveClientPropertyAiResult(task, {
      confidence: this.resolveDraftsConfidenceLabel(success.map((draft) => draft.draftPayload)),
      structuredResult: { records: success.map((draft) => draft.draftPayload), retryDraftIds: ids },
      summary: `已重新识别 ${success.length} 条合同草稿，失败 ${failed.length} 条`,
    });
    return { failed, success, taskId: String(task.id), total: ids.length };
  }

  async deleteEnterpriseContractRecognitionDraft(enterpriseId: string, id: string) {
    const draft = await this.requireClientAiDraft(enterpriseId, id, 'contract_recognition');
    await this.aiDraftRepo.delete({ id: draft.id, enterpriseId });
    return { draftId: String(draft.id), success: true };
  }

  async uploadEnterpriseInvoiceRecognitionPdfs(
    enterpriseId: string,
    operatorId: string,
    files: StoredUploadFile[],
  ) {
    const validFiles = files.filter((file) => file.originalname);
    if (validFiles.length === 0) {
      throw new BadRequestException('请上传至少一个发票 PDF 文件');
    }
    await this.assertUploadedFilesBelongToEnterprise(enterpriseId, validFiles, 'invoice');

    const task = await this.aiTaskRepo.save(
      this.aiTaskRepo.create({
        bizId: enterpriseId,
        bizType: 'enterprise',
        createdBy: operatorId,
        inputSnapshot: JSON.stringify({
          files: validFiles.map((file) => ({ name: file.originalname, size: file.size })),
        }),
        scene: 'invoice_recognition',
        status: 'pending',
      }),
    );
    const sources: Array<{
      draftId: string;
      filePath: string;
      materialId: string;
      sourceName: string;
    }> = [];
    for (const file of validFiles) {
      const filePath = normalizeStoredUploadPath(file.path);
      if (!filePath) {
        throw new BadRequestException(`上传文件路径无效：${file.originalname}`);
      }
      const material = await this.enterpriseMaterialRepo.save(
        this.enterpriseMaterialRepo.create({
          enterpriseId,
          errorCount: 0,
          fileName: file.originalname,
          filePath,
          materialType: 'invoice_pdf',
          remark: JSON.stringify({ source: 'invoice_recognition', taskId: String(task.id) }),
          status: 'uploaded',
          templateId: 'invoice-recognition-pdf',
          templateName: '发票 PDF 识别',
        }),
      );
      const draft = await this.aiDraftRepo.save(
        this.aiDraftRepo.create({
          draftPayload: JSON.stringify({
            fp_path: filePath,
            recognition_note: '后台识别中',
            review_warnings: [],
            source_file_name: file.originalname,
            source_file_path: filePath,
          }),
          draftType: 'invoice_recognition',
          enterpriseId,
          sourceIds: JSON.stringify([String(material.id)]),
          status: 'processing',
          taskId: String(task.id),
        }),
      );
      sources.push({
        draftId: String(draft.id),
        filePath,
        materialId: String(material.id),
        sourceName: file.originalname,
      });
    }

    task.inputSnapshot = JSON.stringify({
      files: sources.map((source) => ({
        materialId: source.materialId,
        name: source.sourceName,
        path: source.filePath,
      })),
    });
    await this.aiTaskRepo.save(task);
    setImmediate(() => {
      void this.runEnterpriseInvoiceRecognitionTask(String(task.id), enterpriseId, sources);
    });
    return { drafts: [], taskId: String(task.id), total: sources.length };
  }

  async listEnterpriseInvoiceRecognitionDrafts(enterpriseId: string) {
    const rows = await this.aiDraftRepo.find({
      order: { id: 'DESC' },
      where: {
        draftType: 'invoice_recognition',
        enterpriseId,
        status: Not('approved'),
      },
    });
    return { items: rows.map((row) => this.toClientAiDraftItem(row)), total: rows.length };
  }

  async approveEnterpriseInvoiceRecognitionDrafts(
    enterpriseId: string,
    reviewedBy: string,
    input: ApproveClientAiDraftsDto,
  ) {
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)))];
    if (ids.length === 0) {
      throw new BadRequestException('请选择要入库的发票草稿');
    }
    const rows = await this.aiDraftRepo.find({
      where: { draftType: 'invoice_recognition', enterpriseId, id: In(ids) },
    });
    const success: Array<{ draftId: string; recordId: string }> = [];
    const failed: Array<{ draftId: string; reason: string }> = [];
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    ids.filter((id) => !rowsById.has(id)).forEach((id) => {
      failed.push({ draftId: id, reason: '发票识别草稿不存在或已被删除' });
    });

    for (const draft of rows) {
      if (draft.status !== 'reviewing') {
        failed.push({
          draftId: String(draft.id),
          reason: draft.status === 'approved' ? '草稿已入库' : '草稿尚未识别成功，不能入库',
        });
        continue;
      }
      const payload = this.normalizeInvoiceRecognitionDraftPayload(
        this.parseJsonObject(draft.draftPayload),
      );
      const validationMessage = await this.validateInvoiceRecognitionDraftForApproval(
        enterpriseId,
        draft,
        payload,
      );
      if (validationMessage) {
        failed.push({ draftId: String(draft.id), reason: validationMessage });
        continue;
      }
      const saved = await this.enterpriseContractRecordRepo.save(
        this.enterpriseContractRecordRepo.create({
          enterpriseId,
          fpDate: this.toNullableStringFromUnknown(payload.fp_date),
          fpMoney: this.toNullableStringFromUnknown(payload.fp_money),
          fpNum: this.toNullableStringFromUnknown(payload.fp_num),
          fpPath: this.toNullableStringFromUnknown(payload.fp_path),
          fpStatus: this.toNullableNumber(payload.fp_status) ?? 1,
          htId: this.toNullableStringFromUnknown(payload.ht_id),
          recordType: 'invoice',
          remark: this.toNullableStringFromUnknown(payload.remark),
          status: 1,
          zfDate: this.toNullableStringFromUnknown(payload.zf_date),
        }),
      );
      draft.approvedRecordId = String(saved.id);
      draft.reviewedAt = new Date();
      draft.reviewedBy = reviewedBy;
      draft.status = 'approved';
      await this.aiDraftRepo.save(draft);
      success.push({ draftId: String(draft.id), recordId: String(saved.id) });
    }
    if (success.length > 0) {
      await this.recalculateEnterpriseProfileStats(enterpriseId);
    }
    return { failed, success, total: ids.length };
  }

  async updateEnterpriseInvoiceRecognitionDraft(
    enterpriseId: string,
    id: string,
    input: UpdateClientAiDraftDto,
  ): Promise<ClientAiDraftItem> {
    const draft = await this.requireClientAiDraft(enterpriseId, id, 'invoice_recognition');
    if (draft.status === 'approved') {
      throw new BadRequestException('已入库的草稿不能修改');
    }
    if (draft.status === 'processing') {
      throw new BadRequestException('草稿正在识别中，暂不能修改');
    }
    const payload = this.normalizeInvoiceRecognitionDraftPayload({
      ...this.parseJsonObject(draft.draftPayload),
      ...input.data,
    });
    if (payload.ht_id) {
      await this.requireEnterpriseContractRecordForInvoice(
        enterpriseId,
        String(payload.ht_id),
      );
    }
    payload.review_warnings = this.buildInvoiceRecognitionReviewWarnings(payload);
    draft.draftPayload = JSON.stringify(payload);
    draft.status = 'reviewing';
    return this.toClientAiDraftItem(await this.aiDraftRepo.save(draft));
  }

  async rejectEnterpriseInvoiceRecognitionDrafts(
    enterpriseId: string,
    reviewedBy: string,
    input: ApproveClientAiDraftsDto,
  ) {
    return this.rejectEnterpriseRecognitionDrafts(
      enterpriseId,
      reviewedBy,
      input,
      'invoice_recognition',
      '发票',
    );
  }

  async retryEnterpriseInvoiceRecognitionDrafts(
    enterpriseId: string,
    operatorId: string,
    input: ApproveClientAiDraftsDto,
  ) {
    const ids = [...new Set((input.ids ?? []).map((id) => String(id)))];
    if (ids.length === 0) {
      throw new BadRequestException('请选择要重新识别的发票草稿');
    }
    const rows = await this.aiDraftRepo.find({
      where: { draftType: 'invoice_recognition', enterpriseId, id: In(ids) },
    });
    const task = await this.aiTaskRepo.save(this.aiTaskRepo.create({
      bizId: enterpriseId,
      bizType: 'enterprise',
      createdBy: operatorId,
      inputSnapshot: JSON.stringify({ retryDraftIds: ids }),
      scene: 'invoice_recognition',
      status: 'processing',
    }));
    const success: ClientAiDraftItem[] = [];
    const failed: Array<{ draftId: string; reason: string }> = [];
    const rowsById = new Map(rows.map((row) => [String(row.id), row]));
    ids.filter((id) => !rowsById.has(id)).forEach((id) => {
      failed.push({ draftId: id, reason: '发票识别草稿不存在或已被删除' });
    });
    for (const draft of rows) {
      if (draft.status === 'approved') {
        failed.push({ draftId: String(draft.id), reason: '已入库草稿不能重新识别' });
        continue;
      }
      const currentPayload = this.parseJsonObject(draft.draftPayload);
      const sourceName = this.toNullableStringFromUnknown(currentPayload.source_file_name) ?? `发票草稿-${draft.id}.pdf`;
      const sourceFilePath = this.toNullableStringFromUnknown(currentPayload.source_file_path) ?? '';
      const payload = await this.buildInvoiceRecognitionDraftPayloadWithAi(
        task,
        enterpriseId,
        sourceName,
        sourceFilePath,
      );
      draft.draftPayload = JSON.stringify(payload);
      draft.status = 'reviewing';
      draft.taskId = String(task.id);
      success.push(this.toClientAiDraftItem(await this.aiDraftRepo.save(draft)));
    }
    await this.saveClientPropertyAiResult(task, {
      confidence: this.resolveDraftsConfidenceLabel(success.map((draft) => draft.draftPayload)),
      structuredResult: { records: success.map((draft) => draft.draftPayload), retryDraftIds: ids },
      summary: `已重新识别 ${success.length} 条发票草稿，失败 ${failed.length} 条`,
    });
    return { failed, success, taskId: String(task.id), total: ids.length };
  }

  async deleteEnterpriseInvoiceRecognitionDraft(enterpriseId: string, id: string) {
    const draft = await this.requireClientAiDraft(enterpriseId, id, 'invoice_recognition');
    await this.aiDraftRepo.delete({ id: draft.id, enterpriseId });
    return { draftId: String(draft.id), success: true };
  }

  private async requireClientAiDraft(
    enterpriseId: string,
    id: string,
    draftType: string,
  ): Promise<AiDraftEntity> {
    const draft = await this.aiDraftRepo.findOne({
      where: {
        draftType,
        enterpriseId,
        id,
      },
    });
    if (!draft) {
      throw new NotFoundException('AI 草稿不存在');
    }

    return draft;
  }

  private parseAiDraftSourceIds(value: null | string): string[] {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.map((item) => String(item)).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }

  private parseDelimitedIds(value: unknown): string[] {
    return String(value ?? '')
      .split(/[,，\s]+/u)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private toClientAiDraftItem(draft: AiDraftEntity): ClientAiDraftItem {
    return {
      approvedRecordId: draft.approvedRecordId
        ? String(draft.approvedRecordId)
        : null,
      createTime: formatDateTimeInBjt(draft.createdAt),
      draftPayload: this.parseJsonObject(draft.draftPayload),
      draftType: draft.draftType,
      id: String(draft.id),
      reviewedAt: draft.reviewedAt ? formatDateTimeInBjt(draft.reviewedAt) : null,
      reviewedBy: draft.reviewedBy ? String(draft.reviewedBy) : null,
      sourceIds: this.parseAiDraftSourceIds(draft.sourceIds),
      status: draft.status,
      taskId: draft.taskId ? String(draft.taskId) : null,
      updateTime: formatDateTimeInBjt(draft.updatedAt),
    };
  }

  private toClientIpRecognitionDraftItem(
    draft: AiDraftEntity,
    request?: Request,
  ): ClientAiDraftItem {
    const item = this.toClientAiDraftItem(draft);
    const payload = item.draftPayload;
    const materialId = item.sourceIds[0];
    const protectedUrl = materialId
      ? this.buildClientProtectedAccessUrl(
          `/client/enterprise/materials/${materialId}/preview`,
          request,
        )
      : null;

    return {
      ...item,
      draftPayload: {
        ...payload,
        ...(protectedUrl ? { soft_work_file: protectedUrl } : {}),
      },
    };
  }

  private toClientFinanceAiDraftItem(
    draft: AiDraftEntity,
    request?: Request,
  ): ClientAiDraftItem {
    const item = this.toClientAiDraftItem(draft);
    const payload = item.draftPayload as FinanceAiParseDraftPayload;
    const materialId = item.sourceIds[0] ?? payload.sourceMaterialId;
    const sourcePreviewUrl = materialId
      ? this.buildClientProtectedAccessUrl(
          `/client/enterprise/materials/${materialId}/preview`,
          request,
        )
      : payload.sourcePreviewUrl ?? null;

    return {
      ...item,
      draftPayload: {
        ...payload,
        sourceMaterialId: materialId ?? null,
        sourcePreviewUrl,
      },
    };
  }

  private async buildFinanceAiParseDraftPayload(
    enterpriseId: string,
    material: EnterpriseMaterialEntity,
    file: StoredUploadFile,
    taskId: string,
    request?: Request,
  ): Promise<FinanceAiParseDraftPayload | null> {
    const sourcePreviewUrl = this.buildClientProtectedAccessUrl(
      `/client/enterprise/materials/${material.id}/preview`,
      request,
    );
    const csvPayload = await this.tryBuildFinanceAiDraftFromCsv(
      enterpriseId,
      material,
      file,
      sourcePreviewUrl,
    );
    if (csvPayload) {
      return csvPayload;
    }

    const excelPayload = await this.tryBuildFinanceAiDraftFromExcel(
      enterpriseId,
      material,
      file,
      sourcePreviewUrl,
    );
    if (excelPayload) {
      return excelPayload;
    }

    const pdfPayload = await this.tryBuildFinanceAiDraftFromPdf(
      enterpriseId,
      material,
      file,
      sourcePreviewUrl,
    );
    const textAiPayload = await this.tryBuildFinanceAiDraftFromTextAi(
      enterpriseId,
      material,
      file,
      sourcePreviewUrl,
      taskId,
      pdfPayload,
    );
    if (textAiPayload && this.hasCompleteFinanceStatement(textAiPayload.financial)) {
      return textAiPayload;
    }

    const visionWarnings: string[] = [];
    const visionPayload = await this.tryBuildFinanceAiDraftFromVision(
      enterpriseId,
      material,
      file,
      sourcePreviewUrl,
      taskId,
      textAiPayload ?? pdfPayload,
      visionWarnings,
    );
    if (visionPayload) {
      if (this.countFinanceAiFinancialFields(visionPayload.financial) > 0 || visionPayload.taxAudit) {
        return visionPayload;
      }
    }

    if (textAiPayload && (this.countFinanceAiFinancialFields(textAiPayload.financial) > 0 || textAiPayload.taxAudit)) {
      return textAiPayload;
    }

    if (pdfPayload && (this.countFinanceAiFinancialFields(pdfPayload.financial) > 0 || pdfPayload.taxAudit)) {
      return pdfPayload;
    }

    return null;
  }

  private async tryBuildFinanceAiDraftFromTextAi(
    enterpriseId: string,
    material: EnterpriseMaterialEntity,
    file: StoredUploadFile,
    sourcePreviewUrl: string,
    taskId: string,
    fallbackPayload?: FinanceAiParseDraftPayload | null,
  ): Promise<FinanceAiParseDraftPayload | null> {
    if (!material.filePath || extname(material.filePath).toLowerCase() !== '.pdf' || !process.env.AI_API_KEY) {
      return fallbackPayload ?? null;
    }
    const pdfText = await this.extractPdfTextFromStoredPath(material.filePath, 'finance');
    if (pdfText.status !== 'success') {
      return fallbackPayload ?? null;
    }

    try {
      const aiResult = await this.aiService.runStructuredJsonCompletion({
        input: { fileName: file.originalname, pdfText: pdfText.snippet },
        outputSchema: this.getFinanceVisionOutputSchema(),
        scene: 'finance_ai_parse_text',
        systemPrompt: [
          '你是财务报表和审计报告识别助手。',
          '只根据提供的 PDF 可读文本识别字段，不得猜测或补全缺失数据。',
          '资产负债表、利润表属于 financial_statement，不属于 tax_audit。',
          '金额保留原表数值，不要换算；financial.source_unit 必须返回 yuan、thousand_yuan、ten_thousand_yuan 或 unknown。无法确定的字段返回 null。',
          '必须只返回 JSON。',
        ].join('\n'),
        taskId,
      });
      const normalized = this.normalizeFinanceVisionResult(
        aiResult.structuredResult,
        material,
        file.originalname,
        fallbackPayload,
      );
      const year = String(
        normalized.financial?.year ??
          normalized.taxAudit?.year ??
          fallbackPayload?.year ??
          this.extractYearFromText(pdfText.snippet) ??
          '',
      );
      if (!/^\d{4}$/u.test(year)) {
        return fallbackPayload ?? null;
      }
      const taxCategory = String(
        normalized.taxAudit?.tax_category ??
          fallbackPayload?.taxAudit?.tax_category ??
          this.inferFinanceTaxCategory(file.originalname, this.inferFinanceFileClass(file.originalname)),
      );
      const taxFileClass = this.normalizeFinanceFileClass(String(
        normalized.taxAudit?.file_class ??
          fallbackPayload?.taxAudit?.file_class ??
          this.inferFinanceFileClass(file.originalname),
      ));
      return {
        confidence: normalized.confidence,
        documentType: normalized.documentType,
        existingFinancial: await this.findExistingFinanceFinancialRecord(enterpriseId, year),
        existingTaxAudit: normalized.taxAudit
          ? await this.findExistingFinanceTaxAuditRecord(enterpriseId, year, taxCategory, taxFileClass)
          : null,
        financial: normalized.financial,
        parseStatus: this.countFinanceAiFinancialFields(normalized.financial) > 0 ? 'success' : 'review_required',
        reviewWarnings: [
          `已使用 ${aiResult.model} 识别 PDF 文本，请核对金额、单位和年度后再确认。`,
          ...(fallbackPayload?.reviewWarnings ?? []),
        ],
        sourceFileName: file.originalname,
        sourceFilePath: material.filePath,
        sourceMaterialId: String(material.id),
        sourcePreviewUrl,
        taxAudit: normalized.taxAudit,
        year,
      };
    } catch (error) {
      console.warn('[FINANCE_AI_PARSE_TEXT_FAILED]', this.resolveErrorMessage(error));
      return fallbackPayload ?? null;
    }
  }

  private async tryBuildFinanceAiDraftFromVision(
    enterpriseId: string,
    material: EnterpriseMaterialEntity,
    file: StoredUploadFile,
    sourcePreviewUrl: string,
    taskId: string,
    fallbackPayload?: FinanceAiParseDraftPayload | null,
    diagnostics?: string[],
  ): Promise<FinanceAiParseDraftPayload | null> {
    if (process.env.AI_FINANCE_VISION_ENABLE === '0') {
      diagnostics?.push('财税视觉识别已关闭，未调用图片识别模型。');
      return null;
    }
    if (!process.env.AI_API_KEY) {
      diagnostics?.push('AI_API_KEY 未配置，未调用图片识别模型。');
      return null;
    }
    if (!process.env.AI_VISION_MODEL) {
      diagnostics?.push('AI_VISION_MODEL 未配置，未调用图片识别模型。');
      return null;
    }

    const extension = extname(file.originalname || material.filePath || '').toLowerCase();
    if (!['.jpeg', '.jpg', '.pdf', '.png'].includes(extension)) {
      return null;
    }

    const filePath = this.resolveUploadedFileAbsolutePath(file) ??
      (material.filePath ? this.resolveStoredFileAbsolutePath(material.filePath) : null);
    if (!filePath || !existsSync(filePath)) {
      diagnostics?.push('上传文件在服务器上不存在或不可读取，未调用图片识别模型。');
      return null;
    }

    try {
      const imageDataUrls = extension === '.pdf'
        ? await this.renderPdfPagesToImageDataUrls(filePath, 2)
        : [this.buildFinanceVisionDataUrl(filePath, extension)];
      const aiResults = await Promise.all(
        imageDataUrls.map((imageDataUrl, index) =>
          this.aiService.runVisionJsonCompletion({
            imageDataUrl,
            outputSchema: this.getFinanceVisionOutputSchema(),
            scene: 'finance_ai_parse_vision',
            systemPrompt: this.getFinanceVisionSystemPrompt(),
            taskId,
            userPrompt: [
              `文件名：${file.originalname}`,
              `当前为第 ${index + 1} 页。`,
              '请识别该财税文件中的年度、财务数据和文件类型。财务报表需结合资产负债表和利润表识别。',
              '只返回 JSON，不要输出 Markdown。没有识别到的字段用 null。',
            ].join('\n'),
          }),
        ),
      );
      const aiResult = aiResults[0];
      if (!aiResult) {
        return null;
      }
      const normalized = this.normalizeFinanceVisionResult(
        this.mergeFinanceVisionResults(aiResults.map((result) => result.structuredResult)),
        material,
        file.originalname,
        fallbackPayload,
      );
      const year = String(
        normalized.financial?.year ??
          normalized.taxAudit?.year ??
          fallbackPayload?.year ??
          this.extractYearFromText(file.originalname) ??
          new Date().getFullYear() - 1,
      );
      const taxCategory = String(
        normalized.taxAudit?.tax_category ??
          fallbackPayload?.taxAudit?.tax_category ??
          this.inferFinanceTaxCategory(file.originalname, this.inferFinanceFileClass(file.originalname)),
      );
      const taxFileClass = this.normalizeFinanceFileClass(String(
        normalized.taxAudit?.file_class ??
          fallbackPayload?.taxAudit?.file_class ??
          this.inferFinanceFileClass(file.originalname),
      ));
      const warnings = [
        `已使用 ${aiResult.model} 视觉模型识别，请核对金额、单位和年度后再确认更新。`,
        ...this.readStringArrayFromUnknown(
          aiResult.structuredResult.warnings,
          [],
        ),
        ...(fallbackPayload?.reviewWarnings ?? []),
      ];

      return {
        confidence: normalized.confidence,
        existingFinancial: await this.findExistingFinanceFinancialRecord(enterpriseId, year),
        existingTaxAudit: await this.findExistingFinanceTaxAuditRecord(
          enterpriseId,
          year,
          taxCategory,
          taxFileClass,
        ),
        financial: normalized.financial,
        documentType: normalized.documentType,
        parseStatus:
          this.countFinanceAiFinancialFields(normalized.financial) > 0
            ? 'partial'
            : 'review_required',
        reviewWarnings: [...new Set(warnings)],
        sourceFileName: file.originalname,
        sourceFilePath: material.filePath ?? '',
        sourceMaterialId: String(material.id),
        sourcePreviewUrl,
        taxAudit: normalized.taxAudit,
        year,
      };
    } catch (error) {
      const errorMessage = this.resolveErrorMessage(error);
      diagnostics?.push(`图片识别模型调用失败：${this.truncateFinanceText(errorMessage, 200)}`);
      console.warn('[FINANCE_AI_PARSE_VISION_FAILED]', errorMessage);
      return null;
    }
  }

  private buildFinanceVisionDataUrl(filePath: string, extension: string): string {
    const mimeType = this.resolveUploadPreviewContentType(`file${extension}`);
    const base64 = readFileSync(filePath).toString('base64');
    return `data:${mimeType};base64,${base64}`;
  }

  private mergeFinanceVisionResults(values: Record<string, unknown>[]): Record<string, unknown> {
    const financial = values
      .map((value) =>
        this.readRecordObject(value.financial) ??
        this.readRecordObject(value.financial_data) ??
        value,
      )
      .filter((value): value is Record<string, unknown> => Boolean(value))
      .map((value) => this.compactRecord(value))
      .reduce((result, value) => ({ ...value, ...result }), {});
    const taxAudit = values
      .map((value) => this.readRecordObject(value.taxAudit ?? value.tax_audit))
      .filter((value): value is Record<string, unknown> => Boolean(value))
      .map((value) => this.compactRecord(value))
      .reduce((result, value) => ({ ...value, ...result }), {});
    const documentType = values
      .map((value) =>
        this.normalizeFinanceDocumentType(value.document_type ?? value.file_type),
      )
      .find((value) => value !== 'other') ?? 'other';
    const warnings = values.flatMap((value) => this.readStringArrayFromUnknown(value.warnings, []));
    const confidence = Math.max(
      ...values
        .map((value) => this.normalizeOptionalConfidenceScore(value.confidence))
        .filter((value): value is number => value !== null),
      0,
    );
    return { confidence, document_type: documentType, financial, taxAudit, warnings };
  }

  private normalizeFinanceDocumentType(value: unknown): 'financial_statement' | 'tax_audit' | 'other' {
    const text = String(value ?? '').trim().toLowerCase();
    if (text === 'financial_statement' || /资产负债表|利润表|财务报表/u.test(text)) {
      return 'financial_statement';
    }
    if (text === 'tax_audit' || /纳税|审计/u.test(text)) {
      return 'tax_audit';
    }
    return 'other';
  }

  private getFinanceVisionOutputSchema(): Record<string, unknown> {
    return {
      confidence: 'number 0-100',
      document_type: 'financial_statement=财务报表，tax_audit=纳税申报或审计报告，other=其他',
      financial: {
        fz: '负债',
        fzl: '负债率',
        high_tech_income: '高新收入',
        lr_total: '利润总额',
        main_business_income: '营业收入',
        net_assets: '净资产',
        net_profit: '净利润',
        rd_depreciation: '折旧摊销',
        rd_design_fee: '设计费',
        rd_direct_input: '直接投入',
        rd_entrusted_development: '委托研发',
        rd_equipment_debugging_fee: '装备调试费',
        rd_intangible_amortization: '无形资产摊销',
        rd_other_expense: '其他费用',
        rd_personnel_cost: '人员人工',
        q: '固定为 1，表示全年数据',
        source_unit: '原表金额单位：yuan=元，thousand_yuan=千元，ten_thousand_yuan=万元，unknown=无法确认',
        xxsr: '销售收入',
        year: '年度',
        yffy: '研发费用',
        zxc: '总资产',
      },
      taxAudit: {
        file_class: '1=纳税申报,2=审计报告,3=其他',
        tax_category: '报告类别/税种',
        year: '年度',
      },
      warnings: ['需要人工核对的问题'],
    };
  }

  private getFinanceVisionSystemPrompt(): string {
    return [
      '你是财税报表和审计报告识别助手。',
      '请从用户上传的图片中识别财务数据和纳税审计信息，并判断文件类型。资产负债表、利润表属于 financial_statement，不能归类为 tax_audit。',
      '财务字段必须逐项识别：年度、销售收入、营业收入、高新收入、总资产、净资产、负债、负债率、利润总额、净利润、研发费用，以及人员人工、直接投入、折旧摊销、无形资产摊销、设计费、装备调试费、委托研发、其他费用。',
      '字段映射：资产负债表中的“资产总计/资产合计”写入总资产，“负债合计”写入负债，“所有者权益合计”写入净资产；利润表中的“营业收入/主营业务收入”写入营业收入，“利润总额”和“净利润”分别写入对应字段。年度报表季度固定为 1；只有原文明确出现“销售收入”“高新收入”时才填写对应字段。',
      '必须识别原表金额单位，并在 financial.source_unit 返回 yuan、thousand_yuan、ten_thousand_yuan 或 unknown。金额字段保留原表数值，不要自行换算，系统会统一换算为万元；无法确认单位时 source_unit 必须为 unknown 并写入 warnings。',
      '无法从报表直接确认的研发及高新收入字段必须为 null；不要将管理费用或其他近似字段擅自填入这些字段。',
      '无法确定的字段必须返回 null，不要猜测。',
      '必须只返回 JSON，不要输出 Markdown。',
    ].join('\n');
  }

  private normalizeFinanceVisionResult(
    value: Record<string, unknown>,
    material: EnterpriseMaterialEntity,
    sourceFileName: string,
    fallbackPayload?: FinanceAiParseDraftPayload | null,
  ): {
    confidence: number;
    documentType: 'financial_statement' | 'tax_audit' | 'other';
    financial: Record<string, unknown> | null;
    taxAudit: Record<string, unknown> | null;
  } {
    const financialRaw =
      this.readRecordObject(value.financial) ??
      this.readRecordObject(value.financial_data) ??
      value;
    const taxAuditRaw = this.readRecordObject(value.taxAudit ?? value.tax_audit);
    const documentType = this.normalizeFinanceDocumentType(
      value.document_type ?? value.file_type ?? fallbackPayload?.documentType ?? sourceFileName,
    );
    const q = 1;
    const sourceUnit = normalizeFinanceAmountUnit(
      this.getFinanceVisionField(financialRaw, ['source_unit', 'sourceUnit', 'amount_unit', 'unit']),
    );
    const year = String(
      financialRaw.year ??
        value.year ??
        taxAuditRaw?.year ??
        fallbackPayload?.year ??
        this.extractYearFromText(sourceFileName) ??
        new Date().getFullYear() - 1,
    );
    const financial = this.normalizeFinanceFinancialAmounts(this.compactRecord({
          fz: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['fz', 'liabilities', 'total_liabilities'])),
          fzl: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['fzl', 'liability_ratio'])),
          high_tech_income: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['high_tech_income', 'high_tech_revenue'])),
          lr_total: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['lr_total', 'profit_total', 'total_profit'])),
          main_business_income: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['main_business_income', 'main_business_revenue', 'operating_revenue', 'total_revenue'])),
          net_assets: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['net_assets'])),
          net_profit: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['net_profit'])),
          q,
          rd_depreciation: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['rd_depreciation', 'depreciation_amortization'])),
          rd_design_fee: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['rd_design_fee', 'design_costs', 'design_fee', 'design_fees', 'design_expenses'])),
          rd_direct_input: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['rd_direct_input', 'direct_input'])),
          rd_entrusted_development: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['rd_entrusted_development', 'outsourced_rd'])),
          rd_equipment_debugging_fee: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['rd_equipment_debugging_fee', 'equipment_debugging_costs', 'equipment_debugging_fee', 'equipment_debugging_fees', 'equipment_debugging_expenses'])),
          rd_intangible_amortization: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['rd_intangible_amortization', 'intangible_asset_amortization'])),
          rd_other_expense: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['rd_other_expense', 'other_expenses'])),
          rd_personnel_cost: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['rd_personnel_cost', 'personnel_costs'])),
          remark: `AI 解析来源：${sourceFileName}`,
          source_unit: sourceUnit,
          xxsr: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['xxsr', 'sales_revenue'])),
          year,
          yffy: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['yffy', 'rd_expenses'])),
          zxc: this.cleanFinanceAiValue(this.getFinanceVisionField(financialRaw, ['zxc', 'total_assets'])),
        }));
    const fileClass = this.normalizeFinanceFileClass(
      String(taxAuditRaw?.file_class ?? fallbackPayload?.taxAudit?.file_class ?? ''),
    );
    const taxCategory =
      this.cleanFinanceAiValue(taxAuditRaw?.tax_category) ??
      this.cleanFinanceAiValue(fallbackPayload?.taxAudit?.tax_category) ??
      this.inferFinanceTaxCategory(sourceFileName, fileClass);
    const taxAudit = documentType === 'tax_audit'
      ? this.compactRecord({
          file_class: fileClass,
          file_path: material.filePath,
          remark: `AI 视觉解析来源：${sourceFileName}`,
          tax_category: taxCategory,
          year,
        })
      : null;
    const confidence = this.normalizeConfidenceScore(
      value.confidence,
      fallbackPayload?.confidence ?? 68,
      40,
      90,
    );

    return {
      confidence,
      documentType,
      financial:
        financial && this.countFinanceAiFinancialFields(financial) > 0
          ? financial
          : null,
      taxAudit,
    };
  }

  private getFinanceVisionField(
    value: Record<string, unknown>,
    fieldNames: string[],
  ): unknown {
    return fieldNames
      .map((fieldName) => value[fieldName])
      .find((fieldValue) => fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim());
  }

  private readRecordObject(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private compactRecord(record: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    );
  }

  private cleanFinanceAiValue(value: unknown): null | string {
    if (value === undefined || value === null) {
      return null;
    }
    const text = String(value).trim();
    if (!text || /^null$/iu.test(text)) {
      return null;
    }
    return this.truncateFinanceText(text, 500);
  }

  private normalizeFinanceFinancialAmounts(data: Record<string, unknown>): Record<string, unknown> {
    const sourceUnit = normalizeFinanceAmountUnit(data.source_unit ?? data.sourceUnit);
    const amountFields = new Set([
      'fz', 'high_tech_income', 'highTechIncome', 'lr_total', 'lrTotal',
      'main_business_income', 'mainBusinessIncome', 'net_assets', 'netAssets',
      'net_profit', 'netProfit', 'rd_depreciation', 'rdDepreciation',
      'rd_design_fee', 'rdDesignFee', 'rd_direct_input', 'rdDirectInput',
      'rd_entrusted_development', 'rdEntrustedDevelopment',
      'rd_equipment_debugging_fee', 'rdEquipmentDebuggingFee',
      'rd_intangible_amortization', 'rdIntangibleAmortization',
      'rd_other_expense', 'rdOtherExpense', 'rd_personnel_cost', 'rdPersonnelCost',
      'total_revenue', 'totalRevenue', 'xxsr', 'yffy', 'rdExpense', 'zxc',
    ]);
    return Object.fromEntries(
      Object.entries(data)
        // source_unit only belongs to the raw AI response. Retaining it causes a later
        // draft approval to apply the same conversion to already normalized amounts.
        .filter(([field]) => field !== 'source_unit' && field !== 'sourceUnit')
        .map(([field, value]) => [
          field,
          amountFields.has(field) ? normalizeFinanceAmount(value, sourceUnit) : value,
        ]),
    );
  }

  private countFinanceAiFinancialFields(value?: null | Record<string, unknown>): number {
    if (!value) {
      return 0;
    }
    return Object.entries(value).filter(
      ([field, fieldValue]) =>
        field !== 'year' &&
        field !== 'q' &&
        field !== 'remark' &&
        this.isFilledValue(fieldValue),
    ).length;
  }

  private async tryBuildFinanceAiDraftFromPdf(
    enterpriseId: string,
    material: EnterpriseMaterialEntity,
    file: StoredUploadFile,
    sourcePreviewUrl: string,
  ): Promise<FinanceAiParseDraftPayload | null> {
    if (!material.filePath || extname(material.filePath).toLowerCase() !== '.pdf') {
      return null;
    }

    const pdfText = await this.extractPdfTextFromStoredPath(material.filePath, 'finance');
    const sourceText = [file.originalname, pdfText.snippet].filter(Boolean).join('\n');
    const inferredYear = this.extractYearFromText(sourceText);
    const year = inferredYear ?? String(new Date().getFullYear() - 1);
    const fileClass = this.inferFinanceFileClass(sourceText);
    const taxCategory = this.inferFinanceTaxCategory(sourceText, fileClass);
    const documentType = this.normalizeFinanceDocumentType(sourceText);
    const financial = this.extractFinanceFinancialDataFromText(
      sourceText,
      year,
      this.extractFinanceSourceUnit(sourceText),
    );
    const taxAudit = documentType === 'tax_audit'
      ? {
          file_class: fileClass,
          file_path: material.filePath,
          remark: `PDF 解析来源：${file.originalname}`,
          tax_category: taxCategory,
          year,
        }
      : null;
    const extractedCount = Object.keys(financial).filter(
      (field) => field !== 'year' && field !== 'q' && this.isFilledValue(financial[field]),
    ).length;

    return {
      confidence: pdfText.status === 'success' ? (extractedCount > 0 ? 72 : 58) : 38,
      documentType,
      existingFinancial: await this.findExistingFinanceFinancialRecord(enterpriseId, year),
      existingTaxAudit: taxAudit
        ? await this.findExistingFinanceTaxAuditRecord(enterpriseId, year, taxCategory, fileClass)
        : null,
      financial: extractedCount > 0 ? financial : null,
      parseStatus:
        pdfText.status === 'success' && extractedCount > 0
          ? 'partial'
          : 'review_required',
      reviewWarnings: [
        pdfText.status === 'success'
          ? `已读取 PDF 文本并识别 ${extractedCount} 个财务字段，请核对金额单位。`
          : 'PDF 未提取到可靠文本，已先生成附件确认草稿。',
        inferredYear
          ? '已从 PDF 文本或文件名识别年度。'
          : '未能识别年度，默认使用上一年度，请确认后再替换。',
      ],
      sourceFileName: file.originalname,
      sourceFilePath: material.filePath ?? '',
      sourceMaterialId: String(material.id),
      sourcePreviewUrl,
      taxAudit,
      year,
    };
  }

  private async tryBuildFinanceAiDraftFromCsv(
    enterpriseId: string,
    material: EnterpriseMaterialEntity,
    file: StoredUploadFile,
    sourcePreviewUrl: string,
  ): Promise<FinanceAiParseDraftPayload | null> {
    if (!file.path || !/\.csv$/iu.test(file.originalname)) {
      return null;
    }

    const content = readFileSync(file.path, 'utf8').replace(/^\uFEFF/u, '');
    const { rows } = this.parseFinanceCsv(content);
    const firstValidRow = rows.find((row) => this.validateFinanceImportRow(row).length === 0);
    if (!firstValidRow) {
      return null;
    }

    const year = this.getFinanceImportCell(firstValidRow, ['年度', 'year']);
    const recordType = this.normalizeFinanceRecordType(
      this.getFinanceImportCell(firstValidRow, ['记录类型', 'record_type']),
    );
    const financial =
      recordType === 'financial'
        ? this.toFinanceAiFinancialDraft(firstValidRow, file.originalname)
        : null;
    const taxAudit =
      recordType === 'tax_audit'
        ? this.toFinanceAiTaxAuditDraft(firstValidRow, material, file.originalname)
        : null;

    return {
      confidence: 82,
      existingFinancial: await this.findExistingFinanceFinancialRecord(enterpriseId, year),
      existingTaxAudit: taxAudit
        ? await this.findExistingFinanceTaxAuditRecord(
            enterpriseId,
            year,
            String(taxAudit.tax_category ?? ''),
            normalizeFinanceFileClass(taxAudit.file_class ?? 1),
          )
        : null,
      financial,
      parseStatus: 'success',
      reviewWarnings: ['已从 CSV 结构化解析，请确认金额单位和年度后再替换。'],
      sourceFileName: file.originalname,
      sourceFilePath: material.filePath ?? '',
      sourceMaterialId: String(material.id),
      sourcePreviewUrl,
      taxAudit,
      year,
    };
  }

  private async tryBuildFinanceAiDraftFromExcel(
    enterpriseId: string,
    material: EnterpriseMaterialEntity,
    file: StoredUploadFile,
    sourcePreviewUrl: string,
  ): Promise<FinanceAiParseDraftPayload | null> {
    if (!file.path || !/\.xlsx?$/iu.test(file.originalname)) {
      return null;
    }

    const filePath = this.resolveUploadedFileAbsolutePath(file);
    if (!filePath) {
      return null;
    }

    const rows = await this.readFinanceWorkbookRows(filePath);
    const firstValidRow = rows.find((row) => this.validateFinanceImportRow(row).length === 0);
    if (!firstValidRow) {
      return null;
    }

    const year = this.getFinanceImportCell(firstValidRow, ['年度', 'year']);
    const recordType = this.normalizeFinanceRecordType(
      this.getFinanceImportCell(firstValidRow, ['记录类型', 'record_type']),
    );
    const financial =
      recordType === 'financial'
        ? this.toFinanceAiFinancialDraft(firstValidRow, file.originalname)
        : null;
    const taxAudit =
      recordType === 'tax_audit'
        ? this.toFinanceAiTaxAuditDraft(firstValidRow, material, file.originalname)
        : null;

    return {
      confidence: 84,
      existingFinancial: await this.findExistingFinanceFinancialRecord(enterpriseId, year),
      existingTaxAudit: taxAudit
        ? await this.findExistingFinanceTaxAuditRecord(
            enterpriseId,
            year,
            String(taxAudit.tax_category ?? ''),
            normalizeFinanceFileClass(taxAudit.file_class ?? 1),
          )
        : null,
      financial,
      parseStatus: 'success',
      reviewWarnings: ['已从 Excel 结构化解析，请确认金额单位和年度后再替换。'],
      sourceFileName: file.originalname,
      sourceFilePath: material.filePath ?? '',
      sourceMaterialId: String(material.id),
      sourcePreviewUrl,
      taxAudit,
      year,
    };
  }

  private toFinanceAiFinancialDraft(
    row: FinanceImportRow,
    sourceFileName: string,
  ): Record<string, unknown> {
    return this.normalizeFinanceFinancialAmounts({
      fz: this.cleanFinanceText(this.getFinanceImportCell(row, ['负债'])),
      fzl: this.cleanFinanceText(this.getFinanceImportCell(row, ['负债率'])),
      high_tech_income: this.cleanFinanceText(this.getFinanceImportCell(row, ['高新收入'])),
      lr_total: this.cleanFinanceText(this.getFinanceImportCell(row, ['利润总额'])),
      main_business_income: this.cleanFinanceText(
        this.getFinanceImportCell(row, ['营业收入', '主营业务收入']),
      ),
      net_assets: this.cleanFinanceText(this.getFinanceImportCell(row, ['净资产'])),
      net_profit: this.cleanFinanceText(this.getFinanceImportCell(row, ['净利润'])),
      q: 1,
      rd_depreciation: this.cleanFinanceText(this.getFinanceImportCell(row, ['折旧摊销'])),
      rd_design_fee: this.cleanFinanceText(this.getFinanceImportCell(row, ['设计费'])),
      rd_direct_input: this.cleanFinanceText(this.getFinanceImportCell(row, ['直接投入'])),
      rd_entrusted_development: this.cleanFinanceText(this.getFinanceImportCell(row, ['委托研发'])),
      rd_equipment_debugging_fee: this.cleanFinanceText(this.getFinanceImportCell(row, ['装备调试费'])),
      rd_intangible_amortization: this.cleanFinanceText(this.getFinanceImportCell(row, ['无形资产摊销'])),
      rd_other_expense: this.cleanFinanceText(this.getFinanceImportCell(row, ['其他费用'])),
      rd_personnel_cost: this.cleanFinanceText(this.getFinanceImportCell(row, ['人员人工'])),
      remark: this.cleanFinanceText(this.getFinanceImportCell(row, ['备注'])) ?? `AI 解析来源：${sourceFileName}`,
      xxsr: this.cleanFinanceText(this.getFinanceImportCell(row, ['销售收入'])),
      year: this.getFinanceImportCell(row, ['年度', 'year']),
      yffy: this.cleanFinanceText(this.getFinanceImportCell(row, ['研发费用'])),
      zxc: this.cleanFinanceText(this.getFinanceImportCell(row, ['总资产'])),
    });
  }

  private toFinanceAiTaxAuditDraft(
    row: FinanceImportRow,
    material: EnterpriseMaterialEntity,
    sourceFileName: string,
  ): Record<string, unknown> {
    return {
      file_class: this.normalizeFinanceFileClass(this.getFinanceImportCell(row, ['文件类型'])),
      file_path: this.cleanFinanceText(this.getFinanceImportCell(row, ['文件路径'])) ?? material.filePath,
      remark: this.cleanFinanceText(this.getFinanceImportCell(row, ['备注'])) ?? `AI 解析来源：${sourceFileName}`,
      tax_category: this.cleanFinanceText(this.getFinanceImportCell(row, ['税种/报告类别'])) ?? this.inferFinanceTaxCategory(sourceFileName, this.inferFinanceFileClass(sourceFileName)),
      year: this.getFinanceImportCell(row, ['年度', 'year']),
    };
  }

  private async upsertFinanceAiFinancialRecord(
    enterpriseId: string,
    data: Record<string, unknown>,
  ): Promise<EnterpriseFinanceRecordEntity> {
    const normalizedData = this.normalizeFinanceFinancialAmounts(data);
    const year = normalizeFinanceYear(normalizedData.year);
    const q = 1;
    const existing = await this.enterpriseFinanceRecordRepo.findOne({
      where: {
        enterpriseId,
        recordType: 'financial',
        status: 1,
        year,
      },
    });
    const entity =
      existing ??
      this.enterpriseFinanceRecordRepo.create({
        enterpriseId,
        recordType: 'financial',
        status: 1,
      });
    Object.assign(
      entity,
      this.toProfileRecordEntityData(
        {
          ...normalizedData,
          q,
          year,
        },
        this.getProfileRecordConfig('finance', 'financial'),
      ),
    );
    return this.enterpriseFinanceRecordRepo.save(entity);
  }

  private async upsertFinanceAiTaxAuditRecord(
    enterpriseId: string,
    data: Record<string, unknown>,
  ): Promise<EnterpriseFinanceRecordEntity> {
    const year = normalizeFinanceYear(data.year);
    const fileClass = normalizeFinanceFileClass(data.file_class ?? 1);
    const taxCategory = normalizeFinanceTaxCategory(data.tax_category);
    const existing = await this.enterpriseFinanceRecordRepo.findOne({
      where: {
        enterpriseId,
        fileClass: fileClass ?? IsNull(),
        recordType: 'tax_audit',
        status: 1,
        year,
        taxCategory: taxCategory ?? IsNull(),
      },
    });
    const entity =
      existing ??
      this.enterpriseFinanceRecordRepo.create({
        enterpriseId,
        recordType: 'tax_audit',
        status: 1,
      });
    Object.assign(entity, this.toProfileRecordEntityData({ ...data, file_class: fileClass, tax_category: taxCategory, year }, this.getProfileRecordConfig('finance', 'taxAudit')));
    return this.enterpriseFinanceRecordRepo.save(entity);
  }

  private async findExistingFinanceFinancialRecord(
    enterpriseId: string,
    year: string,
  ): Promise<Record<string, unknown> | null> {
    const row = await this.enterpriseFinanceRecordRepo.findOne({
      where: {
        enterpriseId,
        recordType: 'financial',
        status: 1,
        year,
      },
    });
    return row ? (row as unknown as Record<string, unknown>) : null;
  }

  private async findExistingFinanceTaxAuditRecord(
    enterpriseId: string,
    year: string,
    taxCategory: string,
    fileClass: null | number,
  ): Promise<Record<string, unknown> | null> {
    const row = await this.enterpriseFinanceRecordRepo.findOne({
      where: {
        enterpriseId,
        fileClass: fileClass ?? IsNull(),
        recordType: 'tax_audit',
        status: 1,
        year,
        taxCategory: normalizeFinanceTaxCategory(taxCategory) ?? IsNull(),
      },
    });
    return row ? (row as unknown as Record<string, unknown>) : null;
  }

  private extractYearFromText(value: string): null | string {
    const match = value.match(/(?:20|19)\d{2}/u);
    return match?.[0] ?? null;
  }

  private extractFinanceSourceUnit(text: string) {
    const match = text.match(/(?:金额)?单位[：:\s]*(?:人民币)?(万元|千元|元)/u);
    return normalizeFinanceAmountUnit(match?.[1]);
  }

  private extractFinanceFinancialDataFromText(
    text: string,
    year: string,
    sourceUnit: ReturnType<typeof normalizeFinanceAmountUnit>,
  ): Record<string, unknown> {
    const normalized = text.replace(/[,\s]+/gu, ' ');
    return this.normalizeFinanceFinancialAmounts({
      fz: this.extractFinanceAmountNearLabels(normalized, ['负债合计', '总负债', '负债']),
      high_tech_income: this.extractFinanceAmountNearLabels(normalized, [
        '高新技术产品收入',
        '高新收入',
      ]),
      lr_total: this.extractFinanceAmountNearLabels(normalized, [
        '利润总额',
        '利润总计',
      ]),
      main_business_income: this.extractFinanceAmountNearLabels(normalized, [
        '营业收入',
        '主营业务收入',
        '主营收入',
      ]),
      net_assets: this.extractFinanceAmountNearLabels(normalized, [
        '净资产',
        '所有者权益合计',
      ]),
      net_profit: this.extractFinanceAmountNearLabels(normalized, ['净利润']),
      q: 1,
      rd_depreciation: this.extractFinanceAmountNearLabels(normalized, [
        '折旧摊销',
        '折旧费用与长期待摊费用',
      ]),
      rd_design_fee: this.extractFinanceAmountNearLabels(normalized, ['设计费']),
      rd_direct_input: this.extractFinanceAmountNearLabels(normalized, ['直接投入']),
      rd_entrusted_development: this.extractFinanceAmountNearLabels(normalized, [
        '委托研发',
        '委托外部研究开发费用',
      ]),
      rd_equipment_debugging_fee: this.extractFinanceAmountNearLabels(normalized, [
        '装备调试费',
      ]),
      rd_intangible_amortization: this.extractFinanceAmountNearLabels(normalized, [
        '无形资产摊销',
      ]),
      rd_other_expense: this.extractFinanceAmountNearLabels(normalized, ['其他费用']),
      rd_personnel_cost: this.extractFinanceAmountNearLabels(normalized, [
        '人员人工',
        '人员人工费用',
      ]),
      remark: 'PDF 文本自动解析，确认前请核对金额单位。',
      source_unit: sourceUnit,
      xxsr: this.extractFinanceAmountNearLabels(normalized, [
        '销售收入',
      ]),
      year,
      yffy: this.extractFinanceAmountNearLabels(normalized, [
        '研发费用总额',
        '研究开发费用合计',
        '研发费用',
      ]),
      zxc: this.extractFinanceAmountNearLabels(normalized, [
        '资产总计',
        '总资产',
      ]),
    });
  }

  private extractFinanceAmountNearLabels(
    text: string,
    labels: string[],
  ): null | string {
    for (const label of labels) {
      const escaped = this.escapeRegExp(label);
      const context = text.match(new RegExp(`${escaped}.{0,80}`, 'u'))?.[0] ?? '';
      if (!context) {
        continue;
      }

      const candidates = [...context.matchAll(/-?\d{1,3}(?:,?\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?/gu)]
        .map((match) => match[0])
        .filter((value) => this.isReliableFinanceAmountCandidate(value));
      if (candidates.length > 0) {
        const amount =
          candidates.find((value) => value.includes('.')) ?? candidates[0];
        return amount?.replace(/,/gu, '') ?? null;
      }
    }
    return null;
  }

  private isReliableFinanceAmountCandidate(value: string): boolean {
    const normalized = value.replace(/,/gu, '');
    if (!/^-?\d+(?:\.\d+)?$/u.test(normalized)) {
      return false;
    }

    const amount = Number(normalized);
    if (!Number.isFinite(amount) || Math.abs(amount) === 0) {
      return false;
    }

    if (/^(?:19|20)\d{2}$/u.test(normalized)) {
      return false;
    }

    return Math.abs(amount) >= 10 || normalized.includes('.');
  }

  private inferFinanceFileClass(value: string): 1 | 2 | 3 {
    if (/纳税|申报|增值税|所得税/u.test(value)) {
      return 1;
    }
    if (/审计|审计报告|专项/u.test(value)) {
      return 2;
    }
    return 3;
  }

  private inferFinanceTaxCategory(value: string, fileClass: 1 | 2 | 3): string {
    if (/研发/u.test(value)) {
      return '研发费用专项审计';
    }
    if (/高新|高企|收入/u.test(value)) {
      return '高新技术产品收入专项审计';
    }
    if (/所得税/u.test(value)) {
      return '企业所得税';
    }
    if (/增值税/u.test(value)) {
      return '增值税';
    }
    if (fileClass === 2) {
      return '年度审计报告';
    }
    if (fileClass === 1) {
      return '纳税申报表';
    }
    return '其他财税资料';
  }

  private async saveClientPropertyAiResult(
    task: AiTaskEntity,
    input: {
      confidence?: null | string;
      structuredResult: Record<string, unknown>;
      summary: null | string;
    },
  ): Promise<AiResultEntity> {
    const result = await this.aiResultRepo.save(
      this.aiResultRepo.create({
        confidence: input.confidence ?? null,
        scene: task.scene,
        status: 'draft',
        structuredResult: JSON.stringify(input.structuredResult),
        summary: input.summary,
        taskId: String(task.id),
      }),
    );

    task.errorMessage = null;
    task.finishedAt = new Date();
    task.resultId = String(result.id);
    task.status = 'success';
    await this.aiTaskRepo.save(task);

    return result;
  }

  private async markClientPropertyAiTaskFailed(
    task: AiTaskEntity,
    errorMessage: string,
  ): Promise<void> {
    const processingDrafts = await this.aiDraftRepo.find({
      where: { status: 'processing', taskId: String(task.id) },
    });
    if (processingDrafts.length > 0) {
      await this.aiDraftRepo.save(
        processingDrafts.map((draft) => {
          draft.status = 'failed';
          draft.draftPayload = JSON.stringify({
            ...this.parseJsonObject(draft.draftPayload),
            recognition_note: '识别失败',
            review_warnings: [errorMessage],
          });
          return draft;
        }),
      );
    }
    task.errorMessage = errorMessage;
    task.finishedAt = new Date();
    task.status = 'failed';
    await this.aiTaskRepo.save(task);
  }

  private resolveDraftsConfidenceLabel(
    payloads: Array<Record<string, unknown>>,
  ): string {
    const confidenceValues = payloads
      .map((payload) => this.normalizeOptionalConfidenceScore(payload.confidence))
      .filter((value): value is number => value !== null);
    if (confidenceValues.length === 0) {
      return 'low';
    }

    const average =
      confidenceValues.reduce((total, value) => total + value, 0) /
      confidenceValues.length;
    if (average >= 80) {
      return 'high';
    }
    if (average >= 60) {
      return 'medium';
    }
    return 'low';
  }

  private toClientAiTaskItem(
    task: AiTaskEntity,
    result: AiResultEntity | null = null,
  ): ClientAiTaskItem {
    return {
      createTime: formatDateTimeInBjt(task.createdAt),
      errorMessage: task.errorMessage,
      finishedAt: task.finishedAt ? formatDateTimeInBjt(task.finishedAt) : null,
      id: String(task.id),
      inputSnapshot: this.parseJsonObject(task.inputSnapshot),
      result: result ? this.toClientAiTaskResultItem(result) : null,
      resultId: task.resultId ? String(task.resultId) : null,
      scene: task.scene,
      status: task.status,
      updateTime: formatDateTimeInBjt(task.updatedAt),
    };
  }

  private toClientAiTaskResultItem(result: AiResultEntity): ClientAiTaskResultItem {
    return {
      confidence: result.confidence,
      id: String(result.id),
      scene: result.scene,
      status: result.status,
      structuredResult: this.parseJsonObject(result.structuredResult),
      summary: result.summary,
    };
  }

  private parseFinanceCsv(content: string): {
    errors: FinanceImportError[];
    rows: FinanceImportRow[];
  } {
    const parsedRows = this.parseCsvRows(content);
    if (parsedRows.length <= 1) {
      return {
        errors: [
          {
            fieldName: null,
            message: '文件中没有可导入的数据行',
            rowNumber: 1,
            suggestion: '请保留模板表头，并至少填写一行财务数据或纳税审计记录。',
          },
        ],
        rows: [],
      };
    }

    const headers = parsedRows[0].map((item) => item.trim());
    const rows = parsedRows
      .slice(1)
      .map((cells, index) => ({ cells, lineNumber: index + 2 }))
      .filter(({ cells }) => cells.some((cell) => cell.trim()))
      .map(({ cells, lineNumber }) => {
        return headers.reduce<FinanceImportRow>(
          (row, header, index) => {
            row[header] = cells[index]?.trim() ?? '';
            return row;
          },
          { __rowNumber: String(lineNumber) },
        );
      });

    return {
      errors: [],
      rows,
    };
  }

  private parseFinanceWorkbook(workbook: ExcelWorkbook): {
    errors: FinanceImportError[];
    rows: FinanceImportRow[];
  } {
    const worksheet = workbook.worksheets[0] ?? null;
    if (!worksheet) {
      return {
        errors: [
          {
            fieldName: null,
            message: 'Excel 中没有可读取的工作表',
            rowNumber: 1,
            suggestion: '请保留财税模板表头，并至少填写一行财务数据或纳税审计记录。',
          },
        ],
        rows: [],
      };
    }

    const headers = this.extractExcelRowValues(worksheet.getRow(1));
    const rows: FinanceImportRow[] = [];
    worksheet.eachRow((row: ExcelRow, rowNumber: number) => {
      if (rowNumber === 1) {
        return;
      }

      const cells = this.extractExcelRowValues(row);
      if (!cells.some((cell) => cell.trim())) {
        return;
      }

      rows.push(
        headers.reduce<FinanceImportRow>(
          (record, header, index) => {
            record[header] = cells[index]?.trim() ?? '';
            return record;
          },
          {
            __rowNumber: String(rowNumber),
            __sheetName: worksheet.name,
          },
        ),
      );
    });

    return {
      errors: rows.length > 0 ? [] : [
        {
          fieldName: null,
          message: '文件中没有可导入的数据行',
          rowNumber: 1,
          suggestion: '请保留财税模板表头，并至少填写一行财务数据或纳税审计记录。',
        },
      ],
      rows,
    };
  }

  private async readFinanceWorkbookRows(filePath: string): Promise<FinanceImportRow[]> {
    try {
      const workbook = await this.readEmployeeWorkbook(filePath);
      return this.parseFinanceWorkbook(workbook).rows;
    } catch {
      return (await this.parseFinanceWorkbookFromXlsxXml(filePath)).rows;
    }
  }

  private async parseFinanceWorkbookFromXlsxXml(
    filePath: string,
  ): Promise<{ errors: FinanceImportError[]; rows: FinanceImportRow[] }> {
    const requireFromHere = createRequire(__filename);
    const JSZip = requireFromHere('jszip') as {
      loadAsync: (data: Buffer) => Promise<{
        file: (path: string) => null | { async: (type: 'string') => Promise<string> };
        files: Record<string, unknown>;
      }>;
    };
    const zip = await JSZip.loadAsync(readFileSync(filePath));
    const sheetPath =
      Object.keys(zip.files).find((path) => /^xl\/worksheets\/sheet\d+\.xml$/u.test(path)) ??
      'xl/worksheets/sheet1.xml';
    const sheetFile = zip.file(sheetPath);
    if (!sheetFile) {
      return {
        errors: [
          {
            fieldName: null,
            message: 'Excel 中没有可读取的工作表',
            rowNumber: 1,
            suggestion: '请另存为 .xlsx 后重新上传。',
          },
        ],
        rows: [],
      };
    }

    const sharedStrings = await this.readXlsxSharedStrings(zip);
    const sheetXml = await sheetFile.async('string');
    const matrix = this.parseXlsxSheetMatrix(sheetXml, sharedStrings);
    return this.parseFinanceTableRows(matrix);
  }

  private async readXlsxSharedStrings(zip: {
    file: (path: string) => null | { async: (type: 'string') => Promise<string> };
  }): Promise<string[]> {
    const sharedFile = zip.file('xl/sharedStrings.xml');
    if (!sharedFile) {
      return [];
    }

    const sharedXml = await sharedFile.async('string');
    return [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/giu)].map((match) =>
      this.decodeXmlText(
        [...(match[1] ?? '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/giu)]
          .map((textMatch) => textMatch[1] ?? '')
          .join(''),
      ),
    );
  }

  private parseXlsxSheetMatrix(sheetXml: string, sharedStrings: string[]): string[][] {
    const rows: string[][] = [];
    for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/giu)) {
      const rowCells: string[] = [];
      for (const cellMatch of (rowMatch[1] ?? '').matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/giu)) {
        const attrs = cellMatch[1] ?? '';
        const body = cellMatch[2] ?? '';
        const ref = attrs.match(/\br="([A-Z]+)\d+"/u)?.[1] ?? '';
        const index = ref ? this.xlsxColumnNameToIndex(ref) : rowCells.length;
        rowCells[index] = this.extractXlsxCellText(attrs, body, sharedStrings);
      }
      rows.push(rowCells.map((cell) => cell ?? ''));
    }
    return rows;
  }

  private extractXlsxCellText(
    attrs: string,
    body: string,
    sharedStrings: string[],
  ): string {
    const type = attrs.match(/\bt="([^"]+)"/u)?.[1] ?? '';
    if (type === 'inlineStr') {
      return this.decodeXmlText(
        [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/giu)]
          .map((match) => match[1] ?? '')
          .join(''),
      );
    }

    const value = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/iu)?.[1] ?? '';
    if (type === 's') {
      return sharedStrings[Number(value)] ?? '';
    }
    return this.decodeXmlText(value);
  }

  private parseFinanceTableRows(cells: string[][]): {
    errors: FinanceImportError[];
    rows: FinanceImportRow[];
  } {
    if (cells.length <= 1) {
      return {
        errors: [
          {
            fieldName: null,
            message: '文件中没有可导入的数据行',
            rowNumber: 1,
            suggestion: '请保留财税模板表头，并至少填写一行财务数据或纳税审计记录。',
          },
        ],
        rows: [],
      };
    }

    const headers = (cells[0] ?? []).map((item) => item.trim());
    const rows = cells
      .slice(1)
      .map((rowCells, index) => ({ cells: rowCells, lineNumber: index + 2 }))
      .filter(({ cells: rowCells }) => rowCells.some((cell) => cell.trim()))
      .map(({ cells: rowCells, lineNumber }) =>
        headers.reduce<FinanceImportRow>(
          (row, header, index) => {
            row[header] = rowCells[index]?.trim() ?? '';
            return row;
          },
          { __rowNumber: String(lineNumber) },
        ),
      );

    return { errors: [], rows };
  }

  private xlsxColumnNameToIndex(value: string): number {
    return [...value].reduce(
      (total, char) => total * 26 + char.charCodeAt(0) - 64,
      0,
    ) - 1;
  }

  private decodeXmlText(value: string): string {
    return value
      .replace(/&lt;/gu, '<')
      .replace(/&gt;/gu, '>')
      .replace(/&quot;/gu, '"')
      .replace(/&apos;/gu, "'")
      .replace(/&amp;/gu, '&')
      .trim();
  }

  private parseCsvRows(content: string): string[][] {
    const rows: string[][] = [];
    let cell = '';
    let row: string[] = [];
    let quoted = false;

    for (let index = 0; index < content.length; index += 1) {
      const char = content[index];
      const next = content[index + 1];
      if (char === '"') {
        if (quoted && next === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
        continue;
      }
      if (char === ',' && !quoted) {
        row.push(cell);
        cell = '';
        continue;
      }
      if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') {
          index += 1;
        }
        row.push(cell);
        rows.push(row);
        cell = '';
        row = [];
        continue;
      }
      cell += char;
    }

    if (cell || row.length > 0) {
      row.push(cell);
      rows.push(row);
    }

    return rows;
  }

  private validateFinanceImportRow(row: FinanceImportRow): FinanceImportError[] {
    const rowNumber = Number(row.__rowNumber || 1);
    const errors: FinanceImportError[] = [];
    const recordTypeText = this.getFinanceImportCell(row, ['记录类型', 'record_type']);
    const recordType = this.normalizeFinanceRecordType(recordTypeText);
    const year = this.getFinanceImportCell(row, ['年度', 'year']);

    if (!recordType) {
      errors.push({
        fieldName: '记录类型',
        message: '记录类型不能为空或不支持',
        rawValue: recordTypeText,
        rowNumber,
        suggestion: '请填写“财务数据”或“纳税审计”。',
      });
    }

    if (!/^\d{4}$/u.test(year)) {
      errors.push({
        fieldName: '年度',
        message: '年度格式不正确',
        rawValue: year,
        rowNumber,
        suggestion: '请填写 4 位年份，例如 2024。',
      });
    }

    if (recordType === 'financial') {
      const amountFields = [
        '销售收入',
        '总资产',
        '净资产',
        '负债',
        '利润总额',
        '净利润',
        '营业收入',
        '研发费用',
        '高新收入',
        '人员人工',
        '直接投入',
        '折旧摊销',
        '无形资产摊销',
        '设计费',
        '装备调试费',
        '委托研发',
        '其他费用',
      ];
      amountFields.forEach((field) => {
        const value = this.getFinanceImportCell(row, [field]);
        if (value && !this.isFinanceAmountLike(value)) {
          errors.push({
            fieldName: field,
            message: `${field}应为数字`,
            rawValue: value,
            rowNumber,
            suggestion: '金额字段可填写数字、小数或千分位逗号。',
          });
        }
      });

      const debtRatio = this.getFinanceImportCell(row, ['负债率']);
      if (debtRatio && !this.isFinancePercentLike(debtRatio)) {
        errors.push({
          fieldName: '负债率',
          message: '负债率格式不正确',
          rawValue: debtRatio,
          rowNumber,
          suggestion: '请填写数字或百分比，例如 40 或 40%。',
        });
      }
    }

    if (recordType === 'tax_audit') {
      const fileClass = this.getFinanceImportCell(row, ['文件类型']);
      try {
        normalizeFinanceFileClass(fileClass || 1);
      } catch {
        errors.push({
          fieldName: '文件类型',
          message: '文件类型仅支持 1 至 3',
          rawValue: fileClass,
          rowNumber,
          suggestion: '请填写 1（纳税申报）、2（审计报告）或 3（其他）。',
        });
      }
    }

    return errors;
  }

  private async upsertFinancialImportRow(
    enterpriseId: string,
    row: FinanceImportRow,
  ): Promise<void> {
    const year = normalizeFinanceYear(this.getFinanceImportCell(row, ['年度', 'year']));
    const existing = await this.enterpriseFinanceRecordRepo.findOne({
      where: {
        enterpriseId,
        recordType: 'financial',
        status: 1,
        year,
      },
    });
    const entity =
      existing ??
      this.enterpriseFinanceRecordRepo.create({
        enterpriseId,
        recordType: 'financial',
        status: 1,
      });

    Object.assign(entity, this.normalizeFinanceFinancialAmounts({
      fz: this.cleanFinanceText(this.getFinanceImportCell(row, ['负债'])),
      fzl: this.cleanFinanceText(this.getFinanceImportCell(row, ['负债率'])),
      highTechIncome: this.cleanFinanceText(
        this.getFinanceImportCell(row, ['高新收入']),
      ),
      lrTotal: this.cleanFinanceText(this.getFinanceImportCell(row, ['利润总额'])),
      mainBusinessIncome: this.cleanFinanceText(
        this.getFinanceImportCell(row, ['营业收入', '主营业务收入']),
      ),
      netAssets: this.cleanFinanceText(this.getFinanceImportCell(row, ['净资产'])),
      netProfit: this.cleanFinanceText(this.getFinanceImportCell(row, ['净利润'])),
      q: 1,
      rdDepreciation: this.cleanFinanceText(
        this.getFinanceImportCell(row, ['折旧摊销']),
      ),
      rdDesignFee: this.cleanFinanceText(this.getFinanceImportCell(row, ['设计费'])),
      rdDirectInput: this.cleanFinanceText(
        this.getFinanceImportCell(row, ['直接投入']),
      ),
      rdEntrustedDevelopment: this.cleanFinanceText(
        this.getFinanceImportCell(row, ['委托研发']),
      ),
      rdEquipmentDebuggingFee: this.cleanFinanceText(
        this.getFinanceImportCell(row, ['装备调试费']),
      ),
      rdIntangibleAmortization: this.cleanFinanceText(
        this.getFinanceImportCell(row, ['无形资产摊销']),
      ),
      rdOtherExpense: this.cleanFinanceText(
        this.getFinanceImportCell(row, ['其他费用']),
      ),
      rdPersonnelCost: this.cleanFinanceText(
        this.getFinanceImportCell(row, ['人员人工']),
      ),
      remark: this.cleanFinanceText(this.getFinanceImportCell(row, ['备注'])),
      xxsr: this.cleanFinanceText(this.getFinanceImportCell(row, ['销售收入'])),
      year,
      yffy: this.cleanFinanceText(this.getFinanceImportCell(row, ['研发费用'])),
      zxc: this.cleanFinanceText(this.getFinanceImportCell(row, ['总资产'])),
    }));

    await this.enterpriseFinanceRecordRepo.save(entity);
  }

  private async upsertTaxAuditImportRow(
    enterpriseId: string,
    row: FinanceImportRow,
  ): Promise<void> {
    const year = normalizeFinanceYear(this.getFinanceImportCell(row, ['年度', 'year']));
    const fileClass = normalizeFinanceFileClass(
      this.getFinanceImportCell(row, ['文件类型']) || 1,
    );
    const taxCategory = normalizeFinanceTaxCategory(
      this.cleanFinanceText(this.getFinanceImportCell(row, ['税种/报告类别'])),
    );
    const existing = await this.enterpriseFinanceRecordRepo.findOne({
      where: {
        enterpriseId,
        fileClass: fileClass ?? IsNull(),
        recordType: 'tax_audit',
        status: 1,
        taxCategory: taxCategory ?? IsNull(),
        year,
      },
    });
    const entity =
      existing ??
      this.enterpriseFinanceRecordRepo.create({
        enterpriseId,
        recordType: 'tax_audit',
        status: 1,
      });

    Object.assign(entity, {
      fileClass,
      filePath: this.cleanFinanceText(this.getFinanceImportCell(row, ['文件路径'])),
      remark: this.cleanFinanceText(this.getFinanceImportCell(row, ['备注'])),
      taxCategory,
      year,
    });

    await this.enterpriseFinanceRecordRepo.save(entity);
  }

  private async persistFinanceImportResult(
    enterpriseId: string,
    material: EnterpriseMaterialEntity,
    errors: FinanceImportError[],
    summary: FinanceImportSummary,
  ): Promise<void> {
    if (errors.length > 0) {
      await this.enterpriseMaterialParseErrorRepo.save(
        errors.map((error) =>
          this.enterpriseMaterialParseErrorRepo.create({
            enterpriseId,
            errorMessage: error.message,
            fieldName: error.fieldName,
            materialId: material.id,
            rawValue: this.truncateFinanceText(error.rawValue ?? null, 500),
            rowNumber: error.rowNumber,
            sheetName: '财税导入',
            suggestion: error.suggestion ?? null,
          }),
        ),
      );
    }

    Object.assign(material, {
      errorCount: errors.length,
      remark: JSON.stringify(summary),
      status: summary.status,
    });
    await this.enterpriseMaterialRepo.save(material);
  }

  private resolveUploadedFileAbsolutePath(file: StoredUploadFile): null | string {
    const candidates: string[] = [];

    if (file.path) {
      candidates.push(isAbsolute(file.path) ? file.path : join(process.cwd(), file.path));
      const storedPathFromFilePath = normalizeStoredUploadPath(file.path);
      if (storedPathFromFilePath) {
        candidates.push(resolveStoredUploadAbsolutePath(storedPathFromFilePath).absolutePath);
      }
    }

    const storedPathFromFilename = normalizeStoredUploadPath(file.filename);
    if (storedPathFromFilename) {
      candidates.push(join(getUploadRootAbsolutePath(), storedPathFromFilename));
    }

    return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0] ?? null;
  }

  private async assertUploadedFilesBelongToEnterprise(
    enterpriseId: string,
    files: StoredUploadFile[],
    scene: EnterpriseMaterialOwnershipScene,
  ): Promise<void> {
    const enterprise = await this.enterpriseRepo.findOne({ where: { id: enterpriseId } });
    if (!enterprise) {
      await this.removeRejectedUploadedFiles(files);
      throw new NotFoundException('企业不存在');
    }

    for (const file of files) {
      const check = await this.checkUploadedFileOwnership(enterprise, file, scene);
      if (check.status !== 'mismatched') {
        continue;
      }

      await this.removeRejectedUploadedFiles(files);
      const materialLabel = this.getOwnershipSceneLabel(scene);
      throw new BadRequestException(
        `${materialLabel}识别到的企业主体与当前企业不匹配，已停止上传和识别`,
      );
    }
  }

  private async assertStoredMaterialsBelongToEnterprise(
    enterpriseId: string,
    materials: EnterpriseMaterialEntity[],
    scene: EnterpriseMaterialOwnershipScene,
  ): Promise<void> {
    const enterprise = await this.enterpriseRepo.findOne({ where: { id: enterpriseId } });
    if (!enterprise) {
      throw new NotFoundException('企业不存在');
    }

    for (const material of materials) {
      const check = await this.checkUploadedFileOwnership(
        enterprise,
        {
          filename: basename(material.filePath ?? ''),
          originalname: material.fileName ?? '企业材料',
          path: material.filePath ?? undefined,
          size: 0,
        },
        scene,
      );
      if (check.status !== 'mismatched') {
        continue;
      }
      const materialLabel = this.getOwnershipSceneLabel(scene);
      throw new BadRequestException(
        `${materialLabel}识别到的企业主体与当前企业不匹配，已停止识别`,
      );
    }
  }

  private async checkUploadedFileOwnership(
    enterprise: EnterpriseEntity,
    file: StoredUploadFile,
    scene: EnterpriseMaterialOwnershipScene,
  ): Promise<EnterpriseMaterialOwnershipCheck> {
    const text = await this.extractUploadedFileOwnershipText(file);
    const targetCreditCode = String(enterprise.creditCode ?? '')
      .replace(/\s+/gu, '')
      .toUpperCase();
    const creditCodes = [
      ...new Set(
        [...text.matchAll(/(?<![0-9A-Z])[0-9A-Z]{18}(?![0-9A-Z])/giu)]
          .map((match) => match[0]?.toUpperCase() ?? '')
          .filter(Boolean),
      ),
    ];
    const targetNames = [enterprise.name, enterprise.shortName]
      .map((value) => this.normalizeCompanyNameForMatch(value))
      .filter((value) => value.length >= 4);
    const normalizedText = this.normalizeCompanyNameForMatch(text);
    const companyNames = this.extractCompanyNamesFromOwnershipText(text);

    if (scene === 'ip') {
      const rightHolder = this.extractIpRecognitionHintsFromPdfText(text).rightHolder;
      if (rightHolder) {
        const normalizedHolder = this.normalizeCompanyNameForMatch(rightHolder);
        const holderMatched = targetNames.some((name) => normalizedHolder.includes(name));
        return { creditCodes, status: holderMatched ? 'matched' : 'mismatched' };
      }
    }

    const matchedByCreditCode = Boolean(
      targetCreditCode && creditCodes.includes(targetCreditCode),
    );
    const matchedByName = targetNames.some((name) => normalizedText.includes(name));
    if (matchedByCreditCode || matchedByName) {
      return { creditCodes, status: 'matched' };
    }

    return {
      creditCodes,
      status: creditCodes.length > 0 || companyNames.length > 0 ? 'mismatched' : 'unverified',
    };
  }

  private extractCompanyNamesFromOwnershipText(text: string): string[] {
    return [
      ...new Set(
        [
          ...text.matchAll(
            /[A-Za-z0-9\u4E00-\u9FFF（）()·&]{4,80}?(?:有限责任公司|股份有限公司|集团有限公司|有限公司|公司)/gu,
          ),
        ]
          .map((match) => this.normalizeCompanyNameForMatch(match[0]))
          .filter((name) => name.length >= 4),
      ),
    ];
  }

  private async extractUploadedFileOwnershipText(
    file: StoredUploadFile,
  ): Promise<string> {
    const filePath = this.resolveUploadedFileAbsolutePath(file);
    if (!filePath || !existsSync(filePath)) {
      return '';
    }

    const extension = extname(file.originalname || filePath).toLowerCase();
    if (extension === '.pdf') {
      const pdfText = await this.extractPdfTextFromStoredPath(filePath, 'finance');
      return pdfText.status === 'success' ? pdfText.snippet : '';
    }
    if (extension === '.csv') {
      return readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, '').slice(0, 100_000);
    }
    if (!['.xls', '.xlsm', '.xlsx'].includes(extension)) {
      return '';
    }

    try {
      const workbook = await this.readEmployeeWorkbook(filePath);
      const values: string[] = [];
      for (const worksheet of workbook.worksheets) {
        worksheet.eachRow((row: ExcelRow) => {
          values.push(this.extractExcelRowValues(row).join(' '));
        });
      }
      return values.join('\n').slice(0, 100_000);
    } catch {
      return '';
    }
  }

  private async removeRejectedUploadedFiles(files: StoredUploadFile[]): Promise<void> {
    await Promise.all(
      files.map(async (file) => {
        const filePath = this.resolveUploadedFileAbsolutePath(file);
        if (filePath) {
          await rm(filePath, { force: true }).catch(() => undefined);
        }
      }),
    );
  }

  private getOwnershipSceneLabel(scene: EnterpriseMaterialOwnershipScene): string {
    return {
      contract: '合同文件',
      employee: '员工材料',
      finance: '财税文件',
      invoice: '发票文件',
      ip: '知识产权文件',
      material: '材料文件',
    }[scene];
  }

  private getFinanceImportCell(row: FinanceImportRow, labels: string[]): string {
    const normalizedLabels = labels.map((label) => this.normalizeFinanceHeader(label));
    const matchedKey = Object.keys(row).find((key) =>
      normalizedLabels.includes(this.normalizeFinanceHeader(key)),
    );
    return matchedKey ? row[matchedKey].trim() : '';
  }

  private normalizeFinanceHeader(value: string): string {
    return value.replace(/\s+/gu, '').toLowerCase();
  }

  private normalizeFinanceRecordType(value: string): null | 'financial' | 'tax_audit' {
    const text = value.trim().toLowerCase();
    if (['financial', 'finance', '财务', '财务数据', '年度财务数据'].includes(text)) {
      return 'financial';
    }
    if (['tax_audit', 'taxaudit', 'audit', '纳税审计', '审计税务'].includes(text)) {
      return 'tax_audit';
    }
    return null;
  }

  private normalizeFinanceFileClass(value: string): 1 | 2 | 3 {
    const text = value.trim();
    if (text === '1' || text.includes('纳税')) {
      return 1;
    }
    if (text === '2' || text.includes('审计')) {
      return 2;
    }
    return 3;
  }

  private isFinanceAmountLike(value: string): boolean {
    return /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/u.test(value.trim());
  }

  private isFinancePercentLike(value: string): boolean {
    return /^-?\d+(\.\d+)?%?$/u.test(value.trim());
  }

  private cleanFinanceText(value: string): null | string {
    const text = value.trim();
    return text ? this.truncateFinanceText(text, 500) : null;
  }

  private truncateFinanceText(value: null | string, maxLength: number): null | string {
    if (!value) {
      return null;
    }
    return value.length > maxLength ? value.slice(0, maxLength) : value;
  }

  private requireExcelRuntime(): ExcelRuntime {
    try {
      const requireFromHere = createRequire(__filename);
      return requireFromHere('exceljs') as ExcelRuntime;
    } catch {
      throw new BadRequestException(
        '员工 Excel 导入依赖未安装，请先安装 exceljs 或使用后续 CSV 导入版本。',
      );
    }
  }

  private async readEmployeeWorkbook(filePath: string): Promise<ExcelWorkbook> {
    const ExcelJS = this.requireExcelRuntime();
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.readFile(filePath);
      return workbook;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('Unexpected xml node in parseOpen')) {
        throw error;
      }

      const sanitizedWorkbook = new ExcelJS.Workbook();
      await sanitizedWorkbook.xlsx.load(await this.sanitizeExcelCoreXml(filePath));
      return sanitizedWorkbook;
    }
  }

  private async sanitizeExcelCoreXml(filePath: string): Promise<Buffer> {
    const requireFromHere = createRequire(__filename);
    const JSZip = requireFromHere('jszip') as {
      loadAsync: (data: Buffer) => Promise<{
        file: (path: string, data?: string) => null | {
          async: (type: 'string') => Promise<string>;
        };
        generateAsync: (options: { type: 'nodebuffer' }) => Promise<Buffer>;
      }>;
    };
    const zip = await JSZip.loadAsync(readFileSync(filePath));
    const coreFile = zip.file('docProps/core.xml');
    if (!coreFile) {
      throw new BadRequestException('员工花名册文件结构异常，请另存为 .xlsx 后重试。');
    }

    const coreXml = await coreFile.async('string');
    const sanitizedCoreXml = coreXml
      .replace(/<cp:lastModifiedBy\b[^>]*>[\s\S]*?<\/cp:lastModifiedBy>/giu, '')
      .replace(/<lastModifiedBy\b[^>]*>[\s\S]*?<\/lastModifiedBy>/giu, '');
    zip.file('docProps/core.xml', sanitizedCoreXml);
    return zip.generateAsync({ type: 'nodebuffer' });
  }

  private async sendEmployeeTemplateWorkbook(
    response: Response,
    template: BuiltinMaterialTemplate,
  ): Promise<void> {
    const ExcelJS = this.requireExcelRuntime();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'new-kjqb';
    workbook.created = new Date();

    const enterpriseSheet = workbook.addWorksheet('企业信息');
    enterpriseSheet.columns = [
      { header: '企业名称', key: 'name', width: 32 },
      { header: '统一社会信用代码', key: 'creditCode', width: 28 },
    ];
    enterpriseSheet.getRow(1).font = { bold: true };
    enterpriseSheet.addRow({
      creditCode: '请填写18位统一社会信用代码',
      name: '请填写当前企业名称',
    });

    const sheet = workbook.addWorksheet('员工花名册');
    sheet.columns = EMPLOYEE_IMPORT_COLUMNS.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width,
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.addRow({
      annual_work_days: 260,
      department: '研发部',
      education_file: '',
      entry_date: '2024-03-01',
      id_card: '320000199001010000',
      is_active: '是',
      is_kjyf: '是',
      labor_contract_file: '',
      position: '研发工程师',
      rd_projects: 'RD01',
      remark: '示例行，导入前可删除',
      social_security_file: '',
      title_file: '',
      yg_files: '',
      yg_lx: '在职人员',
      yg_lxgg: '否',
      yg_name: '张三',
      yg_nl: '31-40岁',
      yg_qr: '否',
      yg_sex: '男',
      yg_wj: '否',
      yg_xl: '本科',
      yg_zc: '中级职称',
    });

    const helpSheet = workbook.addWorksheet('填写说明');
    helpSheet.columns = [
      { header: '字段', key: 'field', width: 22 },
      { header: '填写说明', key: 'description', width: 72 },
    ];
    helpSheet.getRow(1).font = { bold: true };
    [
      ['员工姓名', '必填。重复导入同一身份证号或同名员工时，会更新原记录。'],
      ['性别', '男、女。'],
      ['员工类型', '在职人员、兼职人员、临时兼职人员、临时聘用人员。'],
      ['是否在职/是否科技人员等', '填写 是/否，也可填写 1/0。'],
      ['学历', '博士、硕士、本科、大专及以下。'],
      ['职称', '高级职称、中级职称、初级职称、高级技工、暂无。'],
      ['年龄段', '30岁以下、31-40岁、41-50岁、50岁及以上。'],
      ['附件字段', '第一版可填写已上传文件 URL 或文件说明，后续可再做批量附件归档。'],
    ].forEach(([field, description]) => helpSheet.addRow({ description, field }));

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(template.fileName)}`,
    );
    const buffer = await workbook.xlsx.writeBuffer();
    response.send(Buffer.from(buffer));
  }

  private async importEmployeeMaterial(
    userId: number,
    enterpriseId: string,
    material: EnterpriseMaterialEntity,
    file: StoredUploadFile,
  ): Promise<void> {
    await this.enterpriseMaterialParseErrorRepo.delete({
      enterpriseId,
      materialId: material.id,
    });

    const extension = extname(file.originalname || '').toLowerCase();
    if (!['.xlsx', '.xlsm', '.xls'].includes(extension)) {
      const errors: EmployeeImportError[] = [
        {
          fieldName: 'file',
          message: '员工导入仅支持 Excel 文件',
          rawValue: file.originalname,
          rowNumber: 1,
          suggestion: '请下载员工花名册模板，填写后上传 .xlsx 文件。',
        },
      ];
      await this.persistEmployeeImportResult(enterpriseId, material, errors, {
        employeeCount: 0,
        errorCount: errors.length,
        status: 'invalid',
      });
      return;
    }

    const filePath = this.resolveUploadedFileAbsolutePath(file);
    if (!filePath || !existsSync(filePath)) {
      const errors: EmployeeImportError[] = [
        {
          fieldName: 'file',
          message: '上传文件不存在或无法读取',
          rawValue: file.originalname,
          rowNumber: 1,
          suggestion: '请重新上传员工花名册模板文件。',
        },
      ];
      await this.persistEmployeeImportResult(enterpriseId, material, errors, {
        employeeCount: 0,
        errorCount: errors.length,
        status: 'invalid',
      });
      return;
    }

    const workbook = await this.readEmployeeWorkbook(filePath);
    const { errors, rows } = this.parseEmployeeWorkbook(workbook);
    let employeeCount = 0;

    for (const row of rows) {
      const rowErrors = this.validateEmployeeImportRow(row);
      errors.push(...rowErrors);
      if (rowErrors.length > 0) {
        continue;
      }

      await this.upsertEmployeeImportRow(enterpriseId, row);
      employeeCount += 1;
    }

    const summary: EmployeeImportSummary = {
      employeeCount,
      errorCount: errors.length,
      status:
        errors.length === 0
          ? 'valid'
          : employeeCount > 0
            ? 'partial'
            : 'invalid',
    };
    await this.persistEmployeeImportResult(enterpriseId, material, errors, summary);
    if (userId > 0 && employeeCount > 0) {
      await this.recalculateEnterpriseProfileStats(enterpriseId);
    }
  }

  private async buildAndPersistEmployeeImportPreview(
    enterpriseId: string,
    material: EnterpriseMaterialEntity,
    file: StoredUploadFile,
  ): Promise<EmployeeImportPreviewResult> {
    await this.enterpriseMaterialParseErrorRepo.delete({
      enterpriseId,
      materialId: material.id,
    });

    const preview = {
      ...(await this.buildEmployeeImportPreview(enterpriseId, file)),
      materialId: String(material.id),
    };
    await this.persistEmployeeImportPreview(enterpriseId, material, preview);
    return preview;
  }

  private async buildEmployeeImportPreview(
    enterpriseId: string,
    file: StoredUploadFile,
  ): Promise<EmployeeImportPreviewResult> {
    const extension = extname(file.originalname || '').toLowerCase();
    if (!['.pdf', '.xlsx', '.xlsm', '.xls'].includes(extension)) {
      const errors: EmployeeImportError[] = [
        {
          fieldName: 'file',
          message: '员工导入仅支持 Excel 或社保 PDF 文件',
          rawValue: file.originalname,
          rowNumber: 1,
          suggestion: '请上传员工花名册 Excel，或参保单位社保权益记录单 PDF。',
        },
      ];
      return this.createEmployeeImportPreviewResult('', [], errors);
    }

    const filePath = this.resolveUploadedFileAbsolutePath(file);
    if (!filePath || !existsSync(filePath)) {
      const errors: EmployeeImportError[] = [
        {
          fieldName: 'file',
          message: '上传文件不存在或无法读取',
          rawValue: file.originalname,
          rowNumber: 1,
          suggestion: '请重新上传员工花名册模板文件。',
        },
      ];
      return this.createEmployeeImportPreviewResult('', [], errors);
    }

    const { errors, rows } = extension === '.pdf'
      ? await this.parseSocialSecurityEmployeePdf(filePath, file)
      : this.parseEmployeeWorkbook(await this.readEmployeeWorkbook(filePath));
    const previewRows: EmployeeImportPreviewRow[] = [];
    const fileDuplicateKeys = new Set<string>();
    const seenKeys = new Map<string, string>();

    for (const row of rows) {
      const rowErrors = this.validateEmployeeImportRow(row);
      const data = this.toEmployeeImportPayload(row);
      const rowNumber = Number(row.__rowNumber || 1);
      const sheetName = row.__sheetName || '员工花名册';
      const duplicateKey = this.getEmployeeDuplicateKey(data);
      if (duplicateKey) {
        const firstKey = seenKeys.get(duplicateKey);
        if (firstKey) {
          fileDuplicateKeys.add(firstKey);
          fileDuplicateKeys.add(`${sheetName}:${rowNumber}`);
        } else {
          seenKeys.set(duplicateKey, `${sheetName}:${rowNumber}`);
        }
      }
      const existing = rowErrors.length
        ? null
        : await this.findExistingEmployeeForImport(enterpriseId, data);

      previewRows.push({
        action: rowErrors.length > 0 ? 'error' : existing ? 'update' : 'create',
        data,
        errors: rowErrors,
        importable: rowErrors.length === 0,
        key: `${sheetName}:${rowNumber}`,
        matchedEmployeeId: existing ? String(existing.id) : null,
        rowNumber,
        sheetName,
      });
    }

    const rowsWithDuplicateWarnings = previewRows.map((row) => {
      if (!fileDuplicateKeys.has(row.key) || row.errors.length > 0) {
        return row;
      }
      return {
        ...row,
        errors: [
          ...row.errors,
          {
            fieldName: '员工姓名',
            message: '导入文件内存在疑似重复员工',
            rowNumber: row.rowNumber,
            sheetName: row.sheetName,
            suggestion: '请确认重复行，系统默认仍可导入，后出现的记录会覆盖前面的同一员工。',
          },
        ],
      };
    });

    return this.createEmployeeImportPreviewResult(
      '',
      rowsWithDuplicateWarnings,
      errors,
      this.buildEmployeeImportPreviewSource(file, rows),
    );
  }

  private async importPropertyMaterial(
    userId: number,
    enterpriseId: string,
    material: EnterpriseMaterialEntity,
    file: StoredUploadFile,
    templateId: string,
  ): Promise<void> {
    await this.enterpriseMaterialParseErrorRepo.delete({
      enterpriseId,
      materialId: material.id,
    });

    const config = this.getPropertyImportConfig(templateId);
    const extension = extname(file.originalname || '').toLowerCase();
    if (extension !== '.csv') {
      const errors: FinanceImportError[] = [
        {
          fieldName: 'file',
          message: '当前模板导入仅支持 CSV 文件',
          rawValue: file.originalname,
          rowNumber: 1,
          suggestion: '请下载对应模板，使用 Excel 填写后另存为 CSV 再上传。',
        },
      ];
      await this.persistPropertyImportResult(enterpriseId, material, errors, 0);
      return;
    }

    const filePath = this.resolveUploadedFileAbsolutePath(file);
    if (!filePath || !existsSync(filePath)) {
      const errors: FinanceImportError[] = [
        {
          fieldName: 'file',
          message: '上传文件不存在或无法读取',
          rawValue: file.originalname,
          rowNumber: 1,
          suggestion: '请重新上传模板文件。',
        },
      ];
      await this.persistPropertyImportResult(enterpriseId, material, errors, 0);
      return;
    }

    const content = readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, '');
    const { errors, rows } = this.parsePropertyCsv(content);
    let successCount = 0;
    const recordConfig = this.getProfileRecordConfig('property', config.tabKey);

    for (const row of rows) {
      const rowNumber = Number(row.__rowNumber || 1);
      const nameValue = this.getImportCell(row, config.nameLabels);
      if (!nameValue) {
        errors.push({
          fieldName: config.nameLabels[0],
          message: `${config.nameLabels[0]}不能为空`,
          rowNumber,
          suggestion: '请填写名称后再导入。',
        });
        continue;
      }

      const payload = Object.fromEntries(
        Object.entries(config.fields).map(([payloadField, labels]) => [
          payloadField,
          this.getImportCell(row, labels),
        ]),
      );
      const existing = await this.enterprisePropertyRecordRepo.findOne({
        where: {
          enterpriseId,
          recordType: recordConfig.recordType,
          status: 1,
          [config.entityNameField]: nameValue,
        },
      });
      const entity =
        existing ??
        this.enterprisePropertyRecordRepo.create({
          enterpriseId,
          recordType: recordConfig.recordType,
          status: 1,
        });
      Object.assign(entity, this.toProfileRecordEntityData(payload, recordConfig));
      await this.enterprisePropertyRecordRepo.save(entity);
      successCount += 1;
    }

    await this.persistPropertyImportResult(enterpriseId, material, errors, successCount);
    if (userId > 0 && successCount > 0) {
      await this.recalculateClientEnterpriseProfileStats(userId);
    }
  }

  private parsePropertyCsv(content: string): {
    errors: FinanceImportError[];
    rows: FinanceImportRow[];
  } {
    return this.parseFinanceCsv(content);
  }

  private getImportCell(row: FinanceImportRow, labels: string[]): string {
    const normalizedLabels = labels.map((label) => this.normalizeFinanceHeader(label));
    const matchedKey = Object.keys(row).find((key) =>
      normalizedLabels.includes(this.normalizeFinanceHeader(key)),
    );
    return matchedKey ? row[matchedKey].trim() : '';
  }

  private async persistPropertyImportResult(
    enterpriseId: string,
    material: EnterpriseMaterialEntity,
    errors: FinanceImportError[],
    successCount: number,
  ): Promise<void> {
    if (errors.length > 0) {
      await this.enterpriseMaterialParseErrorRepo.save(
        errors.map((error) =>
          this.enterpriseMaterialParseErrorRepo.create({
            enterpriseId,
            errorMessage: error.message,
            fieldName: error.fieldName,
            materialId: material.id,
            rawValue: this.truncateFinanceText(error.rawValue ?? null, 500),
            rowNumber: error.rowNumber,
            sheetName: '研发与知识产权导入',
            suggestion: error.suggestion ?? null,
          }),
        ),
      );
    }

    const status =
      errors.length === 0 ? 'valid' : successCount > 0 ? 'partial' : 'invalid';
    Object.assign(material, {
      errorCount: errors.length,
      remark: JSON.stringify({
        errorCount: errors.length,
        status,
        successCount,
      }),
      status,
    });
    await this.enterpriseMaterialRepo.save(material);
  }

  private getPropertyImportConfig(templateId: string) {
    const configs = {
      'ip-info': {
        entityNameField: 'softWorkName',
        fields: {
          advanced_degree: ['技术先进程度'],
          apply_date: ['申请日期'],
          authorize_date: ['授权日期'],
          inventor: ['发明人/著作权人', '发明人'],
          ip_level: ['I/II类', 'IP类别'],
          ip_tech_category: ['技术类目', '技术领域'],
          is_core_ip: ['核心IP'],
          obtain_method: ['获得方式'],
          related_ps_ids: ['关联PS'],
          related_rd_ids: ['关联RD'],
          related_transformation_ids: ['关联成果'],
          remark: ['备注'],
          right_holder: ['权利人'],
          soft_work_file: ['证书文件'],
          soft_work_name: ['知识产权名称', '名称'],
          soft_work_num: ['登记号/专利号', '编号'],
          soft_work_status: ['状态'],
          soft_work_type: ['类型'],
          support_effect: ['核心支持程度'],
        },
        nameLabels: ['知识产权名称', '名称'],
        tabKey: 'intellectualProperty',
      },
      'rd-info': {
        entityNameField: 'kyProjectName',
        fields: {
          core_technology: ['核心技术'],
          end_date: ['结题日期', '结束日期'],
          fund_amount: ['项目经费'],
          fund_source: ['资金来源'],
          innovation_points: ['创新点'],
          init_date: ['立项日期', '开始日期'],
          ky_project_des: ['项目描述'],
          ky_project_leader: ['项目负责人'],
          ky_project_name: ['项目名称'],
          ky_project_num: ['项目编号'],
          ky_project_status: ['项目状态'],
          lxbg_file: ['立项报告'],
          project_type: ['项目类型'],
          rd_budget: ['研发预算'],
          rd_expense_total: ['研发费用'],
          rd_organization_method: ['组织实施方式'],
          related_ip_ids: ['关联IP'],
          related_ps_ids: ['关联PS'],
          related_transformation_ids: ['关联成果'],
          stage_result: ['阶段成果'],
        },
        nameLabels: ['项目名称'],
        tabKey: 'researchProject',
      },
      'ps-info': {
        entityNameField: 'psName',
        fields: {
          competitive_advantage: ['竞争优势'],
          high_tech_income: ['高新收入'],
          last_year_income: ['上年度收入'],
          proof_files: ['证明材料'],
          ps_code: ['PS编号'],
          ps_name: ['产品/服务名称', 'PS名称'],
          related_contract_ids: ['关联合同'],
          related_invoice_ids: ['关联发票'],
          related_ip_ids: ['关联IP'],
          related_rd_ids: ['关联RD'],
          related_transformation_ids: ['关联成果'],
          remark: ['备注'],
          tech_description: ['关键技术'],
          tech_field: ['技术领域'],
          tech_index: ['技术指标'],
          tech_source: ['技术来源'],
        },
        nameLabels: ['产品/服务名称', 'PS名称'],
        tabKey: 'productService',
      },
      'transformation-info': {
        entityNameField: 'transformationName',
        fields: {
          application_scene: ['应用场景'],
          customer_name: ['客户名称'],
          proof_files: ['证明材料'],
          related_contract_ids: ['关联合同'],
          related_invoice_ids: ['关联发票'],
          related_ip_ids: ['关联IP'],
          related_ps_ids: ['关联PS'],
          related_rd_ids: ['关联RD'],
          remark: ['备注'],
          transformation_code: ['成果编号'],
          transformation_income: ['转化收入'],
          transformation_method: ['转化方式'],
          transformation_name: ['成果名称'],
        },
        nameLabels: ['成果名称'],
        tabKey: 'transformation',
      },
    };
    const config = configs[templateId as keyof typeof configs];
    if (!config) {
      throw new BadRequestException('不支持的研发与知识产权导入模板');
    }
    return config;
  }

  private async parseSocialSecurityEmployeePdf(
    filePath: string,
    file: StoredUploadFile,
  ): Promise<{
    errors: EmployeeImportError[];
    rows: EmployeeImportRow[];
  }> {
    const pdfText = await this.extractPdfTextFromStoredPath(
      filePath,
      'social_security',
    );
    if (pdfText.status === 'success') {
      const rows = this.parseSocialSecurityEmployeePdfText(pdfText.snippet, file);
      if (rows.length > 0) {
        return { errors: [], rows };
      }
    }

    const visionRows = await this.parseSocialSecurityEmployeePdfWithVision(
      filePath,
      file,
    );
    if (visionRows.length > 0) {
      return { errors: [], rows: visionRows };
    }

    return {
      errors: [
        {
          fieldName: 'file',
          message: '未能从 PDF 中识别员工明细',
          rawValue: file.originalname,
          rowNumber: 1,
          sheetName: '社保权益记录单',
          suggestion:
            '请确认文件为参保单位社保权益记录单；扫描件识别还需要配置 AI_API_KEY、AI_VISION_MODEL 和 PDFTOPPM_PATH。',
        },
      ],
      rows: [],
    };
  }

  private parseSocialSecurityEmployeePdfText(
    text: string,
    file: StoredUploadFile,
  ): EmployeeImportRow[] {
    const queryPeriod = this.extractSocialSecurityPdfPeriod(text);
    const companyName = text.match(
      /参保单位全称[:：]\s*(.+?)(?=现参保地|统一社会信用代码|\n)/u,
    )?.[1]?.trim() ?? '';
    const creditCode = text.match(
      /统一社会信用代码[:：]\s*([0-9A-Z]{18})/iu,
    )?.[1]?.toUpperCase() ?? '';
    const socialSecurityFile = normalizeStoredUploadPath(file.path) ?? '';
    const rowPattern = /^\s*(\d{1,4})\s*([\p{Script=Han}·]{2,30})\s*(\d{17}[\dXx])\s*(\d{6})\s*(?:-|—|–|至|~|～)\s*(\d{6})\s*(\d{1,2})\s*$/u;
    const rows: EmployeeImportRow[] = [];

    for (const line of text.split('\n')) {
      const matched = line.match(rowPattern);
      if (!matched) {
        continue;
      }
      const [, sequence = '', name = '', idCard = '', start = '', end = '', months = ''] = matched;
      rows.push({
        __rowNumber: sequence,
        __sheetName: '社保权益记录单',
        员工姓名: name.trim(),
        身份证号: idCard.toUpperCase(),
        是否在职: '是',
        是否科技人员: '否',
        员工类型: '在职人员',
        社保附件: socialSecurityFile,
        备注: [
          companyName ? `参保单位：${companyName}` : '',
          creditCode ? `统一社会信用代码：${creditCode}` : '',
          queryPeriod ? `社保查询期间：${queryPeriod}` : '',
          `缴费期间：${start}-${end}`,
          `缴费月数：${months}`,
        ].filter(Boolean).join('；'),
      });
    }

    return rows;
  }

  private async parseSocialSecurityEmployeePdfWithVision(
    filePath: string,
    file: StoredUploadFile,
  ): Promise<EmployeeImportRow[]> {
    if (
      process.env.AI_EMPLOYEE_PDF_VISION_ENABLE === '0' ||
      !process.env.AI_API_KEY ||
      !process.env.AI_VISION_MODEL
    ) {
      return [];
    }

    try {
      const maxPages = this.resolvePositiveIntegerEnv(
        'AI_EMPLOYEE_PDF_MAX_PAGES',
        5,
        1,
        20,
      );
      const imageDataUrls = await this.renderPdfPagesToImageDataUrls(
        filePath,
        maxPages,
      );
      const results = await Promise.all(
        imageDataUrls.map((imageDataUrl, index) =>
          this.aiService.runVisionJsonCompletion({
            imageDataUrl,
            outputSchema: this.getSocialSecurityVisionOutputSchema(),
            scene: 'employee_social_security_pdf_vision',
            systemPrompt: this.getSocialSecurityVisionSystemPrompt(),
            taskId: `employee-social-security-${Date.now()}-${index + 1}`,
            userPrompt: [
              `文件名：${file.originalname}`,
              `当前为第 ${index + 1} 页。`,
              '请逐行识别社保权益记录中的员工姓名、完整身份证号、缴费起止年月和缴费月数。',
              '返回结构固定为：{"document_type":"社保权益记录单","company_name":"参保单位全称","credit_code":"18位统一社会信用代码","query_period":"YYYYMM-YYYYMM","employees":[{"name":"姓名","id_card":"18位身份证号","payment_start":"YYYYMM","payment_end":"YYYYMM","payment_months":"数字"}]}。',
              '只返回 JSON，不要输出 Markdown；无法确认的字段留空，不要猜测。',
            ].join('\n'),
          }),
        ),
      );
      const socialSecurityFile = normalizeStoredUploadPath(file.path) ?? '';
      let rowNumber = 0;

      return results.flatMap((result) => {
        const employees = Array.isArray(result.structuredResult.employees)
          ? result.structuredResult.employees
          : Array.isArray(result.structuredResult.records)
            ? result.structuredResult.records
            : [];
        const queryPeriod = this.toNullableStringFromUnknown(
          result.structuredResult.query_period,
        );
        const companyName = this.toNullableStringFromUnknown(
          result.structuredResult.company_name,
        );
        const creditCode = this.toNullableStringFromUnknown(
          result.structuredResult.credit_code,
        );

        return employees
          .filter(
            (employee): employee is Record<string, unknown> =>
              Boolean(employee) &&
              typeof employee === 'object' &&
              !Array.isArray(employee),
          )
          .map((employee) => {
            rowNumber += 1;
            const name = this.toNullableStringFromUnknown(
              employee.name ?? employee.employee_name,
            ) ?? '';
            const idCard = String(
              employee.id_card ?? employee.citizen_id ?? '',
            ).replace(/\s+/gu, '').toUpperCase();
            const paymentStart = this.toNullableStringFromUnknown(
              employee.payment_start,
            );
            const paymentEnd = this.toNullableStringFromUnknown(
              employee.payment_end,
            );
            const paymentMonths = this.toNullableStringFromUnknown(
              employee.payment_months,
            );

            return {
              __rowNumber: String(rowNumber),
              __sheetName: '社保权益记录单',
              员工姓名: name,
              身份证号: idCard,
              是否在职: '是',
              是否科技人员: '否',
              员工类型: '在职人员',
              社保附件: socialSecurityFile,
              备注: [
                companyName ? `参保单位：${companyName}` : '',
                creditCode ? `统一社会信用代码：${creditCode}` : '',
                queryPeriod ? `社保查询期间：${queryPeriod}` : '',
                paymentStart || paymentEnd
                  ? `缴费期间：${paymentStart ?? ''}-${paymentEnd ?? ''}`
                  : '',
                paymentMonths ? `缴费月数：${paymentMonths}` : '',
                `视觉模型：${result.model}`,
              ].filter(Boolean).join('；'),
            };
          });
      });
    } catch (error) {
      console.warn(
        '[EMPLOYEE_SOCIAL_SECURITY_VISION_FAILED]',
        this.resolveErrorMessage(error),
      );
      return [];
    }
  }

  private getSocialSecurityVisionOutputSchema(): Record<string, unknown> {
    return {
      company_name: '参保单位全称，缺失则为空字符串',
      credit_code: '18位统一社会信用代码，缺失则为空字符串',
      document_type: '社保权益记录单或其他',
      query_period: '查询期间，例如 202501-202512，缺失则为空字符串',
      employees: [
        {
          id_card: '完整的18位公民身份证号码，无法确认则为空字符串',
          name: '员工姓名',
          payment_end: '缴费结束年月，YYYYMM 或空字符串',
          payment_months: '缴费月数，数字或空字符串',
          payment_start: '缴费开始年月，YYYYMM 或空字符串',
        },
      ],
    };
  }

  private getSocialSecurityVisionSystemPrompt(): string {
    return [
      '你是中国企业社保权益记录单视觉识别助手。',
      '只根据用户提供的 PDF 页面图片逐行识别员工明细，不要联网，不要补全或猜测身份证号。',
      '身份证号属于敏感字段，只有18位全部清晰时才返回；末位字母统一大写。',
      '缴费起止年月统一为 YYYYMM，缴费月数只返回数字。',
      '必须只返回 JSON 对象，不要输出 Markdown。',
    ].join('\n');
  }

  private extractSocialSecurityPdfPeriod(text: string): string {
    const matched = text.match(
      /查询时间[:：]\s*(\d{6})\s*(?:-|—|–|至|~|～)\s*(\d{6})/u,
    );
    return matched ? `${matched[1]}-${matched[2]}` : '';
  }

  private parseEmployeeWorkbook(workbook: ExcelWorkbook): {
    errors: EmployeeImportError[];
    rows: EmployeeImportRow[];
  } {
    const worksheet =
      workbook.getWorksheet('员工花名册') ?? workbook.worksheets[0] ?? null;
    if (!worksheet) {
      return {
        errors: [
          {
            fieldName: null,
            message: 'Excel 中没有可读取的工作表',
            rowNumber: 1,
            suggestion: '请使用员工花名册模板填写后重新上传。',
          },
        ],
        rows: [],
      };
    }

    const headerRow = worksheet.getRow(1);
    const headers = this.extractExcelRowValues(headerRow);
    if (this.isSocialSecurityEmployeeWorksheet(worksheet, headers)) {
      return this.parseSocialSecurityEmployeeWorksheet(worksheet);
    }

    const rows: EmployeeImportRow[] = [];

    worksheet.eachRow((row: ExcelRow, rowNumber: number) => {
      if (rowNumber === 1) {
        return;
      }

      const cells = this.extractExcelRowValues(row);
      if (!cells.some((cell) => cell.trim())) {
        return;
      }

      const item = headers.reduce<EmployeeImportRow>(
        (record, header, index) => {
          record[header] = cells[index]?.trim() ?? '';
          return record;
        },
        {
          __rowNumber: String(rowNumber),
          __sheetName: worksheet.name,
        },
      );
      rows.push(item);
    });

    if (rows.length === 0) {
      return {
        errors: [
          {
            fieldName: null,
            message: '文件中没有可导入的数据行',
            rowNumber: 1,
            sheetName: worksheet.name,
            suggestion: '请保留模板表头，并至少填写一行员工数据。',
          },
        ],
        rows: [],
      };
    }

    return { errors: [], rows };
  }

  private isSocialSecurityEmployeeWorksheet(
    worksheet: ExcelWorksheet,
    firstRowHeaders: string[],
  ): boolean {
    const title = firstRowHeaders.join('').trim();
    const thirdRowHeaders = this.extractExcelRowValues(worksheet.getRow(3)).map(
      (header) => this.normalizeEmployeeHeader(header),
    );
    return (
      title.includes('单位社保费职工全险种申报明细') ||
      (thirdRowHeaders.includes('姓名') && thirdRowHeaders.includes('证件号码'))
    );
  }

  private parseSocialSecurityEmployeeWorksheet(worksheet: ExcelWorksheet): {
    errors: EmployeeImportError[];
    rows: EmployeeImportRow[];
  } {
    const headerCells = this.extractExcelRowValues(worksheet.getRow(3));
    const nameIndex = this.findEmployeeHeaderIndex(headerCells, ['姓名']);
    const certificateTypeIndex = this.findEmployeeHeaderIndex(headerCells, [
      '证件类型',
    ]);
    const certificateNoIndex = this.findEmployeeHeaderIndex(headerCells, [
      '证件号码',
    ]);

    if (nameIndex < 0 || certificateNoIndex < 0) {
      return {
        errors: [
          {
            fieldName: null,
            message: '社保明细表头无法识别',
            rowNumber: 3,
            sheetName: worksheet.name,
            suggestion: '请确认第 3 行包含“姓名”和“证件号码”列。',
          },
        ],
        rows: [],
      };
    }

    const period = this.extractSocialSecurityPeriod(worksheet);
    const rows: EmployeeImportRow[] = [];

    worksheet.eachRow((row: ExcelRow, rowNumber: number) => {
      if (rowNumber <= 4) {
        return;
      }

      const cells = this.extractExcelRowValues(row);
      const name = cells[nameIndex]?.trim() ?? '';
      const certificateNo = cells[certificateNoIndex]?.trim() ?? '';
      const certificateType =
        certificateTypeIndex >= 0 ? (cells[certificateTypeIndex]?.trim() ?? '') : '';
      if (!name && !certificateNo) {
        return;
      }

      const remarkItems = [
        certificateType ? `社保申报证件类型：${certificateType}` : '',
        period ? `费款所属期：${period}` : '',
      ].filter(Boolean);

      rows.push({
        __rowNumber: String(rowNumber),
        __sheetName: worksheet.name,
        员工姓名: name,
        身份证号: certificateNo,
        是否在职: '是',
        是否科技人员: '否',
        员工类型: '在职人员',
        备注: remarkItems.join('；'),
      });
    });

    if (rows.length === 0) {
      return {
        errors: [
          {
            fieldName: null,
            message: '社保明细中没有可导入的员工数据行',
            rowNumber: 5,
            sheetName: worksheet.name,
            suggestion: '当前文件只有表头，没有第 5 行及之后的员工明细数据。',
          },
        ],
        rows: [],
      };
    }

    return { errors: [], rows };
  }

  private findEmployeeHeaderIndex(headers: string[], labels: string[]): number {
    const normalizedLabels = labels.map((label) => this.normalizeEmployeeHeader(label));
    return headers.findIndex((header) =>
      normalizedLabels.includes(this.normalizeEmployeeHeader(header)),
    );
  }

  private extractSocialSecurityPeriod(worksheet: ExcelWorksheet): string {
    const secondRowText = this.extractExcelRowValues(worksheet.getRow(2)).join(' ');
    const matched = secondRowText.match(/费款所属期[:：]\s*([0-9-]+)/u);
    return matched?.[1] ?? '';
  }

  private extractExcelRowValues(row: ExcelRow): string[] {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    return values.map((value: unknown) => this.stringifyExcelCell(value));
  }

  private stringifyExcelCell(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }
    if (value instanceof Date) {
      return this.formatDate(value) ?? '';
    }
    if (typeof value === 'object') {
      const candidate = value as {
        result?: unknown;
        richText?: Array<{ text?: string }>;
        text?: unknown;
      };
      if (candidate.text !== undefined) {
        return String(candidate.text);
      }
      if (candidate.result !== undefined) {
        return String(candidate.result);
      }
      if (Array.isArray(candidate.richText)) {
        return candidate.richText.map((item) => item.text ?? '').join('');
      }
    }
    return String(value);
  }

  private validateEmployeeImportRow(row: EmployeeImportRow): EmployeeImportError[] {
    const rowNumber = Number(row.__rowNumber || 1);
    const sheetName = row.__sheetName || '员工花名册';
    const errors: EmployeeImportError[] = [];
    const name = this.getEmployeeImportCell(row, ['员工姓名', '姓名', 'yg_name']);
    const idCard = this.getEmployeeImportCell(row, ['身份证号', 'id_card']);
    const annualWorkDays = this.getEmployeeImportCell(row, [
      '全年工作天数',
      'annual_work_days',
    ]);

    if (!name) {
      errors.push({
        fieldName: '员工姓名',
        message: '员工姓名不能为空',
        rowNumber,
        sheetName,
        suggestion: '请填写员工真实姓名。',
      });
    }

    if (sheetName === '社保权益记录单' && !idCard) {
      errors.push({
        fieldName: '身份证号',
        message: '社保记录中的身份证号不能为空',
        rowNumber,
        sheetName,
        suggestion: '请核对 PDF 清晰度，确认完整的18位身份证号后再导入。',
      });
    }

    if (idCard && !/^[0-9A-Za-z]{6,32}$/u.test(idCard)) {
      errors.push({
        fieldName: '身份证号',
        message: '身份证号格式不正确',
        rawValue: idCard,
        rowNumber,
        sheetName,
        suggestion: '请填写 6-32 位证件号码，身份证可填写 18 位号码。',
      });
    } else if (
      /^\d{17}[\dXx]$/u.test(idCard) &&
      !parseChineseIdCard(idCard)
    ) {
      errors.push({
        fieldName: '身份证号',
        message: '身份证号出生日期或校验位不正确',
        rawValue: idCard,
        rowNumber,
        sheetName,
        suggestion: '请对照原件核对18位身份证号。',
      });
    }

    if (annualWorkDays && !/^\d+$/u.test(annualWorkDays)) {
      errors.push({
        fieldName: '全年工作天数',
        message: '全年工作天数应为整数',
        rawValue: annualWorkDays,
        rowNumber,
        sheetName,
        suggestion: '请填写整数，例如 260。',
      });
    }

    return errors;
  }

  private async upsertEmployeeImportRow(
    enterpriseId: string,
    row: EmployeeImportRow,
  ): Promise<void> {
    await this.upsertEmployeeImportData(
      enterpriseId,
      this.toEmployeeImportPayload(row),
    );
  }

  private async upsertEmployeeImportData(
    enterpriseId: string,
    data: EmployeeImportPayload,
  ): Promise<{ action: 'create' | 'update'; entity: EnterpriseEmployeeRecordEntity }> {
    const existing = await this.findExistingEmployeeForImport(enterpriseId, data);
    const entity =
      existing ??
      this.enterpriseEmployeeRecordRepo.create({
        enterpriseId,
        status: 1,
      });

    Object.assign(entity, {
      annualWorkDays: data.annual_work_days,
      department: data.department,
      educationFile: data.education_file,
      entryDate: data.entry_date,
      idCard: data.id_card,
      isActive: data.is_active,
      isKjyf: data.is_kjyf,
      laborContractFile: data.labor_contract_file,
      position: data.position,
      rdProjects: data.rd_projects,
      remark: data.remark,
      socialSecurityFile: data.social_security_file,
      titleFile: data.title_file,
      ygFiles: data.yg_files,
      ygLx: data.yg_lx,
      ygLxgg: data.yg_lxgg,
      ygName: data.yg_name,
      ygNl: data.yg_nl,
      ygQr: data.yg_qr,
      ygSex: data.yg_sex,
      ygWj: data.yg_wj,
      ygXl: data.yg_xl,
      ygZc: data.yg_zc,
    });

    return {
      action: existing ? 'update' : 'create',
      entity: await this.enterpriseEmployeeRecordRepo.save(entity),
    };
  }

  private toEmployeeImportPayload(row: EmployeeImportRow): EmployeeImportPayload {
    const name = this.getEmployeeImportCell(row, ['员工姓名', '姓名', 'yg_name']);
    const idCard = this.cleanEmployeeText(
      this.getEmployeeImportCell(row, ['身份证号', 'id_card'])
        .replace(/\s+/gu, '')
        .toUpperCase(),
      32,
    );
    const identity = parseChineseIdCard(idCard);
    return {
      annual_work_days: this.toNullableInteger(
        this.getEmployeeImportCell(row, ['全年工作天数', 'annual_work_days']),
      ),
      department: this.cleanEmployeeText(
        this.getEmployeeImportCell(row, ['部门', 'department']),
        128,
      ),
      education_file: this.cleanEmployeeText(
        this.getEmployeeImportCell(row, ['学历附件', 'education_file']),
        500,
      ),
      entry_date: this.cleanEmployeeText(
        this.getEmployeeImportCell(row, ['入职日期', 'entry_date']),
        32,
      ),
      id_card: idCard,
      is_active: this.normalizeYesNoValue(
        this.getEmployeeImportCell(row, ['是否在职', 'is_active']),
        1,
      ),
      is_kjyf: this.normalizeYesNoValue(
        this.getEmployeeImportCell(row, ['是否科技人员', '科研人员', 'is_kjyf']),
        0,
      ),
      labor_contract_file: this.cleanEmployeeText(
        this.getEmployeeImportCell(row, ['劳动合同附件', 'labor_contract_file']),
        500,
      ),
      position: this.cleanEmployeeText(
        this.getEmployeeImportCell(row, ['岗位', 'position']),
        128,
      ),
      rd_projects: this.cleanEmployeeText(
        this.getEmployeeImportCell(row, ['参与RD项目', 'rd_projects']),
        500,
      ),
      remark: this.cleanEmployeeText(
        this.getEmployeeImportCell(row, ['备注', 'remark']),
        500,
      ),
      social_security_file: this.cleanEmployeeText(
        this.getEmployeeImportCell(row, ['社保附件', 'social_security_file']),
        500,
      ),
      title_file: this.cleanEmployeeText(
        this.getEmployeeImportCell(row, ['职称附件', 'title_file']),
        500,
      ),
      yg_files: this.cleanEmployeeText(
        this.getEmployeeImportCell(row, ['员工综合附件', '员工附件', 'yg_files']),
        500,
      ),
      yg_lx: this.normalizeEmployeeType(
        this.getEmployeeImportCell(row, ['员工类型', 'yg_lx']),
      ),
      yg_lxgg: this.normalizeYesNoValue(
        this.getEmployeeImportCell(row, ['留学归国人员', 'yg_lxgg']),
        0,
      ),
      yg_name: name,
      yg_nl:
        this.normalizeAgeRange(
          this.getEmployeeImportCell(row, ['年龄段', 'yg_nl']),
        ) ?? identity?.ageRange ?? null,
      yg_qr: this.normalizeYesNoValue(
        this.getEmployeeImportCell(row, ['千人计划人员', 'yg_qr']),
        0,
      ),
      yg_sex:
        this.normalizeGender(
          this.getEmployeeImportCell(row, ['性别', 'yg_sex']),
        ) ?? identity?.gender ?? null,
      yg_wj: this.normalizeYesNoValue(
        this.getEmployeeImportCell(row, ['外籍人员', 'yg_wj']),
        0,
      ),
      yg_xl: this.normalizeEducation(this.getEmployeeImportCell(row, ['学历', 'yg_xl'])),
      yg_zc: this.normalizeJobTitle(this.getEmployeeImportCell(row, ['职称', 'yg_zc'])),
    };
  }

  private async findExistingEmployeeForImport(
    enterpriseId: string,
    data: EmployeeImportPayload,
  ): Promise<EnterpriseEmployeeRecordEntity | null> {
    if (data.id_card) {
      return this.enterpriseEmployeeRecordRepo.findOne({
        where: {
          enterpriseId,
          idCard: data.id_card,
          status: 1,
        },
      });
    }

    if (data.yg_name && data.department && data.position) {
      const matchedByRole = await this.enterpriseEmployeeRecordRepo.findOne({
        where: {
          department: data.department,
          enterpriseId,
          position: data.position,
          status: 1,
          ygName: data.yg_name,
        },
      });
      if (matchedByRole) {
        return matchedByRole;
      }
    }

    return this.enterpriseEmployeeRecordRepo.findOne({
      where: {
        enterpriseId,
        status: 1,
        ygName: data.yg_name,
      },
    });
  }

  private getEmployeeDuplicateKey(data: EmployeeImportPayload): null | string {
    if (data.id_card) {
      return `id:${data.id_card}`;
    }
    if (!data.yg_name) {
      return null;
    }
    return `name:${data.yg_name}:${data.department ?? ''}:${data.position ?? ''}`;
  }

  private createEmployeeImportPreviewResult(
    materialId: string,
    rows: EmployeeImportPreviewRow[],
    fileErrors: EmployeeImportError[],
    source: EmployeeImportPreviewResult['source'] = {
      companyName: null,
      creditCode: null,
      fileName: '',
      fileType: 'unknown',
      queryPeriod: null,
      recognitionMode: 'unknown',
    },
  ): EmployeeImportPreviewResult {
    const allErrors = [
      ...fileErrors,
      ...rows.flatMap((row) => row.errors),
    ];
    const createCount = rows.filter((row) => row.action === 'create').length;
    const updateCount = rows.filter((row) => row.action === 'update').length;
    const importableCount = rows.filter((row) => row.importable).length;
    const summary: EmployeeImportPreviewSummary = {
      createCount,
      errorCount: rows.filter((row) => row.errors.length > 0).length + fileErrors.length,
      importableCount,
      readCount: rows.length,
      skippedCount: rows.filter((row) => row.action === 'skip').length,
      status:
        allErrors.length === 0
          ? 'valid'
          : importableCount > 0
            ? 'partial'
            : 'invalid',
      updateCount,
    };

    return {
      materialId,
      rows,
      source,
      summary,
    };
  }

  private buildEmployeeImportPreviewSource(
    file: StoredUploadFile,
    rows: EmployeeImportRow[],
  ): EmployeeImportPreviewResult['source'] {
    const extension = extname(file.originalname || '').toLowerCase();
    const remark = rows[0]
      ? this.getEmployeeImportCell(rows[0], ['备注', 'remark'])
      : '';
    const companyName = remark.match(/参保单位[:：]([^；]+)/u)?.[1]?.trim() ?? null;
    const creditCode = remark.match(
      /统一社会信用代码[:：]([0-9A-Z]{18})/iu,
    )?.[1]?.toUpperCase() ?? null;
    const queryPeriod = remark.match(
      /社保查询期间[:：]([^；]+)/u,
    )?.[1]?.trim() ?? null;

    return {
      companyName,
      creditCode,
      fileName: file.originalname || file.filename,
      fileType: extension === '.pdf' ? 'pdf' : ['.xls', '.xlsm', '.xlsx'].includes(extension) ? 'excel' : 'unknown',
      queryPeriod,
      recognitionMode: extension === '.pdf'
        ? /视觉模型[:：]/u.test(remark)
          ? 'vision'
          : 'pdf_text'
        : ['.xls', '.xlsm', '.xlsx'].includes(extension)
          ? 'excel'
          : 'unknown',
    };
  }

  private async persistEmployeeImportPreview(
    enterpriseId: string,
    material: EnterpriseMaterialEntity,
    preview: EmployeeImportPreviewResult,
  ): Promise<void> {
    const allErrors = preview.rows.flatMap((row) => row.errors);

    if (allErrors.length > 0) {
      await this.enterpriseMaterialParseErrorRepo.save(
        allErrors.map((error) =>
          this.enterpriseMaterialParseErrorRepo.create({
            enterpriseId,
            errorMessage: error.message,
            fieldName: error.fieldName,
            materialId: material.id,
            rawValue: this.cleanEmployeeText(error.rawValue ?? '', 500),
            rowNumber: error.rowNumber,
            sheetName: error.sheetName ?? '员工花名册',
            suggestion: error.suggestion ?? null,
          }),
        ),
      );
    }

    Object.assign(material, {
      errorCount: allErrors.length,
      remark: JSON.stringify({
        importSummary: preview.summary,
        previewNonce: randomUUID(),
      }),
      status: 'review_required',
    });
    await this.enterpriseMaterialRepo.save(material);
  }

  private async persistEmployeeImportResult(
    enterpriseId: string,
    material: EnterpriseMaterialEntity,
    errors: EmployeeImportError[],
    summary: EmployeeImportSummary,
  ): Promise<void> {
    if (errors.length > 0) {
      await this.enterpriseMaterialParseErrorRepo.save(
        errors.map((error) =>
          this.enterpriseMaterialParseErrorRepo.create({
            enterpriseId,
            errorMessage: error.message,
            fieldName: error.fieldName,
            materialId: material.id,
            rawValue: this.cleanEmployeeText(error.rawValue ?? '', 500),
            rowNumber: error.rowNumber,
            sheetName: error.sheetName ?? '员工花名册',
            suggestion: error.suggestion ?? null,
          }),
        ),
      );
    }

    Object.assign(material, {
      errorCount: errors.length,
      remark: JSON.stringify(summary),
      status: summary.status,
    });
    await this.enterpriseMaterialRepo.save(material);
  }

  private getEmployeeImportCell(row: EmployeeImportRow, labels: string[]): string {
    const normalizedLabels = labels.map((label) => this.normalizeEmployeeHeader(label));
    const matchedKey = Object.keys(row).find((key) =>
      normalizedLabels.includes(this.normalizeEmployeeHeader(key)),
    );
    return matchedKey ? row[matchedKey].trim() : '';
  }

  private normalizeEmployeeHeader(value: string): string {
    return value.replace(/\s+/gu, '').toLowerCase();
  }

  private normalizeGender(value: string): null | number {
    const text = value.trim();
    if (!text) {
      return null;
    }
    if (text === '1' || text === '男') {
      return 1;
    }
    if (text === '2' || text === '女') {
      return 2;
    }
    return null;
  }

  private formatEmployeeGender(value: null | number): string {
    return (
      {
        1: '男',
        2: '女',
      }[Number(value)] ?? ''
    );
  }

  private normalizeEmployeeType(value: string): null | number {
    return this.normalizeOptionValue(value, {
      在职人员: 1,
      兼职人员: 2,
      临时兼职人员: 3,
      临时聘用人员: 4,
    });
  }

  private formatEmployeeType(value: null | number): string {
    return (
      {
        1: '在职人员',
        2: '兼职人员',
        3: '临时兼职人员',
        4: '临时聘用人员',
      }[Number(value)] ?? ''
    );
  }

  private normalizeEducation(value: string): null | number {
    return this.normalizeOptionValue(value, {
      博士: 1,
      硕士: 2,
      本科: 3,
      大专及以下: 4,
      大专: 4,
      其他: 4,
    });
  }

  private formatEmployeeEducation(value: null | number): string {
    return (
      {
        1: '博士',
        2: '硕士',
        3: '本科',
        4: '大专及以下',
      }[Number(value)] ?? ''
    );
  }

  private normalizeJobTitle(value: string): null | number {
    return this.normalizeOptionValue(value, {
      高级职称: 1,
      中级职称: 2,
      初级职称: 3,
      高级技工: 4,
      暂无: 5,
      无: 5,
    });
  }

  private formatEmployeeJobTitle(value: null | number): string {
    return (
      {
        1: '高级职称',
        2: '中级职称',
        3: '初级职称',
        4: '高级技工',
        5: '暂无',
      }[Number(value)] ?? ''
    );
  }

  private normalizeAgeRange(value: string): null | number {
    return this.normalizeOptionValue(value, {
      '30岁以下': 1,
      '31-40岁': 2,
      '41-50岁': 3,
      '50岁及以上': 4,
    });
  }

  private formatEmployeeAgeRange(value: null | number): string {
    return (
      {
        1: '30岁以下',
        2: '31-40岁',
        3: '41-50岁',
        4: '50岁及以上',
      }[Number(value)] ?? ''
    );
  }

  private normalizeYesNoValue(value: string, fallback: number): number {
    const text = value.trim().toLowerCase();
    if (!text) {
      return fallback;
    }
    if (['1', 'true', 'yes', 'y', '是'].includes(text)) {
      return 1;
    }
    if (['0', 'false', 'no', 'n', '否'].includes(text)) {
      return 0;
    }
    return fallback;
  }

  private formatEmployeeYesNo(value: null | number): string {
    if (value === null || value === undefined) {
      return '';
    }
    return Number(value) === 1 ? '是' : '否';
  }

  private normalizeOptionValue(
    value: string,
    map: Record<string, number>,
  ): null | number {
    const text = value.trim();
    if (!text) {
      return null;
    }
    if (/^\d+$/u.test(text)) {
      return Number(text);
    }
    return map[text] ?? null;
  }

  private toNullableInteger(value: string): null | number {
    const text = value.trim();
    if (!text) {
      return null;
    }
    const numberValue = Number(text);
    return Number.isInteger(numberValue) ? numberValue : null;
  }

  private cleanEmployeeText(value: string, maxLength: number): null | string {
    const text = value.trim();
    if (!text) {
      return null;
    }
    return text.length > maxLength ? text.slice(0, maxLength) : text;
  }

  private countEmployeeOption(values: Array<null | number>) {
    return values.reduce<Record<string, number>>((result, value) => {
      const key = value === null ? 'unknown' : String(value);
      result[key] = (result[key] ?? 0) + 1;
      return result;
    }, {});
  }

  private emptyEmployeeStats() {
    return {
      activeCount: 0,
      attachmentCount: 0,
      education: {},
      researchCount: 0,
      researchRatio: 0,
      title: {},
      total: 0,
    };
  }

  async listClientPolicies(
    userId: number,
    query: Record<string, string | string[] | undefined>,
    request?: Request,
  ): Promise<{ items: ClientPolicyFileItem[]; total: number }> {
    const regionIds = await this.resolveCurrentEnterprisePolicyRegionIds(userId);
    if (regionIds.size === 0) {
      return {
        items: [],
        total: 0,
      };
    }

    const title = this.getQueryValue(query.title)?.trim().toLowerCase();
    const projectId = this.getQueryValue(query.projectId);
    const regionId = this.getQueryValue(query.regionId);

    const rows = await this.regionPolicyFileRepo.find({
      order: {
        id: 'DESC',
      },
      where: {
        status: 'published',
      },
    });

    let items = rows
      .filter((row) => regionIds.has(String(row.regionId)))
      .map((row) => this.toClientPolicyFileItem(row, request));

    if (title) {
      items = items.filter((item) =>
        [item.title, item.projectName, item.regionName]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(title)),
      );
    }
    if (projectId) {
      items = items.filter((item) => item.projectId === projectId);
    }
    if (regionId) {
      items = items.filter((item) => item.regionId === regionId);
    }

    const page = Math.max(Number(this.getQueryValue(query.page) ?? 1), 1);
    const pageSize = Math.max(
      Number(this.getQueryValue(query.pageSize) ?? items.length) || 10,
      1,
    );
    const start = (page - 1) * pageSize;

    return {
      items: items.slice(start, start + pageSize),
      total: items.length,
    };
  }

  async getClientPolicyDetail(
    userId: number,
    id: string,
    request?: Request,
  ): Promise<ClientPolicyFileItem> {
    const regionIds = await this.resolveCurrentEnterprisePolicyRegionIds(userId);
    const row = await this.regionPolicyFileRepo.findOne({
      where: {
        id,
        status: 'published',
      },
    });

    if (!row || !regionIds.has(String(row.regionId))) {
      throw new NotFoundException('政策文件不存在');
    }

    return this.toClientPolicyFileItem(row, request);
  }

  async listClientDeclareProjects(
    userId: number,
    query: Record<string, string | string[] | undefined>,
    request?: Request,
  ): Promise<{ items: ClientDeclareProjectItem[]; total: number }> {
    const policyResult = await this.listClientPolicies(
      userId,
      {
        page: '1',
        pageSize: '1000',
        regionId: query.regionId,
        title: query.keyword,
      },
      request,
    );
    const policies = policyResult.items;
    if (policies.length === 0) {
      return {
        items: [],
        total: 0,
      };
    }

    const projectIds = [...new Set(policies.map((policy) => policy.projectId))];
    const projects = await this.policyProjectRepo.find({
      where: {
        enabled: 1,
        id: In(projectIds),
      },
    });
    const projectMap = new Map(projects.map((project) => [String(project.id), project]));
    const keyword = this.getQueryValue(query.keyword)?.trim().toLowerCase();
    const policyType = this.getQueryValue(query.policyType)?.trim().toLowerCase();
    const requestedRegionId = this.getQueryValue(query.regionId);
    const groupedPolicies = new Map<string, ClientPolicyFileItem[]>();

    policies.forEach((policy) => {
      const rows = groupedPolicies.get(policy.projectId) ?? [];
      rows.push(policy);
      groupedPolicies.set(policy.projectId, rows);
    });

    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const activeDeclarations = await this.clientDeclarationRepo.find({
      order: {
        id: 'DESC',
      },
      where: {
        enterpriseId,
        projectId: In(projectIds),
        status: In(ACTIVE_CLIENT_DECLARATION_STATUSES),
      },
    });
    const activeDeclarationMap = new Map<string, ClientDeclarationEntity>();
    activeDeclarations.forEach((declaration) => {
      if (
        requestedRegionId &&
        (this.getDeclarationRegionId(declaration) ?? null) !== requestedRegionId
      ) {
        return;
      }

      const key = String(declaration.projectId);
      if (!activeDeclarationMap.has(key)) {
        activeDeclarationMap.set(key, declaration);
      }
    });

    let items = await Promise.all([...groupedPolicies.entries()].map(async ([projectId, matchedPolicies]) => {
      const project = projectMap.get(projectId);
      const regionNames = [
        ...new Set(matchedPolicies.map((policy) => policy.regionName)),
      ];
      const nearestDeadline =
        matchedPolicies
          .map((policy) => policy.endDate)
          .filter((value): value is string => Boolean(value))
          .sort()[0] ?? null;
      const subsidyText =
        matchedPolicies.find((policy) => policy.subsidyText)?.subsidyText ??
        matchedPolicies
          .map((policy) => policy.subsidyAmountMax)
          .filter((value): value is string => Boolean(value))
          .sort((left, right) => Number(right) - Number(left))[0] ??
        null;
      const scheme = await this.resolveClientDeclarationScheme(
        projectId,
        matchedPolicies
          .map((policy) => policy.regionId)
          .filter((regionId): regionId is string => Boolean(regionId)),
        enterpriseId,
      );
      const existingDeclaration = activeDeclarationMap.get(projectId) ?? null;

      return {
        applicableObjects: project?.applicableObjects ?? null,
        basicDescription: project?.basicDescription ?? matchedPolicies[0]?.content ?? null,
        canCreateDeclaration:
          !existingDeclaration && scheme?.qualification.status !== 'ineligible',
        existingDeclaration: existingDeclaration
          ? this.toExistingClientDeclarationSummary(existingDeclaration)
          : null,
        id: projectId,
        matchedPolicies,
        matchedPolicyCount: matchedPolicies.length,
        name: project?.name ?? matchedPolicies[0]?.projectName ?? '未命名项目',
        nearestDeadline,
        policyType: project?.policyType ?? null,
        regionNames,
        scheme,
        subsidyText,
      };
    }));

    if (keyword) {
      items = items.filter((item) =>
        [item.name, item.policyType, item.regionNames.join(' ')]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(keyword)),
      );
    }
    if (policyType) {
      items = items.filter((item) =>
        (item.policyType ?? '').toLowerCase().includes(policyType),
      );
    }

    return {
      items,
      total: items.length,
    };
  }

  async getClientDeclareProjectDetail(
    userId: number,
    projectId: string,
    regionId?: string,
  ): Promise<ClientDeclareProjectItem> {
    return this.requireClientDeclareProject(userId, projectId, regionId);
  }

  async getClientProjectReadiness(
    userId: number,
    projectId: string,
    regionId?: string,
  ): Promise<ClientProjectReadiness> {
    const project = await this.requireClientDeclareProject(userId, projectId, regionId);
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const [enterprise, basicInfo, contacts] = await Promise.all([
      this.enterpriseRepo.findOne({ where: { id: enterpriseId } }),
      this.enterpriseBasicInfoRepo.findOne({ where: { enterpriseId } }),
      this.enterpriseContactRepo.find({
        where: {
          enterpriseId,
          status: 1,
        },
      }),
    ]);

    const missingRequiredFields = this.getMissingEnterpriseProfileFields(
      enterprise,
      basicInfo,
      contacts.length,
    );
    const score = Math.max(0, 100 - missingRequiredFields.length * 12);
    const conditionTexts = [
      ...new Set(
        project.matchedPolicies
          .map((policy) => policy.conditionText)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const materialTexts = [
      ...new Set(
        project.matchedPolicies
          .map((policy) => policy.materialText)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const qualificationMissing = [
      ...(project.scheme?.qualification.missing ?? []),
    ];
    return {
      canCreate: missingRequiredFields.length === 0 && qualificationMissing.length === 0,
      conditionTexts,
      materialTexts,
      matchedPolicyFileIds: project.matchedPolicies.map((policy) => policy.id),
      missingMaterials: [],
      missingRequiredFields: [...missingRequiredFields, ...qualificationMissing],
      score,
      status:
        missingRequiredFields.length === 0 && qualificationMissing.length === 0
          ? 'ready'
          : 'needs_profile',
    };
  }

  async getClientProjectMaterialReadiness(
    userId: number,
    projectId: string,
    regionId?: string,
  ): Promise<ClientProjectMaterialReadiness> {
    const project = await this.requireClientDeclareProject(userId, projectId, regionId);
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const latestCheck = await this.declarationMaterialCheckRepo.findOne({
      order: {
        checkedAt: 'DESC',
        id: 'DESC',
      },
      where: {
        enterpriseId,
        projectId: project.id,
        requirementId: project.scheme?.id ?? project.id,
      },
    });
    const parsedLatestCheck = this.parseMaterialCheckSummary(
      latestCheck?.summaryJson ?? null,
    );
    if (parsedLatestCheck) {
      return parsedLatestCheck;
    }

    const result = await this.buildAndPersistMaterialCheck({
      declarationId: null,
      enterpriseId,
      project,
    });

    return this.toClientProjectMaterialReadiness(project, result);
  }

  async createClientProjectMaterialCheck(
    userId: number,
    projectId: string,
    input: ClientProjectMaterialCheckDto,
  ): Promise<ClientProjectMaterialReadiness> {
    const project = await this.requireClientDeclareProject(userId, projectId, input.regionId);
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const declarationId = this.toNullableString(input.declarationId);

    if (declarationId) {
      const declaration = await this.clientDeclarationRepo.findOne({
        where: {
          enterpriseId,
          id: declarationId,
          projectId: project.id,
        },
      });
      if (!declaration) {
        throw new NotFoundException('申报记录不存在');
      }
    }

    const result = await this.buildAndPersistMaterialCheck({
      declarationId,
      enterpriseId,
      project,
    });

    return this.toClientProjectMaterialReadiness(project, result);
  }

  private async requireClientDeclareProject(
    userId: number,
    projectId: string,
    regionId?: string,
  ): Promise<ClientDeclareProjectItem> {
    const project = await this.listClientDeclareProjects(
      userId,
      {
        page: '1',
        pageSize: '1000',
        regionId,
      },
    ).then((result) =>
      result.items.find((item) => String(item.id) === String(projectId)),
    );
    if (!project) {
      throw new NotFoundException('当前企业未匹配到该申报项目');
    }

    return project;
  }

  private async buildAndPersistMaterialCheck(input: {
    declarationId: null | string;
    enterpriseId: string;
    project: ClientDeclareProjectItem;
  }): Promise<MaterialCheckResult> {
    const requirement = await this.resolveProjectMaterialRequirement(
      input.project.id,
      input.project.name,
      input.project.scheme,
    );

    const enterpriseId = input.enterpriseId;
    const checkedItems = await Promise.all(
      requirement.items.map(async (item) =>
        this.checkProjectMaterialRequirementItem(
          item,
          await this.loadMaterialRecords(enterpriseId, item.moduleKey, item.tabKey),
        ),
      ),
    );
    const totalWeight = checkedItems.reduce(
      (sum, item) => sum + this.toNumberValue(item.scoreWeight ?? 1),
      0,
    );
    const weightedScore = checkedItems.reduce((sum, item) => {
      const weight = this.toNumberValue(item.scoreWeight ?? 1);
      return sum + item.score * weight;
    }, 0);
    const readinessScore = this.roundStatNumber(
      totalWeight > 0 ? weightedScore / totalWeight : 0,
    );
    const passedItems = checkedItems.filter((item) => item.checkStatus === 'passed').length;
    const missingItems = checkedItems.filter((item) => item.checkStatus !== 'passed').length;
    const checkStatus =
      missingItems === 0 ? 'passed' : passedItems > 0 ? 'partial' : 'missing';
    const riskLevel =
      readinessScore >= 85 ? 'low' : readinessScore >= 60 ? 'medium' : 'high';
    const checkedAt = new Date();
    const summary = {
      checkStatus,
      checkedAt: checkedAt.toISOString(),
      enterpriseId,
      items: checkedItems.map((item) => ({
        ...item,
        matchedRecordIds: item.matchedRecordIds,
        missingFields: item.missingFields,
      })),
      missingItems,
      passedItems,
      projectId: input.project.id,
      projectName: input.project.name,
      readinessScore,
      requirementId: requirement.requirementId,
      requirementName: requirement.requirementName,
      riskLevel,
      totalItems: checkedItems.length,
      version: requirement.version,
    };

    const saved = await this.declarationMaterialCheckRepo.save(
      this.declarationMaterialCheckRepo.create({
        checkStatus,
        checkedAt,
        declarationId: input.declarationId,
        enterpriseId,
        missingItems,
        passedItems,
        projectId: input.project.id,
        readinessScore,
        requirementId: requirement.requirementId,
        riskLevel,
        summaryJson: JSON.stringify(summary),
        totalItems: checkedItems.length,
      }),
    );

    await this.declarationMaterialCheckItemRepo.save(
      checkedItems.map((item) =>
        this.declarationMaterialCheckItemRepo.create({
          attachmentMissing: item.attachmentMissing ? 1 : 0,
          checkId: saved.id,
          checkStatus: item.checkStatus,
          itemName: item.itemName,
          matchedCount: item.matchedCount,
          matchedRecordIds: JSON.stringify(item.matchedRecordIds),
          missingFields: JSON.stringify(item.missingFields),
          moduleKey: item.moduleKey,
          requirementItemId: item.requirementItemId,
          requiredCount: item.requiredCount,
          score: item.score,
          suggestion: item.suggestion,
          tabKey: item.tabKey,
        }),
      ),
    );

    return {
      checkId: String(saved.id),
      checkedAt: summary.checkedAt,
      checkStatus,
      enterpriseId,
      items: checkedItems,
      missingItems,
      passedItems,
      projectId: input.project.id,
      projectName: input.project.name,
      readinessScore,
      requirementId: requirement.requirementId,
      requirementName: requirement.requirementName,
      riskLevel,
      totalItems: checkedItems.length,
      version: requirement.version,
    };
  }

  private async resolveProjectMaterialRequirement(
    projectId: string,
    projectName: string,
    scheme?: ClientDeclareProjectItem['scheme'],
  ): Promise<ResolvedProjectMaterialRequirement> {
    const schemeItems = this.buildSchemeMaterialRequirementItems(
      projectId,
      scheme,
    );
    if (schemeItems.length > 0 && scheme) {
      return {
        items: schemeItems,
        requirementId: scheme.id,
        requirementName: `${scheme.schemeName}材料要求`,
        version: scheme.version,
      };
    }

    const requirement = await this.projectMaterialRequirementRepo.findOne({
      order: { id: 'DESC' },
      where: {
        enabled: 1,
        projectId,
      },
    });

    if (requirement) {
      const items = await this.projectMaterialRequirementItemRepo.find({
        order: {
          sortOrder: 'ASC',
          id: 'ASC',
        },
        where: {
          enabled: 1,
          requirementId: requirement.id,
        },
      });

      if (items.length > 0) {
        return {
          items,
          requirementId: String(requirement.id),
          requirementName: requirement.requirementName,
          version: requirement.version,
        };
      }
    }

    return {
      items: this.buildFallbackProjectMaterialRequirementItems(projectId),
      requirementId: projectId,
      requirementName: `${projectName}\u6750\u6599\u8981\u6c42`,
      version: 'fallback',
    };
  }

  private buildFallbackProjectMaterialRequirementItems(
    projectId: string,
  ): ProjectMaterialRequirementItemEntity[] {
    return BUILTIN_PROJECT_MATERIAL_REQUIREMENT_ITEMS.map((item) => {
      const entity = this.projectMaterialRequirementItemRepo.create({
        attachmentRequired: item.attachmentRequired,
        enabled: 1,
        isRequired: item.isRequired,
        itemName: item.itemName,
        moduleKey: item.moduleKey,
        requiredCount: item.requiredCount,
        requiredFields: JSON.stringify(item.requiredFields ?? []),
        requiredYears: JSON.stringify(item.requiredYears ?? []),
        requirementDesc: item.requirementDesc,
        requirementId: projectId,
        scoreWeight: item.scoreWeight,
        sortOrder: item.sortOrder,
        tabKey: item.tabKey,
      });
      return entity;
    });
  }

  private async loadMaterialRecords(
    enterpriseId: string,
    moduleKey: string,
    tabKey: string,
  ): Promise<Array<Record<string, unknown>>> {
    switch (`${moduleKey}/${tabKey}`) {
      case 'basic/info': {
        const [enterprise, basicInfo] = await Promise.all([
          this.enterpriseRepo.findOne({ where: { id: enterpriseId } }),
          this.enterpriseBasicInfoRepo.findOne({ where: { enterpriseId } }),
        ]);

        if (!enterprise && !basicInfo) {
          return [];
        }

        return [
          {
            creditCode: basicInfo?.creditCode ?? enterprise?.creditCode ?? null,
            enterpriseId,
            id: enterpriseId,
            industry: basicInfo?.industry ?? enterprise?.industry ?? null,
            legalPersonName:
              basicInfo?.legalPersonName ?? enterprise?.legalPerson ?? null,
            name: basicInfo?.name ?? enterprise?.name ?? null,
          },
        ];
      }
      case 'finance/financial':
        return (await this.enterpriseFinanceRecordRepo.find({
          where: {
            enterpriseId,
            recordType: 'financial',
            status: 1,
          },
        })).map((row) => row as unknown as Record<string, unknown>);
      case 'finance/taxAudit':
        return (await this.enterpriseFinanceRecordRepo.find({
          where: {
            enterpriseId,
            recordType: 'tax_audit',
            status: 1,
          },
        })).map((row) => row as unknown as Record<string, unknown>);
      case 'employee/employees':
        return (await this.enterpriseEmployeeRecordRepo.find({
          where: {
            enterpriseId,
            status: 1,
          },
        })).map((row) => row as unknown as Record<string, unknown>);
      case 'property/intellectualProperty':
        return (await this.enterprisePropertyRecordRepo.find({
          where: {
            enterpriseId,
            recordType: 'intellectual_property',
            status: 1,
          },
        })).map((row) => row as unknown as Record<string, unknown>);
      case 'property/researchProject':
        return (await this.enterprisePropertyRecordRepo.find({
          where: {
            enterpriseId,
            recordType: 'research_project',
            status: 1,
          },
        })).map((row) => row as unknown as Record<string, unknown>);
      case 'property/productService':
        return (await this.enterprisePropertyRecordRepo.find({
          where: {
            enterpriseId,
            recordType: 'product_service',
            status: 1,
          },
        })).map((row) => row as unknown as Record<string, unknown>);
      case 'property/transformation':
        return (await this.enterprisePropertyRecordRepo.find({
          where: {
            enterpriseId,
            recordType: 'transformation',
            status: 1,
          },
        })).map((row) => row as unknown as Record<string, unknown>);
      case 'contract/contracts':
        return (await this.enterpriseContractRecordRepo.find({
          where: {
            enterpriseId,
            recordType: 'contract',
            status: 1,
          },
        })).map((row) => row as unknown as Record<string, unknown>);
      case 'contract/invoices':
        return (await this.enterpriseContractRecordRepo.find({
          where: {
            enterpriseId,
            recordType: 'invoice',
            status: 1,
          },
        })).map((row) => row as unknown as Record<string, unknown>);
      case 'document/documents':
        return (await this.enterpriseDocumentRecordRepo.find({
          where: {
            enterpriseId,
            status: 1,
          },
        })).map((row) => row as unknown as Record<string, unknown>);
      case 'certificate/certificates':
        return (await this.enterpriseCertificateRecordRepo.find({
          where: {
            enterpriseId,
            status: 1,
          },
        })).map((row) => row as unknown as Record<string, unknown>);
      case 'photo/photos':
        return (await this.enterprisePhotoRecordRepo.find({
          where: {
            enterpriseId,
            status: 1,
          },
        })).map((row) => row as unknown as Record<string, unknown>);
      case 'account/accounts':
        return (await this.enterpriseAccountRecordRepo.find({
          where: {
            enterpriseId,
            status: 1,
          },
        })).map((row) => row as unknown as Record<string, unknown>);
      default:
        return [];
    }
  }

  private checkProjectMaterialRequirementItem(
    item: ProjectMaterialRequirementItemEntity,
    records: Array<Record<string, unknown>>,
  ): MaterialRequirementItemCheck {
    const requiredFields = this.parseJsonStringArray(item.requiredFields);
    const requiredYears = this.parseJsonStringArray(item.requiredYears);
    const attachmentField = this.getMaterialAttachmentField(
      item.moduleKey,
      item.tabKey,
    );
    const evaluations = records.map((record) =>
      this.evaluateMaterialRecord(
        record,
        requiredFields,
        requiredYears,
        attachmentField,
        item.attachmentRequired === 1,
      ),
    );
    const passedEvaluations = evaluations.filter((entry) => entry.passed);
    const matchedRecordIds = passedEvaluations.map((entry) => entry.recordId);
    const matchedCount = matchedRecordIds.length;
    const missingFields = [
      ...new Set(
        evaluations.flatMap((entry) => entry.missingFields),
      ),
    ];
    const attachmentMissing =
      item.attachmentRequired === 1
        ? !evaluations.some((entry) => entry.hasAttachment)
        : false;
    const requiredCount = Math.max(Number(item.requiredCount ?? 1), 1);
    const quantityRatio = Math.min(matchedCount / requiredCount, 1);
    const score = this.roundStatNumber(
      records.length === 0
        ? 0
        : Math.min(
            100,
            quantityRatio * 60 +
              (missingFields.length === 0 ? 25 : 0) +
              (item.attachmentRequired === 1 ? (attachmentMissing ? 0 : 15) : 10),
          ),
    );
    const checkStatus =
      matchedCount >= requiredCount && missingFields.length === 0 && !attachmentMissing
        ? 'passed'
        : records.length === 0
          ? 'missing'
          : 'partial';
    const relationSummary = this.extractMaterialRelationSummary(records);
    const requirementItemId = /^\d+$/.test(String(item.id ?? ''))
      ? String(item.id)
      : null;

    return {
      attachmentMissing,
      checkStatus,
      itemName: item.itemName,
      matchedCount,
      matchedRecordIds,
      missingFields,
      moduleKey: item.moduleKey,
      ...(Object.keys(relationSummary).length > 0 ? { relationSummary } : {}),
      requirementItemId,
      requiredCount,
      scoreWeight: this.toNumberValue(item.scoreWeight ?? 1),
      score,
      suggestion:
        checkStatus === 'passed'
          ? null
          : `请补齐${item.itemName}相关材料${missingFields.length > 0 ? `：${missingFields.join('、')}` : ''}`,
      tabKey: item.tabKey,
    };
  }

  private extractMaterialRelationSummary(
    records: Array<Record<string, unknown>>,
  ): Record<string, string[]> {
    const relationFields: Array<[string, string]> = [
      ['rd', 'relatedRdIds'],
      ['ip', 'relatedIpIds'],
      ['ps', 'relatedPsIds'],
      ['transformation', 'relatedTransformationIds'],
      ['contract', 'relatedContractIds'],
      ['invoice', 'relatedInvoiceIds'],
    ];
    const summary = relationFields.reduce<Record<string, string[]>>(
      (result, [key, field]) => {
        const ids = [
          ...new Set(
            records.flatMap((record) =>
              this.parseMaterialRelationIds(record[field]),
            ),
          ),
        ];
        if (ids.length > 0) {
          result[key] = ids;
        }
        return result;
      },
      {},
    );

    return summary;
  }

  private parseMaterialRelationIds(value: unknown): string[] {
    if (!this.isFilledValue(value)) {
      return [];
    }
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }

    return String(value)
      .split(/[,，\s]+/u)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private evaluateMaterialRecord(
    record: Record<string, unknown>,
    requiredFields: string[],
    requiredYears: string[],
    attachmentField: string | null,
    attachmentRequired: boolean,
  ) {
    const missingFields = requiredFields.filter((field) =>
      !this.isFilledValue(record[field]),
    );
    const hasAttachment = attachmentField
      ? this.isFilledValue(record[attachmentField])
      : false;
    if (attachmentRequired && !hasAttachment) {
      missingFields.push('attachment');
    }

    const yearMatched =
      requiredYears.length === 0
        ? true
        : requiredYears.includes(this.extractRecordYear(record) ?? '');

    const passed = missingFields.length === 0 && yearMatched;

    return {
      hasAttachment,
      missingFields: [...new Set(missingFields)],
      passed,
      recordId: String(record.id ?? ''),
    };
  }

  private getMaterialAttachmentField(
    moduleKey: string,
    tabKey: string,
  ): string | null {
    const map: Record<string, string> = {
      'certificate/certificates': 'zsPath',
      'contract/contracts': 'htPath',
      'document/documents': 'filePath',
      'employee/employees': 'ygFiles',
      'finance/taxAudit': 'filePath',
      'photo/photos': 'photoFiles',
      'property/intellectualProperty': 'softWorkFile',
      'property/researchProject': 'lxbgFile',
      'property/productService': 'proofFiles',
      'property/transformation': 'proofFiles',
    };

    return map[`${moduleKey}/${tabKey}`] ?? null;
  }

  private extractRecordYear(record: Record<string, unknown>): null | string {
    const directYear = record.year;
    if (this.isFilledValue(directYear)) {
      return String(directYear).slice(0, 4);
    }

    const dateFields = [
      record.applyDate,
      record.authorizeDate,
      record.endDate,
      record.fileStartDate,
      record.initDate,
      record.psDate,
      record.qdDate,
      record.startDate,
    ];
    const dateValue = dateFields.find((value) => this.isFilledValue(value));
    if (!dateValue) {
      return null;
    }

    const matched = String(dateValue).match(/(19|20)\d{2}/);
    return matched ? matched[0] : null;
  }

  private parseJsonStringArray(value: null | string): string[] {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.map((item) => String(item)).filter((item) => item.length > 0)
        : [];
    } catch {
      return [];
    }
  }

  private parseMaterialCheckSummary(
    value: null | string,
  ): ClientProjectMaterialReadiness | null {
    if (!value) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as Partial<ClientProjectMaterialReadiness>;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
        return null;
      }

      return parsed as ClientProjectMaterialReadiness;
    } catch {
      return null;
    }
  }

  private isFilledValue(value: unknown): boolean {
    if (value === undefined || value === null) {
      return false;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return String(value).trim() !== '';
  }

  private toNumberValue(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private toClientProjectMaterialReadiness(
    project: ClientDeclareProjectItem,
    result: MaterialCheckResult,
  ): ClientProjectMaterialReadiness {
    return {
      ...result,
      projectId: project.id,
      projectName: project.name,
    };
  }

  async createClientDeclarationDraft(
    userId: number,
    projectId: string,
    regionId?: string,
  ): Promise<ClientDeclarationItem> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const project = await this.listClientDeclareProjects(
      userId,
      {
        page: '1',
        pageSize: '1000',
        regionId,
      },
    ).then((result) =>
      result.items.find((item) => String(item.id) === String(projectId)),
    );
    if (!project) {
      throw new NotFoundException('当前企业未匹配到该申报项目');
    }
    const matchedRegionIds = new Set(
      project.matchedPolicies
        .map((policy) => policy.regionId)
        .filter((id): id is string => Boolean(id)),
    );
    if (matchedRegionIds.size > 1 && !regionId) {
      throw new BadRequestException('该项目命中多个地区，请先选择实际申报地区');
    }

    const declarationRegion = this.resolveDeclarationRegionSnapshot(
      project,
      regionId,
    );
    if (project.scheme?.qualification.status === 'ineligible') {
      throw new BadRequestException('当前企业暂不满足该地区申报方案的准入条件');
    }

    let activeDeclaration = await this.clientDeclarationRepo.findOne({
      order: {
        id: 'DESC',
      },
      where: {
        enterpriseId,
        declarationRegionId: declarationRegion.id ?? IsNull(),
        projectId: project.id,
        status: In(['draft', 'preparing', 'submitted', 'reviewing', 'rejected']),
      },
    });
    if (!activeDeclaration) {
      const legacyDeclarations = await this.clientDeclarationRepo.find({
        order: {
          id: 'DESC',
        },
        where: {
          enterpriseId,
          declarationRegionId: IsNull(),
          projectId: project.id,
          status: In(['draft', 'preparing', 'submitted', 'reviewing', 'rejected']),
        },
      });
      activeDeclaration = legacyDeclarations.find(
        (item) =>
          (this.getDeclarationRegionId(item) ?? null) === declarationRegion.id,
      ) ?? null;
    }
    if (activeDeclaration) {
      return this.toClientDeclarationItem(activeDeclaration);
    }

    const materialCheck = await this.buildAndPersistMaterialCheck({
      declarationId: null,
      enterpriseId,
      project,
    });
    const readiness = await this.getClientProjectReadiness(userId, projectId, regionId);

    const [enterprise, basicInfo] = await Promise.all([
      this.enterpriseRepo.findOne({ where: { id: enterpriseId } }),
      this.enterpriseBasicInfoRepo.findOne({ where: { enterpriseId } }),
    ]);
    const enterpriseName =
      basicInfo?.name ?? enterprise?.name ?? `企业 ${enterpriseId}`;

    const initialNode = project.scheme?.flowTemplate.nodes?.find(
      (item) => item.name === this.getSchemeInitialNodeName(project.scheme),
    );
    const initialDeadline = initialNode
      ? this.resolveFlowNodeDeadline(initialNode, {}, new Date(), new Date())
      : null;
    const saved = await this.clientDeclarationRepo.save(
      this.clientDeclarationRepo.create({
        currentNodeName: this.getSchemeInitialNodeName(project.scheme),
        deadline: initialDeadline ?? (project.nearestDeadline
          ? this.normalizeDate(project.nearestDeadline)
          : null),
        declarationNo: this.generateDeclarationNo(),
        enterpriseId,
        enterpriseName,
        declarationRegionId: declarationRegion.id,
        missingMaterialCount: materialCheck.missingItems,
        policyFileIds: project.matchedPolicies.map((policy) => policy.id).join(','),
        policyType: project.policyType,
        progress: 0,
        projectId: project.id,
        projectName: project.name,
        rejectedReason: null,
        snapshotJson: JSON.stringify({
          basicInfo,
          enterprise,
          readiness,
          materialCheck,
          declarationRegion,
          scheme: project.scheme,
        }),
        schemeId: project.scheme?.id ?? null,
        schemeVersion: project.scheme?.version ?? null,
        status: 'draft',
        submitTime: null,
      }),
    );

    return this.toClientDeclarationItem(saved);
  }

  async listClientDeclarations(
    userId: number,
    query: Record<string, string | string[] | undefined>,
  ): Promise<{ items: ClientDeclarationItem[]; total: number }> {
    const enterpriseId = await this.getCurrentEnterpriseIdOrNull(userId);
    if (!enterpriseId) {
      return {
        items: [],
        total: 0,
      };
    }

    const keyword = this.getQueryValue(query.keyword)?.trim().toLowerCase();
    const status = this.getQueryValue(query.status);
    const rows = await this.clientDeclarationRepo.find({
      order: {
        id: 'DESC',
      },
      where: {
        enterpriseId,
      },
    });

    let items = rows.map((row) => this.toClientDeclarationItem(row));
    if (keyword) {
      items = items.filter((item) =>
        [item.projectName, item.declarationNo]
          .some((value) => value.toLowerCase().includes(keyword)),
      );
    }
    if (status) {
      items = items.filter((item) => item.status === status);
    }

    return {
      items,
      total: items.length,
    };
  }

  async getClientDeclarationStats(userId: number) {
    const list = await this.listClientDeclarations(userId, {});
    const countByStatus = (status: string) =>
      list.items.filter((item) => item.status === status).length;

    return {
      all: list.total,
      approved: countByStatus('approved'),
      draft: countByStatus('draft'),
      preparing: countByStatus('preparing'),
      rejected: countByStatus('rejected'),
      reviewing: countByStatus('reviewing'),
    };
  }

  async getClientDeclarationDetail(
    userId: number,
    id: string,
  ): Promise<ClientDeclarationDetail> {
    const entity = await this.requireClientDeclaration(userId, id);
    const snapshot = this.parseJsonObject(entity.snapshotJson);
    const scheme = snapshot.scheme as ResolvedDeclarationScheme | undefined;
    const appliedSchemeName = scheme?.schemeName
      || this.toNullableStringFromUnknown(
        (scheme as unknown as Record<string, unknown> | undefined)?.name,
      )
      || '未命名方案';
    const matchedScheme = await this.resolveCurrentDeclarationMatchedScheme(
      userId,
      entity,
    );
    return {
      ...this.toClientDeclarationItem(entity),
      appliedScheme: scheme?.id
        ? {
            id: scheme.id,
            schemeName: appliedSchemeName,
            version: scheme.version,
          }
        : null,
      flow: await this.buildClientDeclarationFlow(entity),
      matchedScheme,
      qualification: scheme?.id
        ? await this.evaluateQualificationRules(
            entity.enterpriseId,
            this.toObjectValue(scheme.qualificationRules),
          )
        : null,
    };
  }

  async sendDueDeclarationNodeReminders(now = new Date()): Promise<number> {
    return this.sendDueDeclarationNodeRemindersForAllNodes(now);
    /* Legacy single-current-node reminder logic is retained below only for
       historical source context and is bypassed by the parallel-node path. */
    /*
    let notificationCount = 0;
    const declarations = await this.clientDeclarationRepo.find({
      where: { status: In(['draft', 'preparing', 'reviewing', 'submitted']) },
    });

    for (const declaration of declarations) {
      const snapshot = this.parseJsonObject(declaration.snapshotJson);
      const scheme = snapshot.scheme as ResolvedDeclarationScheme | undefined;
      const currentNode = scheme?.flowTemplate.nodes?.find(
        (node) => node.name === declaration.currentNodeName,
      );
      if (!currentNode || currentNode.type === 'end') {
        continue;
      }

      const deadline = this.resolveFlowNodeDeadline(
        currentNode,
        snapshot,
        declaration.createdAt,
        now,
      );
      if (!deadline) {
        continue;
      }

      const daysUntilDeadline = this.getCalendarDayDistance(now, deadline);
      const reminderType =
        daysUntilDeadline === 7
          ? 'declaration_node_due_warning'
          : daysUntilDeadline === 0
            ? 'declaration_node_overdue'
            : null;
      if (!reminderType) {
        continue;
      }

      const reminderHistory = this.getDeclarationReminderHistory(snapshot);
      const reminderKey = `${reminderType}:${declaration.id}:${currentNode.name}:${this.formatDate(deadline)}`;
      if (reminderHistory.includes(reminderKey)) {
        continue;
      }

      const recipientIds = await this.resolveDeclarationReminderRecipients(
        declaration.enterpriseId,
        currentNode.role,
      );
      if (recipientIds.length === 0) {
        continue;
      }

      const deadlineText = this.formatDate(deadline) ?? '当前节点截止日';
      const isOverdue = reminderType === 'declaration_node_overdue';
      const title = isOverdue
        ? `重点提醒：${declaration.projectName}节点已到期`
        : `节点提醒：${declaration.projectName}将在7天后到期`;
      const content = isOverdue
        ? `申报单 ${declaration.declarationNo} 的“${currentNode.name}”节点已到期，请尽快处理。`
        : `申报单 ${declaration.declarationNo} 的“${currentNode.name}”节点将于 ${deadlineText} 到期，请提前处理。`;
      await this.policyCollectNotificationRepo.save(
        recipientIds.map((targetUserId) =>
          this.policyCollectNotificationRepo.create({
            content,
            jobId: null,
            runId: null,
            runItemId: null,
            status: 'unread',
            targetUserId,
            title,
            type: reminderType,
          }),
        ),
      );
      snapshot.declarationReminderHistory = [...reminderHistory, reminderKey];
      declaration.snapshotJson = JSON.stringify(snapshot);
      await this.clientDeclarationRepo.save(declaration);
      notificationCount += recipientIds.length;
    }

    await this.autoAdvanceDueDeclarationFlows(now);
    return notificationCount;
    */
  }

  private getDeclarationReminderHistory(snapshot: Record<string, unknown>): string[] {
    return Array.isArray(snapshot.declarationReminderHistory)
      ? snapshot.declarationReminderHistory.filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
  }

  private async sendDueDeclarationNodeRemindersForAllNodes(now: Date): Promise<number> {
    const declarations = await this.clientDeclarationRepo.find({
      where: { status: In(['draft', 'preparing', 'reviewing', 'submitted']) },
    });
    let notificationCount = 0;

    for (const declaration of declarations) {
      const snapshot = this.parseJsonObject(declaration.snapshotJson);
      const scheme = snapshot.scheme as ResolvedDeclarationScheme | undefined;
      const nodes = scheme?.flowTemplate.nodes?.filter(
        (node) => node.code?.trim() && node.name?.trim() && node.type !== 'end',
      ) ?? [];
      const reminderHistory = this.getDeclarationReminderHistory(snapshot);
      const newKeys: string[] = [];
      for (const node of nodes) {
        const deadline = this.resolveFlowNodeDeadline(node, snapshot, declaration.createdAt, now);
        if (!deadline) continue;
        const distance = this.getCalendarDayDistance(now, deadline);
        const type = distance === 7
          ? 'declaration_node_due_warning'
          : distance === 0 ? 'declaration_node_overdue' : null;
        if (!type) continue;
        const key = `${type}:${declaration.id}:${node.name}:${this.formatDate(deadline)}`;
        if (reminderHistory.includes(key)) continue;
        const recipients = await this.resolveDeclarationReminderRecipients(
          declaration.enterpriseId,
          node.role,
        );
        if (recipients.length === 0) continue;
        const overdue = type === 'declaration_node_overdue';
        await this.policyCollectNotificationRepo.save(recipients.map((targetUserId) =>
          this.policyCollectNotificationRepo.create({
            content: overdue
              ? `申报单 ${declaration.declarationNo} 的“${node.name}”节点已到期，系统将自动完成该节点。`
              : `申报单 ${declaration.declarationNo} 的“${node.name}”节点将在 7 天后到期，请提前处理。`,
            jobId: null,
            runId: null,
            runItemId: null,
            status: 'unread',
            targetUserId,
            title: overdue
              ? `重点提醒：${declaration.projectName}节点已到期`
              : `节点提醒：${declaration.projectName}将在 7 天后到期`,
            type,
          }),
        ));
        newKeys.push(key);
        notificationCount += recipients.length;
      }
      if (newKeys.length > 0) {
        snapshot.declarationReminderHistory = [...reminderHistory, ...newKeys];
        declaration.snapshotJson = JSON.stringify(snapshot);
        await this.clientDeclarationRepo.save(declaration);
      }
    }
    await this.autoAdvanceDueDeclarationFlows(now);
    return notificationCount;
  }

  private async resolveDeclarationReminderRecipients(
    enterpriseId: string,
    role?: string,
  ): Promise<string[]> {
    const [teacher, owner, administrators] = await Promise.all([
      this.enterpriseTeacherRepo.findOne({
        order: { updatedAt: 'DESC', id: 'DESC' },
        where: { enterpriseId, status: 1 },
      }),
      this.enterpriseOwnerRepo.findOne({
        order: { updatedAt: 'DESC', id: 'DESC' },
        where: { enterpriseId, status: 1 },
      }),
      this.userRoleRepo
        .createQueryBuilder('userRole')
        .innerJoin('userRole.role', 'role')
        .innerJoin('userRole.user', 'user')
        .select('userRole.userId', 'userId')
        .where('role.code = :code', { code: 'admin' })
        .andWhere('role.status = 1')
        .andWhere('user.status = 1')
        .getRawMany<{ userId: string }>(),
    ]);
    const enterpriseRecipient = role === 'enterprise'
      ? owner?.userId ?? null
      : teacher?.teacherUserId ?? owner?.userId ?? null;
    return [enterpriseRecipient, ...administrators.map((item) => item.userId)]
      .filter((item): item is string => Boolean(item))
      .filter((item, index, values) => values.indexOf(item) === index);
  }

  private async autoAdvanceDueDeclarationFlows(now: Date): Promise<void> {
    return this.completeDueDeclarationFlowNodes(now);
    /* Legacy serial-node progression remains unreachable for compatibility. */
    /*
    const declarations = await this.clientDeclarationRepo.find({
      where: { status: In(['draft', 'preparing', 'reviewing', 'submitted']) },
    });

    for (const declaration of declarations) {
      const snapshot = this.parseJsonObject(declaration.snapshotJson);
      const scheme = snapshot.scheme as ResolvedDeclarationScheme | undefined;
      const nodes = scheme?.flowTemplate.nodes?.filter(
        (item) => item.code?.trim() && item.name?.trim(),
      ) ?? [];
      if (!scheme?.id || nodes.length === 0) continue;

      let currentIndex = nodes.findIndex(
        (item) => item.name === declaration.currentNodeName,
      );
      if (currentIndex < 0) currentIndex = 0;
      let changed = false;

      while (currentIndex < nodes.length - 1) {
        const current = nodes[currentIndex];
        const deadline = this.resolveFlowNodeDeadline(
          current,
          snapshot,
          declaration.createdAt,
          now,
        );
        if (!deadline || now < deadline) break;

        const next = nodes[currentIndex + 1];
        declaration.currentNodeName = next.name ?? declaration.currentNodeName;
        declaration.status = next.type === 'end' ? 'completed' : 'preparing';
        declaration.progress = this.resolveFlowProgress(currentIndex + 1, nodes.length);
        declaration.deadline = this.resolveFlowNodeDeadline(
          next,
          snapshot,
          declaration.createdAt,
          now,
        );
        declaration.snapshotJson = this.appendSchemeFlowHistory(
          this.parseJsonObject(declaration.snapshotJson),
          {
            from: current.name ?? '当前节点',
            reason: '节点截止时间已到，系统自动推进',
            to: next.name ?? '完成',
          },
        );
        changed = true;
        currentIndex += 1;
        if (next.type === 'end') break;
      }

      if (changed) {
        await this.clientDeclarationRepo.save(declaration);
      }
    }
    */
  }

  private resolveFlowProgress(currentIndex: number, total: number): number {
    if (total <= 1) return 100;
    return Math.min(100, Math.round(currentIndex / (total - 1) * 100));
  }

  private async completeDueDeclarationFlowNodes(now: Date): Promise<void> {
    const declarations = await this.clientDeclarationRepo.find({
      where: { status: In(['draft', 'preparing', 'reviewing', 'submitted']) },
    });
    for (const declaration of declarations) {
      const snapshot = this.parseJsonObject(declaration.snapshotJson);
      const scheme = snapshot.scheme as ResolvedDeclarationScheme | undefined;
      const nodes = scheme?.flowTemplate.nodes?.filter(
        (node) => node.code?.trim() && node.name?.trim(),
      ) ?? [];
      if (!scheme?.id || nodes.length === 0) continue;

      const completed = this.getCompletedFlowNodeNames(snapshot);
      const qualificationByNodeName = await this.resolveFlowNodeQualifications(
        declaration.enterpriseId,
        nodes,
      );
      const completedNow = nodes.filter((node) => {
        const name = node.name?.trim();
        const deadline = this.resolveFlowNodeDeadline(node, snapshot, declaration.createdAt, now);
        const qualification = name ? qualificationByNodeName.get(name) : null;
        return Boolean(
          name
          && deadline
          && now >= deadline
          && !completed.includes(name)
          && qualification?.status === 'eligible',
        );
      });
      const completedNames = [...completed, ...completedNow.map((node) => node.name!.trim())];
      const activeNodes = nodes.filter((node) => this.isFlowNodeActive(node, now, completedNames));
      const endNode = nodes.at(-1);
      const isFinished = Boolean(endNode?.name && completedNames.includes(endNode.name));
      const pendingNodes = nodes.filter((node) => {
        const name = node.name?.trim();
        return Boolean(name && !completedNames.includes(name) && this.isFlowNodeWaiting(node, now));
      });
      const firstIncompleteNode = nodes.find((node) => {
        const name = node.name?.trim();
        return Boolean(name && !completedNames.includes(name));
      });
      const summaryNode =
        activeNodes[0] ?? pendingNodes[0] ?? firstIncompleteNode ?? endNode ?? nodes[0];
      const deadlineNodes = activeNodes.length > 0 ? activeNodes : pendingNodes;
      const nextDeadline = deadlineNodes
        .map((node) => this.resolveFlowNodeDeadline(node, snapshot, declaration.createdAt, now))
        .filter((value): value is Date => Boolean(value))
        .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;

      if (
        completedNow.length === 0
        && declaration.currentNodeName === summaryNode?.name
        && this.formatDate(declaration.deadline) === this.formatDate(nextDeadline)
      ) {
        continue;
      }
      let nextSnapshot = snapshot;
      for (const node of completedNow) {
        nextSnapshot = this.parseJsonObject(this.appendSchemeFlowHistory(nextSnapshot, {
          from: node.name ?? '流程节点',
          reason: '节点截止时间已到，系统自动完成',
          to: node.name ?? '流程节点',
        }));
      }
      nextSnapshot.schemeFlowCompletedNodes = completedNames;
      declaration.currentNodeName = summaryNode?.name ?? declaration.currentNodeName;
      declaration.deadline = nextDeadline;
      declaration.progress = isFinished ? 100 : Math.round(completedNames.length / nodes.length * 100);
      declaration.status = isFinished ? 'completed' : 'preparing';
      declaration.snapshotJson = JSON.stringify(nextSnapshot);
      await this.clientDeclarationRepo.save(declaration);
    }
  }

  private getCompletedFlowNodeNames(snapshot: Record<string, unknown>): string[] {
    return Array.isArray(snapshot.schemeFlowCompletedNodes)
      ? snapshot.schemeFlowCompletedNodes.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private isFlowNodeActive(
    node: ResolvedFlowNode,
    now: Date,
    completedNames: string[],
  ): boolean {
    const name = node.name?.trim();
    if (!name || completedNames.includes(name)) return false;
    const startDate = node.timeRule?.mode === 'date_range'
      ? this.toValidDate(node.timeRule.startDate)
      : null;
    const deadline = this.resolveFlowNodeDeadline(node, {}, now, now);
    return Boolean(startDate && deadline && now >= startDate && now < deadline);
  }

  async syncClientDeclarationScheme(
    userId: number,
    id: string,
  ): Promise<ClientDeclarationItem> {
    const declaration = await this.requireClientDeclaration(userId, id);
    if (!['draft', 'preparing'].includes(declaration.status)) {
      throw new BadRequestException('仅草稿或补资料中的申报可以同步最新方案');
    }
    const snapshot = this.parseJsonObject(declaration.snapshotJson);
    const regionId = this.getDeclarationRegionId(declaration, snapshot);
    const project = await this.requireClientDeclareProject(
      userId,
      declaration.projectId,
      regionId,
    );
    if (!project.scheme) {
      throw new BadRequestException('当前项目没有可同步的已发布申报方案');
    }
    const nodeNames = project.scheme.flowTemplate.nodes
      ?.map((item) => item.name?.trim())
      .filter((name): name is string => Boolean(name)) ?? [];
    declaration.currentNodeName = nodeNames.includes(declaration.currentNodeName ?? '')
      ? declaration.currentNodeName
      : this.getSchemeInitialNodeName(project.scheme);
    declaration.schemeId = project.scheme.id;
    declaration.schemeVersion = project.scheme.version;
    declaration.declarationRegionId = regionId ?? null;
    const currentNode = project.scheme.flowTemplate.nodes?.find(
      (item) => item.name === declaration.currentNodeName,
    );
    declaration.deadline = currentNode
      ? this.resolveFlowNodeDeadline(currentNode, snapshot, declaration.createdAt, new Date())
      : null;
    declaration.snapshotJson = JSON.stringify({
      ...snapshot,
      declarationRegion: this.resolveDeclarationRegionSnapshot(project, regionId),
      scheme: project.scheme,
    });
    const saved = await this.clientDeclarationRepo.save(declaration);
    const materialCheck = await this.createClientDeclarationMaterialCheck(userId, id);
    saved.missingMaterialCount = materialCheck.missingItems;
    return this.toClientDeclarationItem(await this.clientDeclarationRepo.save(saved));
  }

  async advanceClientDeclarationFlow(
    userId: number,
    id: string,
    _input: ClientDeclarationFlowActionDto,
  ): Promise<ClientDeclarationItem> {
    await this.requireClientDeclaration(userId, id);
    throw new BadRequestException('流程由系统在节点截止时间自动推进');
  }

  private buildSchemeMaterialRequirementItems(
    projectId: string,
    scheme?: ClientDeclareProjectItem['scheme'],
  ): ProjectMaterialRequirementItemEntity[] {
    if (!scheme || !Array.isArray(scheme.materialRules)) return [];
    return scheme.materialRules
      .filter((item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
      .map((item, index) => {
        const moduleKey = this.toNullableStringFromUnknown(item.moduleKey);
        const tabKey = this.toNullableStringFromUnknown(item.tabKey);
        const itemName = this.toNullableStringFromUnknown(item.itemName);
        if (!moduleKey || !tabKey || !itemName) return null;
        return this.projectMaterialRequirementItemRepo.create({
          attachmentRequired: Number(item.attachmentRequired) === 1 ? 1 : 0,
          enabled: 1,
          isRequired: Number(item.isRequired) === 0 ? 0 : 1,
          itemName,
          moduleKey,
          requiredCount: Math.max(this.toNumberValue(item.requiredCount) || 1, 1),
          requiredFields: JSON.stringify(Array.isArray(item.requiredFields) ? item.requiredFields : []),
          requiredYears: JSON.stringify(Array.isArray(item.requiredYears) ? item.requiredYears : []),
          requirementDesc: this.toNullableStringFromUnknown(item.requirementDesc),
          requirementId: projectId,
          scoreWeight: Math.max(this.toNumberValue(item.scoreWeight) || 1, 0),
          sortOrder: this.toNumberValue(item.sortOrder) || index,
          tabKey,
        });
      })
      .filter((item): item is ProjectMaterialRequirementItemEntity => Boolean(item));
  }

  async getClientDeclarationMaterialReadiness(
    userId: number,
    id: string,
  ): Promise<ClientProjectMaterialReadiness> {
    const declaration = await this.requireClientDeclaration(userId, id);
    const latestCheck = await this.declarationMaterialCheckRepo.findOne({
      order: {
        checkedAt: 'DESC',
        id: 'DESC',
      },
      where: {
        declarationId: String(declaration.id),
        enterpriseId: declaration.enterpriseId,
      },
    });
    const parsedLatestCheck = this.parseMaterialCheckSummary(
      latestCheck?.summaryJson ?? null,
    );
    if (parsedLatestCheck) {
      return parsedLatestCheck;
    }

    return this.createClientDeclarationMaterialCheck(userId, id);
  }

  async createClientDeclarationMaterialCheck(
    userId: number,
    id: string,
  ): Promise<ClientProjectMaterialReadiness> {
    const declaration = await this.requireClientDeclaration(userId, id);
    const snapshot = this.parseJsonObject(declaration.snapshotJson);
    const project = await this.requireClientDeclareProject(
      userId,
      declaration.projectId,
      this.getDeclarationRegionId(declaration, snapshot),
    );
    const snapshotScheme = snapshot.scheme as
      | ResolvedDeclarationScheme
      | undefined;
    const result = await this.buildAndPersistMaterialCheck({
      declarationId: String(declaration.id),
      enterpriseId: declaration.enterpriseId,
      project: {
        ...project,
        scheme: snapshotScheme?.id ? snapshotScheme : project.scheme,
      },
    });

    return this.toClientProjectMaterialReadiness(project, result);
  }

  async getEnterpriseWorkspaceDeclarationMaterialReadiness(
    enterpriseId: string,
    declarationId: string,
  ): Promise<ClientProjectMaterialReadiness> {
    const declaration = await this.clientDeclarationRepo.findOne({
      where: { enterpriseId, id: declarationId },
    });
    if (!declaration) {
      throw new NotFoundException('申报记录不存在');
    }
    const snapshot = this.parseJsonObject(declaration.snapshotJson);
    const scheme = snapshot.scheme as ResolvedDeclarationScheme | undefined;
    const project = {
      id: declaration.projectId,
      name: declaration.projectName,
      scheme: scheme?.id ? scheme : null,
    } as ClientDeclareProjectItem;
    const result = await this.buildAndPersistMaterialCheck({
      declarationId: String(declaration.id),
      enterpriseId,
      project,
    });
    return this.toClientProjectMaterialReadiness(project, result);
  }

  async getEnterpriseWorkspaceDeclarationGaoxinScore(
    enterpriseId: string,
    declarationId: string,
    scoreRules?: Record<string, unknown>,
  ): Promise<GaoxinScoreResult | null> {
    const declaration = await this.clientDeclarationRepo.findOne({
      where: { enterpriseId, id: declarationId },
    });
    if (!declaration) {
      throw new NotFoundException('申报记录不存在');
    }
    const snapshot = this.parseJsonObject(declaration.snapshotJson);
    const scheme = snapshot.scheme as ResolvedDeclarationScheme | undefined;
    if (!this.normalizeDeclarationCapabilities(scheme?.capabilities).gaoxinScore) {
      return null;
    }
    return this.calculateGaoxinScore(declaration.enterpriseId, scoreRules);
  }

  private hasCompleteFinanceStatement(value?: null | Record<string, unknown>): boolean {
    if (!value) {
      return false;
    }
    return (
      ['fz', 'net_profit', 'zxc'].every((field) => this.isFilledValue(value[field])) &&
      this.isFilledValue(value.main_business_income ?? value.total_revenue)
    );
  }

  async getClientProjectGaoxinScore(
    userId: number,
    projectId: string,
    regionId?: string,
  ): Promise<GaoxinScoreResult> {
    const project = await this.requireClientDeclareProject(userId, projectId, regionId);
    this.requireSchemeCapability(project.scheme, 'gaoxinScore', '高企测算');
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.calculateGaoxinScore(enterpriseId);
  }

  async getClientProjectSchemeScore(
    userId: number,
    projectId: string,
    regionId?: string,
  ): Promise<null | SchemeScoreResult> {
    const [project, enterpriseId] = await Promise.all([
      this.requireClientDeclareProject(userId, projectId, regionId),
      this.requireCurrentEnterpriseId(userId),
    ]);
    if (!project.scheme) return null;
    this.requireSchemeCapability(project.scheme, 'score', '规则评分');
    const [material, metrics] = await Promise.all([
      this.getClientProjectMaterialReadiness(userId, projectId, regionId),
      this.loadSchemeScoreMetrics(enterpriseId),
    ]);
    return this.calculateSchemeScore(project.scheme, material.readinessScore, metrics);
  }

  async getClientProjectGaoxinAiDiagnosis(
    userId: number,
    projectId: string,
    regionId?: string,
  ): Promise<GaoxinAiDiagnosisResult> {
    const project = await this.requireClientDeclareProject(userId, projectId, regionId);
    this.requireSchemeCapability(project.scheme, 'gaoxinScore', 'AI 申报诊断');
    const [materialReadiness, gaoxinScore] = await Promise.all([
      this.getClientProjectMaterialReadiness(userId, projectId, regionId),
      this.getClientProjectGaoxinScore(userId, projectId, regionId),
    ]);
    const fallback = this.buildGaoxinAiDiagnosisFallback({
      gaoxinScore,
      materialReadiness,
      projectId: project.id,
      projectName: project.name,
    });

    return this.enhanceGaoxinAiDiagnosisWithAi(userId, {
      bizId: project.id,
      bizType: 'client_project',
      fallback,
      input: this.buildGaoxinAiDiagnosisInput({
        gaoxinScore,
        materialReadiness,
        projectName: project.name,
      }),
    });
  }

  async getClientDeclarationGaoxinScore(
    userId: number,
    id: string,
  ): Promise<GaoxinScoreResult> {
    const declaration = await this.requireClientDeclaration(userId, id);
    this.requireDeclarationCapability(declaration, 'gaoxinScore', '高企测算');
    return this.calculateGaoxinScore(declaration.enterpriseId);
  }

  async getClientDeclarationSchemeScore(
    userId: number,
    id: string,
  ): Promise<null | SchemeScoreResult> {
    const declaration = await this.requireClientDeclaration(userId, id);
    const snapshot = this.parseJsonObject(declaration.snapshotJson);
    const scheme = snapshot.scheme as ResolvedDeclarationScheme | undefined;
    if (!scheme?.id) return null;
    this.requireSchemeCapability(scheme, 'score', '规则评分');
    const [material, metrics] = await Promise.all([
      this.getClientDeclarationMaterialReadiness(userId, id),
      this.loadSchemeScoreMetrics(declaration.enterpriseId),
    ]);
    return this.calculateSchemeScore(scheme, material.readinessScore, metrics);
  }

  async getClientDeclarationGaoxinAiDiagnosis(
    userId: number,
    id: string,
  ): Promise<GaoxinAiDiagnosisResult> {
    const declaration = await this.requireClientDeclaration(userId, id);
    this.requireDeclarationCapability(declaration, 'gaoxinScore', 'AI 申报诊断');
    const [materialReadiness, gaoxinScore, bookDraft] = await Promise.all([
      this.getClientDeclarationMaterialReadiness(userId, id),
      this.calculateGaoxinScore(declaration.enterpriseId),
      this.getClientDeclarationGaoxinBookDraft(userId, id),
    ]);
    const exportIssues = [
      ...this.buildExportMaterialIssues(materialReadiness),
      ...this.buildExportScoreIssues(gaoxinScore),
      ...this.buildExportBookIssues(bookDraft),
      ...this.buildExportEvidenceChainIssues(materialReadiness),
    ];
    const fallback = this.buildGaoxinAiDiagnosisFallback({
      bookCompletionRate: bookDraft.completionRate,
      exportIssues,
      gaoxinScore,
      materialReadiness,
      projectId: declaration.projectId,
      projectName: declaration.projectName,
    });

    return this.enhanceGaoxinAiDiagnosisWithAi(userId, {
      bizId: String(declaration.id),
      bizType: 'client_declaration',
      fallback,
      input: this.buildGaoxinAiDiagnosisInput({
        bookDraft,
        exportIssues,
        gaoxinScore,
        materialReadiness,
        projectName: declaration.projectName,
      }),
    });
  }

  async getClientDeclarationGaoxinBookDraft(
    userId: number,
    id: string,
  ): Promise<GaoxinBookDraftResult> {
    const declaration = await this.requireClientDeclaration(userId, id);
    this.requireDeclarationCapability(declaration, 'gaoxinScore', '申报书草稿');
    const draft = await this.getOrCreateGaoxinBookDraft(declaration);
    return this.refreshGaoxinBookDraft(declaration, draft);
  }

  async saveClientDeclarationGaoxinBookDraft(
    userId: number,
    id: string,
    input: SaveClientGaoxinBookDraftDto,
  ): Promise<GaoxinBookDraftResult> {
    const declaration = await this.requireClientDeclaration(userId, id);
    this.requireDeclarationCapability(declaration, 'gaoxinScore', '申报书草稿');
    const draft = await this.getOrCreateGaoxinBookDraft(declaration);
    const currentSupplemental = this.parseGaoxinBookSupplemental(
      draft.supplementalJson,
    );
    draft.supplementalJson = JSON.stringify({
      ...currentSupplemental,
      ...this.normalizeGaoxinBookSupplemental(input.supplemental ?? {}),
    });
    await this.gaoxinBookDraftRepo.save(draft);
    return this.refreshGaoxinBookDraft(declaration, draft);
  }

  async getClientDeclarationGaoxinExportReadiness(
    userId: number,
    id: string,
  ): Promise<GaoxinExportReadinessResult> {
    const declaration = await this.requireClientDeclaration(userId, id);
    this.requireDeclarationCapability(declaration, 'exportPackage', '申报数据包导出');
    const scheme = this.parseJsonObject(declaration.snapshotJson).scheme as
      | ResolvedDeclarationScheme
      | undefined;
    const hasGaoxinContent = this.normalizeDeclarationCapabilities(
      scheme?.capabilities,
    ).gaoxinScore;
    const materialReadiness = await this.getClientDeclarationMaterialReadiness(
      userId,
      id,
    );
    const [gaoxinScore, bookDraft] = hasGaoxinContent
      ? await Promise.all([
          this.calculateGaoxinScore(declaration.enterpriseId),
          this.getClientDeclarationGaoxinBookDraft(userId, id),
        ])
      : [null, null];
    const issues = [
      ...this.buildExportMaterialIssues(materialReadiness),
      ...(gaoxinScore ? this.buildExportScoreIssues(gaoxinScore) : []),
      ...(bookDraft ? this.buildExportBookIssues(bookDraft) : []),
      ...this.buildExportEvidenceChainIssues(materialReadiness),
    ];
    const issueCounts = {
      error: issues.filter((item) => item.level === 'error').length,
      info: issues.filter((item) => item.level === 'info').length,
      warning: issues.filter((item) => item.level === 'warning').length,
    };
    const status =
      issueCounts.error > 0 || gaoxinScore?.riskLevel === 'high'
        ? 'high_risk'
        : issueCounts.warning > 0
          ? 'needs_completion'
          : 'ready';
    const canExport = status === 'ready';

    return {
      bookCompletionRate: bookDraft?.completionRate ?? null,
      canExport,
      declarationId: String(declaration.id),
      generatedAt: new Date().toISOString(),
      gaoxinScore: gaoxinScore?.totalScore ?? null,
      hasGaoxinContent,
      issueCounts,
      issues,
      materialReadinessScore: materialReadiness.readinessScore,
      projectId: declaration.projectId,
      projectName: declaration.projectName,
      riskLevel: status === 'ready' ? 'low' : status === 'needs_completion' ? 'medium' : 'high',
      status,
      summary: canExport
        ? hasGaoxinContent
          ? '当前申报书草稿、企业资料、附件和证据链已满足导出准备要求。'
          : '当前企业资料、附件和材料清单已满足导出准备要求。'
        : `当前还有 ${issueCounts.error} 个阻断项、${issueCounts.warning} 个提醒项，建议补齐后再导出。`,
    };
  }

  async downloadClientDeclarationGaoxinExportPackage(
    userId: number,
    id: string,
    response: Response,
  ): Promise<void> {
    const declaration = await this.requireClientDeclaration(userId, id);
    this.requireDeclarationCapability(declaration, 'exportPackage', '申报数据包导出');
    const [readiness, materialReadiness] = await Promise.all([
      this.getClientDeclarationGaoxinExportReadiness(userId, id),
      this.getClientDeclarationMaterialReadiness(userId, id),
    ]);
    const [gaoxinScore, bookDraft] = readiness.hasGaoxinContent
      ? await Promise.all([
          this.calculateGaoxinScore(declaration.enterpriseId),
          this.getClientDeclarationGaoxinBookDraft(userId, id),
        ])
      : [null, null];
    const ExcelJS = this.requireExcelRuntime();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'new-kjqb';
    workbook.created = new Date();

    this.appendGaoxinExportSummarySheet(workbook, readiness);
    this.appendGaoxinExportIssuesSheet(workbook, readiness.issues);
    if (bookDraft) this.appendGaoxinExportBookSheet(workbook, bookDraft);
    if (gaoxinScore) this.appendGaoxinExportScoreSheet(workbook, gaoxinScore);
    this.appendGaoxinExportMaterialSheet(workbook, materialReadiness);

    const filename = `${declaration.projectName || '高企申报'}-申报数据包.xlsx`;
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    const buffer = await workbook.xlsx.writeBuffer();
    response.send(Buffer.from(buffer));
  }

  private appendGaoxinExportSummarySheet(
    workbook: ExcelWorkbook,
    readiness: GaoxinExportReadinessResult,
  ) {
    const sheet = workbook.addWorksheet('导出说明');
    sheet.columns = [
      { header: '项目', key: 'label', width: 24 },
      { header: '内容', key: 'value', width: 72 },
    ];
    const rows = [
      ['申报项目', readiness.projectName],
      ['导出状态', readiness.status],
      ['是否可导出', readiness.canExport ? '是' : '否'],
      ['整体风险', readiness.riskLevel],
      ['材料准备度', `${readiness.materialReadinessScore}`],
      ['阻断项', `${readiness.issueCounts.error}`],
      ['提醒项', `${readiness.issueCounts.warning}`],
      ['检查时间', readiness.generatedAt],
      ['说明', readiness.summary],
    ];
    if (readiness.hasGaoxinContent) {
      rows.splice(5, 0,
        ['草稿完整度', `${readiness.bookCompletionRate}`],
        ['高企测算分', `${readiness.gaoxinScore}`],
      );
    }
    rows.forEach(([label, value]) => sheet.addRow({ label, value }));
    this.styleGaoxinExportSheet(sheet);
  }

  private appendGaoxinExportIssuesSheet(
    workbook: ExcelWorkbook,
    issues: GaoxinExportReadinessIssue[],
  ) {
    const sheet = workbook.addWorksheet('导出问题清单');
    sheet.columns = [
      { header: '级别', key: 'level', width: 12 },
      { header: '来源', key: 'source', width: 18 },
      { header: '问题', key: 'title', width: 32 },
      { header: '说明', key: 'description', width: 72 },
      { header: '是否阻断导出', key: 'blockingExport', width: 16 },
      { header: '处理动作', key: 'actionText', width: 20 },
      { header: '模块', key: 'moduleKey', width: 16 },
      { header: '页签', key: 'tabKey', width: 20 },
    ];
    issues.forEach((issue) =>
      sheet.addRow({
        ...issue,
        blockingExport: issue.blockingExport ? '是' : '否',
      }),
    );
    this.styleGaoxinExportSheet(sheet);
  }

  private appendGaoxinExportBookSheet(
    workbook: ExcelWorkbook,
    draft: GaoxinBookDraftResult,
  ) {
    const sheet = workbook.addWorksheet('申报书草稿');
    sheet.columns = [
      { header: '章节', key: 'section', width: 24 },
      { header: '记录', key: 'record', width: 28 },
      { header: '字段', key: 'label', width: 24 },
      { header: '内容', key: 'value', width: 60 },
      { header: '来源', key: 'source', width: 18 },
      { header: '是否可编辑', key: 'editable', width: 14 },
      { header: '模块', key: 'moduleKey', width: 16 },
      { header: '页签', key: 'tabKey', width: 20 },
    ];
    draft.sections.forEach((section) => {
      section.fields.forEach((field) =>
        sheet.addRow({
          editable: field.editable ? '是' : '否',
          label: field.label,
          moduleKey: field.moduleKey ?? '',
          record: '',
          section: section.title,
          source: field.source,
          tabKey: field.tabKey ?? '',
          value: field.value ?? '',
        }),
      );
      section.records.forEach((record) => {
        record.fields.forEach((field) =>
          sheet.addRow({
            editable: field.editable ? '是' : '否',
            label: field.label,
            moduleKey: field.moduleKey ?? '',
            record: record.title,
            section: section.title,
            source: field.source,
            tabKey: field.tabKey ?? '',
            value: field.value ?? '',
          }),
        );
      });
    });
    this.styleGaoxinExportSheet(sheet);
  }

  private appendGaoxinExportScoreSheet(
    workbook: ExcelWorkbook,
    score: GaoxinScoreResult,
  ) {
    const sheet = workbook.addWorksheet('评分测算');
    sheet.columns = [
      { header: '评分项', key: 'label', width: 24 },
      { header: '得分', key: 'score', width: 12 },
      { header: '满分', key: 'maxScore', width: 12 },
      { header: '风险', key: 'riskLevel', width: 12 },
      { header: '规则摘要', key: 'ruleItems', width: 56 },
      { header: '证据链', key: 'evidenceChain', width: 48 },
      { header: '缺口数', key: 'missingEvidenceCount', width: 12 },
      { header: '依据', key: 'evidence', width: 48 },
      { header: '扣分原因', key: 'deductions', width: 56 },
      { header: '补齐建议', key: 'suggestions', width: 56 },
    ];
    score.categories.forEach((category) =>
      sheet.addRow({
        deductions: category.deductions.join('；'),
        evidence: category.evidence.join('；'),
        label: category.label,
        maxScore: category.maxScore,
        missingEvidenceCount: category.missingEvidenceCount,
        riskLevel: category.riskLevel,
        ruleItems: category.ruleItems.join('；'),
        score: category.score,
        evidenceChain: `${category.evidenceChain.summary}${
          category.evidenceChain.missing.length > 0
            ? `；缺：${category.evidenceChain.missing.join('、')}`
            : ''
        }`,
        suggestions: category.suggestions.map((item) => item.text).join('；'),
      }),
    );
    this.styleGaoxinExportSheet(sheet);
  }

  private appendGaoxinExportMaterialSheet(
    workbook: ExcelWorkbook,
    readiness: ClientProjectMaterialReadiness,
  ) {
    const sheet = workbook.addWorksheet('材料准备度');
    sheet.columns = [
      { header: '材料项', key: 'itemName', width: 28 },
      { header: '状态', key: 'checkStatus', width: 14 },
      { header: '匹配记录', key: 'matched', width: 14 },
      { header: '缺失字段', key: 'missingFields', width: 36 },
      { header: '缺附件', key: 'attachmentMissing', width: 12 },
      { header: '证据链', key: 'relationSummary', width: 56 },
      { header: '建议', key: 'suggestion', width: 56 },
      { header: '模块', key: 'moduleKey', width: 16 },
      { header: '页签', key: 'tabKey', width: 20 },
    ];
    readiness.items.forEach((item) =>
      sheet.addRow({
        attachmentMissing: item.attachmentMissing ? '是' : '否',
        checkStatus: item.checkStatus,
        itemName: item.itemName,
        matched: `${item.matchedCount}/${item.requiredCount}`,
        missingFields: item.missingFields.join('、'),
        moduleKey: item.moduleKey,
        relationSummary: Object.entries(item.relationSummary ?? {})
          .map(([key, ids]) => `${key}:${ids.join(',')}`)
          .join('；'),
        suggestion: item.suggestion ?? '',
        tabKey: item.tabKey,
      }),
    );
    this.styleGaoxinExportSheet(sheet);
  }

  private styleGaoxinExportSheet(sheet: any) {
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.eachRow((row: any) => {
      row.alignment = { vertical: 'top', wrapText: true };
    });
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  private buildExportMaterialIssues(
    readiness: ClientProjectMaterialReadiness,
  ): GaoxinExportReadinessIssue[] {
    return readiness.items
      .filter((item) => item.checkStatus !== 'passed')
      .map((item) => ({
        actionText: '去企业资料补齐',
        blockingExport: item.checkStatus === 'missing' || item.attachmentMissing,
        description:
          item.suggestion ??
          `请补齐 ${item.itemName}，缺失字段：${
            item.missingFields.length > 0 ? item.missingFields.join('、') : '暂无'
          }。`,
        key: `material-${item.moduleKey}-${item.tabKey}-${item.itemName}`,
        level: item.checkStatus === 'missing' || item.attachmentMissing ? 'error' : 'warning',
        moduleKey: item.moduleKey,
        source: 'material',
        tabKey: item.tabKey,
        title: `${item.itemName}未满足导出要求`,
      }));
  }

  private buildExportScoreIssues(
    score: GaoxinScoreResult,
  ): GaoxinExportReadinessIssue[] {
    const issues: GaoxinExportReadinessIssue[] = [];
    if (!score.passed) {
      issues.push({
        actionText: '查看评分补齐建议',
        blockingExport: true,
        description: `当前测算 ${score.totalScore} 分，低于建议达标线 ${score.passScore} 分。`,
        key: 'score-total-below-pass',
        level: 'error',
        source: 'score',
        title: '高企评分测算未达到建议线',
      });
    }

    score.categories
      .filter((category) => category.riskLevel !== 'low')
      .forEach((category) => {
        const firstSuggestion = category.suggestions[0];
        issues.push({
          actionText: firstSuggestion ? '去企业资料补齐' : '查看评分说明',
          blockingExport: category.riskLevel === 'high',
          description:
            category.deductions[0] ??
            `${category.label}当前 ${category.score}/${category.maxScore}，建议完善相关证明材料。`,
          key: `score-${category.key}`,
          level: category.riskLevel === 'high' ? 'error' : 'warning',
          moduleKey: firstSuggestion?.moduleKey,
          source: 'score',
          tabKey: firstSuggestion?.tabKey,
          title: `${category.label}存在${category.riskLevel === 'high' ? '高' : '中'}风险`,
        });
      });

    return issues;
  }

  private buildExportBookIssues(
    draft: GaoxinBookDraftResult,
  ): GaoxinExportReadinessIssue[] {
    const issues: GaoxinExportReadinessIssue[] = [];
    draft.sections.forEach((section) => {
      const fields = [
        ...section.fields,
        ...section.records.flatMap((record) => record.fields),
      ];
      fields
        .filter((field) => !this.isFilledValue(field.value))
        .forEach((field) => {
          issues.push({
            actionText: field.editable ? '完善申报书草稿' : '去企业资料补齐',
            blockingExport: !field.editable,
            description: `${section.title}中的“${field.label}”为空。`,
            key: `book-${section.key}-${field.key}`,
            level: field.editable ? 'warning' : 'error',
            moduleKey: field.moduleKey,
            source: field.editable ? 'book' : 'enterprise_profile',
            tabKey: field.tabKey,
            title: `申报书字段缺失：${field.label}`,
          });
        });
    });

    if (draft.completionRate < 90) {
      issues.push({
        actionText: '完善申报书草稿',
        blockingExport: true,
        description: `当前申报书草稿完整度 ${draft.completionRate}%，低于 90% 的导出准备线。`,
        key: 'book-completion-below-90',
        level: 'error',
        source: 'book',
        title: '申报书草稿完整度不足',
      });
    }

    return issues;
  }

  private buildExportEvidenceChainIssues(
    readiness: ClientProjectMaterialReadiness,
  ): GaoxinExportReadinessIssue[] {
    const relationRequiredItems = readiness.items.filter((item) =>
      ['productService', 'transformation'].includes(item.tabKey),
    );

    return relationRequiredItems
      .filter((item) => {
        const summary = item.relationSummary ?? {};
        return ['contract', 'invoice', 'ip', 'rd'].some(
          (key) => (summary[key]?.length ?? 0) === 0,
        );
      })
      .map((item) => ({
        actionText: '去企业资料补齐证据链',
        blockingExport: false,
        description: `${item.itemName}建议同时关联 RD、IP、合同、发票等证据，便于后续正式导出和申报核查。`,
        key: `evidence-${item.moduleKey}-${item.tabKey}-${item.itemName}`,
        level: 'warning' as const,
        moduleKey: item.moduleKey,
        source: 'evidence_chain' as const,
        tabKey: item.tabKey,
        title: `${item.itemName}证据链不完整`,
      }));
  }

  private buildGaoxinAiDiagnosisFallback(input: {
    bookCompletionRate?: number;
    exportIssues?: GaoxinExportReadinessIssue[];
    gaoxinScore: GaoxinScoreResult;
    materialReadiness: ClientProjectMaterialReadiness;
    projectId: string;
    projectName: string;
  }): GaoxinAiDiagnosisResult {
    const scoreGap = Math.max(
      0,
      input.gaoxinScore.passScore - input.gaoxinScore.totalScore,
    );
    const riskLevel = this.resolveGaoxinDiagnosisRiskLevel(input);
    const conclusion =
      riskLevel === 'low'
        ? 'recommended'
        : riskLevel === 'medium'
          ? 'can_try'
          : 'not_ready';
    const weakCategories = input.gaoxinScore.categories.filter(
      (category) => category.riskLevel !== 'low',
    );
    const missingMaterials = input.materialReadiness.items.filter(
      (item) => item.checkStatus !== 'passed',
    );
    const advantages = [
      ...input.gaoxinScore.categories
        .filter((category) => category.riskLevel === 'low')
        .map((category) => `${category.label}基础较好，当前 ${category.score}/${category.maxScore} 分。`),
      input.materialReadiness.readinessScore >= 85
        ? `材料准备度 ${input.materialReadiness.readinessScore}%，已接近导出准备要求。`
        : null,
      input.bookCompletionRate !== undefined && input.bookCompletionRate >= 90
        ? `申报书草稿完整度 ${input.bookCompletionRate}%，基础内容较完整。`
        : null,
    ].filter((item): item is string => Boolean(item));
    const risks = [
      scoreGap > 0
        ? `高企测算分 ${input.gaoxinScore.totalScore}，距离建议线 ${input.gaoxinScore.passScore} 还差 ${scoreGap} 分。`
        : null,
      input.materialReadiness.riskLevel !== 'low'
        ? `材料准备度 ${input.materialReadiness.readinessScore}%，仍有 ${input.materialReadiness.missingItems} 项材料待补齐。`
        : null,
      input.bookCompletionRate !== undefined && input.bookCompletionRate < 90
        ? `申报书草稿完整度 ${input.bookCompletionRate}%，导出前仍需完善。`
        : null,
      ...weakCategories.map(
        (category) =>
          `${category.label}存在${category.riskLevel === 'high' ? '高' : '中'}风险：${
            category.deductions[0] ?? '相关证明材料仍需补强'
          }`,
      ),
    ].filter((item): item is string => Boolean(item));
    const priorityActions: GaoxinAiDiagnosisAction[] = [
      ...weakCategories.flatMap((category) =>
        category.suggestions.slice(0, 2).map((suggestion) => ({
          actionText: '去企业资料补齐',
          description: suggestion.text,
          key: `score-${category.key}-${suggestion.moduleKey}-${suggestion.tabKey}`,
          moduleKey: suggestion.moduleKey,
          priority: (category.riskLevel === 'high' ? 'high' : 'medium') as
            | 'high'
            | 'medium',
          tabKey: suggestion.tabKey,
          title: `补强${category.label}`,
        })),
      ),
      ...missingMaterials.slice(0, 4).map((item) => ({
        actionText: '去企业资料补齐',
        description:
          item.suggestion ??
          `当前匹配 ${item.matchedCount}/${item.requiredCount}，缺失字段：${
            item.missingFields.join('、') || '暂无字段缺口'
        }。`,
        key: `material-${item.moduleKey}-${item.tabKey}-${item.itemName}`,
        moduleKey: item.moduleKey,
        priority: (item.checkStatus === 'missing' ? 'high' : 'medium') as
          | 'high'
          | 'medium',
        tabKey: item.tabKey,
        title: `补齐${item.itemName}`,
      })),
    ];
    if (input.bookCompletionRate !== undefined && input.bookCompletionRate < 90) {
      priorityActions.push({
        actionText: '完善申报书草稿',
        description: '补齐申报补充说明和草稿缺失字段，导出前建议完整度达到 90% 以上。',
        key: 'book-draft-completion',
        priority: input.bookCompletionRate < 70 ? 'high' : 'medium',
        title: '完善申报书草稿',
      });
    }

    return {
      adapterStatus: 'fallback_not_configured',
      advantages: advantages.length > 0 ? advantages : ['当前已完成基础申报诊断，可继续按缺口补齐资料。'],
      bookCompletionRate: input.bookCompletionRate,
      conclusion,
      generatedAt: new Date().toISOString(),
      materialReadinessScore: input.materialReadiness.readinessScore,
      mode: 'rule',
      nextSteps: this.buildGaoxinDiagnosisNextSteps(conclusion, Boolean(input.bookCompletionRate)),
      priorityActions: this.uniqueGaoxinDiagnosisActions(priorityActions).slice(0, 8),
      projectId: input.projectId,
      projectName: input.projectName,
      riskLevel,
      risks: risks.length > 0 ? risks : ['当前未发现明显阻断风险，建议继续核对附件和证据链。'],
      scoreGap,
      summary: this.buildGaoxinDiagnosisSummary({
        conclusion,
        materialScore: input.materialReadiness.readinessScore,
        scoreGap,
        totalScore: input.gaoxinScore.totalScore,
      }),
      totalScore: input.gaoxinScore.totalScore,
    };
  }

  private async enhanceGaoxinAiDiagnosisWithAi(
    userId: number,
    input: {
      bizId: string;
      bizType: string;
      fallback: GaoxinAiDiagnosisResult;
      input: Record<string, unknown>;
    },
  ): Promise<GaoxinAiDiagnosisResult> {
    if (!this.canUseClientDeclarationAi()) {
      return input.fallback;
    }

    const task = await this.aiTaskRepo.save(
      this.aiTaskRepo.create({
        bizId: input.bizId,
        bizType: input.bizType,
        createdBy: String(userId),
        inputSnapshot: JSON.stringify(input.input),
        scene: 'gaoxin_declaration_diagnosis',
        status: 'running',
      }),
    );

    try {
      const aiResult = await this.aiService.runStructuredJsonCompletion({
        input: input.input,
        outputSchema: this.getGaoxinDiagnosisOutputSchema(),
        scene: 'gaoxin_declaration_diagnosis',
        systemPrompt: this.getGaoxinDiagnosisSystemPrompt(),
        taskId: String(task.id),
      });
      const normalized = this.normalizeGaoxinAiDiagnosisResult(
        aiResult.structuredResult,
        input.fallback,
      );
      const savedResult = await this.aiResultRepo.save(
        this.aiResultRepo.create({
          confidence: normalized.riskLevel === input.fallback.riskLevel ? 'high' : 'medium',
          scene: 'gaoxin_declaration_diagnosis',
          status: 'confirmed',
          structuredResult: JSON.stringify(normalized),
          summary: normalized.summary,
          taskId: String(task.id),
        }),
      );
      task.finishedAt = new Date();
      task.resultId = String(savedResult.id);
      task.status = 'success';
      await this.aiTaskRepo.save(task);

      return {
        ...normalized,
        adapterStatus: 'success',
        aiModel: aiResult.model,
        aiTaskId: String(task.id),
        generatedAt: new Date().toISOString(),
        mode: 'ai',
      };
    } catch (error) {
      const message = this.resolveErrorMessage(error);
      task.errorMessage = message;
      task.finishedAt = new Date();
      task.status = 'failed';
      await this.aiTaskRepo.save(task);
      return {
        ...input.fallback,
        adapterError: message,
        adapterStatus: 'fallback_after_error',
        aiTaskId: String(task.id),
      };
    }
  }

  private buildGaoxinAiDiagnosisInput(input: {
    bookDraft?: GaoxinBookDraftResult;
    exportIssues?: GaoxinExportReadinessIssue[];
    gaoxinScore: GaoxinScoreResult;
    materialReadiness: ClientProjectMaterialReadiness;
    projectName: string;
  }): Record<string, unknown> {
    return {
      bookDraft: input.bookDraft
        ? {
            completionRate: input.bookDraft.completionRate,
            status: input.bookDraft.status,
          }
        : null,
      exportIssues: (input.exportIssues ?? []).slice(0, 20).map((issue) => ({
        blockingExport: issue.blockingExport,
        description: issue.description,
        level: issue.level,
        moduleKey: issue.moduleKey,
        source: issue.source,
        tabKey: issue.tabKey,
        title: issue.title,
      })),
      gaoxinScore: {
        categories: input.gaoxinScore.categories.map((category) => ({
          deductions: category.deductions,
          evidence: category.evidence,
          evidenceChain: category.evidenceChain,
          key: category.key,
          label: category.label,
          maxScore: category.maxScore,
          riskLevel: category.riskLevel,
          score: category.score,
          suggestions: category.suggestions,
        })),
        passScore: input.gaoxinScore.passScore,
        passed: input.gaoxinScore.passed,
        riskLevel: input.gaoxinScore.riskLevel,
        sourceCounts: input.gaoxinScore.sourceCounts,
        totalScore: input.gaoxinScore.totalScore,
      },
      materialReadiness: {
        checkStatus: input.materialReadiness.checkStatus,
        missingItems: input.materialReadiness.missingItems,
        readinessScore: input.materialReadiness.readinessScore,
        riskLevel: input.materialReadiness.riskLevel,
        totalItems: input.materialReadiness.totalItems,
        weakItems: input.materialReadiness.items
          .filter((item) => item.checkStatus !== 'passed')
          .slice(0, 20)
          .map((item) => ({
            attachmentMissing: item.attachmentMissing,
            checkStatus: item.checkStatus,
            itemName: item.itemName,
            matchedCount: item.matchedCount,
            missingFields: item.missingFields,
            moduleKey: item.moduleKey,
            relationSummary: item.relationSummary,
            requiredCount: item.requiredCount,
            suggestion: item.suggestion,
            tabKey: item.tabKey,
          })),
      },
      projectName: input.projectName,
    };
  }

  private normalizeGaoxinAiDiagnosisResult(
    value: Record<string, unknown>,
    fallback: GaoxinAiDiagnosisResult,
  ): GaoxinAiDiagnosisResult {
    return {
      ...fallback,
      advantages: this.readStringArrayFromUnknown(value.advantages, fallback.advantages),
      conclusion: this.readEnumFromUnknown(
        value.conclusion,
        ['can_try', 'not_ready', 'recommended'],
        fallback.conclusion,
      ),
      nextSteps: this.readStringArrayFromUnknown(value.nextSteps, fallback.nextSteps),
      priorityActions: this.normalizeGaoxinAiDiagnosisActions(
        value.priorityActions,
        fallback.priorityActions,
      ),
      riskLevel: this.readEnumFromUnknown(
        value.riskLevel,
        ['high', 'low', 'medium'],
        fallback.riskLevel,
      ),
      risks: this.readStringArrayFromUnknown(value.risks, fallback.risks),
      summary: this.readStringFromUnknown(value.summary, fallback.summary),
    };
  }

  private normalizeGaoxinAiDiagnosisActions(
    value: unknown,
    fallback: GaoxinAiDiagnosisAction[],
  ): GaoxinAiDiagnosisAction[] {
    if (!Array.isArray(value)) {
      return fallback;
    }
    const actions = value
      .filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === 'object' && !Array.isArray(item),
      )
      .map((item, index) => ({
        actionText: this.readStringFromUnknown(item.actionText, '去处理'),
        description: this.readStringFromUnknown(item.description, ''),
        key: this.readStringFromUnknown(item.key, `ai-action-${index}`),
        moduleKey: this.readOptionalStringFromUnknown(item.moduleKey),
        priority: this.readEnumFromUnknown(
          item.priority,
          ['high', 'low', 'medium'],
          'medium',
        ),
        tabKey: this.readOptionalStringFromUnknown(item.tabKey),
        title: this.readStringFromUnknown(item.title, '待处理事项'),
      }))
      .filter((item) => item.description || item.title);
    return actions.length > 0
      ? this.uniqueGaoxinDiagnosisActions(actions).slice(0, 8)
      : fallback;
  }

  private resolveGaoxinDiagnosisRiskLevel(input: {
    bookCompletionRate?: number;
    exportIssues?: GaoxinExportReadinessIssue[];
    gaoxinScore: GaoxinScoreResult;
    materialReadiness: ClientProjectMaterialReadiness;
  }): 'high' | 'low' | 'medium' {
    if (
      input.gaoxinScore.riskLevel === 'high' ||
      input.materialReadiness.riskLevel === 'high' ||
      (input.bookCompletionRate !== undefined && input.bookCompletionRate < 70) ||
      (input.exportIssues ?? []).some((issue) => issue.level === 'error')
    ) {
      return 'high';
    }
    if (
      input.gaoxinScore.riskLevel === 'medium' ||
      input.materialReadiness.riskLevel === 'medium' ||
      (input.bookCompletionRate !== undefined && input.bookCompletionRate < 90) ||
      (input.exportIssues ?? []).some((issue) => issue.level === 'warning')
    ) {
      return 'medium';
    }
    return 'low';
  }

  private buildGaoxinDiagnosisSummary(input: {
    conclusion: 'can_try' | 'not_ready' | 'recommended';
    materialScore: number;
    scoreGap: number;
    totalScore: number;
  }): string {
    if (input.conclusion === 'recommended') {
      return `当前高企测算 ${input.totalScore} 分，材料准备度 ${input.materialScore}%，建议继续核对附件后推进申报。`;
    }
    if (input.conclusion === 'can_try') {
      return `当前可以先创建申报草稿并补齐材料，测算分差 ${input.scoreGap} 分，建议优先处理高风险缺口。`;
    }
    return `当前资料和评分风险较高，仍可保留申报草稿，但建议先补齐关键材料和证据链。`;
  }

  private buildGaoxinDiagnosisNextSteps(
    conclusion: 'can_try' | 'not_ready' | 'recommended',
    hasBookDraft: boolean,
  ): string[] {
    if (conclusion === 'recommended') {
      return [
        '复核企业资料附件和证据链是否真实完整。',
        hasBookDraft ? '检查申报书草稿补充说明并准备导出数据包。' : '可先创建申报草稿，进入申报详情生成材料清单。',
        '导出申报数据包后交由项目老师或管理员复核。',
      ];
    }
    return [
      '先创建或保留申报草稿，不等待所有材料一次性补齐。',
      '按优先行动补齐财税、人员、知识产权、RD、PS、成果转化和附件。',
      hasBookDraft ? '完善申报书草稿中的补充说明。' : '资料补齐后重新测算评分和材料准备度。',
    ];
  }

  private uniqueGaoxinDiagnosisActions(
    actions: GaoxinAiDiagnosisAction[],
  ): GaoxinAiDiagnosisAction[] {
    const seen = new Set<string>();
    return actions.filter((action) => {
      const key = `${action.moduleKey ?? ''}-${action.tabKey ?? ''}-${action.title}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private getGaoxinDiagnosisSystemPrompt(): string {
    return [
      '你是高新技术企业申报 AI 诊断助手。',
      '只能根据输入的结构化评分、材料准备度、证据链、申报书草稿和导出问题清单给出诊断。',
      '不要编造企业事实、合同、收入、知识产权、附件或政府申报结论。',
      '分数结论必须尊重输入中的规则评分，不要自行改分。',
      '输出面向企业用户，语言要明确可执行，必须返回 JSON，不要输出 Markdown。',
    ].join('\n');
  }

  private getGaoxinDiagnosisOutputSchema(): Record<string, unknown> {
    return {
      advantages: ['优势点，字符串数组'],
      conclusion: 'recommended | can_try | not_ready',
      nextSteps: ['下一步建议，字符串数组'],
      priorityActions: [
        {
          actionText: '按钮文案',
          description: '处理说明',
          key: '唯一键',
          moduleKey: '可选企业资料模块',
          priority: 'high | medium | low',
          tabKey: '可选企业资料页签',
          title: '行动标题',
        },
      ],
      riskLevel: 'high | medium | low',
      risks: ['风险点，字符串数组'],
      summary: '不超过 120 字的综合诊断',
    };
  }

  private canUseClientDeclarationAi(): boolean {
    return (
      process.env.AI_CLIENT_DECLARATION_ENABLE !== '0' &&
      Boolean(process.env.AI_API_KEY)
    );
  }

  private readStringFromUnknown(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  private readOptionalStringFromUnknown(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private readStringArrayFromUnknown(
    value: unknown,
    fallback: string[],
  ): string[] {
    if (!Array.isArray(value)) {
      return fallback;
    }
    const items = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .slice(0, 8);
    return items.length > 0 ? items : fallback;
  }

  private readEnumFromUnknown<T extends string>(
    value: unknown,
    options: readonly T[],
    fallback: T,
  ): T {
    return typeof value === 'string' && options.includes(value as T)
      ? (value as T)
      : fallback;
  }

  private async getOrCreateGaoxinBookDraft(
    declaration: ClientDeclarationEntity,
  ): Promise<GaoxinBookDraftEntity> {
    const existing = await this.gaoxinBookDraftRepo.findOne({
      where: {
        declarationId: String(declaration.id),
      },
    });
    if (existing) {
      return existing;
    }

    return await this.gaoxinBookDraftRepo.save(
      this.gaoxinBookDraftRepo.create({
        completionRate: 0,
        declarationId: String(declaration.id),
        enterpriseId: declaration.enterpriseId,
        projectId: declaration.projectId,
        readonlySnapshotJson: null,
        status: 'draft',
        supplementalJson: JSON.stringify(this.getDefaultGaoxinBookSupplemental()),
      }),
    );
  }

  private async refreshGaoxinBookDraft(
    declaration: ClientDeclarationEntity,
    draft: GaoxinBookDraftEntity,
  ): Promise<GaoxinBookDraftResult> {
    const supplemental = {
      ...this.getDefaultGaoxinBookSupplemental(),
      ...this.parseGaoxinBookSupplemental(draft.supplementalJson),
    };
    const sections = await this.buildGaoxinBookSections(
      declaration.enterpriseId,
      supplemental,
    );
    const completionRate = this.calculateGaoxinBookCompletionRate(sections);
    Object.assign(draft, {
      completionRate,
      readonlySnapshotJson: JSON.stringify(sections),
      status: completionRate >= 90 ? 'ready' : 'draft',
      supplementalJson: JSON.stringify(supplemental),
    });
    const saved = await this.gaoxinBookDraftRepo.save(draft);

    return {
      completionRate,
      declarationId: String(declaration.id),
      draftId: String(saved.id),
      generatedAt: new Date().toISOString(),
      projectId: declaration.projectId,
      projectName: declaration.projectName,
      sections,
      status: saved.status,
      supplemental,
    };
  }

  private async buildGaoxinBookSections(
    enterpriseId: string,
    supplemental: Record<string, string>,
  ): Promise<GaoxinBookSection[]> {
    const [
      basic,
      financeRows,
      employeeRows,
      ipRows,
      rdRows,
      psRows,
      transformationRows,
    ] = await Promise.all([
      this.enterpriseBasicInfoRepo.findOne({ where: { enterpriseId } }),
      this.enterpriseFinanceRecordRepo.find({
        order: { year: 'DESC' },
        where: { enterpriseId, recordType: 'financial', status: 1 },
      }),
      this.enterpriseEmployeeRecordRepo.find({ where: { enterpriseId, status: 1 } }),
      this.enterprisePropertyRecordRepo.find({
        where: { enterpriseId, recordType: 'intellectual_property', status: 1 },
      }),
      this.enterprisePropertyRecordRepo.find({
        where: { enterpriseId, recordType: 'research_project', status: 1 },
      }),
      this.enterprisePropertyRecordRepo.find({
        where: { enterpriseId, recordType: 'product_service', status: 1 },
      }),
      this.enterprisePropertyRecordRepo.find({
        where: { enterpriseId, recordType: 'transformation', status: 1 },
      }),
    ]);
    const activeEmployees = employeeRows.filter((row) => row.isActive !== 0);
    const researchEmployees = employeeRows.filter((row) => row.isKjyf === 1);

    return [
      {
        description: '企业基础信息来自企业资料，只能跳转企业资料修改。',
        fields: [
          this.enterpriseBookField('enterpriseName', '企业名称', basic?.name, 'basic', 'info'),
          this.enterpriseBookField('creditCode', '统一社会信用代码', basic?.creditCode, 'basic', 'info'),
          this.enterpriseBookField('legalPerson', '法定代表人', basic?.legalPersonName, 'basic', 'info'),
          this.enterpriseBookField('establishTime', '成立时间', this.formatGaoxinBookDate(basic?.establishTime), 'basic', 'info'),
          this.enterpriseBookField('registeredAddress', '注册地址', basic?.regLocation, 'basic', 'info'),
          this.enterpriseBookField('industry', '所属行业', basic?.industry, 'basic', 'info'),
          this.enterpriseBookField('businessScope', '经营范围', basic?.businessScope, 'basic', 'info'),
        ],
        key: 'basicInfo',
        records: [],
        title: '企业基本信息',
      },
      {
        description: '财税数据来自企业资料财税模块，用于成长性和研发费用表。',
        fields: [],
        key: 'finance',
        records: financeRows.map((row) => ({
          fields: [
            this.enterpriseBookField('year', '年度', row.year, 'finance', 'financial'),
            this.enterpriseBookField('salesIncome', '销售收入', row.xxsr, 'finance', 'financial'),
            this.enterpriseBookField('netAssets', '净资产', row.netAssets ?? row.zxc, 'finance', 'financial'),
            this.enterpriseBookField('rdExpense', '研发费用', row.yffy, 'finance', 'financial'),
            this.enterpriseBookField('highTechIncome', '高新收入', row.highTechIncome, 'finance', 'financial'),
          ],
          id: String(row.id),
          title: `${row.year || '未知年度'} 财务数据`,
        })),
        title: '财税与成长性',
      },
      {
        description: '人员统计来自员工资料，支撑科技人员占比。',
        fields: [
          this.enterpriseBookField('employeeTotal', '职工总数', String(activeEmployees.length), 'employee', 'employees'),
          this.enterpriseBookField('researchEmployeeTotal', '科技人员数', String(researchEmployees.length), 'employee', 'employees'),
          this.enterpriseBookField(
            'researchEmployeeRatio',
            '科技人员占比',
            activeEmployees.length > 0
              ? `${this.roundStatNumber((researchEmployees.length / activeEmployees.length) * 100)}%`
              : '0%',
            'employee',
            'employees',
          ),
        ],
        key: 'employees',
        records: researchEmployees.slice(0, 20).map((row) => ({
          fields: [
            this.enterpriseBookField('name', '姓名', row.ygName, 'employee', 'employees'),
            this.enterpriseBookField('department', '部门', row.department, 'employee', 'employees'),
            this.enterpriseBookField('position', '岗位', row.position, 'employee', 'employees'),
            this.enterpriseBookField('rdProjects', '参与 RD', row.rdProjects, 'employee', 'employees'),
          ],
          id: String(row.id),
          title: row.ygName || '未命名科技人员',
        })),
        title: '人力资源情况',
      },
      {
        description: '知识产权清单来自研发与知识产权模块。',
        fields: [],
        key: 'intellectualProperty',
        records: ipRows.map((row) => ({
          fields: [
            this.enterpriseBookField('name', '名称', row.softWorkName, 'property', 'intellectualProperty'),
            this.enterpriseBookField('number', '编号', row.softWorkNum, 'property', 'intellectualProperty'),
            this.enterpriseBookField('level', 'I/II 类', row.ipLevel, 'property', 'intellectualProperty'),
            this.enterpriseBookField('rightHolder', '权利人', row.rightHolder, 'property', 'intellectualProperty'),
            this.enterpriseBookField('supportEffect', '核心支持程度', row.supportEffect, 'property', 'intellectualProperty'),
          ],
          id: String(row.id),
          title: row.softWorkName || '未命名知识产权',
        })),
        title: '知识产权汇总',
      },
      {
        description: 'RD 活动来自研发项目资料，申报说明可在补充说明中完善。',
        fields: [],
        key: 'researchProjects',
        records: rdRows.map((row) => ({
          fields: [
            this.enterpriseBookField('name', '项目名称', row.kyProjectName, 'property', 'researchProject'),
            this.enterpriseBookField('number', '项目编号', row.kyProjectNum, 'property', 'researchProject'),
            this.enterpriseBookField('leader', '负责人', row.kyProjectLeader, 'property', 'researchProject'),
            this.enterpriseBookField('expense', '研发费用', row.rdExpenseTotal ?? row.fundAmount, 'property', 'researchProject'),
            this.enterpriseBookField('innovation', '创新点', row.innovationPoints, 'property', 'researchProject'),
          ],
          id: String(row.id),
          title: row.kyProjectName || '未命名 RD 项目',
        })),
        title: '研发项目 RD',
      },
      {
        description: 'PS 与成果转化来自企业资料证据链。',
        fields: [],
        key: 'productsAndTransformations',
        records: [
          ...psRows.map((row) => ({
            fields: [
              this.enterpriseBookField('name', 'PS 名称', row.psName, 'property', 'productService'),
              this.enterpriseBookField('code', 'PS 编号', row.psCode, 'property', 'productService'),
              this.enterpriseBookField('income', '高新收入', row.highTechIncome, 'property', 'productService'),
              this.enterpriseBookField('description', '关键技术', row.techDescription, 'property', 'productService'),
            ],
            id: `ps-${row.id}`,
            title: row.psName || '未命名 PS',
          })),
          ...transformationRows.map((row) => ({
            fields: [
              this.enterpriseBookField('name', '成果名称', row.transformationName, 'property', 'transformation'),
              this.enterpriseBookField('year', '转化年度', row.transformationYear, 'property', 'transformation'),
              this.enterpriseBookField('method', '转化方式', row.transformationMethod, 'property', 'transformation'),
              this.enterpriseBookField('income', '转化收入', row.transformationIncome, 'property', 'transformation'),
            ],
            id: `transformation-${row.id}`,
            title: row.transformationName || '未命名成果转化',
          })),
        ],
        title: 'PS 与成果转化',
      },
      {
        description: '这些是本次申报专用说明，可在申报草稿中保存。',
        fields: [
          this.supplementalBookField('projectSummary', '项目概述', supplemental.projectSummary),
          this.supplementalBookField('innovationSummary', '创新能力说明', supplemental.innovationSummary),
          this.supplementalBookField('rdSummary', '研发活动说明', supplemental.rdSummary),
          this.supplementalBookField('psSummary', '高新产品/服务说明', supplemental.psSummary),
          this.supplementalBookField('transformationSummary', '成果转化说明', supplemental.transformationSummary),
        ],
        key: 'supplemental',
        records: [],
        title: '申报补充说明',
      },
    ];
  }

  private calculateGaoxinBookCompletionRate(sections: GaoxinBookSection[]): number {
    const fields = sections.flatMap((section) => [
      ...section.fields,
      ...section.records.flatMap((record) => record.fields),
    ]);
    if (fields.length === 0) {
      return 0;
    }
    const filledCount = fields.filter((field) => this.isFilledValue(field.value)).length;
    return this.roundStatNumber((filledCount / fields.length) * 100);
  }

  private enterpriseBookField(
    key: string,
    label: string,
    value: unknown,
    moduleKey: string,
    tabKey: string,
  ): GaoxinBookField {
    return {
      editable: false,
      key,
      label,
      moduleKey,
      source: 'enterprise_profile',
      tabKey,
      value: this.toGaoxinBookString(value),
    };
  }

  private supplementalBookField(
    key: string,
    label: string,
    value: unknown,
  ): GaoxinBookField {
    return {
      editable: true,
      key,
      label,
      source: 'supplemental',
      value: this.toGaoxinBookString(value),
    };
  }

  private getDefaultGaoxinBookSupplemental(): Record<string, string> {
    return {
      innovationSummary: '',
      projectSummary: '',
      psSummary: '',
      rdSummary: '',
      transformationSummary: '',
    };
  }

  private normalizeGaoxinBookSupplemental(
    value: Record<string, unknown>,
  ): Record<string, string> {
    const defaults = this.getDefaultGaoxinBookSupplemental();
    return Object.fromEntries(
      Object.keys(defaults).map((key) => [
        key,
        this.truncateFinanceText(this.toGaoxinBookString(value[key]) ?? '', 5000) ?? '',
      ]),
    );
  }

  private parseGaoxinBookSupplemental(value: null | string): Record<string, string> {
    if (!value) {
      return {};
    }
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return this.normalizeGaoxinBookSupplemental(parsed);
    } catch {
      return {};
    }
  }

  private formatGaoxinBookDate(value: Date | null | undefined): null | string {
    return value instanceof Date ? value.toISOString().slice(0, 10) : null;
  }

  private toGaoxinBookString(value: unknown): null | string {
    if (value === undefined || value === null) {
      return null;
    }
    const text = String(value).trim();
    return text ? text : null;
  }

  private async calculateGaoxinScore(
    enterpriseId: string,
    scoreRules?: Record<string, unknown>,
  ): Promise<GaoxinScoreResult> {
    const [
      financeRows,
      employeeRows,
      ipRows,
      rdRows,
      psRows,
      transformationRows,
      documentRows,
      contractRows,
      invoiceRows,
    ] = await Promise.all([
      this.enterpriseFinanceRecordRepo.find({
        where: { enterpriseId, recordType: 'financial', status: 1 },
      }),
      this.enterpriseEmployeeRecordRepo.find({ where: { enterpriseId, status: 1 } }),
      this.enterprisePropertyRecordRepo.find({
        where: { enterpriseId, recordType: 'intellectual_property', status: 1 },
      }),
      this.enterprisePropertyRecordRepo.find({
        where: { enterpriseId, recordType: 'research_project', status: 1 },
      }),
      this.enterprisePropertyRecordRepo.find({
        where: { enterpriseId, recordType: 'product_service', status: 1 },
      }),
      this.enterprisePropertyRecordRepo.find({
        where: { enterpriseId, recordType: 'transformation', status: 1 },
      }),
      this.enterpriseDocumentRecordRepo.find({ where: { enterpriseId, status: 1 } }),
      this.enterpriseContractRecordRepo.find({
        where: { enterpriseId, recordType: 'contract', status: 1 },
      }),
      this.enterpriseContractRecordRepo.find({
        where: { enterpriseId, recordType: 'invoice', status: 1 },
      }),
    ]);

    const rawCategories = [
      this.scoreGaoxinIp(ipRows),
      this.scoreGaoxinAchievement(
        transformationRows,
        psRows,
        contractRows,
        invoiceRows,
        financeRows,
      ),
      this.scoreGaoxinRdManagement(rdRows, employeeRows, documentRows, financeRows),
      this.scoreGaoxinGrowth(financeRows),
    ];
    const categories = this.enrichGaoxinScoreCategories(rawCategories);
    const totalScore = this.roundStatNumber(
      categories.reduce((total, item) => total + item.score, 0),
    );
    const configuredPassScore = Number(scoreRules?.passScore);
    const passScore = Number.isFinite(configuredPassScore) && configuredPassScore > 0
      ? configuredPassScore
      : 71;
    const configuredRuleVersion = scoreRules?.model;
    const ruleVersion =
      typeof configuredRuleVersion === 'string' && configuredRuleVersion.trim()
        ? configuredRuleVersion.trim()
        : 'gaoxin-v2-innovation-rules';
    const riskLevel =
      totalScore >= passScore ? 'low' : totalScore >= 60 ? 'medium' : 'high';

    return {
      calculatedAt: new Date().toISOString(),
      categories,
      passScore,
      passed: totalScore >= passScore,
      riskLevel,
      ruleVersion,
      sourceCounts: {
        contract: contractRows.length,
        document: documentRows.length,
        employee: employeeRows.length,
        finance: financeRows.length,
        intellectualProperty: ipRows.length,
        invoice: invoiceRows.length,
        productService: psRows.length,
        researchProject: rdRows.length,
        transformation: transformationRows.length,
      },
      summary:
        totalScore >= passScore
          ? '当前资料的系统预估已达到建议达标线，请继续核对附件、证据链及专家定性评分。'
          : '当前资料的系统预估未达到建议达标线，请优先补齐低分项对应企业资料。',
      totalScore,
      // 定性小项须由技术专家综合评价，系统仅按企业资料作预估展示。
    };
  }

  private scoreGaoxinIp(
    rows: EnterprisePropertyRecordEntity[],
  ): GaoxinScoreCategory {
    const evidence: string[] = [`知识产权记录 ${rows.length} 条`];
    const deductions: string[] = [];
    const suggestions: GaoxinScoreSuggestion[] = [];
    const levelOneCount = rows.filter((row) => {
      const level = String(row.ipLevel ?? row.softWorkType ?? '')
        .trim()
        .toUpperCase();
      return /(?:^|[^I])I类|Ⅰ类|1类|发明/u.test(level);
    }).length;
    const levelTwoCount = Math.max(rows.length - levelOneCount, 0);
    const coreCount = rows.filter((row) => row.isCoreIp === 1).length;
    const advancedAssessment = this.assessGaoxinIpQualitativeLevel(
      rows.map((row) => row.advancedDegree),
      '技术先进程度',
    );
    const supportAssessment = this.assessGaoxinIpQualitativeLevel(
      rows.map((row) => row.supportEffect),
      '核心支持作用',
    );
    const advancedScore = advancedAssessment.score;
    const supportScore = supportAssessment.score;
    const quantityScore =
      levelOneCount > 0
        ? 8
        : levelTwoCount >= 5
          ? 6
          : levelTwoCount >= 3
            ? 4
            : levelTwoCount >= 1
              ? 2
              : 0;
    const selfDevelopedCount = rows.filter((row) =>
      this.isSelfDevelopedIp(row.obtainMethod),
    ).length;
    const obtainScore =
      rows.length === 0 ? 0 : selfDevelopedCount > 0 ? 6 : 3;
    const standardCount = rows.filter((row) =>
      /参与.{0,12}(编制|起草).{0,20}(国家标准|行业标准|检测方法|技术规范)|(?:编制|起草).{0,20}(国家标准|行业标准|检测方法|技术规范)/iu.test(
        `${row.remark ?? ''} ${row.advancedDegree ?? ''} ${row.supportEffect ?? ''}`,
      ),
    ).length;
    const standardScore = standardCount > 0 ? 2 : 0;
    const score = Math.min(
      advancedScore + supportScore + quantityScore + obtainScore + standardScore,
      30,
    );

    evidence.push(
      `技术先进程度 ${advancedScore}/8`,
      `核心支持作用 ${supportScore}/8`,
      `I类 ${levelOneCount} 条，II类 ${levelTwoCount} 条`,
      `自主研发取得 ${selfDevelopedCount} 条`,
    );
    if (levelOneCount > 0) {
      evidence.push(`I 类或高价值知识产权 ${levelOneCount} 条`);
    }
    if (standardScore > 0) {
      evidence.push(`参与标准/检测方法/技术规范 ${standardCount} 项`);
    }
    if (rows.length === 0) {
      deductions.push('知识产权数量为 0');
      suggestions.push({
        moduleKey: 'property',
        tabKey: 'intellectualProperty',
        text: '补充专利、软著等知识产权清单和证书附件。',
      });
    }
    if (quantityScore < 6) {
      deductions.push('知识产权数量未达到 I 类 1 项或 II 类 5 项的高分档');
    }
    if (advancedScore < 7) {
      deductions.push('技术先进程度说明不足，未达到高分档');
    }
    if (supportScore < 7 || coreCount === 0) {
      deductions.push('对主要产品/服务的核心支持作用说明不足');
      suggestions.push({
        moduleKey: 'property',
        tabKey: 'intellectualProperty',
        text: '补齐知识产权技术先进程度、核心支持作用和主要产品/服务关联说明。',
      });
    }
    if (obtainScore < 6 && rows.length > 0) {
      deductions.push('知识产权取得方式未体现自主研发');
      suggestions.push({
        moduleKey: 'property',
        tabKey: 'intellectualProperty',
        text: '核对知识产权取得方式，优先补充自主研发形成的知识产权。',
      });
    }

    return this.toGaoxinScoreCategory({
      deductions,
      evidence,
      key: 'ip',
      label: '知识产权',
      maxScore: 30,
      score,
      subItems: [
        {
          basis: advancedAssessment.basis,
          expertReviewRequired: true,
          grade: advancedAssessment.grade,
          key: 'advancedDegree',
          label: '技术的先进程度',
          maxScore: 8,
          score: advancedScore,
          scoreRange: '高 7-8；较高 5-6；一般 3-4；较低 1-2；无 0',
        },
        {
          basis: supportAssessment.basis,
          expertReviewRequired: true,
          grade: supportAssessment.grade,
          key: 'coreSupport',
          label: '对主要产品（服务）的核心支持作用',
          maxScore: 8,
          score: supportScore,
          scoreRange: '强 7-8；较强 5-6；一般 3-4；较弱 1-2；无 0',
        },
        {
          basis: `I类 ${levelOneCount} 条，II类 ${levelTwoCount} 条`,
          expertReviewRequired: false,
          grade:
            levelOneCount > 0
              ? 'A档'
              : levelTwoCount >= 5
                ? 'B档'
                : levelTwoCount >= 3
                  ? 'C档'
                  : levelTwoCount >= 1
                    ? 'D档'
                    : 'E档',
          key: 'quantity',
          label: '知识产权数量',
          maxScore: 8,
          score: quantityScore,
          scoreRange: '≥1项I类 7-8；≥5项II类 5-6；3-4项II类 3-4；1-2项II类 1-2；0项 0',
        },
        {
          basis: `自主研发 ${selfDevelopedCount} 条，共 ${rows.length} 条`,
          expertReviewRequired: true,
          grade: selfDevelopedCount > 0 ? '含自主研发' : rows.length > 0 ? '仅受让/受赠/并购' : '无',
          key: 'obtainMethod',
          label: '知识产权获得方式',
          maxScore: 6,
          score: obtainScore,
          scoreRange: '有自主研发 1-6；仅受让、受赠和并购等 1-3；无 0',
        },
        {
          basis: `明确记录参与编制 ${standardCount} 项`,
          expertReviewRequired: true,
          grade: standardCount > 0 ? '加分项' : '未识别',
          key: 'standardParticipation',
          label: '参与编制标准、检测方法或技术规范',
          maxScore: 2,
          score: standardScore,
          scoreRange: '是 1-2；否 0（加分后知识产权总分不超过30）',
        },
      ],
      suggestions,
    });
  }

  private scoreGaoxinAchievement(
    transformationRows: EnterprisePropertyRecordEntity[],
    psRows: EnterprisePropertyRecordEntity[],
    contractRows: EnterpriseContractRecordEntity[],
    invoiceRows: EnterpriseContractRecordEntity[],
    financeRows: EnterpriseFinanceRecordEntity[],
  ): GaoxinScoreCategory {
    const currentYear = new Date().getFullYear();
    const latestFinancialYear = Math.max(
      ...financeRows
        .map((row) => Number(this.extractGaoxinYear(row.year)))
        .filter((year) => Number.isInteger(year) && year <= currentYear),
      Number.NEGATIVE_INFINITY,
    );
    // The evaluation period follows the latest completed financial year, rather
    // than the calendar year. This prevents a new application year from
    // incorrectly excluding the oldest of the three submitted fiscal years.
    const latestTransformationYear = Number.isFinite(latestFinancialYear)
      ? latestFinancialYear
      : Math.max(
        ...transformationRows
          .map((row) => Number(this.extractGaoxinYear(row.transformationYear)))
          .filter((year) => Number.isInteger(year) && year < currentYear),
        currentYear - 1,
      );
    const recentYears = [
      latestTransformationYear - 2,
      latestTransformationYear - 1,
      latestTransformationYear,
    ];
    const recentRows = transformationRows.filter((row) => {
      const year = this.extractGaoxinYear(row.transformationYear);
      return year ? recentYears.includes(Number(year)) : false;
    });
    const uniqueRows = this.uniqueGaoxinTransformations(recentRows);
    const yearCount = new Set(
      uniqueRows
        .map((row) => this.extractGaoxinYear(row.transformationYear))
        .filter((year): year is string => Boolean(year)),
    ).size;
    const averageCount = uniqueRows.length / 3;
    let score =
      averageCount >= 5
        ? 30
        : averageCount >= 4
          ? 24
          : averageCount >= 3
            ? 18
            : averageCount >= 2
              ? 12
              : averageCount >= 1
                ? 6
                : 0;
    const relationCount = uniqueRows.filter((row) =>
      [
        row.relatedContractIds,
        row.relatedInvoiceIds,
        row.relatedIpIds,
        row.relatedPsIds,
        row.relatedRdIds,
      ].some((value) => this.isFilledValue(value)),
    ).length;
    const proofCount = uniqueRows.filter((row) =>
      this.isFilledValue(row.proofFiles),
    ).length;
    if (uniqueRows.length > 0 && relationCount === 0) {
      score = Math.max(score - 4, 0);
    }
    if (uniqueRows.length > 0 && proofCount === 0) {
      score = Math.max(score - 3, 0);
    }

    const deductions: string[] = [];
    const suggestions: GaoxinScoreSuggestion[] = [];
    if (averageCount < 5) {
      deductions.push('近三年科技成果转化年平均数未达到 5 项高分档');
      suggestions.push({
        moduleKey: 'property',
        tabKey: 'transformation',
        text: '补充成果转化清单、年度、转化方式和证明材料。',
      });
    }
    if (transformationRows.length > 0 && yearCount === 0) {
      deductions.push('成果转化缺少转化年度，无法核对近三年归属');
    }
    if (relationCount === 0 && uniqueRows.length > 0) {
      deductions.push('成果转化尚未形成 RD/IP/PS/合同发票关联链');
      suggestions.push({
        moduleKey: 'property',
        tabKey: 'transformation',
        text: '将成果转化关联到 RD、IP、PS、合同和发票。',
      });
    }
    if (psRows.length === 0) {
      suggestions.push({
        moduleKey: 'property',
        tabKey: 'productService',
        text: '补充高新产品/服务 PS 和高新收入信息。',
      });
    }

    return this.toGaoxinScoreCategory({
      deductions,
      evidence: [
        `全部成果转化 ${transformationRows.length} 条`,
        `近三年（${recentYears.join('、')}）有效成果 ${uniqueRows.length} 条`,
        `近三年年平均 ${this.roundStatNumber(averageCount)} 项`,
        `PS ${psRows.length} 条`,
        `合同 ${contractRows.length} 条，发票 ${invoiceRows.length} 条`,
      ],
      key: 'achievement',
      label: '科技成果转化',
      maxScore: 30,
      score,
      subItems: [
        {
          basis: `近三年（${recentYears.join('、')}）有效且按成果编号去重后 ${uniqueRows.length} 项，年平均 ${this.roundStatNumber(averageCount)} 项`,
          expertReviewRequired: true,
          grade:
            averageCount >= 5
              ? 'A档（强）'
              : averageCount >= 4
                ? 'B档（较强）'
                : averageCount >= 3
                  ? 'C档（一般）'
                  : averageCount >= 2
                    ? 'D档（较弱）'
                    : averageCount >= 1
                      ? 'E档（弱）'
                      : 'F档（无）',
          key: 'threeYearAverage',
          label: '近三年科技成果转化年平均数',
          maxScore: 30,
          score,
          scoreRange: '≥5项 25-30；≥4项 19-24；≥3项 13-18；≥2项 7-12；≥1项 1-6；0项 0',
        },
      ],
      suggestions,
    });
  }

  private scoreGaoxinRdManagement(
    rdRows: EnterprisePropertyRecordEntity[],
    employeeRows: EnterpriseEmployeeRecordEntity[],
    documentRows: EnterpriseDocumentRecordEntity[],
    financeRows: EnterpriseFinanceRecordEntity[],
  ): GaoxinScoreCategory {
    const activeEmployees = employeeRows.filter((row) => row.isActive !== 0);
    const researchEmployees = employeeRows.filter((row) => row.isKjyf === 1);
    const rdExpenseRows = financeRows.filter((row) => this.isFilledValue(row.yffy));
    const documentText = documentRows
      .map((row) => `${row.fileTitle ?? ''} ${row.fileRemark ?? ''}`)
      .join(' ');
    const hasRdSystem =
      /研发|研究开发|辅助账|核算|投入/iu.test(documentText) ||
      rdExpenseRows.length >= 3;
    const hasRdInstitution =
      /研发机构|科研条件|产学研|合作|实验室|技术中心/iu.test(documentText) ||
      rdRows.some((row) => this.isFilledValue(row.rdOrganizationMethod));
    const hasTransformationSystem =
      /成果转化|激励|奖励|创新创业|平台/iu.test(documentText);
    const hasTalentSystem =
      /科技人员|人才|培训|进修|绩效|职工技能/iu.test(documentText);
    const score =
      (hasRdSystem ? 6 : rdExpenseRows.length > 0 || rdRows.length > 0 ? 3 : 0) +
      (hasRdInstitution ? 6 : rdRows.length > 0 ? 3 : 0) +
      (hasTransformationSystem ? 4 : documentRows.length > 0 ? 2 : 0) +
      (hasTalentSystem ? 4 : researchEmployees.length > 0 ? 2 : 0);

    const suggestions: GaoxinScoreSuggestion[] = [];
    const deductions: string[] = [];
    if (rdRows.length === 0) {
      deductions.push('缺少研发项目 RD 资料');
      suggestions.push({
        moduleKey: 'property',
        tabKey: 'researchProject',
        text: '补充 RD 项目、组织实施方式、核心技术和创新点。',
      });
    }
    if (documentRows.length === 0) {
      deductions.push('缺少研发组织、成果转化或人才激励制度文件');
      suggestions.push({
        moduleKey: 'document',
        tabKey: 'documents',
        text: '补充研发组织管理、成果转化、人才激励等制度文件。',
      });
    }
    if (rdExpenseRows.length < 3) {
      suggestions.push({
        moduleKey: 'finance',
        tabKey: 'financial',
        text: '补齐近三年研发费用数据。',
      });
    }

    return this.toGaoxinScoreCategory({
      deductions,
      evidence: [
        `RD 项目 ${rdRows.length} 条`,
        `科技人员 ${researchEmployees.length}/${activeEmployees.length} 人`,
        `制度文件 ${documentRows.length} 条`,
      ],
      key: 'rdManagement',
      label: '研究开发组织管理水平',
      maxScore: 20,
      score,
      subItems: [
        {
          basis: hasRdSystem
            ? '已识别研发管理、投入核算或研发费用辅助账资料'
            : '未完整识别研发管理、投入核算和研发费用辅助账资料',
          expertReviewRequired: true,
          grade: hasRdSystem ? '资料已识别' : '待补齐',
          key: 'rdSystem',
          label: '研发组织管理制度、投入核算体系和研发费用辅助账',
          maxScore: 6,
          score: hasRdSystem ? 6 : rdExpenseRows.length > 0 || rdRows.length > 0 ? 3 : 0,
          scoreRange: '≤6分，技术专家结合实际执行情况综合评价',
        },
        {
          basis: hasRdInstitution
            ? '已识别研发机构、科研条件、产学研合作或研发组织方式资料'
            : '未完整识别研发机构、科研条件和产学研合作资料',
          expertReviewRequired: true,
          grade: hasRdInstitution ? '资料已识别' : '待补齐',
          key: 'rdInstitution',
          label: '内部研发机构、科研条件和产学研合作',
          maxScore: 6,
          score: hasRdInstitution ? 6 : rdRows.length > 0 ? 3 : 0,
          scoreRange: '≤6分，技术专家结合实际执行情况综合评价',
        },
        {
          basis: hasTransformationSystem
            ? '已识别成果转化组织、激励奖励或创新平台资料'
            : '未完整识别成果转化组织、激励奖励和创新平台资料',
          expertReviewRequired: true,
          grade: hasTransformationSystem ? '资料已识别' : '待补齐',
          key: 'transformationSystem',
          label: '成果转化组织实施、激励奖励和创新创业平台',
          maxScore: 4,
          score: hasTransformationSystem ? 4 : documentRows.length > 0 ? 2 : 0,
          scoreRange: '≤4分，技术专家结合实际执行情况综合评价',
        },
        {
          basis: hasTalentSystem
            ? '已识别科技人员培养、培训、人才或绩效资料'
            : '未完整识别科技人员培养、培训、人才和绩效资料',
          expertReviewRequired: true,
          grade: hasTalentSystem ? '资料已识别' : '待补齐',
          key: 'talentSystem',
          label: '科技人员培养培训、人才引进和绩效奖励',
          maxScore: 4,
          score: hasTalentSystem ? 4 : researchEmployees.length > 0 ? 2 : 0,
          scoreRange: '≤4分，技术专家结合实际执行情况综合评价',
        },
      ],
      suggestions,
    });
  }

  private async buildGaoxinDocumentPackage(
    enterpriseId: string,
  ): Promise<GaoxinDocumentPackageResult> {
    const [
      enterprise,
      basicInfo,
      rdRows,
      employeeRows,
      financeRows,
      transformationRows,
      documentRows,
    ] = await Promise.all([
      this.enterpriseRepo.findOne({ where: { id: enterpriseId } }),
      this.enterpriseBasicInfoRepo.findOne({ where: { enterpriseId } }),
      this.enterprisePropertyRecordRepo.find({
        where: { enterpriseId, recordType: 'research_project', status: 1 },
      }),
      this.enterpriseEmployeeRecordRepo.find({ where: { enterpriseId, status: 1 } }),
      this.enterpriseFinanceRecordRepo.find({
        where: { enterpriseId, recordType: 'financial', status: 1 },
      }),
      this.enterprisePropertyRecordRepo.find({
        where: { enterpriseId, recordType: 'transformation', status: 1 },
      }),
      this.enterpriseDocumentRecordRepo.find({ where: { enterpriseId, status: 1 } }),
    ]);
    this.assertGaoxinDocumentPackageSourceReady({
      basicInfo,
      employeeRows,
      financeRows,
      rdRows,
      transformationRows,
    });
    const enterpriseName = basicInfo?.name ?? enterprise?.name ?? '本企业';
    const existingText = documentRows
      .map((row) => `${row.fileTitle ?? ''} ${row.fileRemark ?? ''}`)
      .join(' ');
    const profile = {
      documentCount: documentRows.length,
      enterpriseName,
      financeYearCount: financeRows.filter((row) => this.isFilledValue(row.year)).length,
      rdCount: rdRows.length,
      researchEmployeeCount: employeeRows.filter((row) => row.isKjyf === 1).length,
      totalEmployeeCount: employeeRows.filter((row) => row.isActive !== 0).length,
      transformationCount: transformationRows.length,
    };
    const context = {
      address: basicInfo?.regLocation ?? enterprise?.address ?? '企业实际经营地址',
      industry: basicInfo?.industry ?? enterprise?.industry ?? '企业所属技术领域',
      profile,
      rdNames: rdRows
        .map((row) => row.kyProjectName)
        .filter((value): value is string => this.isFilledValue(value))
        .slice(0, 6),
      years: financeRows
        .map((row) => row.year)
        .filter((value): value is string => this.isFilledValue(value))
        .map(String)
        .slice(-3),
    };
    const drafts = this.getGaoxinDocumentTemplates(context).map((draft) => ({
      ...draft,
      recommended: !this.isGaoxinDocumentDraftCovered(existingText, draft),
    }));

    return {
      drafts,
      generatedAt: new Date().toISOString(),
      profileSummary: profile,
      scoreRules: [
        {
          description: '研发组织管理制度、研发投入核算体系、研发费用辅助账。',
          maxScore: 6,
          title: '研发制度与费用核算',
        },
        {
          description: '内部研发机构、科研条件、产学研合作。',
          maxScore: 6,
          title: '研发机构与产学研',
        },
        {
          description: '成果转化组织实施、激励奖励、开放式创新创业平台。',
          maxScore: 4,
          title: '成果转化与创新平台',
        },
        {
          description: '科技人员培养进修、职工技能培训、人才引进和绩效奖励。',
          maxScore: 4,
          title: '人才培养与绩效激励',
        },
      ],
      summary: `系统已结合 ${enterpriseName} 当前 RD、财税、人员、成果转化和已有制度资料生成制度文件草稿，建议优先采纳未覆盖评分点的文件。`,
    };
  }

  private assertGaoxinDocumentPackageSourceReady(
    source: GaoxinDocumentPackageSourceData,
  ) {
    const missing: string[] = [];
    if (!source.basicInfo) {
      missing.push('企业基础信息');
    }
    if (source.rdRows.length === 0) {
      missing.push('RD 研发项目');
    }
    if (source.employeeRows.length === 0) {
      missing.push('员工记录');
    }
    if (
      source.financeRows.filter((row) => this.isFilledValue(row.year)).length === 0
    ) {
      missing.push('财务年度记录');
    }
    if (source.transformationRows.length === 0) {
      missing.push('成果转化记录');
    }
    if (missing.length > 0) {
      throw new BadRequestException(
        `生成制度文件包前请先补充必要材料：${missing.join('、')}。`,
      );
    }
  }

  private isGaoxinDocumentDraftCovered(
    existingText: string,
    draft: GaoxinDocumentPackageDraft,
  ): boolean {
    if (!existingText.trim()) {
      return false;
    }
    if (existingText.includes(draft.title)) {
      return true;
    }
    const keywordMap: Record<string, RegExp> = {
      achievement_incentive: /成果转化.*(奖励|激励)|奖励.*成果转化/iu,
      achievement_reward: /成果转化.*(管理|组织|实施)|科技成果转化管理/iu,
      innovation_platform: /创新.*平台|开放.*平台|创新创业/iu,
      rd_accounting: /研发.*(核算|投入|费用)|研发投入核算/iu,
      rd_auxiliary_account: /辅助账|研发费用.*台账|研发费用.*明细/iu,
      rd_center: /研发(中心|机构)|技术中心/iu,
      rd_condition: /科研条件|研发设备|研发场地|测试环境/iu,
      rd_project: /研发项目.*管理|研究开发.*制度/iu,
      talent_training: /科技人员|人才|培训|进修|绩效|职工技能/iu,
      university_cooperation: /产学研|合作研发|委托研发|联合研发/iu,
    };
    return keywordMap[draft.key]?.test(existingText) ?? false;
  }

  private getGaoxinDocumentTemplates(context: {
    address: string;
    industry: string;
    profile: {
      enterpriseName: string;
      financeYearCount: number;
      rdCount: number;
      researchEmployeeCount: number;
      totalEmployeeCount: number;
      transformationCount: number;
    };
    rdNames: string[];
    years: string[];
  }): GaoxinDocumentPackageDraft[] {
    const { profile } = context;
    const rdLine =
      context.rdNames.length > 0
        ? `当前已归档研发项目包括：${context.rdNames.join('、')}。`
        : '当前研发项目清单待进一步补充，后续应按 RD 编号持续归档。';
    const yearLine =
      context.years.length > 0
        ? `当前系统已维护财务年度：${context.years.join('、')}。`
        : '当前近三年研发费用年度数据待进一步补充。';
    const specs: Array<
      Omit<GaoxinDocumentPackageDraft, 'content' | 'recommended'> & {
        attachmentChecklist: string[];
        chapters: Array<{ articles: string[]; title: string }>;
      }
    > = [
      {
        attachmentChecklist: [
          '研发项目立项申请表',
          '研发项目立项评审记录',
          '研发项目阶段检查记录',
          '研发项目结题验收表',
          '研发项目资料归档清单',
        ],
        chapters: [
          {
            articles: [
              `为规范 ${profile.enterpriseName} 研究开发活动管理，建立从研发需求提出、立项评审、过程控制、结题验收到资料归档的闭环机制，制定本制度。`,
              `本制度适用于企业围绕 ${context.industry} 开展的自主研发、合作研发、委托研发及技术改进类项目。`,
              '研发项目管理应遵循目标明确、过程可控、费用可核、成果可验、资料可追溯的原则。',
            ],
            title: '总则',
          },
          {
            articles: [
              '企业负责人负责审定年度研发方向、重点项目和资源投入。',
              '研发负责人负责组织项目立项、技术方案评审、研发进度跟踪、阶段成果确认和结题验收。',
              '财务人员负责研发费用科目归集、项目费用核对和费用资料归档。',
              '资料管理员负责立项报告、过程记录、测试记录、知识产权材料和成果转化材料的归档。',
            ],
            title: '管理职责',
          },
          {
            articles: [
              `研发项目应结合主营业务、客户需求、技术难点、产品服务升级和知识产权布局提出。${rdLine}`,
              '立项材料应包括项目名称、RD 编号、研发周期、负责人、技术路线、创新点、预算安排、参与人员、预期成果和风险控制措施。',
              '立项评审应重点审核研发必要性、技术可行性、费用预算合理性、成果形成路径和申报资料支撑价值。',
            ],
            title: '立项管理',
          },
          {
            articles: [
              '项目实施过程中应按阶段形成研发计划、研发记录、测试验证记录、问题处理记录和阶段成果说明。',
              '项目发生目标、周期、负责人、预算或技术路线重大调整时，应形成变更说明并重新确认审批。',
              '研发负责人应定期检查项目进度和资料完整性，确保研发活动与费用归集、知识产权申请和成果转化安排一致。',
            ],
            title: '过程控制',
          },
          {
            articles: [
              '项目完成后应组织结题验收，确认研发目标完成情况、技术指标达成情况、成果形式和后续转化计划。',
              '结题资料应包括立项报告、阶段记录、测试验证、结题报告、费用归集说明、知识产权材料、成果转化说明和相关附件。',
              '研发项目资料原则上按年度、项目编号和资料类别分别归档，保存期限不低于高企申报和后续备查要求。',
            ],
            title: '结题与归档',
          },
        ],
        fileClass: 1,
        key: 'rd_project',
        missingEvidence: ['立项报告', '研发过程记录', '结题或阶段验收记录'],
        scoreItem: '研发制度与费用核算',
        scoreMax: 6,
        title: '研发项目管理制度',
      },
      {
        attachmentChecklist: [
          '研发费用科目归集表',
          '研发费用年度汇总表',
          '研发费用凭证清单',
          '研发费用审核记录',
          '研发费用专项审计或内部核对说明',
        ],
        chapters: [
          {
            articles: [
              '为规范研发投入核算，明确研发费用归集范围、审批流程和责任分工，确保研发投入数据真实、完整、口径一致，制定本制度。',
              '本制度适用于企业所有研发项目发生的人员人工、直接投入、折旧摊销、设计费、委托研发及其他研发相关支出。',
              '研发投入核算应坚持项目归集、科目清晰、凭证完整、数据一致、可复核的原则。',
            ],
            title: '总则',
          },
          {
            articles: [
              '研发费用归集范围包括人员人工、直接投入、折旧费用、无形资产摊销、设计费用、装备调试费用、委托外部研发费用和其他费用。',
              '与研发活动无直接关系的销售费用、行政费用、生产成本和其他无关支出不得计入研发费用。',
              '跨项目共用支出应依据工时、使用记录、项目周期或其他合理方法进行分摊，并留存分摊依据。',
            ],
            title: '核算范围',
          },
          {
            articles: [
              `财务人员应按年度、项目和费用科目归集研发支出，研发负责人负责确认费用与研发项目的对应关系。${yearLine}`,
              '费用入账前应核对费用发生时间、业务内容、凭证附件、所属项目和费用科目。',
              '涉及委托研发、合作研发、设备折旧和无形资产摊销的，应同步保存合同、验收、付款、折旧摊销测算等支撑材料。',
            ],
            title: '归集流程',
          },
          {
            articles: [
              '研发费用归集结果应由财务负责人、研发负责人和企业负责人按月度、季度或年度进行审核。',
              '审核重点包括项目归属是否准确、费用科目是否合理、凭证是否完整、金额是否与财务账一致。',
              '发现费用归集错误、凭证缺失或项目对应关系不清的，应及时调整并形成更正说明。',
            ],
            title: '审核控制',
          },
          {
            articles: [
              '研发投入核算资料应与研发项目资料、辅助账、财务凭证和专项审计材料同步归档。',
              '研发费用年度汇总表应与财务账、纳税申报资料、高企申报表和专项审计报告保持一致。',
              '归档资料应标明年度、项目编号、费用科目、责任人和审核状态，便于后续核验。',
            ],
            title: '归档与复核',
          },
        ],
        fileClass: 2,
        key: 'rd_accounting',
        missingEvidence: ['研发费用明细表', '费用凭证清单', '研发投入年度汇总表'],
        scoreItem: '研发制度与费用核算',
        scoreMax: 6,
        title: '研发投入核算管理制度',
      },
      {
        attachmentChecklist: [
          '研发费用辅助账',
          '研发费用辅助账编制说明',
          '项目费用分摊明细',
          '辅助账审核签字页',
          '研发费用辅助账与财务账差异说明',
        ],
        chapters: [
          {
            articles: [
              '为规范研发费用辅助账编制工作，建立按年度、研发项目和费用科目归集的辅助核算体系，制定本制度。',
              '研发费用辅助账是研发投入核算、专项审计、高企申报和后续备查的重要基础资料。',
              '辅助账编制应坚持真实发生、项目对应、凭证支撑、口径一致、过程留痕的原则。',
            ],
            title: '总则',
          },
          {
            articles: [
              '辅助账应至少包含年度、RD 项目编号、项目名称、费用科目、发生日期、凭证编号、费用摘要、发生金额、归集依据、审核人和备注说明。',
              '费用科目应与高企研发费用归集口径一致，并与企业财务核算科目建立对应关系。',
              '项目编号、项目名称和研发周期应与研发项目立项资料保持一致。',
            ],
            title: '编制内容',
          },
          {
            articles: [
              '财务人员应按月或按季度收集研发费用凭证，初步归集至对应研发项目和费用科目。',
              '研发负责人负责确认费用是否服务于对应研发项目，并对研发用途、使用期间和项目关系进行说明。',
              '财务负责人负责复核辅助账金额、科目和凭证来源，企业负责人负责确认年度汇总结果。',
            ],
            title: '编制流程',
          },
          {
            articles: [
              '共用人员、共用设备、共用场地或共用软件产生的费用，应根据工时记录、使用记录、项目周期或合理分摊方法进行归集。',
              '分摊方法一经确定应保持相对稳定，确需调整的，应说明调整原因和影响金额。',
              '辅助账金额应与财务账、费用明细表、专项审计报告和申报材料进行交叉核对。',
            ],
            title: '分摊与核对',
          },
          {
            articles: [
              '辅助账应与研发项目立项、过程记录、结题资料、费用凭证、合同发票和审计材料同步归档。',
              '辅助账电子版和纸质签字版应保持一致，修改时应留存版本记录和审批记录。',
              '辅助账保存期限应满足高企申报、审计检查、税务核验和企业内部管理要求。',
            ],
            title: '保管与版本控制',
          },
        ],
        fileClass: 2,
        key: 'rd_auxiliary_account',
        missingEvidence: ['近三年研发费用辅助账', '辅助账审核记录', '研发费用专项审计材料'],
        scoreItem: '研发制度与费用核算',
        scoreMax: 6,
        title: '研发费用辅助账编制制度',
      },
      {
        attachmentChecklist: [
          '研发中心设立文件',
          '研发组织架构图',
          '研发岗位职责说明',
          '研发会议纪要',
          '年度研发工作总结',
        ],
        chapters: [
          {
            articles: [
              '为提升企业技术创新能力，规范内部科学技术研究开发机构建设和运行管理，制定本制度。',
              `研发中心围绕企业 ${context.industry} 方向开展技术规划、研发项目实施、知识产权培育、成果转化支撑和研发资料归档。`,
              '研发中心运行应坚持职责清晰、资源集中、项目驱动、成果导向、资料完整的原则。',
            ],
            title: '总则',
          },
          {
            articles: [
              '企业应设立研发中心或研发部门，作为内部科学技术研究开发机构，负责组织企业研发与技术创新活动。',
              `企业应结合实际设置研发负责人、项目负责人、技术研发人员、测试验证人员和资料归档人员。当前系统记录科技人员 ${profile.researchEmployeeCount}/${profile.totalEmployeeCount} 人。`,
              '研发中心可根据项目需要设置软件研发、产品研发、测试验证、资料管理、成果转化等岗位或职责分工。',
            ],
            title: '机构设置',
          },
          {
            articles: [
              '研发中心负责收集技术需求、组织研发立项、开展技术攻关、协调研发资源、跟踪研发进度和组织结题验收。',
              '研发中心应配合财务部门完成研发费用归集、费用用途确认和研发投入资料准备。',
              '研发中心应推动研发成果形成知识产权、技术成果、高新产品服务和成果转化证明材料。',
            ],
            title: '职责分工',
          },
          {
            articles: [
              '研发中心应建立定期会议机制，研究研发计划、项目进度、技术难题、人员安排和成果转化事项。',
              '研发中心应对研发项目实施情况、费用归集情况、知识产权形成情况和资料归档情况进行检查。',
              '研发中心应根据年度研发计划和高企申报要求，形成年度研发工作总结和下一年度研发计划。',
            ],
            title: '运行机制',
          },
          {
            articles: [
              '研发中心设立文件、组织架构图、岗位职责、人员名单、会议纪要和年度总结应统一归档。',
              '研发机构资料应与研发项目、科技人员、研发费用和成果转化资料保持一致。',
              '研发中心资料发生调整时，应及时更新版本并保留历史记录。',
            ],
            title: '资料归档',
          },
        ],
        fileClass: 3,
        key: 'rd_center',
        missingEvidence: ['研发中心设立文件', '研发组织架构图', '研发岗位职责说明'],
        scoreItem: '研发机构与产学研',
        scoreMax: 6,
        title: '研发中心设立及管理制度',
      },
      {
        attachmentChecklist: [
          '研发场地照片',
          '研发设备清单',
          '研发设备台账',
          '设备使用记录',
          '设备维护或校准记录',
        ],
        chapters: [
          {
            articles: [
              '为保障研发活动顺利开展，规范研发场地、设备、软件工具、测试环境和研发资料的使用管理，制定本制度。',
              '科研条件是企业开展研究开发和技术创新活动的重要基础，应优先保障研发项目实施。',
              '科研条件管理应坚持专人负责、台账管理、合理使用、定期维护、安全合规的原则。',
            ],
            title: '总则',
          },
          {
            articles: [
              `科研条件包括研发办公场地、试验测试环境、研发设备、检测工具、软件系统、数据资源、样品样机和其他支撑研发活动的资源。研发场所位于 ${context.address} 或企业实际研发办公场地。`,
              '研发设备包括但不限于计算机设备、测试设备、实验设备、生产试制设备、检测仪器、研发软件和数据处理工具。',
              '企业应建立科研条件清单，明确资源名称、规格型号、用途、使用部门、责任人员和对应研发项目。',
            ],
            title: '科研条件范围',
          },
          {
            articles: [
              '研发场地、设备和测试环境应优先服务于 RD 项目，不得长期挪作与研发无关用途。',
              '研发设备使用人员应按操作规范使用设备，做好领用、测试、异常处理和安全管理记录。',
              '涉及数据安全、样品安全、技术秘密和知识产权的，应按照企业保密要求执行。',
            ],
            title: '使用管理',
          },
          {
            articles: [
              '企业应定期盘点研发设备和科研条件，核对设备状态、使用部门、责任人员和项目使用情况。',
              '重要研发设备应建立维护、保养、校准或升级记录，确保设备持续可用。',
              '设备发生损坏、调拨、报废或用途变更时，应办理审批并更新台账。',
            ],
            title: '维护与盘点',
          },
          {
            articles: [
              '企业应归档研发场地照片、设备清单、设备发票或台账、使用记录、维护记录和测试环境说明。',
              '科研条件资料应能证明企业具备持续开展研发活动的场地、设备、工具和管理能力。',
              '涉及高企申报的科研条件证明材料，应与研发机构、研发项目和科技人员材料一并归档。',
            ],
            title: '资料归档',
          },
        ],
        fileClass: 3,
        key: 'rd_condition',
        missingEvidence: ['研发场地照片', '研发设备清单', '设备使用或维护记录'],
        scoreItem: '研发机构与产学研',
        scoreMax: 6,
        title: '科研条件与研发设备管理制度',
      },
      {
        attachmentChecklist: [
          '产学研合作协议',
          '联合研发或委托研发计划',
          '合作沟通记录',
          '合作成果验收材料',
          '合作费用发票或付款证明',
        ],
        chapters: [
          {
            articles: [
              '为规范企业与高校、科研院所、技术服务机构及上下游企业开展合作研发、委托研发、技术咨询和成果转化合作，制定本制度。',
              '产学研合作应服务于企业主营业务、研发项目、关键技术攻关、知识产权形成和成果转化目标。',
              '合作管理应坚持目标明确、协议完备、过程留痕、成果可验、权责清晰的原则。',
            ],
            title: '总则',
          },
          {
            articles: [
              '产学研合作形式包括联合研发、委托研发、技术咨询、测试验证、人才培养、成果转化、共建平台和技术交流等。',
              '合作事项应与企业研发项目或技术创新需求相匹配，并明确合作目标、合作周期、成果形式和验收标准。',
              '涉及研发费用的合作事项，应与研发投入核算和辅助账归集要求保持一致。',
            ],
            title: '合作形式',
          },
          {
            articles: [
              '合作前应对合作方研发能力、技术水平、履约能力、保密能力和成果交付能力进行评估。',
              '合作协议应明确合作内容、双方职责、费用安排、知识产权归属、保密要求、验收方式和违约责任。',
              '合作过程中应保存沟通记录、阶段成果、测试验证、验收材料和费用凭证。',
            ],
            title: '合作过程管理',
          },
          {
            articles: [
              '合作形成的技术成果应明确知识产权归属、使用范围、转化方式和资料归档责任。',
              '合作成果可作为研发项目、知识产权、成果转化和高新产品服务的支撑材料，但不得重复或虚构成果。',
              '涉及申报材料时，应确保合作协议、成果说明、费用凭证和转化证明相互一致。',
            ],
            title: '成果归属与应用',
          },
          {
            articles: [
              '企业应归档合作协议、项目计划、沟通记录、阶段成果、验收记录、发票或付款证明、技术成果说明等材料。',
              '产学研合作材料应按合作项目和年度分类保存，并与对应 RD 项目建立关联。',
              '合作资料应由研发负责人和资料管理员共同确认完整性。',
            ],
            title: '资料归档',
          },
        ],
        fileClass: 3,
        key: 'university_cooperation',
        missingEvidence: ['产学研合作协议', '联合研发或委托研发记录', '合作成果验收材料'],
        scoreItem: '研发机构与产学研',
        scoreMax: 6,
        title: '产学研合作管理制度',
      },
      {
        attachmentChecklist: [
          '科技成果转化台账',
          '成果转化立项或确认记录',
          '成果转化证明材料',
          '合同发票或验收证明',
          '成果转化效果评价记录',
        ],
        chapters: [
          {
            articles: [
              '为规范科技成果从研发形成到产品服务、合同收入和市场应用的转化过程，建立成果识别、评估、实施、证明和归档机制，制定本制度。',
              '本制度适用于企业研发项目、知识产权、技术方案、样机样品、软件系统、工艺改进、检测报告等成果的转化管理。',
              '科技成果转化应坚持成果真实、链路清晰、证据完整、应用可验、持续改进的原则。',
            ],
            title: '总则',
          },
          {
            articles: [
              `科技成果包括研发项目阶段成果、知识产权、技术方案、样机样品、软件系统、工艺改进、检测报告和可应用于产品服务的技术成果。当前系统记录成果转化 ${profile.transformationCount} 条。`,
              '成果来源应能够追溯至研发项目、知识产权、技术服务、合作研发或其他合法技术来源。',
              '同一成果多处应用时，应明确主要转化对象、应用场景、收入或效果证明，避免重复认定。',
            ],
            title: '成果范围',
          },
          {
            articles: [
              '成果转化应经过成果确认、应用场景评估、转化对象确定、证明材料收集和效果评价。',
              '转化对象应尽量关联 RD 项目、知识产权、PS 产品服务、合同、发票、验收报告、检测报告和照片资料。',
              '成果转化实施前应明确责任部门、责任人、转化方式、实施周期、预期效果和归档要求。',
            ],
            title: '转化流程',
          },
          {
            articles: [
              '研发负责人负责成果技术说明、技术先进性说明和研发来源说明。',
              '业务或项目负责人负责应用场景、客户使用、市场推广和合同发票证明材料收集。',
              '财务人员负责收入、发票、收款和高新收入口径核对，资料负责人负责证据链归档。',
            ],
            title: '组织实施',
          },
          {
            articles: [
              '企业应建立科技成果转化台账，记录成果名称、来源、年度、转化方式、转化对象、证明材料和经济社会效果。',
              '归档材料包括成果转化清单、关联研发项目、知识产权证书、产品服务说明、合同发票、验收或检测证明、照片及应用说明。',
              '成果转化资料应与研发项目、知识产权、PS 产品服务、合同发票和申报草稿保持一致。',
            ],
            title: '台账与归档',
          },
        ],
        fileClass: 4,
        key: 'achievement_reward',
        missingEvidence: ['成果转化台账', '成果转化证明材料', '合同发票或验收证明'],
        scoreItem: '成果转化与创新平台',
        scoreMax: 4,
        title: '科技成果转化管理制度',
      },
      {
        attachmentChecklist: [
          '成果转化奖励申请表',
          '成果贡献说明',
          '奖励审批记录',
          '奖励发放证明',
          '成果转化奖励台账',
        ],
        chapters: [
          {
            articles: [
              '为鼓励科技人员参与研发创新和成果转化，建立与研发贡献、成果质量、知识产权形成和市场应用效果相匹配的激励奖励机制，制定本办法。',
              '本办法适用于企业研发成果、知识产权、高新产品服务、技术改进和成果转化活动中作出贡献的团队和人员。',
              '奖励管理应坚持公开透明、贡献导向、审批规范、资料留痕、合规发放的原则。',
            ],
            title: '总则',
          },
          {
            articles: [
              '奖励对象包括参与研发立项、技术攻关、测试验证、知识产权形成、成果转化、市场应用和资料归档的科技人员及项目团队。',
              '对跨部门协作成果，可根据研发、产品、测试、业务、财务和资料归档等不同贡献进行综合评价。',
              '外部合作方奖励或费用安排应以合同约定和企业审批记录为准。',
            ],
            title: '奖励对象',
          },
          {
            articles: [
              '奖励依据包括研发项目完成情况、技术指标达成情况、知识产权授权或登记、成果转化落地、产品服务收入支撑和资料归档完整度。',
              '成果奖励应结合成果创新性、应用价值、经济效果、团队贡献和申报支撑价值综合评价。',
              '不具备真实成果、证明材料缺失或权属不清的，不得作为奖励依据。',
            ],
            title: '奖励依据',
          },
          {
            articles: [
              '企业可采用绩效加分、专项奖金、荣誉表彰、培训机会、岗位晋升推荐等方式进行激励。',
              '奖励申请由项目负责人或部门负责人提出，附成果说明、贡献说明和证明材料。',
              '奖励事项应经部门审核、财务复核、企业负责人批准后执行。',
            ],
            title: '奖励方式与审批',
          },
          {
            articles: [
              '奖励发放应形成审批表、发放记录、签收记录或工资绩效记录。',
              '成果奖励资料应与成果转化台账、研发项目资料、知识产权资料和合同发票材料对应。',
              '奖励台账应按年度归档，便于高企申报和后续核验。',
            ],
            title: '发放与归档',
          },
        ],
        fileClass: 4,
        key: 'achievement_incentive',
        missingEvidence: ['奖励审批记录', '奖励发放证明', '成果贡献说明'],
        scoreItem: '成果转化与创新平台',
        scoreMax: 4,
        title: '科技成果转化激励奖励办法',
      },
      {
        attachmentChecklist: [
          '开放创新需求征集表',
          '技术交流会议纪要',
          '外部合作记录',
          '创新项目评审记录',
          '创新平台运行台账',
        ],
        chapters: [
          {
            articles: [
              '为建立开放式创新创业平台，吸收外部技术资源、客户需求、供应链能力和专业服务力量参与企业创新活动，制定本办法。',
              '开放式创新平台服务于企业技术创新、研发项目储备、成果转化、人才交流和产业协同。',
              '平台运行应坚持开放协同、需求牵引、资源整合、成果导向、资料留痕的原则。',
            ],
            title: '总则',
          },
          {
            articles: [
              '开放创新平台可包括技术交流机制、联合研发渠道、客户需求反馈、供应商协同、技术服务机构合作、创新项目征集和成果展示等形式。',
              '平台可通过线上沟通、线下会议、项目评审、技术沙龙、客户访谈、供应商交流等方式运行。',
              '平台活动应围绕企业研发方向和主营业务开展，不得脱离企业实际经营和技术能力。',
            ],
            title: '平台形式',
          },
          {
            articles: [
              '企业应定期收集技术需求、客户反馈、行业趋势和合作机会，形成创新需求清单。',
              '研发中心或相关部门应对创新需求进行评审，必要时转化为研发项目、技术改进任务或成果转化任务。',
              '对外合作事项应明确保密要求、知识产权归属、成果形式、费用安排和资料归档责任。',
            ],
            title: '运行机制',
          },
          {
            articles: [
              '开放创新平台形成的技术方案、需求清单、合作记录、项目建议和成果展示材料，可作为研发立项和成果转化的支撑资料。',
              '平台活动中形成的知识产权线索、客户应用需求和产品改进建议，应及时反馈至研发项目管理流程。',
              '平台运行效果应结合研发项目数量、成果转化数量、技术问题解决情况和合作资源沉淀情况进行评价。',
            ],
            title: '成果应用',
          },
          {
            articles: [
              '平台运行应保存会议纪要、需求清单、合作记录、项目立项材料、成果展示资料和转化证明。',
              '平台资料应按年度和活动类别归档，重要活动应关联对应研发项目或成果转化记录。',
              '企业应根据研发项目、成果转化和市场反馈持续优化开放创新平台运行机制。',
            ],
            title: '资料归档与持续改进',
          },
        ],
        fileClass: 4,
        key: 'innovation_platform',
        missingEvidence: ['技术需求征集记录', '开放合作记录', '创新平台运行材料'],
        scoreItem: '成果转化与创新平台',
        scoreMax: 4,
        title: '开放式创新平台管理办法',
      },
      {
        attachmentChecklist: [
          '年度培训计划',
          '培训签到表',
          '培训课件或通知',
          '培训照片',
          '培训效果评价表',
        ],
        chapters: [
          {
            articles: [
              '为提升科技人员研发能力和职工技能水平，建立年度培训、岗位学习、外部进修和技术交流机制，制定本制度。',
              '本制度适用于企业科技人员、研发辅助人员、测试人员、产品服务人员及其他参与技术创新活动的职工。',
              '培训管理应坚持计划明确、内容匹配、过程留痕、效果评价、持续改进的原则。',
            ],
            title: '总则',
          },
          {
            articles: [
              '培训对象包括研发人员、技术支持人员、测试人员、产品服务人员、项目资料人员及其他参与技术创新活动的职工。',
              '科技人员应优先参加与研发项目、知识产权、成果转化和技术领域相关的培训。',
              '新入职科技人员应接受岗位职责、研发流程、资料归档和保密要求培训。',
            ],
            title: '培训对象',
          },
          {
            articles: [
              '培训内容包括研发项目管理、技术领域知识、知识产权意识、成果转化流程、质量测试、财务合规、数据安全和申报资料规范。',
              '培训形式包括内部培训、外部课程、技术交流、项目复盘、岗位带教、线上学习和外部进修。',
              '培训计划应结合年度研发计划、项目需求、岗位能力短板和高企申报材料要求制定。',
            ],
            title: '培训内容与形式',
          },
          {
            articles: [
              '企业每年应制定培训计划，明确培训主题、对象、时间、讲师、方式和预期效果。',
              '培训实施过程中应形成通知、签到、课件、照片、测试或评价记录。',
              '培训结束后应对培训效果进行评价，并根据评价结果优化后续培训安排。',
            ],
            title: '组织实施',
          },
          {
            articles: [
              '培训资料由综合或人事负责人归档，并与科技人员名单、岗位职责和研发项目参与情况保持一致。',
              '外部进修或专业培训应保存报名记录、课程证明、结业证明或费用凭证。',
              '培训资料应按年度归档，作为科技人员培养进修和职工技能培训的证明材料。',
            ],
            title: '归档要求',
          },
        ],
        fileClass: 5,
        key: 'talent_training',
        missingEvidence: ['年度培训计划', '培训签到表', '培训照片或课件'],
        scoreItem: '人才培养与绩效激励',
        scoreMax: 4,
        title: '科技人员培养与职工技能培训制度',
      },
      {
        attachmentChecklist: [
          '人才引进需求表',
          '人才面试或录用评价表',
          '科技人员绩效评价表',
          '绩效奖励审批表',
          '人才引进与绩效奖励台账',
        ],
        chapters: [
          {
            articles: [
              '为加强科技人才队伍建设，规范优秀人才引进、科技人员绩效评价和奖励管理，提升企业研发创新能力，制定本制度。',
              '本制度适用于企业研发、产品、测试、项目管理、成果转化和技术支持相关岗位人员。',
              '人才管理应坚持岗位匹配、能力导向、绩效评价、激励约束、资料完整的原则。',
            ],
            title: '总则',
          },
          {
            articles: [
              '企业根据研发方向、项目需求、技术短板和成果转化需要，引进研发、产品、测试、项目管理和成果转化相关人才。',
              '人才引进应明确岗位需求、任职条件、专业能力、工作职责和预期贡献。',
              '人才引进过程应保存招聘需求、简历筛选、面试评价、录用审批、入职资料和岗位职责。',
            ],
            title: '优秀人才引进',
          },
          {
            articles: [
              '科技人员绩效评价应结合研发项目参与度、技术难题解决、知识产权贡献、成果转化贡献、资料归档质量和团队协作情况综合评定。',
              '绩效评价周期可按季度、半年度或年度开展，并可结合项目节点进行专项评价。',
              '评价结果应作为绩效奖励、岗位晋升、培训培养、项目任命和人才储备的重要依据。',
            ],
            title: '绩效评价',
          },
          {
            articles: [
              '企业可通过绩效奖金、项目奖励、培训机会、职级晋升、荣誉表彰等方式激励优秀科技人员。',
              '奖励事项应依据绩效评价结果、项目贡献和企业审批流程执行。',
              '涉及奖金或薪酬调整的，应由财务或人事人员复核并保存发放记录。',
            ],
            title: '奖励机制',
          },
          {
            articles: [
              '归档材料包括科技人员名单、岗位职责、绩效评价表、奖励审批表、人才引进记录和培训培养记录。',
              '科技人员绩效评价和奖励资料应与研发项目、知识产权、成果转化和培训记录建立对应关系。',
              '人才资料涉及个人信息的，应按企业信息安全和隐私保护要求进行保管。',
            ],
            title: '资料归档',
          },
        ],
        fileClass: 5,
        key: 'talent_performance',
        missingEvidence: ['人才引进记录', '科技人员绩效评价表', '奖励审批或发放记录'],
        scoreItem: '人才培养与绩效激励',
        scoreMax: 4,
        title: '优秀人才引进及科技人员绩效评价奖励制度',
      },
    ];

    return specs.map((spec) => ({
      ...spec,
      content: this.buildGaoxinDocumentMarkdown({
        attachmentChecklist: spec.attachmentChecklist,
        chapters: spec.chapters,
        context,
        scoreItem: spec.scoreItem,
        title: spec.title,
      }),
      recommended: true,
    }));
  }

  private buildGaoxinDocumentMarkdown(input: {
    attachmentChecklist: string[];
    chapters: Array<{ articles: string[]; title: string }>;
    context: {
      industry: string;
      profile: {
        enterpriseName: string;
      };
    };
    scoreItem: string;
    title: string;
  }): string {
    const publishDate = new Date().toISOString().slice(0, 10);
    const chapterText = input.chapters
      .map((chapter, chapterIndex) => {
        const articleText = chapter.articles
          .map(
            (article, articleIndex) =>
              `第${articleIndex + 1}条 ${article}`,
          )
          .join('\n\n');
        return `## 第${chapterIndex + 1}章 ${chapter.title}\n\n${articleText}`;
      })
      .join('\n\n');
    const appendixText = input.attachmentChecklist
      .map((item, index) => `${index + 1}. ${item}`)
      .join('\n');

    return [
      `# ${input.title}`,
      '## 文件信息',
      `- 适用企业：${input.context.profile.enterpriseName}`,
      `- 适用范围：${input.context.industry}`,
      `- 对应评分项：${input.scoreItem}`,
      `- 文件版本：V1.0-草稿`,
      `- 编制日期：${publishDate}`,
      '- 文件状态：待企业审核发布',
      '- Word导出提示：本文件已按“标题、文件信息、章节、条款、附表清单、附则”组织，可直接映射为 Word 标题层级。',
      chapterText,
      '## 附表与佐证材料清单',
      appendixText,
      '## 附则',
      '第1条 本制度为系统根据企业资料自动生成的草稿，企业应结合真实组织架构、审批权限、财务口径和实际执行记录审核后发布。',
      '第2条 涉及合作协议、费用凭证、培训签到、奖励发放、场地设备照片等真实性材料，应以企业实际归档附件为准，不得以本草稿替代原始证明。',
      '第3条 本制度经企业负责人审核确认后执行，后续如组织架构、研发流程、财务口径或申报要求发生变化，应及时修订。',
    ].join('\n\n');
  }

  private buildGaoxinDocumentWordHtml(markdown: string): string {
    const lines = markdown.split(/\r?\n/u);
    const body = lines
      .map((line) => {
        const text = line.trim();
        if (!text) {
          return '';
        }
        if (text.startsWith('# ')) {
          return `<h1>${this.escapeHtmlText(text.slice(2))}</h1>`;
        }
        if (text.startsWith('## ')) {
          return `<h2>${this.escapeHtmlText(text.slice(3))}</h2>`;
        }
        if (text.startsWith('- ')) {
          return `<p class="meta">${this.escapeHtmlText(text.slice(2))}</p>`;
        }
        if (/^\d+\.\s/u.test(text)) {
          return `<p class="appendix">${this.escapeHtmlText(text)}</p>`;
        }
        if (/^第\d+条/u.test(text)) {
          return `<p class="article">${this.escapeHtmlText(text)}</p>`;
        }
        return `<p>${this.escapeHtmlText(text)}</p>`;
      })
      .filter(Boolean)
      .join('\n');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>制度文件</title>
  <style>
    @page {
      margin: 2.54cm 2.8cm;
    }
    body {
      font-family: "SimSun", "宋体", serif;
      font-size: 12pt;
      line-height: 1.8;
      color: #111;
    }
    h1 {
      margin: 0 0 22pt;
      font-family: "SimHei", "黑体", sans-serif;
      font-size: 22pt;
      font-weight: 700;
      line-height: 1.4;
      text-align: center;
    }
    h2 {
      margin: 18pt 0 8pt;
      font-family: "SimHei", "黑体", sans-serif;
      font-size: 15pt;
      font-weight: 700;
      line-height: 1.5;
    }
    p {
      margin: 0 0 7pt;
      text-indent: 2em;
    }
    .meta,
    .appendix {
      text-indent: 0;
    }
    .article {
      text-indent: 0;
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;
  }

  private escapeHtmlText(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private scoreGaoxinGrowth(
    financeRows: EnterpriseFinanceRecordEntity[],
  ): GaoxinScoreCategory {
    const rows = financeRows
      .filter((row) => this.isFilledValue(row.year))
      .sort((left, right) => String(left.year).localeCompare(String(right.year)))
      .slice(-3);
    const salesValues = rows.map((row) => this.parseGaoxinAmount(row.xxsr));
    const netAssetValues = rows.map((row) => this.resolveGaoxinNetAssets(row));
    const salesGrowth = this.calculateGaoxinGrowthRate(salesValues);
    const netAssetGrowth = this.calculateGaoxinGrowthRate(netAssetValues);
    const salesGrowthScore = this.scoreGaoxinGrowthRate(salesGrowth);
    const netAssetGrowthScore = this.scoreGaoxinGrowthRate(netAssetGrowth);
    const score = salesGrowthScore + netAssetGrowthScore;

    const deductions: string[] = [];
    const suggestions: GaoxinScoreSuggestion[] = [];
    if (rows.length < 3) {
      deductions.push('近三年财务数据不足');
    }
    if (salesGrowth <= 0) {
      deductions.push('销售收入成长性不足或缺少销售收入数据');
    }
    if (netAssetGrowth <= 0) {
      deductions.push('净资产成长性不足或缺少净资产数据');
    }
    if (deductions.length > 0) {
      suggestions.push({
        moduleKey: 'finance',
        tabKey: 'financial',
        text: '补齐近三年销售收入、总资产、负债和净资产数据。',
      });
    }

    return this.toGaoxinScoreCategory({
      deductions,
      evidence: [
        `财务年度 ${rows.length} 年`,
        `销售收入增长率 ${this.roundStatNumber(salesGrowth * 100)}%，得分 ${salesGrowthScore}/10`,
        `净资产增长率 ${this.roundStatNumber(netAssetGrowth * 100)}%，得分 ${netAssetGrowthScore}/10`,
      ],
      key: 'growth',
      label: '成长性指标',
      maxScore: 20,
      score,
      subItems: [
        {
          basis: `近三年销售收入 ${salesValues.join('、')}，增长率 ${this.roundStatNumber(salesGrowth * 100)}%`,
          expertReviewRequired: false,
          grade: this.getGaoxinGrowthGrade(salesGrowth),
          key: 'salesGrowth',
          label: '销售收入增长率',
          maxScore: 10,
          score: salesGrowthScore,
          scoreRange: '≥35% 9-10；≥25% 7-8；≥15% 5-6；≥5% 3-4；>0 1-2；≤0 0',
        },
        {
          basis: `近三年净资产 ${netAssetValues.join('、')}，增长率 ${this.roundStatNumber(netAssetGrowth * 100)}%`,
          expertReviewRequired: false,
          grade: this.getGaoxinGrowthGrade(netAssetGrowth),
          key: 'netAssetGrowth',
          label: '净资产增长率',
          maxScore: 10,
          score: netAssetGrowthScore,
          scoreRange: '≥35% 9-10；≥25% 7-8；≥15% 5-6；≥5% 3-4；>0 1-2；≤0 0',
        },
      ],
      suggestions,
    });
  }

  private toGaoxinScoreCategory(input: {
    deductions: string[];
    evidence: string[];
    evidenceChain?: {
      complete: boolean;
      missing: string[];
      summary: string;
    };
    key: GaoxinScoreCategory['key'];
    label: string;
    maxScore: number;
    missingEvidenceCount?: number;
    ruleItems?: string[];
    score: number;
    subItems?: GaoxinScoreSubItem[];
    suggestions: GaoxinScoreSuggestion[];
  }): GaoxinScoreCategory {
    const score = this.roundStatNumber(
      Math.max(0, Math.min(input.score, input.maxScore)),
    );
    const ratio = input.maxScore > 0 ? score / input.maxScore : 0;
    return {
      ...input,
      evidenceChain: input.evidenceChain ?? {
        complete: input.deductions.length === 0,
        missing: input.deductions,
        summary: input.evidence.join('；'),
      },
      missingEvidenceCount:
        input.missingEvidenceCount ?? input.deductions.length,
      riskLevel: ratio >= 0.8 ? 'low' : ratio >= 0.5 ? 'medium' : 'high',
      ruleItems: input.ruleItems ?? [],
      score,
      subItems: input.subItems ?? [],
      suggestions: this.uniqueGaoxinSuggestions(input.suggestions),
    };
  }

  private enrichGaoxinScoreCategories(
    categories: GaoxinScoreCategory[],
  ): GaoxinScoreCategory[] {
    const ruleMap: Record<
      GaoxinScoreCategory['key'],
      { evidenceKeywords: string[]; ruleItems: string[] }
    > = {
      achievement: {
        evidenceKeywords: ['成果', 'PS', '合同', '发票', '关联'],
        ruleItems: [
          '近三年科技成果转化年平均数',
          '同一成果多处转化只按一项保守计',
          '成果与RD/IP/PS/合同发票的证明链',
          '转化年度、方式和证明材料完整性',
        ],
      },
      growth: {
        evidenceKeywords: ['财务', '销售', '净资产'],
        ruleItems: [
          '近三年财务数据完整性',
          '销售收入增长率按档计 0-10 分',
          '净资产增长率按档计 0-10 分',
          '增长率为负或关键年度为 0 时按 0 分处理',
        ],
      },
      ip: {
        evidenceKeywords: ['IP', '知识产权', '核心', '自主', '标准'],
        ruleItems: [
          '技术先进程度 0-8 分',
          '对主要产品/服务核心支持作用 0-8 分',
          '知识产权数量按 I/II 类分档 0-8 分',
          '取得方式 0-6 分，标准/规范最多加 2 分且总分不超过 30',
        ],
      },
      rdManagement: {
        evidenceKeywords: ['RD', '科技人员', '制度', '研发费用', '组织'],
        ruleItems: [
          '研发组织管理制度、研发投入核算和辅助账 0-6 分',
          '内部研发机构、科研条件和产学研合作 0-6 分',
          '成果转化组织实施、激励奖励和创新平台 0-4 分',
          '科技人员培养培训、人才引进和绩效奖励 0-4 分',
        ],
      },
    };

    return categories.map((category) => {
      const config = ruleMap[category.key];
      const missing = [
        ...category.deductions,
        ...category.suggestions.map((item) => item.text),
      ];
      const evidenceText = category.evidence.join('；');
      const matchedKeywords = config.evidenceKeywords.filter((keyword) =>
        evidenceText.toLowerCase().includes(keyword.toLowerCase()),
      );

      return {
        ...category,
        evidenceChain: {
          complete: category.riskLevel === 'low' && missing.length === 0,
          missing,
          summary:
            matchedKeywords.length > 0
              ? `已覆盖：${matchedKeywords.join('、')}`
              : '证据链覆盖不足，需补齐企业资料',
        },
        missingEvidenceCount: missing.length,
        ruleItems: config.ruleItems,
      };
    });
  }

  private parseGaoxinAmount(value: unknown): number {
    if (!this.isFilledValue(value)) {
      return 0;
    }
    const normalized = String(value).replace(/[,，万元元\s]/gu, '');
    const matched = normalized.match(/-?\d+(\.\d+)?/u);
    return matched ? Number(matched[0]) : 0;
  }

  private extractGaoxinYear(value: unknown): null | string {
    const matched = String(value ?? '').match(/\d{4}/u);
    return matched?.[0] ?? null;
  }

  private isSelfDevelopedIp(value: unknown): boolean {
    return /自主|原始|自研|申请/iu.test(String(value ?? ''));
  }

  private resolveGaoxinNetAssets(row: EnterpriseFinanceRecordEntity): number {
    if (this.isFilledValue(row.netAssets)) {
      return this.parseGaoxinAmount(row.netAssets);
    }
    const totalAssets = this.parseGaoxinAmount(row.zxc);
    const liabilities = this.parseGaoxinAmount(row.fz);
    return totalAssets > 0 ? totalAssets - liabilities : 0;
  }

  private scoreGaoxinGrowthRate(rate: number): number {
    if (rate >= 0.35) {
      return 10;
    }
    if (rate >= 0.25) {
      return 8;
    }
    if (rate >= 0.15) {
      return 6;
    }
    if (rate >= 0.05) {
      return 4;
    }
    if (rate > 0) {
      return 2;
    }
    return 0;
  }

  private getGaoxinGrowthGrade(rate: number): string {
    if (rate >= 0.35) return 'A档';
    if (rate >= 0.25) return 'B档';
    if (rate >= 0.15) return 'C档';
    if (rate >= 0.05) return 'D档';
    if (rate > 0) return 'E档';
    return 'F档';
  }

  private assessGaoxinIpQualitativeLevel(
    values: unknown[],
    label: '技术先进程度' | '核心支持作用',
  ): { basis: string; grade: string; score: number } {
    const text = values
      .filter((value) => this.isFilledValue(value))
      .map((value) => String(value))
      .join(' ');
    if (!text) {
      return { basis: '未填写评价说明', grade: 'E档（无）', score: 0 };
    }
    if (/较高|较强/iu.test(text)) {
      return { basis: text, grade: label === '技术先进程度' ? 'B档（较高）' : 'B档（较强）', score: 6 };
    }
    if (/一般|普通/iu.test(text)) {
      return { basis: text, grade: 'C档（一般）', score: 4 };
    }
    if (/较低|较弱|不足/iu.test(text)) {
      return { basis: text, grade: label === '技术先进程度' ? 'D档（较低）' : 'D档（较弱）', score: 2 };
    }
    if (/高|强|领先|先进|首创|核心|自主|突破/iu.test(text)) {
      return { basis: text, grade: label === '技术先进程度' ? 'A档（高）' : 'A档（强）', score: 8 };
    }
    return { basis: text, grade: '待专家判断', score: 0 };
  }

  private uniqueGaoxinTransformations(
    rows: EnterprisePropertyRecordEntity[],
  ): EnterprisePropertyRecordEntity[] {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const code = this.toNullableStringFromUnknown(row.transformationCode);
      const key = code ? `code:${code}` : `id:${row.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private calculateGaoxinGrowthRate(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }
    const normalized = values.map((value) =>
      Number.isFinite(value) ? value : 0,
    );
    if (normalized.length >= 3) {
      const [first, second, third] = normalized;
      if (!second) {
        return 0;
      }
      if (!first) {
        return Math.max(third / second - 1, 0);
      }
      return Math.max(0.5 * (second / first + third / second) - 1, 0);
    }
    const [first, second] = normalized;
    return first ? Math.max(second / first - 1, 0) : 0;
  }

  private uniqueGaoxinSuggestions(
    suggestions: GaoxinScoreSuggestion[],
  ): GaoxinScoreSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter((item) => {
      const key = `${item.moduleKey}/${item.tabKey}/${item.text}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private async requireClientDeclaration(
    userId: number,
    id: string,
  ): Promise<ClientDeclarationEntity> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const entity = await this.clientDeclarationRepo.findOne({
      where: {
        enterpriseId,
        id,
      },
    });
    if (!entity) {
      throw new NotFoundException('申报记录不存在');
    }

    return entity;
  }

  async getClientEnterpriseProfileStats(userId: number) {
    return this.recalculateClientEnterpriseProfileStats(userId);
  }

  async recalculateClientEnterpriseProfileStats(userId: number) {
    const enterpriseId = await this.getCurrentEnterpriseIdOrNull(userId);
    if (!enterpriseId) {
      return this.emptyEnterpriseProfileStats();
    }

    return this.recalculateEnterpriseProfileStats(enterpriseId);
  }

  async recalculateEnterpriseProfileStats(enterpriseId: string) {

    const itemConfigs = this.getProfileStatItemConfigs();
    const items = await Promise.all(
      itemConfigs.map((config) => this.calculateProfileStatItem(enterpriseId, config)),
    );
    const moduleKeys = Array.from(new Set(items.map((item) => item.moduleKey)));
    const missingModules = moduleKeys
      .map((moduleKey) => {
        const moduleItems = items.filter((item) => item.moduleKey === moduleKey);
        return moduleItems.every((item) => item.isCompleted)
          ? null
          : {
              key: moduleKey,
              name: moduleItems[0]?.moduleName ?? moduleKey,
            };
      })
      .filter(
        (item): item is { key: EnterpriseProfileModuleKey; name: string } =>
          Boolean(item),
      );
    const totalModules = moduleKeys.length;
    const completedModules = totalModules - missingModules.length;
    const totalRecords = items.reduce((sum, item) => sum + item.recordCount, 0);
    const attachmentRecords = items.reduce(
      (sum, item) => sum + item.attachmentCount,
      0,
    );
    const completenessRate = this.roundStatNumber(
      totalModules > 0 ? (completedModules / totalModules) * 100 : 0,
    );
    const healthScore = this.roundStatNumber(
      items.length > 0
        ? items.reduce((sum, item) => sum + item.score, 0) / items.length
        : 0,
    );
    const calculatedAt = new Date();
    const summary = {
      attachmentRecords,
      completedModules,
      missingModules,
      totalModules,
      totalRecords,
    };
    const existed = await this.enterpriseProfileStatRepo.findOne({
      where: { enterpriseId },
    });
    const saved = await this.enterpriseProfileStatRepo.save(
      this.enterpriseProfileStatRepo.create({
        ...(existed ? { id: existed.id } : {}),
        attachmentRecords,
        calculatedAt,
        completedModules,
        completenessRate,
        enterpriseId,
        healthScore,
        missingModules: JSON.stringify(missingModules),
        summaryJson: JSON.stringify(summary),
        totalModules,
        totalRecords,
      }),
    );

    await this.enterpriseProfileStatItemRepo.delete({ statId: saved.id });
    const savedItems = await this.enterpriseProfileStatItemRepo.save(
      items.map((item) =>
        this.enterpriseProfileStatItemRepo.create({
          attachmentCount: item.attachmentCount,
          enterpriseId,
          isCompleted: item.isCompleted ? 1 : 0,
          itemName: item.itemName,
          missingFields: JSON.stringify(item.missingFields),
          moduleKey: item.moduleKey,
          moduleName: item.moduleName,
          recordCount: item.recordCount,
          requiredMinCount: item.requiredMinCount,
          score: item.score,
          statId: saved.id,
          summary: item.summary ?? '',
          tabKey: item.tabKey,
        }),
      ),
    );

    return this.toEnterpriseProfileStatsPayload(saved, savedItems);
  }

  async listClientEnterpriseRecords(
    userId: number,
    moduleKey: string,
    tabKey: string,
  ) {
    const config = this.getProfileRecordConfig(moduleKey, tabKey);
    const enterpriseId = await this.getCurrentEnterpriseIdOrNull(userId);
    if (!enterpriseId) {
      return {
        items: [],
        total: 0,
      };
    }
    if (moduleKey === 'property') {
      await this.renumberClientIpCodes(enterpriseId);
    }
    if (moduleKey === 'property' && tabKey === 'transformation') {
      await this.renumberClientTransformationCodes(enterpriseId);
    }

    const where: Record<string, unknown> = {
      enterpriseId,
      status: 1,
    };
    if (config.recordType) {
      where.recordType = config.recordType;
    }

    const rows = await config.repository.find({
      order: {
        id: 'DESC',
      },
      where,
    });
    if (moduleKey === 'property') {
      const ipRows = await this.enterprisePropertyRecordRepo.find({
        where: {
          enterpriseId,
          recordType: 'intellectual_property',
          status: 1,
        },
      });
      rows.splice(
        0,
        rows.length,
        ...this.sortClientPropertyRowsByRelatedIpCode(
          rows as EnterprisePropertyRecordEntity[],
          ipRows,
        ),
      );
    }

    const items = rows.map((row) => this.toProfileRecordPayload(row, config));
    if (moduleKey === 'property') {
      await this.enrichClientPropertyRelationLabels(enterpriseId, items);
    }
    return {
      items,
      total: items.length,
    };
  }

  async previewClientEnterpriseRecordFile(
    userId: number,
    moduleKey: string,
    tabKey: string,
    id: string,
    filePath: string,
    response: Response,
  ): Promise<void> {
    const config = this.getProfileRecordConfig(moduleKey, tabKey);
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const entity = await this.findProfileRecordOrFail(config, enterpriseId, id);
    if (!entity) {
      throw new NotFoundException('Enterprise profile record does not exist');
    }

    const requestedPath = normalizeStoredUploadPath(filePath);
    const permittedPaths = this.getProfileRecordAttachmentPaths(entity, config);
    if (!requestedPath || !permittedPaths.includes(requestedPath)) {
      throw new NotFoundException('Enterprise profile file does not exist');
    }

    const { absolutePath, storedPath } = resolveStoredUploadAbsolutePath(
      requestedPath,
    );
    const fileStat = await stat(absolutePath).catch(() => null);
    if (!fileStat?.isFile()) {
      throw new NotFoundException('Enterprise profile file does not exist');
    }

    const filename = basename(storedPath);
    response.setHeader('Content-Length', String(fileStat.size));
    response.setHeader('Content-Type', this.resolveUploadPreviewContentType(filename));
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(filename)}"`,
    );
    await pipeline(createReadStream(absolutePath), response);
  }

  async uploadClientEnterpriseMedia(
    userId: number,
    files: StoredUploadFile[],
  ) {
    await this.requireCurrentEnterpriseId(userId);
    return files.map((file) => {
      const path = normalizeStoredUploadPath(file.path);
      if (!path) {
        throw new BadRequestException('Uploaded file path is invalid');
      }
      return {
        name: file.originalname,
        path,
        size: file.size,
      };
    });
  }

  async previewClientEnterpriseMediaFile(
    userId: number,
    type: string,
    id: string,
    filePath: string,
    response: Response,
  ): Promise<void> {
    const mediaConfig = {
      certificate: ['media', 'certificates'],
      photo: ['media', 'photos'],
    }[type];
    if (!mediaConfig) {
      throw new NotFoundException('Enterprise media does not exist');
    }
    await this.previewClientEnterpriseRecordFile(
      userId,
      mediaConfig[0],
      mediaConfig[1],
      id,
      filePath,
      response,
    );
  }

  async createClientEnterpriseRecord(
    userId: number,
    moduleKey: string,
    tabKey: string,
    input: SaveClientEnterpriseRecordDto,
  ) {
    const config = this.getProfileRecordConfig(moduleKey, tabKey);
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const entityData = this.toProfileRecordEntityData(input.data ?? {}, config);
    if (moduleKey === 'media' && tabKey === 'certificates') {
      this.normalizeClientCertificateQualification(entityData);
    }
    if (moduleKey === 'contract' && tabKey === 'invoices') {
      await this.assertClientInvoiceContractScope(enterpriseId, entityData.htId);
    }
    if (moduleKey === 'property' && tabKey === 'researchProject') {
      await this.applyResearchTransformationRelationsFromIps(enterpriseId, entityData);
      if (!this.isClientRdCode(entityData.kyProjectNum)) {
        entityData.kyProjectNum = await this.getNextClientPropertySequentialCode(
          enterpriseId,
          'research_project',
          'kyProjectNum',
          'RD',
        );
      }
    }
    if (moduleKey === 'property' && tabKey === 'transformation') {
      const validationMessage = await this.validateTransformationRelationUniqueness(
        enterpriseId,
        this.parseRelationIds(entityData.relatedIpIds as null | string),
        null,
      );
      if (validationMessage) {
        throw new BadRequestException(validationMessage);
      }
      await this.applyTransformationCodeFromRelatedIp(enterpriseId, entityData);
    }
    const saved = await config.repository.save(
      config.repository.create({
        ...entityData,
        enterpriseId,
        status: 1,
      }),
    );
    await this.reconcileClientPropertyReverseRelationsFromRecord(
      enterpriseId,
      moduleKey,
      tabKey,
      saved,
    );
    await this.refreshClientPropertyAutoCodesAfterChange(
      enterpriseId,
      moduleKey,
      tabKey,
    );

    const refreshed = await this.findProfileRecordOrFail(
      config,
      enterpriseId,
      String(saved.id),
    );
    return this.toProfileRecordPayload(refreshed ?? saved, config);
  }

  async updateClientEnterpriseRecord(
    userId: number,
    moduleKey: string,
    tabKey: string,
    id: string,
    input: SaveClientEnterpriseRecordDto,
  ) {
    const config = this.getProfileRecordConfig(moduleKey, tabKey);
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const entity = await this.findProfileRecordOrFail(
      config,
      enterpriseId,
      id,
    );
    if (!entity) {
      throw new NotFoundException('企业资料记录不存在');
    }

    Object.assign(entity, this.toProfileRecordEntityData(input.data ?? {}, config));
    if (moduleKey === 'media' && tabKey === 'certificates') {
      this.normalizeClientCertificateQualification(entity);
    }
    if (moduleKey === 'contract' && tabKey === 'invoices') {
      await this.assertClientInvoiceContractScope(enterpriseId, entity.htId);
    }
    if (moduleKey === 'property' && tabKey === 'researchProject') {
      await this.applyResearchTransformationRelationsFromIps(enterpriseId, entity);
    }
    if (moduleKey === 'property' && tabKey === 'transformation') {
      const validationMessage = await this.validateTransformationRelationUniqueness(
        enterpriseId,
        this.parseRelationIds(entity.relatedIpIds),
        String(entity.id),
      );
      if (validationMessage) {
        throw new BadRequestException(validationMessage);
      }
      await this.applyTransformationCodeFromRelatedIp(enterpriseId, entity);
    }
    const saved = await config.repository.save(entity);
    await this.reconcileClientPropertyReverseRelationsFromRecord(
      enterpriseId,
      moduleKey,
      tabKey,
      saved,
    );
    await this.refreshClientPropertyAutoCodesAfterChange(
      enterpriseId,
      moduleKey,
      tabKey,
    );

    const refreshed = await this.findProfileRecordOrFail(
      config,
      enterpriseId,
      String(saved.id),
    );
    return this.toProfileRecordPayload(refreshed ?? saved, config);
  }

  async getClientGaoxinDocumentPackage(
    userId: number,
  ): Promise<GaoxinDocumentPackageResult> {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.getGaoxinDocumentPackageForEnterprise(enterpriseId);
  }

  async getGaoxinDocumentPackageForEnterprise(enterpriseId: string) {
    return this.buildGaoxinDocumentPackage(enterpriseId);
  }

  async adoptClientGaoxinDocumentPackage(
    userId: number,
    input: AdoptClientGaoxinDocumentPackageDto,
  ) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    return this.adoptGaoxinDocumentPackageForEnterprise(enterpriseId, input.keys);
  }

  async adoptGaoxinDocumentPackageForEnterprise(
    enterpriseId: string,
    keys?: string[],
  ) {
    const packageResult = await this.buildGaoxinDocumentPackage(enterpriseId);
    const selectedKeys = new Set(
      (keys?.length
        ? keys
        : packageResult.drafts.filter((item) => item.recommended).map((item) => item.key)
      ).map(String),
    );
    const selectedDrafts = packageResult.drafts.filter((item) =>
      selectedKeys.has(item.key),
    );
    if (selectedDrafts.length === 0) {
      throw new BadRequestException('请选择需要采纳的制度文件');
    }

    const existingRows = await this.enterpriseDocumentRecordRepo.find({
      where: { enterpriseId, status: 1 },
    });
    const existingTitles = new Set(
      existingRows
        .map((row) => row.fileTitle?.trim())
        .filter((value): value is string => Boolean(value)),
    );
    const targetDirectory = join(
      getUploadRootAbsolutePath(),
      'enterprise',
      'attachment',
      String(new Date().getFullYear()),
      String(new Date().getMonth() + 1).padStart(2, '0'),
    );
    if (!existsSync(targetDirectory)) {
      mkdirSync(targetDirectory, { recursive: true });
    }

    const savedItems: Array<Record<string, unknown>> = [];
    const skippedItems: Array<{ key: string; title: string }> = [];
    for (const draft of selectedDrafts) {
      if (existingTitles.has(draft.title)) {
        skippedItems.push({ key: draft.key, title: draft.title });
        continue;
      }

      const fileName = `${Date.now()}-${draft.key}.doc`;
      const absolutePath = join(targetDirectory, fileName);
      const storedPath = [
        'enterprise',
        'attachment',
        String(new Date().getFullYear()),
        String(new Date().getMonth() + 1).padStart(2, '0'),
        fileName,
      ].join('/');
      writeFileSync(
        absolutePath,
        this.buildGaoxinDocumentWordHtml(draft.content),
        'utf8',
      );

      const saved = await this.enterpriseDocumentRecordRepo.save(
        this.enterpriseDocumentRecordRepo.create({
          enterpriseId,
          fileClass: draft.fileClass,
          filePath: storedPath,
          fileRemark: [
            `高企研发组织管理自动生成草稿：${draft.scoreItem}`,
            draft.missingEvidence.length > 0
              ? `仍需补充真实佐证：${draft.missingEvidence.join('、')}`
              : null,
          ]
            .filter(Boolean)
            .join('；'),
          fileStartDate: new Date().toISOString().slice(0, 10),
          fileStatus: 2,
          fileTitle: draft.title,
          fileVersion: 'V1.0-草稿',
          status: 1,
        }),
      );
      savedItems.push(
        this.toProfileRecordPayload(
          saved as unknown as Record<string, unknown>,
          this.getProfileRecordConfig('document', 'documents'),
        ),
      );
      existingTitles.add(draft.title);
    }

    return {
      savedItems,
      skippedItems,
      summary: `已采纳 ${savedItems.length} 份制度文件草稿${
        skippedItems.length > 0 ? `，跳过 ${skippedItems.length} 份已存在文件` : ''
      }。`,
    };
  }

  async deleteClientEnterpriseRecord(
    userId: number,
    moduleKey: string,
    tabKey: string,
    id: string,
  ) {
    const config = this.getProfileRecordConfig(moduleKey, tabKey);
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const entity = await this.findProfileRecordOrFail(
      config,
      enterpriseId,
      id,
    );
    if (!entity) {
      throw new NotFoundException('企业资料记录不存在');
    }

    entity.status = 0;
    await config.repository.save(entity);
    await this.clearClientPropertyReverseRelationsFromRecord(
      enterpriseId,
      moduleKey,
      tabKey,
      entity,
    );
    await this.refreshClientPropertyAutoCodesAfterChange(
      enterpriseId,
      moduleKey,
      tabKey,
    );
    return {
      success: true,
    };
  }

  async clearClientEnterpriseRecordsByTab(
    userId: number,
    moduleKey: string,
    tabKey: string,
  ) {
    const config = this.getProfileRecordConfig(moduleKey, tabKey);
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    const where: Record<string, unknown> = {
      enterpriseId,
      status: 1,
    };
    if (config.recordType) {
      where.recordType = config.recordType;
    }
    const rows = await config.repository.find({ where });
    if (rows.length === 0) {
      return {
        clearedCount: 0,
        moduleKey,
        success: true,
        tabKey,
      };
    }

    for (const row of rows) {
      row.status = 0;
      await this.clearClientPropertyReverseRelationsFromRecord(
        enterpriseId,
        moduleKey,
        tabKey,
        row,
      );
    }
    await config.repository.save(rows);
    await this.refreshClientPropertyAutoCodesAfterChange(
      enterpriseId,
      moduleKey,
      tabKey,
    );
    await this.recalculateClientEnterpriseProfileStats(userId);
    return {
      clearedCount: rows.length,
      moduleKey,
      success: true,
      tabKey,
    };
  }

  async clearClientEnterpriseRecordsByModule(userId: number, moduleKey: string) {
    const enterpriseId = await this.requireCurrentEnterpriseId(userId);
    if (moduleKey !== 'property') {
      throw new BadRequestException('当前仅支持按模块清空研发与知识产权资料');
    }

    const tabKeys = [
      'intellectualProperty',
      'researchProject',
      'productService',
      'transformation',
    ] as const;
    const results: Array<{ clearedCount: number; tabKey: string }> = [];
    for (const tabKey of tabKeys) {
      const config = this.getProfileRecordConfig(moduleKey, tabKey);
      const where: Record<string, unknown> = {
        enterpriseId,
        status: 1,
      };
      if (config.recordType) {
        where.recordType = config.recordType;
      }
      const rows = await config.repository.find({ where });
      if (rows.length === 0) {
        results.push({ clearedCount: 0, tabKey });
        continue;
      }

      for (const row of rows) {
        row.status = 0;
      }
      await config.repository.save(rows);
      results.push({ clearedCount: rows.length, tabKey });
    }

    await this.refreshClientPropertyAutoCodesAfterChange(
      enterpriseId,
      moduleKey,
      'intellectualProperty',
    );
    await this.recalculateClientEnterpriseProfileStats(userId);
    return {
      clearedCount: results.reduce((sum, item) => sum + item.clearedCount, 0),
      moduleKey,
      results,
      success: true,
    };
  }

  private async refreshClientPropertyAutoCodesAfterChange(
    enterpriseId: string,
    moduleKey: string,
    tabKey: string,
  ): Promise<void> {
    if (moduleKey !== 'property') {
      return;
    }

    if (tabKey === 'intellectualProperty') {
      await this.renumberClientIpCodes(enterpriseId);
      await this.renumberClientTransformationCodes(enterpriseId);
      await this.syncClientResearchTransformationRelationsFromIps(enterpriseId);
      return;
    }

    if (tabKey === 'transformation') {
      await this.renumberClientTransformationCodes(enterpriseId);
      await this.syncClientResearchTransformationRelationsFromIps(enterpriseId);
      return;
    }

    if (tabKey === 'researchProject') {
      await this.syncClientResearchTransformationRelationsFromIps(enterpriseId);
    }
  }

  private async syncClientResearchTransformationRelationsFromIps(
    enterpriseId: string,
  ): Promise<void> {
    const rows = await this.enterprisePropertyRecordRepo.find({
      where: {
        enterpriseId,
        recordType: 'research_project',
        status: 1,
      },
    });
    const changedRows: EnterprisePropertyRecordEntity[] = [];

    for (const row of rows) {
      const nextTransformationIds = await this.resolveTransformationIdsByIpIds(
        enterpriseId,
        this.parseRelationIds(row.relatedIpIds),
      );
      const nextValue =
        nextTransformationIds.length > 0 ? nextTransformationIds.join(',') : null;
      if (row.relatedTransformationIds === nextValue) {
        continue;
      }
      row.relatedTransformationIds = nextValue;
      changedRows.push(row);
    }

    if (changedRows.length > 0) {
      await this.enterprisePropertyRecordRepo.save(changedRows);
    }
  }

  private async applyResearchTransformationRelationsFromIps(
    enterpriseId: string,
    target: Partial<EnterprisePropertyRecordEntity>,
  ): Promise<void> {
    const transformationIds = await this.resolveTransformationIdsByIpIds(
      enterpriseId,
      this.parseRelationIds(target.relatedIpIds),
    );
    target.relatedTransformationIds =
      transformationIds.length > 0 ? transformationIds.join(',') : null;
  }

  private async resolveTransformationIdsByIpIds(
    enterpriseId: string,
    ipIds: string[],
  ): Promise<string[]> {
    const uniqueIpIds = this.uniqueRelationIds(ipIds);
    if (uniqueIpIds.length === 0) {
      return [];
    }

    const rows = await this.enterprisePropertyRecordRepo.find({
      order: {
        id: 'ASC',
      },
      where: {
        enterpriseId,
        recordType: 'transformation',
        status: 1,
      },
    });
    return rows
      .filter((row) =>
        this.parseRelationIds(row.relatedIpIds).some((id) => uniqueIpIds.includes(id)),
      )
      .map((row) => String(row.id));
  }

  private async renumberClientIpCodes(enterpriseId: string): Promise<void> {
    const rows = await this.enterprisePropertyRecordRepo.find({
      where: {
        enterpriseId,
        recordType: 'intellectual_property',
        status: 1,
      },
    });
    const orderedRows = this.sortClientIpRowsForCodeGeneration(rows);

    const changedRows = orderedRows.filter((row, index) => {
      const nextCode = this.formatSequentialCode('IP', index + 1);
      if (row.ipCode === nextCode) {
        return false;
      }
      row.ipCode = nextCode;
      return true;
    });
    if (changedRows.length > 0) {
      await this.enterprisePropertyRecordRepo.save(changedRows);
    }
  }

  private async renumberClientTransformationCodes(
    enterpriseId: string,
  ): Promise<void> {
    const [ipRows, transformationRows] = await Promise.all([
      this.enterprisePropertyRecordRepo.find({
        where: {
          enterpriseId,
          recordType: 'intellectual_property',
          status: 1,
        },
      }),
      this.enterprisePropertyRecordRepo.find({
        where: {
          enterpriseId,
          recordType: 'transformation',
          status: 1,
        },
      }),
    ]);
    const ipById = new Map(ipRows.map((ip) => [String(ip.id), ip]));
    const orderedRows = this.sortClientPropertyRowsByRelatedIpCode(
      transformationRows,
      ipRows,
    );
    const changedRows: EnterprisePropertyRecordEntity[] = [];

    orderedRows.forEach((row, index) => {
      const firstIpId = this.resolveEarliestRelatedIpId(row.relatedIpIds, ipRows);
      const nextName = this.normalizeTransformationStoredName(
        row.transformationName,
        ipById.get(firstIpId ?? '')?.softWorkName,
      );
      const nextCode = this.formatSequentialCode('成果', index + 1);
      if (
        row.transformationCode === nextCode &&
        row.transformationName === nextName
      ) {
        return;
      }
      row.transformationCode = nextCode;
      row.transformationName = nextName;
      changedRows.push(row);
    });

    if (changedRows.length > 0) {
      await this.enterprisePropertyRecordRepo.save(changedRows);
    }
  }

  private async applyTransformationCodeFromRelatedIp(
    enterpriseId: string,
    target: Partial<EnterprisePropertyRecordEntity>,
  ): Promise<void> {
    target.transformationName = this.normalizeTransformationStoredName(
      target.transformationName,
    );
    const firstIpId = this.parseRelationIds(target.relatedIpIds)[0];
    if (!firstIpId) {
      return;
    }

    const ip = await this.enterprisePropertyRecordRepo.findOne({
      where: {
        enterpriseId,
        id: firstIpId,
        recordType: 'intellectual_property',
        status: 1,
      },
    });
    target.transformationName = this.normalizeTransformationStoredName(
      target.transformationName,
      ip?.softWorkName,
    );
  }

  private async getNextClientPropertySequentialCode(
    enterpriseId: string,
    recordType: string,
    fieldName: keyof EnterprisePropertyRecordEntity,
    prefix: string,
  ): Promise<string> {
    const rows = await this.enterprisePropertyRecordRepo.find({
      where: {
        enterpriseId,
        recordType,
        status: 1,
      },
    });
    const maxNumber = rows.reduce((max, row) => {
      const value = row[fieldName];
      const match =
        typeof value === 'string'
          ? value.match(new RegExp(`^${prefix}(\\d+)$`, 'u'))
          : null;
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);

    return this.formatSequentialCode(prefix, maxNumber + 1);
  }

  private resolveClientIpTypeSort(type: null | number): number {
    const priority: Record<number, number> = {
      1: 1,
      2: 2,
      3: 3,
      4: 4,
    };
    return type ? priority[type] ?? 99 : 99;
  }

  private resolveClientIpSortTime(row: EnterprisePropertyRecordEntity): number {
    const parsed =
      this.parseDateOnlyTime(row.authorizeDate) ??
      this.parseDateOnlyTime(row.applyDate);
    return parsed ?? Number.MAX_SAFE_INTEGER;
  }

  private sortClientIpRowsForNumbering(
    rows: EnterprisePropertyRecordEntity[],
  ): EnterprisePropertyRecordEntity[] {
    return [...rows].sort((left, right) => {
      const codeDiff =
        this.resolveClientIpCodeRank(left) - this.resolveClientIpCodeRank(right);
      if (codeDiff !== 0) {
        return codeDiff;
      }

      return Number(left.id) - Number(right.id);
    });
  }

  private sortClientIpRowsForCodeGeneration(
    rows: EnterprisePropertyRecordEntity[],
  ): EnterprisePropertyRecordEntity[] {
    return [...rows].sort((left, right) => {
      const typeDiff =
        this.resolveClientIpTypeSort(left.softWorkType) -
        this.resolveClientIpTypeSort(right.softWorkType);
      if (typeDiff !== 0) {
        return typeDiff;
      }

      const applicationDateDiff =
        this.resolveClientIpApplicationSortTime(left) -
        this.resolveClientIpApplicationSortTime(right);
      if (applicationDateDiff !== 0) {
        return applicationDateDiff;
      }

      const dateDiff =
        this.resolveClientIpSortTime(left) - this.resolveClientIpSortTime(right);
      if (dateDiff !== 0) {
        return dateDiff;
      }

      return Number(left.id) - Number(right.id);
    });
  }

  private sortClientPropertyRowsByRelatedIpCode(
    rows: EnterprisePropertyRecordEntity[],
    ipRows: EnterprisePropertyRecordEntity[],
  ): EnterprisePropertyRecordEntity[] {
    const ipRanks = new Map(
      ipRows.map((ip) => [
        String(ip.id),
        this.resolveClientIpCodeRank(ip),
      ]),
    );
    return [...rows].sort((left, right) => {
      const rankDiff =
        this.resolveClientPropertyRowIpRank(left, ipRanks) -
        this.resolveClientPropertyRowIpRank(right, ipRanks);
      if (rankDiff !== 0) {
        return rankDiff;
      }

      const codeDiff = this.resolveClientPropertyRowCode(left).localeCompare(
        this.resolveClientPropertyRowCode(right),
        'zh-CN',
        { numeric: true },
      );
      if (codeDiff !== 0) {
        return codeDiff;
      }
      return String(left.id ?? '').localeCompare(String(right.id ?? ''), 'zh-CN', {
        numeric: true,
      });
    });
  }

  private resolveClientPropertyRowIpRank(
    row: EnterprisePropertyRecordEntity,
    ipRanks: Map<string, number>,
  ): number {
    const relatedIpIds =
      row.recordType === 'intellectual_property'
        ? [String(row.id)]
        : this.parseRelationIds(row.relatedIpIds);
    const ranks = relatedIpIds
      .map((id) => ipRanks.get(id))
      .filter((rank): rank is number => rank !== undefined);
    return ranks.length > 0 ? Math.min(...ranks) : Number.MAX_SAFE_INTEGER;
  }

  private resolveClientIpCodeRank(
    ip: EnterprisePropertyRecordEntity | undefined,
  ): number {
    const match = ip?.ipCode?.trim().match(/^IP(\d+)$/iu);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  }

  private resolveClientPropertyRowCode(
    row: EnterprisePropertyRecordEntity | undefined,
  ): string {
    if (!row) {
      return '';
    }
    const codeByType: Record<string, null | string> = {
      intellectual_property: row.ipCode,
      product_service: row.psCode,
      research_project: row.kyProjectNum,
      transformation: row.transformationCode,
    };
    return codeByType[row.recordType] ?? '';
  }

  private sortClientRelationIdsByRelatedIpCode(
    ids: string[],
    recordType: string,
    rows: EnterprisePropertyRecordEntity[],
    ipRows: EnterprisePropertyRecordEntity[],
  ): string[] {
    const ipRanks = new Map(
      ipRows.map((ip) => [
        String(ip.id),
        this.resolveClientIpCodeRank(ip),
      ]),
    );
    const targetRows = new Map(
      rows
        .filter((row) => row.recordType === recordType)
        .map((row) => [String(row.id), row]),
    );
    const uniqueIds = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];

    return uniqueIds.sort((left, right) => {
      const leftRow = targetRows.get(left);
      const rightRow = targetRows.get(right);
      const leftRank =
        recordType === 'intellectual_property'
          ? ipRanks.get(left)
          : leftRow
            ? this.resolveClientPropertyRowIpRank(leftRow, ipRanks)
            : Number.MAX_SAFE_INTEGER;
      const rightRank =
        recordType === 'intellectual_property'
          ? ipRanks.get(right)
          : rightRow
            ? this.resolveClientPropertyRowIpRank(rightRow, ipRanks)
            : Number.MAX_SAFE_INTEGER;
      const rankDiff =
        (leftRank ?? Number.MAX_SAFE_INTEGER) -
        (rightRank ?? Number.MAX_SAFE_INTEGER);
      if (rankDiff !== 0) {
        return rankDiff;
      }

      const codeDiff = this.resolveClientPropertyRowCode(leftRow).localeCompare(
        this.resolveClientPropertyRowCode(rightRow),
        'zh-CN',
        { numeric: true },
      );
      return codeDiff || left.localeCompare(right, 'zh-CN', { numeric: true });
    });
  }

  private resolveEarliestRelatedIpId(
    relatedIpIds: null | string | undefined,
    ipRows: EnterprisePropertyRecordEntity[],
  ): string | undefined {
    const ipRanks = new Map(
      ipRows.map((ip) => [
        String(ip.id),
        this.resolveClientIpCodeRank(ip),
      ]),
    );
    return this.parseRelationIds(relatedIpIds)
      .sort(
        (left, right) =>
          (ipRanks.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (ipRanks.get(right) ?? Number.MAX_SAFE_INTEGER),
      )[0];
  }

  private async listClientPropertyDraftsSortedByIpCode(
    enterpriseId: string,
    rows: AiDraftEntity[],
  ): Promise<{ items: ClientAiDraftItem[]; total: number }> {
    await this.renumberClientIpCodes(enterpriseId);
    const ipRows = await this.enterprisePropertyRecordRepo.find({
      where: {
        enterpriseId,
        recordType: 'intellectual_property',
        status: 1,
      },
    });
    const ipRanks = new Map(
      ipRows.map((ip) => [
        String(ip.id),
        this.resolveClientIpCodeRank(ip),
      ]),
    );
    const items = await this.enrichClientPropertyDraftItemsWithReviewWarnings(
      enterpriseId,
      rows.map((row) => this.toClientAiDraftItem(row)),
    );
    items.sort((left, right) => {
      const leftRank = this.resolveClientPropertyDraftIpRank(left, ipRanks);
      const rightRank = this.resolveClientPropertyDraftIpRank(right, ipRanks);
      return leftRank - rightRank || left.id.localeCompare(right.id, 'zh-CN', {
        numeric: true,
      });
    });
    return { items, total: rows.length };
  }

  private resolveClientPropertyDraftIpRank(
    draft: ClientAiDraftItem,
    ipRanks: Map<string, number>,
  ): number {
    const relatedIpIds = this.parseRelationIds(
      this.toNullableStringFromUnknown(draft.draftPayload.related_ip_ids),
    );
    const ranks = relatedIpIds
      .map((id) => ipRanks.get(id))
      .filter((rank): rank is number => rank !== undefined);
    return ranks.length > 0 ? Math.min(...ranks) : Number.MAX_SAFE_INTEGER;
  }

  private resolveClientIpApplicationSortTime(
    row: EnterprisePropertyRecordEntity,
  ): number {
    const parsed =
      this.parseDateOnlyTime(row.applyDate) ??
      this.parseDateOnlyTime(row.authorizeDate);
    return parsed ?? Number.MAX_SAFE_INTEGER;
  }

  private normalizeTransformationStoredName(
    currentName: null | string | undefined,
    fallbackName?: null | string,
  ): string {
    const name = (this.toNullableStringFromUnknown(currentName) ?? '')
      .replace(/^成果\d+\s*[-—_:：]\s*/u, '')
      .trim();
    if (!name || /^成果\d+$/u.test(name)) {
      return this.toNullableStringFromUnknown(fallbackName) ?? '未命名技术成果';
    }
    return name;
  }

  private isClientRdCode(value: unknown): value is string {
    return typeof value === 'string' && /^RD\d+$/u.test(value);
  }

  private formatSequentialCode(prefix: string, index: number): string {
    return `${prefix}${String(index).padStart(2, '0')}`;
  }

  private getQueryValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private normalizeDeclarationCapabilities(value: unknown): DeclarationCapabilities {
    const capabilities = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
    return {
      exportPackage: capabilities.exportPackage === true,
      gaoxinScore: capabilities.gaoxinScore === true,
      score: capabilities.score !== false,
    };
  }

  private requireDeclarationCapability(
    declaration: ClientDeclarationEntity,
    capability: keyof DeclarationCapabilities,
    label: string,
  ): void {
    const scheme = this.parseJsonObject(declaration.snapshotJson).scheme as
      | ResolvedDeclarationScheme
      | undefined;
    this.requireSchemeCapability(scheme, capability, label);
  }

  private requireSchemeCapability(
    scheme: ClientDeclareProjectItem['scheme'] | ResolvedDeclarationScheme | undefined | null,
    capability: keyof DeclarationCapabilities,
    label: string,
  ): void {
    if (!scheme?.capabilities[capability]) {
      throw new BadRequestException(`当前地区申报方案未启用${label}`);
    }
  }

  private async resolveClientDeclarationScheme(
    projectId: string,
    policyRegionIds: string[],
    enterpriseId: string,
  ): Promise<null | ResolvedDeclarationScheme> {
    const schemes = await this.declarationSchemeRepo.find({
      where: { projectId, status: 'published' },
    });
    if (schemes.length === 0) return null;

    const today = new Date();
    const regions = await this.regionRepo.find({ where: { status: 1 } });
    const regionById = new Map(regions.map((region) => [String(region.id), region]));
    const ranks = new Map<string, number>();
    const levelRank = (region: RegionEntity) =>
      region.level === 'district' ? 3 : region.level === 'city' ? 2 : region.level === 'province' ? 1 : 0;

    for (const policyRegionId of policyRegionIds) {
      const visited = new Set<string>();
      let region = regionById.get(policyRegionId);
      while (region && !visited.has(String(region.id))) {
        const regionId = String(region.id);
        visited.add(regionId);
        ranks.set(regionId, Math.max(ranks.get(regionId) ?? 0, levelRank(region)));
        region = region.parentId ? regionById.get(String(region.parentId)) : undefined;
      }
    }

    const rank = (regionId: null | string) =>
      regionId ? ranks.get(String(regionId)) ?? -1 : 0;
    const scheme = schemes
      .filter((item) =>
        (!item.regionId || ranks.has(String(item.regionId))) &&
        (!item.effectiveStartDate || item.effectiveStartDate <= today) &&
        (!item.effectiveEndDate || item.effectiveEndDate >= today),
      )
      .sort((left, right) => rank(right.regionId) - rank(left.regionId) || Number(right.id) - Number(left.id))[0];
    if (!scheme) return null;

    const qualification = await this.evaluateQualificationRules(
      enterpriseId,
      this.parseJsonObject(scheme.qualificationRulesJson),
    );
    return {
      capabilities: this.normalizeDeclarationCapabilities(this.parseJsonObject(scheme.capabilitiesJson)),
      flowTemplate: this.parseJsonObject(scheme.flowTemplateJson) as ResolvedDeclarationScheme['flowTemplate'],
      id: String(scheme.id),
      materialRules: this.parseJsonValue(scheme.materialRulesJson, []),
      qualification,
      qualificationRules: this.parseJsonObject(scheme.qualificationRulesJson),
      regionId: scheme.regionId ? String(scheme.regionId) : null,
      schemeName: scheme.schemeName,
      scoreRules: this.parseJsonValue(scheme.scoreRulesJson, { items: [], passScore: 0 }),
      version: scheme.version,
    };
  }

  async evaluateEnterpriseQualificationRules(
    enterpriseId: string,
    config: Record<string, unknown>,
  ): Promise<{ missing: string[]; status: 'eligible' | 'ineligible' }> {
    return this.evaluateQualificationRules(enterpriseId, config);
  }

  async getEnterpriseQualificationRuleDetails(
    enterpriseId: string,
    config: Record<string, unknown>,
  ) {
    const rules = Array.isArray(config.rules)
      ? config.rules.filter((item): item is QualificationRule =>
        Boolean(item) && typeof item === 'object',
      )
      : [];
    const mode = config.mode === 'any' ? 'any' : 'all';
    if (rules.length === 0) {
      return { mode, rules: [], status: 'eligible' as const };
    }

    const { certificates, metrics } = await this.loadQualificationEvaluationContext(
      enterpriseId,
    );
    const now = new Date();
    const details = rules.map((rule) => {
      if (rule.type === 'metric') {
        const metric = ENTERPRISE_METRIC_CATALOG.find(
          (item) => item.key === rule.key,
        );
        const actual = metrics[String(rule.key ?? '')];
        const expected = Number(rule.value);
        const passed =
          ENTERPRISE_METRIC_KEYS.has(String(rule.key ?? '')) &&
          Number.isFinite(actual) &&
          Number.isFinite(expected) &&
          this.isMetricQualificationPassed(actual, expected, rule.operator);
        return {
          actual: Number.isFinite(actual) ? this.roundStatNumber(actual) : null,
          expected,
          key: rule.key,
          label: metric?.label ?? String(rule.key ?? '企业指标'),
          operator: rule.operator,
          passed,
          source: metric?.source ?? '企业资料',
          type: 'metric' as const,
          unit: metric?.unit ?? '',
          valueType: metric?.valueType ?? 'number',
        };
      }

      const certificateType =
        rule.type === 'certificate_exists'
          ? rule.certificateType
          : rule.code ?? rule.name ?? '';
      const passed = certificates.some((certificate) => {
        const code = String(certificateType).trim().toUpperCase();
        const matched = code
          ? certificate.qualificationCode?.trim().toUpperCase() === code
          : rule.type === 'certificate' &&
            Boolean(rule.name && certificate.zsName?.includes(rule.name));
        return matched && (!certificate.validUntil || certificate.validUntil >= now);
      });
      return {
        actual: passed ? 1 : 0,
        expected: 1,
        key: certificateType,
        label: `有效证书：${certificateType || '未指定'}`,
        operator: 'eq',
        passed,
        source: '企业证书',
        type: 'certificate' as const,
        unit: '是/否',
        valueType: 'boolean' as const,
      };
    });

    const passed =
      mode === 'any'
        ? details.some((item) => item.passed)
        : details.every((item) => item.passed);
    return {
      mode,
      rules: details,
      status: passed ? ('eligible' as const) : ('ineligible' as const),
    };
  }

  private async resolveCurrentDeclarationMatchedScheme(
    userId: number,
    declaration: ClientDeclarationEntity,
  ): Promise<ClientDeclarationDetail['matchedScheme']> {
    const regionId = this.getDeclarationRegionId(declaration);
    const project = await this.listClientDeclareProjects(userId, {
      page: '1',
      pageSize: '1000',
      regionId,
    }).then((result) =>
      result.items.find((item) => item.id === String(declaration.projectId)),
    );
    const scheme = project?.scheme;
    if (!scheme) return null;

    const schemeRegion = scheme.regionId
      ? await this.regionRepo.findOne({ where: { id: scheme.regionId } })
      : null;
    return {
      id: scheme.id,
      qualificationStatus: scheme.qualification.status,
      regionId: scheme.regionId,
      regionName: schemeRegion?.name ?? '项目默认方案',
      schemeName: scheme.schemeName,
      version: scheme.version,
    };
  }

  async getEnterpriseFlowNodeQualificationDetails(
    enterpriseId: string,
    nodes: Array<{
      code?: string;
      name?: string;
      qualificationPresetIds?: string[];
    }>,
  ) {
    const presetIds = [
      ...new Set(
        nodes.flatMap((node) =>
          (node.qualificationPresetIds ?? [])
            .map((id) => String(id).trim())
            .filter(Boolean),
        ),
      ),
    ];
    const presets = presetIds.length
      ? await this.declarationPresetRepo.find({
          where: {
            id: In(presetIds),
            presetType: 'qualification',
            status: 'published',
          },
        })
      : [];
    const presetById = new Map(
      presets.map((preset) => [String(preset.id), preset]),
    );
    const detailsByPresetId = new Map(
      await Promise.all(
        presets.map(async (preset) => [
          String(preset.id),
          await this.getEnterpriseQualificationRuleDetails(
            enterpriseId,
            this.parseJsonObject(preset.payloadJson),
          ),
        ] as const),
      ),
    );

    return nodes.map((node) => {
      const preconditions = (node.qualificationPresetIds ?? []).map((id) => {
        const presetId = String(id);
        const preset = presetById.get(presetId);
        const evaluation = detailsByPresetId.get(presetId);
        return {
          description: preset?.description ?? null,
          id: presetId,
          name: preset?.name ?? `不可用预设 ${presetId}`,
          rules: evaluation?.rules ?? [],
          status: evaluation?.status ?? ('ineligible' as const),
          version: preset?.version ?? null,
        };
      });
      return {
        code: node.code ?? '',
        name: node.name ?? '',
        preconditions,
        status:
          preconditions.length === 0 ||
          preconditions.every((item) => item.status === 'eligible')
            ? ('eligible' as const)
            : ('ineligible' as const),
      };
    });
  }

  private isMetricQualificationPassed(
    actual: number,
    expected: number,
    operator?: string,
  ): boolean {
    switch (operator) {
      case 'gt':
        return actual > expected;
      case 'eq':
        return actual === expected;
      case 'lt':
        return actual < expected;
      case 'lte':
        return actual <= expected;
      case 'gte':
      default:
        return actual >= expected;
    }
  }

  private async evaluateQualificationRules(
    enterpriseId: string,
    config: Record<string, unknown>,
    context?: QualificationEvaluationContext,
  ): Promise<ResolvedDeclarationScheme['qualification']> {
    const rules = Array.isArray(config.rules)
      ? config.rules.filter((item): item is QualificationRule => Boolean(item) && typeof item === 'object')
      : [];
    if (rules.length === 0) return { missing: [], status: 'eligible' };

    const { certificates, metrics } = context ?? await this.loadQualificationEvaluationContext(enterpriseId);
    const now = new Date();
    const failed = rules.filter((rule) => {
      if (rule.type === 'metric') {
        const actual = metrics[String(rule.key ?? '')];
        const expected = Number(rule.value);
        if (!ENTERPRISE_METRIC_KEYS.has(String(rule.key ?? '')) || !Number.isFinite(actual) || !Number.isFinite(expected)) return true;
        switch (rule.operator) {
          case 'gt': return actual <= expected;
          case 'eq': return actual !== expected;
          case 'lt': return actual >= expected;
          case 'lte': return actual > expected;
          default: return actual < expected;
        }
      }
      const code = (rule.type === 'certificate_exists' ? rule.certificateType : rule.code)?.trim().toUpperCase();
      return !certificates.some((certificate) => {
        const matched = code
          ? certificate.qualificationCode?.trim().toUpperCase() === code
          : rule.type === 'certificate' && Boolean(rule.name && certificate.zsName?.includes(rule.name));
        return matched && (!certificate.validUntil || certificate.validUntil >= now);
      });
    });
    const mode = config.mode === 'any' ? 'any' : 'all';
    const missing = mode === 'any' && failed.length < rules.length
      ? []
      : failed.map((rule) => this.describeQualificationFailure(rule, metrics));
    return { missing, status: missing.length === 0 ? 'eligible' : 'ineligible' };
  }

  private async loadQualificationEvaluationContext(
    enterpriseId: string,
  ): Promise<QualificationEvaluationContext> {
    const [certificates, metrics] = await Promise.all([
      this.enterpriseCertificateRecordRepo.find({ where: { enterpriseId, status: 1 } }),
      this.loadEnterprisePresetMetrics(enterpriseId),
    ]);
    return { certificates, metrics };
  }

  private async resolveFlowNodeQualifications(
    enterpriseId: string,
    nodes: ResolvedFlowNode[],
  ): Promise<Map<string, FlowNodeQualification>> {
    const hasSnapshots = nodes.some((node) => (node.qualificationSnapshots?.length ?? 0) > 0);
    if (hasSnapshots) {
      const context = await this.loadQualificationEvaluationContext(enterpriseId);
      const entries = await Promise.all(nodes.map(async (node) => {
        const nodeName = node.name?.trim();
        if (!nodeName) return null;
        const snapshots = node.qualificationSnapshots ?? [];
        if (snapshots.length === 0) {
          const missing = (node.qualificationPresetIds?.length ?? 0) > 0
            ? ['节点准入条件快照缺失']
            : [];
          return [nodeName, {
            missing,
            presetNames: [],
            status: missing.length === 0 ? 'eligible' : 'ineligible',
          } satisfies FlowNodeQualification] as const;
        }
        const evaluations = await Promise.all(snapshots.map(async (snapshot) => ({
          name: snapshot.name?.trim() || '节点准入条件',
          result: await this.evaluateQualificationRules(
            enterpriseId,
            this.toObjectValue(snapshot.rules),
            context,
          ),
        })));
        const missing = evaluations.flatMap(({ name, result }) =>
          result.missing.map((item) => `${name}：${item}`),
        );
        return [nodeName, {
          missing,
          presetNames: evaluations.map((item) => item.name),
          status: missing.length === 0 ? 'eligible' : 'ineligible',
        } satisfies FlowNodeQualification] as const;
      }));
      return new Map(entries.filter(
        (item): item is readonly [string, FlowNodeQualification] => Boolean(item),
      ));
    }

    const presetIds = [...new Set(nodes.flatMap((node) =>
      (node.qualificationPresetIds ?? []).map((id) => String(id).trim()).filter(Boolean),
    ))];
    const presets = presetIds.length > 0
      ? await this.declarationPresetRepo.find({
          where: {
            id: In(presetIds),
            presetType: 'qualification',
            status: 'published',
          },
        })
      : [];
    const presetById = new Map(presets.map((preset) => [String(preset.id), preset]));
    const context = presets.length > 0
      ? await this.loadQualificationEvaluationContext(enterpriseId)
      : null;
    const evaluationByPresetId = new Map(await Promise.all(presets.map(async (preset) => [
      String(preset.id),
      await this.evaluateQualificationRules(
        enterpriseId,
        this.parseJsonObject(preset.payloadJson),
        context ?? undefined,
      ),
    ] as const)));

    return new Map(nodes
      .map((node) => {
        const nodeName = node.name?.trim();
        if (!nodeName) return null;
        const nodePresetIds = (node.qualificationPresetIds ?? [])
          .map((id) => String(id).trim())
          .filter(Boolean);
        const presetNames = nodePresetIds.flatMap((id) => {
          const preset = presetById.get(id);
          return preset ? [preset.name] : [];
        });
        const missing = nodePresetIds.flatMap((id) => {
          const preset = presetById.get(id);
          const evaluation = evaluationByPresetId.get(id);
          if (!preset || !evaluation) return [`准入条件预设不可用：${id}`];
          return evaluation.missing.map((item) => `${preset.name}：${item}`);
        });
        return [nodeName, {
          missing,
          presetNames,
          status: missing.length === 0 ? 'eligible' : 'ineligible',
        } satisfies FlowNodeQualification] as const;
      })
      .filter((item): item is readonly [string, FlowNodeQualification] => Boolean(item)));
  }

  private describeQualificationFailure(rule: QualificationRule, metrics: Record<string, number>): string {
    if (rule.type === 'metric') {
      const metric = ENTERPRISE_METRIC_CATALOG.find((item) => item.key === rule.key);
      const label = metric?.label ?? String(rule.key ?? '企业指标');
      const actual = metrics[String(rule.key ?? '')];
      if (metric?.valueType === 'boolean') {
        const expected = Number(rule.value) === 1 ? '是' : '否';
        const current = Number.isFinite(actual) ? (actual === 1 ? '是' : '否') : '未提供';
        return `${label} 需为“${expected}”，当前“${current}”`;
      }
      const operators: Record<string, string> = { eq: '等于', gt: '大于', gte: '大于等于', lt: '小于', lte: '小于等于' };
      const unit = metric?.unit ?? '';
      return `${label} ${operators[String(rule.operator ?? 'gte')] ?? '大于等于'} ${Number(rule.value ?? 0)}${unit}，当前 ${Number.isFinite(actual) ? this.roundStatNumber(actual) : '未提供'}${Number.isFinite(actual) ? unit : ''}`;
    }
    return rule.type === 'certificate_exists'
      ? `缺少有效证书：${rule.certificateType ?? '未指定'}`
      : rule.name || rule.code || '企业资质';
  }

  private async evaluateEnterprisePreset(
    enterpriseId: string,
    config: Record<string, unknown>,
  ): Promise<{ missing: string[]; status: 'eligible' | 'ineligible' }> {
    const rules = Array.isArray(config.rules)
      ? config.rules.filter((item): item is {
          key?: unknown;
          label?: unknown;
          operator?: unknown;
          value?: unknown;
        } => Boolean(item) && typeof item === 'object')
      : [];
    if (rules.length === 0) return { missing: [], status: 'eligible' };

    const metrics = await this.loadEnterprisePresetMetrics(enterpriseId);
    const failed = rules.filter((rule) => {
      const key = String(rule.key ?? '');
      const actual = metrics[key];
      const expected = Number(rule.value);
      if (!Number.isFinite(actual) || !Number.isFinite(expected)) return true;
      switch (rule.operator) {
        case 'gt': return actual <= expected;
        case 'eq': return actual !== expected;
        case 'lt': return actual >= expected;
        case 'lte': return actual > expected;
        case 'gte':
        default: return actual < expected;
      }
    });
    const mode = config.mode === 'any' ? 'any' : 'all';
    const missing = mode === 'any' && failed.length < rules.length
      ? []
      : failed.map((rule) => this.describeEnterprisePresetFailure(rule, metrics));
    return { missing, status: missing.length === 0 ? 'eligible' : 'ineligible' };
  }

  private async loadEnterprisePresetMetrics(enterpriseId: string): Promise<Record<string, number>> {
    const [accounts, basicInfo, certificates, contracts, employees, financeRecords, photos, properties] = await Promise.all([
      this.enterpriseAccountRecordRepo.find({ where: { enterpriseId, status: 1 } }),
      this.enterpriseBasicInfoRepo.findOne({ where: { enterpriseId } }),
      this.enterpriseCertificateRecordRepo.find({ where: { enterpriseId, status: 1 } }),
      this.enterpriseContractRecordRepo.find({ where: { enterpriseId, status: 1 } }),
      this.enterpriseEmployeeRecordRepo.find({ where: { enterpriseId, status: 1 } }),
      this.enterpriseFinanceRecordRepo.find({ where: { enterpriseId, status: 1 } }),
      this.enterprisePhotoRecordRepo.find({ where: { enterpriseId, status: 1 } }),
      this.enterprisePropertyRecordRepo.find({ where: { enterpriseId, status: 1 } }),
    ]);
    const financialRecords = financeRecords.filter((item) => item.recordType === 'financial');
    const latestFinance = [...financialRecords].sort((left, right) =>
      String(right.year ?? '').localeCompare(String(left.year ?? '')),
    )[0];
    const recentFinancialRecords = [...financialRecords]
      .sort((left, right) => String(right.year ?? '').localeCompare(String(left.year ?? '')))
      .slice(0, 3);
    const totalRevenue = this.toNumberValue(latestFinance?.mainBusinessIncome ?? latestFinance?.totalRevenue ?? latestFinance?.xxsr);
    const highTechIncome = this.toNumberValue(latestFinance?.highTechIncome);
    const threeYearSalesRevenue = recentFinancialRecords.reduce(
      (total, item) => total + this.toNumberValue(item.mainBusinessIncome ?? item.totalRevenue ?? item.xxsr),
      0,
    );
    const threeYearRdExpense = recentFinancialRecords.reduce(
      (total, item) => total + this.toNumberValue(item.yffy),
      0,
    );
    const activeEmployees = employees.filter((item) => item.isActive !== 0);
    const employeeAttachmentCount = employees.filter((item) => this.hasAnyFilledValue(item, [
      'educationFile',
      'laborContractFile',
      'socialSecurityFile',
      'titleFile',
      'ygFiles',
    ])).length;
    const establishedAt = basicInfo?.establishTime;
    const enterpriseAgeDays = establishedAt
      ? Math.max(0, Math.floor((Date.now() - establishedAt.getTime()) / 86_400_000))
      : Number.NaN;
    const requiredFinancialYears = Number.isFinite(enterpriseAgeDays)
      ? Math.min(3, Math.max(1, Math.floor(enterpriseAgeDays / 365)))
      : 3;
    const rdExpenseRatio = threeYearSalesRevenue > 0
      ? threeYearRdExpense / threeYearSalesRevenue * 100
      : 0;
    // 财务金额按企业资料中的万元口径计算；高企研发费用比例门槛由
    // 最近一年销售收入决定，不能固定为单一阈值。
    const latestSalesRevenue = this.toNumberValue(latestFinance?.mainBusinessIncome ?? latestFinance?.totalRevenue ?? latestFinance?.xxsr);
    const requiredRdExpenseRatio = latestSalesRevenue < 5000
      ? 5
      : totalRevenue <= 20_000
        ? 4
        : 3;
    const ipRows = properties.filter((item) => item.recordType === 'intellectual_property');
    const rdRows = properties.filter((item) => item.recordType === 'research_project');
    const psRows = properties.filter((item) => item.recordType === 'product_service');
    const transformationRows = properties.filter((item) => item.recordType === 'transformation');
    const taxAuditRows = financeRecords.filter((item) => item.recordType === 'tax_audit');
    return {
      account_high_tech_declaration_exists: accounts.some((item) => item.zhType === 1 || /高企|高新技术企业|高新申报/u.test(`${item.ptName ?? ''}${item.remark ?? ''}`)) ? 1 : 0,
      account_soft_copyright_exists: accounts.some((item) => item.zhType === 3 || /软著|软件著作权|版权保护/u.test(`${item.ptName ?? ''}${item.remark ?? ''}`)) ? 1 : 0,
      balance_sheet_exists: taxAuditRows.some((item) => this.isFinanceAttachmentMatch(item, /科目余额|余额表/u)) ? 1 : 0,
      business_license_exists: certificates.some((item) => item.zsClass === 5 && (this.isFilledValue(item.zsName) || this.isFilledValue(item.zsPath))) ? 1 : 0,
      contract_count: contracts.filter((item) => item.recordType === 'contract').length,
      employee_count: employees.length,
      employee_attachment_count: employeeAttachmentCount,
      employee_attachment_coverage_ratio: employees.length > 0 ? employeeAttachmentCount / employees.length * 100 : 0,
      enterprise_age_days: enterpriseAgeDays,
      equipment_photo_exists: photos.some((item) => item.photoStatus === 3 && this.isFilledValue(item.photoFiles)) ? 1 : 0,
      finance_year_count: new Set(financialRecords.map((item) => item.year).filter((value) => this.isFilledValue(value))).size,
      financial_statement_exists: taxAuditRows.some((item) => this.isFilledValue(item.filePath) && (item.fileClass === 2 || this.isFinanceAttachmentMatch(item, /财务报表|审计报告|年度审计|资产负债表|利润表|现金流量表/u))) ? 1 : 0,
      gaoxin_financial_period_complete: recentFinancialRecords.length >= requiredFinancialYears ? 1 : 0,
      core_ip_exists: properties.some((item) =>
        item.recordType === 'intellectual_property' && item.isCoreIp === 1,
      ) ? 1 : 0,
      ip_count: properties.filter((item) => item.recordType === 'intellectual_property').length,
      ip_rd_ps_chain_complete: this.isIpRdPsChainComplete(ipRows, rdRows, psRows, transformationRows) ? 1 : 0,
      invoice_count: contracts.filter((item) => item.recordType === 'invoice').length,
      latest_high_tech_income: highTechIncome,
      latest_high_tech_income_ratio: totalRevenue > 0 ? highTechIncome / totalRevenue * 100 : 0,
      latest_total_revenue: totalRevenue,
      personnel_info_exists: employees.length > 0 ? 1 : 0,
      sequence_ledger_exists: taxAuditRows.some((item) => this.isFinanceAttachmentMatch(item, /序时账|明细账|总账/u)) ? 1 : 0,
      site_photo_exists: photos.some((item) => item.photoStatus === 1 && this.isFilledValue(item.photoFiles)) ? 1 : 0,
      tech_employee_count: employees.filter((item) => item.isKjyf === 1).length,
      tech_employee_ratio: activeEmployees.length > 0
        ? activeEmployees.filter((item) => item.isKjyf === 1).length / activeEmployees.length * 100
        : 0,
      three_year_rd_expense_ratio: rdExpenseRatio,
      three_year_rd_expense_ratio_required: requiredRdExpenseRatio,
      three_year_rd_expense_ratio_qualified:
        recentFinancialRecords.length >= requiredFinancialYears && rdExpenseRatio >= requiredRdExpenseRatio
          ? 1
          : 0,
      training_photo_exists: photos.some((item) => item.photoStatus === 2 && this.isFilledValue(item.photoFiles)) ? 1 : 0,
    };
  }

  private hasAnyFilledValue(record: object, fields: string[]): boolean {
    const values = record as Record<string, unknown>;
    return fields.some((field) => this.isFilledValue(values[field]));
  }

  private isFinanceAttachmentMatch(row: EnterpriseFinanceRecordEntity, pattern: RegExp): boolean {
    return this.isFilledValue(row.filePath) && pattern.test([
      row.filePath,
      row.remark,
      row.taxCategory,
    ].filter((value) => this.isFilledValue(value)).join(' '));
  }

  private hasAnyRelationValue(record: EnterprisePropertyRecordEntity, fields: Array<keyof EnterprisePropertyRecordEntity>): boolean {
    return fields.some((field) => this.parseMetricRelationIds(record[field]).length > 0);
  }

  private isIpRdPsChainComplete(
    ipRows: EnterprisePropertyRecordEntity[],
    rdRows: EnterprisePropertyRecordEntity[],
    psRows: EnterprisePropertyRecordEntity[],
    transformationRows: EnterprisePropertyRecordEntity[],
  ): boolean {
    if (!ipRows.length || !rdRows.length || !psRows.length || !transformationRows.length) {
      return false;
    }

    const hasIpRelation = ipRows.some((item) => this.hasAnyRelationValue(item, ['relatedPsIds', 'relatedRdIds', 'relatedTransformationIds']));
    const hasRdRelation = rdRows.some((item) => this.hasAnyRelationValue(item, ['relatedIpIds', 'relatedPsIds', 'relatedTransformationIds']));
    const hasPsRelation = psRows.some((item) => this.hasAnyRelationValue(item, ['relatedIpIds', 'relatedRdIds', 'relatedTransformationIds']));
    const hasTransformationRelation = transformationRows.some((item) => this.hasAnyRelationValue(item, ['relatedIpIds', 'relatedPsIds', 'relatedRdIds']));

    return hasIpRelation && hasRdRelation && hasPsRelation && hasTransformationRelation;
  }

  private parseMetricRelationIds(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }

    const text = String(value ?? '').trim();
    if (!text) {
      return [];
    }

    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text) as unknown;
        return Array.isArray(parsed)
          ? parsed.map((item) => String(item).trim()).filter(Boolean)
          : [];
      } catch {
        return [];
      }
    }

    return text.split(/[,，\s]+/u).map((item) => item.trim()).filter(Boolean);
  }

  private describeEnterprisePresetFailure(
    rule: { key?: unknown; label?: unknown; operator?: unknown; value?: unknown },
    metrics: Record<string, number>,
  ): string {
    const labels: Record<string, string> = {
      account_high_tech_declaration_exists: '企业高企申报账号是否存在',
      account_soft_copyright_exists: '软件著作权账号是否存在',
      balance_sheet_exists: '科目余额表是否上传',
      business_license_exists: '营业执照是否存在',
      contract_count: '合同数量',
      employee_count: '员工人数',
      employee_attachment_count: '有附件员工数量',
      employee_attachment_coverage_ratio: '员工附件覆盖率',
      enterprise_age_days: '企业成立天数',
      equipment_photo_exists: '设备照片是否存在',
      finance_year_count: '经营数据年度数量',
      financial_statement_exists: '财务报表是否上传',
      ip_count: '知识产权数量',
      ip_rd_ps_chain_complete: 'IP-RD-PS-成果转化链路是否完善',
      invoice_count: '发票数量',
      latest_high_tech_income: '最近一年高新技术产品收入',
      latest_high_tech_income_ratio: '最近一年高新技术产品收入占比',
      latest_total_revenue: '最近一年总收入',
      personnel_info_exists: '人员情况是否存在',
      sequence_ledger_exists: '序时账是否上传',
      site_photo_exists: '场地照片是否存在',
      training_photo_exists: '人员培训照片是否存在',
    };
    const operators: Record<string, string> = {
      eq: '等于', gt: '大于', gte: '不少于', lt: '小于', lte: '不超过',
    };
    const key = String(rule.key ?? '');
    const label = String(rule.label ?? '').trim() || labels[key] || key;
    const expected = Number(rule.value ?? 0);
    const actual = metrics[key];
    const suffix = key === 'enterprise_age_days' && Number.isFinite(actual) && expected > actual
      ? `，当前 ${Math.floor(actual)} 天，距满足还差 ${Math.ceil(expected - actual)} 天`
      : Number.isFinite(actual) ? `，当前值 ${this.roundStatNumber(actual)}` : '，企业资料未提供可计算值';
    return `${label}${operators[String(rule.operator ?? 'gte')] ?? '不少于'} ${expected}${suffix}`;
  }

  private getSchemeInitialNodeName(scheme: ClientDeclareProjectItem['scheme']): string {
    const node = scheme?.flowTemplate.nodes?.find((item) => item.code === 'precheck')
      ?? scheme?.flowTemplate.nodes?.[0];
    return node?.name?.trim() || '草稿';
  }

  private getDeclarationRegionId(
    declaration: ClientDeclarationEntity,
    snapshot = this.parseJsonObject(declaration.snapshotJson),
  ): string | undefined {
    if (declaration.declarationRegionId) {
      return String(declaration.declarationRegionId);
    }
    const region = snapshot.declarationRegion as { id?: unknown } | undefined;
    return typeof region?.id === 'string' || typeof region?.id === 'number'
      ? String(region.id)
      : undefined;
  }

  private resolveDeclarationRegionSnapshot(
    project: ClientDeclareProjectItem,
    requestedRegionId?: string,
  ) {
    const policy = requestedRegionId
      ? project.matchedPolicies.find((item) => item.regionId === requestedRegionId)
      : project.matchedPolicies[0];
    return {
      id: requestedRegionId ?? policy?.regionId ?? null,
      name: policy?.regionName ?? '项目默认地区',
    };
  }

  private calculateSchemeScore(
    scheme: ResolvedDeclarationScheme,
    materialReadinessScore: number,
    metrics: Record<string, number>,
  ): SchemeScoreResult {
    const config = this.parseScoreRuleConfig(scheme.scoreRules);
    const items = config.items.map((item) => {
      const sourceValue = item.source === 'qualification'
        ? scheme.qualification.status === 'eligible' ? 1 : 0
        : item.source === 'material_readiness'
          ? materialReadinessScore
          : metrics[item.source] ?? 0;
      const maxScore = Math.max(Number(item.maxScore ?? 0), 0);
      const threshold = Math.max(Number(item.threshold ?? 0), 0);
      const method = item.method ?? 'fixed';
      const score = method === 'ladder'
        ? this.resolveSchemeLadderScore(item.ladder, sourceValue, maxScore)
        : method === 'ratio'
        ? threshold > 0 ? Math.min(maxScore, sourceValue / threshold * maxScore) : 0
        : method === 'threshold'
          ? sourceValue >= threshold ? maxScore : 0
          : sourceValue > 0 ? Math.min(Number(item.score ?? maxScore), maxScore) : 0;
      return {
        label: item.label || item.source,
        maxScore,
        score: this.roundStatNumber(score),
        source: item.source,
        value: this.roundStatNumber(sourceValue),
      };
    });
    const totalScore = this.roundStatNumber(items.reduce((sum, item) => sum + item.score, 0));
    return {
      items,
      passScore: config.passScore,
      passed: totalScore >= config.passScore,
      schemeId: scheme.id,
      schemeVersion: scheme.version,
      totalScore,
    };
  }

  private parseScoreRuleConfig(value: unknown): {
    items: Array<{
      label?: string;
      maxScore?: number;
      ladder?: Array<{ min?: number; score?: number }>;
      method?: 'fixed' | 'ladder' | 'ratio' | 'threshold';
      score?: number;
      source: string;
      threshold?: number;
    }>;
    passScore: number;
  } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { items: [], passScore: 0 };
    }
    const config = value as { items?: unknown; passScore?: unknown };
    const items = Array.isArray(config.items)
      ? config.items.filter((item): item is { source: string } =>
          Boolean(item) && typeof item === 'object' &&
          this.isSupportedSchemeScoreSource(String((item as { source?: unknown }).source)),
        )
      : [];
    return { items, passScore: Math.max(Number(config.passScore ?? 0), 0) };
  }

  private resolveSchemeLadderScore(
    ladder: unknown,
    value: number,
    maxScore: number,
  ): number {
    if (!Array.isArray(ladder)) return 0;
    return ladder.reduce((score, item) => {
      if (!item || typeof item !== 'object') return score;
      const step = item as { min?: unknown; score?: unknown };
      return value >= Number(step.min ?? 0)
        ? Math.max(score, Math.min(Number(step.score ?? 0), maxScore))
        : score;
    }, 0);
  }

  private isSupportedSchemeScoreSource(source: string): boolean {
    if (ENTERPRISE_METRIC_KEYS.has(source)) {
      return true;
    }

    return new Set([
      'certificate_count',
      'employee_count',
      'finance.high_tech_income_ratio',
      'finance.rd_expense_ratio',
      'ip_count',
      'material_readiness',
      'property.ps_count',
      'property.rd_count',
      'property.transformation_count',
      'qualification',
      'tech_employee_count',
      'tech_employee_ratio',
    ]).has(source);
  }

  private async loadSchemeScoreMetrics(enterpriseId: string): Promise<Record<string, number>> {
    const [certificates, employees, enterpriseMetrics, financeRecords, properties] = await Promise.all([
      this.enterpriseCertificateRecordRepo.find({ where: { enterpriseId, status: 1 } }),
      this.enterpriseEmployeeRecordRepo.find({ where: { enterpriseId, status: 1 } }),
      this.loadEnterprisePresetMetrics(enterpriseId),
      this.enterpriseFinanceRecordRepo.find({ where: { enterpriseId, recordType: 'financial', status: 1 } }),
      this.enterprisePropertyRecordRepo.find({ where: { enterpriseId, status: 1 } }),
    ]);
    const latestFinance = [...financeRecords].sort((left, right) =>
      String(right.year ?? '').localeCompare(String(left.year ?? '')),
    )[0];
    const totalRevenue = this.toNumberValue(latestFinance?.mainBusinessIncome ?? latestFinance?.totalRevenue ?? latestFinance?.xxsr);
    const rdExpense = this.toNumberValue(latestFinance?.yffy);
    const highTechIncome = this.toNumberValue(latestFinance?.highTechIncome);
    const techEmployeeCount = employees.filter((item) => item.isKjyf === 1).length;
    const byRecordType = (recordType: string) =>
      properties.filter((item) => item.recordType === recordType).length;
    return {
      ...enterpriseMetrics,
      certificate_count: certificates.length,
      employee_count: employees.length,
      'finance.high_tech_income_ratio': totalRevenue > 0 ? highTechIncome / totalRevenue * 100 : 0,
      'finance.rd_expense_ratio': totalRevenue > 0 ? rdExpense / totalRevenue * 100 : 0,
      ip_count: byRecordType('intellectual_property'),
      'property.ps_count': byRecordType('product_service'),
      'property.rd_count': byRecordType('research_project'),
      'property.transformation_count': byRecordType('transformation'),
      tech_employee_count: techEmployeeCount,
      tech_employee_ratio: employees.length > 0 ? techEmployeeCount / employees.length * 100 : 0,
    };
  }

  private parseJsonValue<T>(value: null | string | undefined, fallback: T): T {
    if (!value) return fallback;
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }

  private toObjectValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private evaluateFlowNodeTiming(
    node: ResolvedFlowNode,
    snapshot: Record<string, unknown>,
    declarationCreatedAt: Date,
    now = new Date(),
  ): { available: boolean; message: string } {
    const timeRule = node.timeRule;
    if (timeRule?.mode === 'annual_window') {
      const start = this.toFlowMonthDay(timeRule.startMonth, timeRule.startDay);
      const end = this.toFlowMonthDay(timeRule.endMonth, timeRule.endDay);
      if (start !== null && end !== null) {
        const current = this.toFlowMonthDay(
          this.toBjtDateParts(now).month,
          this.toBjtDateParts(now).day,
        );
        const available = start <= end
          ? current !== null && current >= start && current <= end
          : current !== null && (current >= start || current <= end);
        if (!available) {
          return {
            available: false,
            message: `${node.name ?? '当前节点'}仅可在${this.formatFlowMonthDay(start)}至${this.formatFlowMonthDay(end)}期间办理`,
          };
        }
      }
    }

    if (timeRule?.mode === 'date_range') {
      const startDate = this.toValidDate(timeRule.startDate);
      const endDate = this.toValidDate(timeRule.endDate);
      if (startDate && endDate && (now < startDate || now > endDate)) {
        return {
          available: false,
          message: `${node.name ?? '当前节点'}仅可在 ${this.formatDate(startDate)} 至 ${this.formatDate(endDate)} 期间办理`,
        };
      }
    }

    if (timeRule?.mode === 'relative_days') {
      const elapsedDays = Math.floor((now.getTime() - declarationCreatedAt.getTime()) / 86_400_000);
      const startOffset = this.toNonNegativeInteger(timeRule.startOffsetDays);
      const endOffset = this.toNonNegativeInteger(timeRule.endOffsetDays);
      if (startOffset !== null && elapsedDays < startOffset) {
        return {
          available: false,
          message: `${node.name ?? '当前节点'}需在申报创建后第${startOffset}天起办理`,
        };
      }
      if (endOffset !== null && elapsedDays > endOffset) {
        return {
          available: false,
          message: `${node.name ?? '当前节点'}的办理期限为申报创建后${endOffset}天内`,
        };
      }
    }

    const maxHandleDays = this.toPositiveInteger(timeRule?.maxHandleDays);
    if (maxHandleDays !== null) {
      const nodeStartedAt = this.resolveFlowNodeStartedAt(
        snapshot,
        node.name?.trim(),
        declarationCreatedAt,
      );
      const elapsedDays = Math.floor((now.getTime() - nodeStartedAt.getTime()) / 86_400_000);
      if (elapsedDays > maxHandleDays) {
        return {
          available: false,
          message: `${node.name ?? '当前节点'}进入后需在${maxHandleDays}天内办理，当前已超期`,
        };
      }
    }

    return { available: true, message: '' };
  }

  private resolveFlowNodeDeadline(
    node: ResolvedFlowNode,
    snapshot: Record<string, unknown>,
    declarationCreatedAt: Date,
    now: Date,
  ): Date | null {
    const timeRule = node.timeRule;
    if (timeRule?.mode === 'annual_window') {
      const end = this.toFlowMonthDay(timeRule.endMonth, timeRule.endDay);
      if (end !== null) {
        const bjt = this.toBjtDateParts(now);
        const current = this.toFlowMonthDay(bjt.month, bjt.day);
        return new Date(`${bjt.year}-${String(Math.floor(end / 100)).padStart(2, '0')}-${String(end % 100).padStart(2, '0')}T23:59:59+08:00`);
      }
    }
    if (timeRule?.mode === 'date_range') {
      return this.toFlowEndOfDay(timeRule.endDate);
    }
    if (timeRule?.mode === 'relative_days') {
      const endOffset = this.toNonNegativeInteger(timeRule.endOffsetDays);
      if (endOffset !== null) {
        return new Date(declarationCreatedAt.getTime() + endOffset * 86_400_000);
      }
    }
    const maxHandleDays = this.toPositiveInteger(timeRule?.maxHandleDays);
    if (maxHandleDays !== null) {
      const startedAt = this.resolveFlowNodeStartedAt(
        snapshot,
        node.name?.trim(),
        declarationCreatedAt,
      );
      return new Date(startedAt.getTime() + maxHandleDays * 86_400_000);
    }
    return null;
  }

  private getCalendarDayDistance(from: Date, to: Date): number {
    const toDay = (value: Date) => {
      const parts = this.toBjtDateParts(value);
      return Date.UTC(parts.year, parts.month - 1, parts.day);
    };
    return Math.round((toDay(to) - toDay(from)) / 86_400_000);
  }

  private describeFlowNode(node: ResolvedFlowNode): string {
    const base = node.description?.trim() || (node.type === 'auto' ? '系统自动校验节点。' : '按方案配置处理该节点。');
    return `${base}${this.describeFlowNodeTimeRule(node.timeRule)}。`;
  }

  private describeFlowNodeTimeRule(timeRule?: ResolvedFlowNodeTimeRule): string {
    const parts: string[] = [];
    if (timeRule?.mode === 'annual_window') {
      const start = this.toFlowMonthDay(timeRule.startMonth, timeRule.startDay);
      const end = this.toFlowMonthDay(timeRule.endMonth, timeRule.endDay);
      parts.push(
        start !== null && end !== null
          ? `办理窗口：每年${this.formatFlowMonthDay(start)}至${this.formatFlowMonthDay(end)}`
          : '办理窗口：每年固定窗口（待补充日期）',
      );
    } else if (timeRule?.mode === 'date_range') {
      const start = this.toValidDate(timeRule.startDate);
      const end = this.toValidDate(timeRule.endDate);
      parts.push(
        start && end
          ? `办理时间：${this.formatDate(start)} 至 ${this.formatDate(end)}`
          : '办理时间：指定日期段（待补充日期）',
      );
    } else if (timeRule?.mode === 'relative_days') {
      const startOffset = this.toNonNegativeInteger(timeRule.startOffsetDays);
      const endOffset = this.toNonNegativeInteger(timeRule.endOffsetDays);
      if (startOffset !== null && endOffset !== null) {
        parts.push(`办理窗口：申报创建后第${startOffset}至${endOffset}天`);
      } else if (startOffset !== null) {
        parts.push(`办理窗口：申报创建后第${startOffset}天起`);
      } else if (endOffset !== null) {
        parts.push(`办理窗口：申报创建后${endOffset}天内`);
      } else {
        parts.push('办理窗口：申报创建后时限（待补充天数）');
      }
    } else {
      parts.push('办理时间：全年可办理');
    }
    const maxHandleDays = this.toPositiveInteger(timeRule?.maxHandleDays);
    if (maxHandleDays !== null) parts.push(`节点时限：进入后${maxHandleDays}天内`);
    return parts.join('；');
  }

  private describeFlowNodeYearScope(yearScope?: ResolvedFlowNodeYearScope): string {
    const mode = yearScope?.mode ?? 'current';
    if (mode === 'previous') return '业务年度：上一年度';
    if (mode === 'specified') {
      const year = this.toPositiveInteger(yearScope?.specifiedYear);
      return year !== null ? `业务年度：${year}年` : '业务年度：指定年度（待补充）';
    }
    if (mode === 'recent_years') {
      const years = this.toPositiveInteger(yearScope?.recentYears);
      return years !== null ? `业务年度：最近${years}年` : '业务年度：最近 N 年（待补充年数）';
    }
    return '业务年度：当前年度';
  }

  private resolveFlowNodeStartedAt(
    snapshot: Record<string, unknown>,
    nodeName: string | undefined,
    fallback: Date,
  ): Date {
    if (!nodeName || !Array.isArray(snapshot.schemeFlowHistory)) return fallback;
    for (const entry of [...snapshot.schemeFlowHistory].reverse()) {
      if (!entry || typeof entry !== 'object') continue;
      const value = entry as { at?: unknown; from?: unknown; to?: unknown };
      if (
        value.to !== nodeName
        || value.from === value.to
        || typeof value.at !== 'string'
      ) continue;
      const startedAt = new Date(value.at);
      if (!Number.isNaN(startedAt.valueOf())) return startedAt;
    }
    return fallback;
  }

  private toBjtDateParts(date: Date): { day: number; month: number; year: number } {
    const bjt = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    return {
      day: bjt.getUTCDate(),
      month: bjt.getUTCMonth() + 1,
      year: bjt.getUTCFullYear(),
    };
  }

  private toValidDate(value: unknown): Date | null {
    return parseFlowDate(value);
  }

  private toFlowEndOfDay(value: unknown): Date | null {
    return parseFlowDate(value, true);
  }

  private isFlowNodeWaiting(node: ResolvedFlowNode, now: Date): boolean {
    const startDate = node.timeRule?.mode === 'date_range'
      ? this.toValidDate(node.timeRule.startDate)
      : null;
    return Boolean(startDate && now < startDate);
  }

  private toFlowMonthDay(month: unknown, day: unknown): null | number {
    const normalizedMonth = this.toPositiveInteger(month);
    const normalizedDay = this.toPositiveInteger(day);
    if (normalizedMonth === null || normalizedDay === null || normalizedMonth > 12) return null;
    const maxDay = new Date(2024, normalizedMonth, 0).getDate();
    if (normalizedDay > maxDay) return null;
    return normalizedMonth * 100 + normalizedDay;
  }

  private formatFlowMonthDay(value: number): string {
    const month = Math.floor(value / 100);
    const day = value % 100;
    return `${month}月${day}日`;
  }

  private toNonNegativeInteger(value: unknown): null | number {
    const normalized = Number(value);
    return Number.isInteger(normalized) && normalized >= 0 ? normalized : null;
  }

  private toPositiveInteger(value: unknown): null | number {
    const normalized = Number(value);
    return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
  }

  private appendSchemeFlowHistory(
    snapshot: Record<string, unknown>,
    item: { from: string; reason: string; to: string },
  ): string {
    const history = Array.isArray(snapshot.schemeFlowHistory)
      ? snapshot.schemeFlowHistory.filter((entry) => entry && typeof entry === 'object')
      : [];
    return JSON.stringify({
      ...snapshot,
      schemeFlowHistory: [
        ...history,
        { ...item, at: new Date().toISOString() },
      ],
    });
  }

  private async resolveCurrentEnterprisePolicyRegionIds(
    userId: number,
  ): Promise<Set<string>> {
    const enterpriseId = await this.getCurrentEnterpriseIdOrNull(userId);
    if (!enterpriseId) {
      return new Set();
    }

    const [enterprise, basicInfo, regions] = await Promise.all([
      this.enterpriseRepo.findOne({ where: { id: enterpriseId } }),
      this.enterpriseBasicInfoRepo.findOne({ where: { enterpriseId } }),
      this.regionRepo.find({
        order: {
          id: 'ASC',
        },
        where: {
          status: 1,
        },
      }),
    ]);

    const regionNames = [
      basicInfo?.province ?? enterprise?.province,
      basicInfo?.city ?? enterprise?.city,
      basicInfo?.district ?? enterprise?.district,
    ]
      .map((item) => item?.trim())
      .filter((item): item is string => Boolean(item));

    if (regionNames.length === 0) {
      return new Set();
    }

    const normalizedNames = new Set(
      regionNames.flatMap((name) => [name, name.replace(/(省|市|区|县)$/u, '')]),
    );
    const regionMap = new Map(regions.map((region) => [String(region.id), region]));
    const matchedIds = new Set<string>();

    regions.forEach((region) => {
      const normalizedRegionName = region.name.replace(/(省|市|区|县)$/u, '');
      if (
        normalizedNames.has(region.name) ||
        normalizedNames.has(normalizedRegionName)
      ) {
        matchedIds.add(String(region.id));
      }
    });

    const result = new Set<string>();
    matchedIds.forEach((id) => {
      let current: RegionEntity | undefined = regionMap.get(id);
      while (current) {
        result.add(String(current.id));
        current = current.parentId ? regionMap.get(String(current.parentId)) : undefined;
      }
    });

    return result;
  }

  private getMissingEnterpriseProfileFields(
    enterprise: EnterpriseEntity | null,
    basicInfo: EnterpriseBasicInfoEntity | null,
    contactCount: number,
  ): string[] {
    const requiredFields: Array<[string, unknown]> = [
      ['企业名称', basicInfo?.name ?? enterprise?.name],
      ['统一社会信用代码', basicInfo?.creditCode ?? enterprise?.creditCode],
      ['所属省份', basicInfo?.province ?? enterprise?.province],
      ['所属城市', basicInfo?.city ?? enterprise?.city],
      ['所属区县', basicInfo?.district ?? enterprise?.district],
      ['所属行业', basicInfo?.industry ?? enterprise?.industry],
      ['法定代表人', basicInfo?.legalPersonName ?? enterprise?.legalPerson],
      ['注册地址', basicInfo?.regLocation ?? enterprise?.address],
      ['企业联系人', contactCount > 0 ? 'ready' : null],
    ];

    return requiredFields
      .filter(([, value]) => value === undefined || value === null || value === '')
      .map(([label]) => label);
  }

  private toClientPolicyFileItem(
    row: RegionPolicyFileEntity,
    request?: Request,
  ): ClientPolicyFileItem {
    return {
      applicationLevel: row.applicationLevel,
      conditionText: row.conditionText,
      content: row.content,
      createTime: formatDateTimeInBjt(row.createdAt),
      endDate: this.formatDate(row.endDate),
      fileName: row.fileName,
      fileUrl: buildUploadPublicUrl(row.fileUrl, request),
      id: String(row.id),
      materialText: row.materialText,
      officialFileUrl: row.officialFileUrl,
      ownerName: row.ownerName,
      ownerUserId: row.ownerUserId,
      projectId: row.projectId,
      projectName: row.projectName,
      regionId: row.regionId,
      regionName: row.regionName,
      remark: row.remark,
      startDate: this.formatDate(row.startDate),
      status: row.status,
      subsidyAmountMax: row.subsidyAmountMax,
      subsidyAmountMin: row.subsidyAmountMin,
      subsidyText: row.subsidyText,
      targetObjects: row.targetObjects,
      templateFileId: row.templateFileId,
      templateFileName: row.templateFileName,
      title: row.title,
      updateTime: formatDateTimeInBjt(row.updatedAt),
    };
  }

  private toClientDeclarationItem(
    row: ClientDeclarationEntity,
  ): ClientDeclarationItem {
    const region = this.parseJsonObject(row.snapshotJson).declarationRegion as
      | { id?: unknown; name?: unknown }
      | undefined;
    const snapshot = this.parseJsonObject(row.snapshotJson);
    const scheme = snapshot.scheme as ResolvedDeclarationScheme | undefined;
    const completedNames = this.getCompletedFlowNodeNames(snapshot);
    const activeNodeNames = ['cancelled', 'completed', 'rejected', 'paused'].includes(row.status)
      ? []
      : scheme?.flowTemplate.nodes
        ?.filter((node) => this.isFlowNodeActive(node, new Date(), completedNames))
        .map((node) => node.name?.trim())
        .filter((name): name is string => Boolean(name)) ?? [];
    return {
      activeNodeNames,
      capabilities: this.normalizeDeclarationCapabilities(scheme?.capabilities),
      companyId: row.enterpriseId,
      currentNodeName: row.currentNodeName,
      deadline: this.formatDate(row.deadline),
      declarationNo: row.declarationNo,
      id: String(row.id),
      missingMaterialCount: row.missingMaterialCount,
      policyType: row.policyType,
      progress: row.progress,
      projectId: row.projectId,
      projectName: row.projectName,
      rejectedReason: row.rejectedReason,
      regionId: this.getDeclarationRegionId(row) ?? null,
      regionName: typeof region?.name === 'string' ? region.name : null,
      schemeId: row.schemeId ? String(row.schemeId) : null,
      schemeVersion: row.schemeVersion,
      status: row.status,
      submitTime: row.submitTime ? formatDateTimeInBjt(row.submitTime) : null,
      updateTime: formatDateTimeInBjt(row.updatedAt),
    };
  }

  private toExistingClientDeclarationSummary(
    row: ClientDeclarationEntity,
  ): ExistingClientDeclarationSummary {
    const item = this.toClientDeclarationItem(row);
    return {
      declarationNo: item.declarationNo,
      id: item.id,
      regionId: item.regionId,
      regionName: item.regionName,
      status: item.status,
      updateTime: item.updateTime,
    };
  }

  private async buildClientDeclarationFlow(
    row: ClientDeclarationEntity,
  ): Promise<ClientDeclarationFlow> {
    const detail = this.toClientDeclarationItem(row);
    const snapshot = this.parseJsonObject(row.snapshotJson);
    const snapshotMaterialCheck = this.normalizeDeclarationMaterialSnapshot(
      snapshot.materialCheck,
    );
    const latestMaterialCheck = snapshotMaterialCheck
      ? {
          check: snapshotMaterialCheck,
          source: 'declaration_snapshot' as const,
        }
      : await this.loadLatestDeclarationMaterialSnapshot(row);
    const materialSnapshot = latestMaterialCheck
      ? this.toClientDeclarationMaterialSnapshot(
          latestMaterialCheck.check,
          latestMaterialCheck.source,
        )
      : {
          checkedAt: null,
          checkId: null,
          items: [],
          readinessScore: 0,
          source: 'latest_check' as const,
        };
    const replenishment = row.rejectedReason
      ? {
          reason: row.rejectedReason,
          requestedAt: formatDateTimeInBjt(row.updatedAt),
          status: row.status === 'rejected' ? 'pending' as const : 'resolved' as const,
        }
      : null;
    const submitRecord = row.submitTime
      ? {
          declarationNo: row.declarationNo,
          nodeName: row.currentNodeName ?? '已提交',
          submitTime: formatDateTimeInBjt(row.submitTime),
        }
      : null;

    const auditNodes = await this.buildClientDeclarationFlowNodes(
      row,
      detail.updateTime,
      detail.activeNodeNames,
    );
    const events = this.buildClientDeclarationFlowEvents({
      detail,
      materialSnapshot,
      replenishment,
      submitRecord,
    });

    return {
      auditNodes,
      events,
      materialSnapshot,
      replenishment,
      submitRecord,
    };
  }

  private async buildClientDeclarationFlowNodes(
    row: ClientDeclarationEntity,
    updateTime: string,
    activeNodeNames: string[],
  ): Promise<ClientDeclarationFlowNode[]> {
    const scheme = this.parseJsonObject(row.snapshotJson).scheme as
      | ResolvedDeclarationScheme
      | undefined;
    const configuredNodes = scheme?.flowTemplate?.nodes?.filter(
      (item) => item.name?.trim(),
    );
    if (configuredNodes?.length) {
      const snapshot = this.parseJsonObject(row.snapshotJson);
      const completedNames = this.getCompletedFlowNodeNames(snapshot);
      const activeNodeNameSet = new Set(activeNodeNames);
      const qualificationByNodeName = await this.resolveFlowNodeQualifications(
        row.enterpriseId,
        configuredNodes,
      );
      return configuredNodes.map((item, index) => {
        const name = item.name?.trim() ?? '';
        const completed = completedNames.includes(name);
        const waiting = !completed && this.isFlowNodeWaiting(item, new Date());
        const active = !completed && activeNodeNameSet.has(name);
        const nodeStatus =
          row.status === 'rejected' && item.name === row.currentNodeName
            ? 'rejected'
            : completed
              ? 'completed'
              : waiting ? 'waiting' : active ? 'current' : 'pending';
        return {
          description: this.describeFlowNode(item),
          nodeName: item.name?.trim() ?? item.code ?? '未命名节点',
          order: index + 1,
          qualification: qualificationByNodeName.get(name) ?? {
            missing: [],
            presetNames: [],
            status: 'eligible',
          },
          status: nodeStatus,
          time: ['completed', 'current'].includes(nodeStatus) ? updateTime : null,
          timeNodeDescription: this.describeFlowNodeTimeRule(item.timeRule),
          timeRuleDescription: this.describeFlowNodeTimeRule(item.timeRule),
        };
      });
    }

    const status = row.status;
    const isRejected = status === 'rejected';
    const currentNodeName = row.currentNodeName;
    const nodeTemplates = [
      {
        description: '企业创建申报草稿并准备材料。',
        nodeName: '草稿',
      },
      {
        description: '材料与申报书补充说明准备中。',
        nodeName: '材料准备',
      },
      {
        description: '企业已提交申报，等待项目老师审核。',
        nodeName: '提交审核',
      },
      {
        description: '项目老师审核材料完整性和申报内容。',
        nodeName: currentNodeName || '人工审核',
      },
      {
        description: '审核通过后进入结果归档。',
        nodeName: '结果归档',
      },
    ];
    const statusStepMap: Record<string, number> = {
      approved: 4,
      cancelled: 1,
      completed: 5,
      draft: 1,
      preparing: 2,
      rejected: 4,
      reviewing: 4,
      submitted: 3,
    };
    const currentStep = statusStepMap[status] ?? 1;

    return nodeTemplates.map((item, index) => {
      const order = index + 1;
      const nodeStatus =
        isRejected && order === 4
          ? 'rejected'
          : order < currentStep
            ? 'completed'
            : order === currentStep
              ? 'current'
              : 'pending';
      return {
        description: item.description,
        nodeName: item.nodeName,
        order,
        qualification: {
          missing: [],
          presetNames: [],
          status: 'eligible',
        },
        status: nodeStatus,
        time:
          nodeStatus === 'completed' || nodeStatus === 'current' || nodeStatus === 'rejected'
            ? updateTime
            : null,
        timeNodeDescription: '时间节点：未设置',
        timeRuleDescription: '办理时间：全年可办理',
      };
    });
  }

  private buildClientDeclarationFlowEvents(input: {
    detail: ClientDeclarationItem;
    materialSnapshot: ClientDeclarationFlow['materialSnapshot'];
    replenishment: ClientDeclarationReplenishment | null;
    submitRecord: ClientDeclarationFlow['submitRecord'];
  }): ClientDeclarationFlowEvent[] {
    const events: ClientDeclarationFlowEvent[] = [];

    if (input.submitRecord) {
      events.push({
        description: `申报编号 ${input.submitRecord.declarationNo} 已提交到 ${input.submitRecord.nodeName}。`,
        nodeName: input.submitRecord.nodeName,
        occurredAt: input.submitRecord.submitTime,
        status: 'completed',
        title: '提交记录',
        type: 'submit',
      });
    }

    if (input.materialSnapshot.checkedAt) {
      events.push({
        description: `材料快照包含 ${input.materialSnapshot.items.length} 个材料项，准备度 ${input.materialSnapshot.readinessScore}%。`,
        nodeName: '材料快照',
        occurredAt: input.materialSnapshot.checkedAt,
        status: 'completed',
        title: '材料快照生成',
        type: 'material_snapshot',
      });
    }

    if (input.replenishment) {
      events.push({
        description: input.replenishment.reason,
        nodeName: '退回补件',
        occurredAt: input.replenishment.requestedAt,
        status: input.replenishment.status === 'pending' ? 'rejected' : 'completed',
        title: '退回补件原因',
        type: 'replenishment',
      });
    }

    events.push({
      description: input.detail.currentNodeName || '申报流程待推进。',
      nodeName: input.detail.currentNodeName || '当前节点',
      occurredAt: input.detail.updateTime,
      status: input.detail.status === 'rejected' ? 'rejected' : 'current',
      title: '当前审核节点',
      type: 'audit',
    });

    return events.sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
  }

  private async loadLatestDeclarationMaterialSnapshot(
    row: ClientDeclarationEntity,
  ): Promise<null | {
    check: ClientProjectMaterialReadiness;
    source: 'latest_check';
  }> {
    const latestCheck = await this.declarationMaterialCheckRepo.findOne({
      order: {
        checkedAt: 'DESC',
        id: 'DESC',
      },
      where: {
        declarationId: String(row.id),
        enterpriseId: row.enterpriseId,
      },
    });
    const parsedLatestCheck = this.parseMaterialCheckSummary(
      latestCheck?.summaryJson ?? null,
    );

    if (parsedLatestCheck) {
      return {
        check: parsedLatestCheck,
        source: 'latest_check',
      };
    }

    return null;
  }

  private normalizeDeclarationMaterialSnapshot(
    value: unknown,
  ): ClientProjectMaterialReadiness | null {
    if (!value || typeof value !== 'object' || !Array.isArray((value as any).items)) {
      return null;
    }

    return value as ClientProjectMaterialReadiness;
  }

  private toClientDeclarationMaterialSnapshot(
    check: ClientProjectMaterialReadiness,
    source: ClientDeclarationFlow['materialSnapshot']['source'],
  ): ClientDeclarationFlow['materialSnapshot'] {
    return {
      checkedAt: check.checkedAt,
      checkId: check.checkId,
      items: check.items.map((item) => {
        const moduleMeta = this.getProfileModuleLabel(item.moduleKey, item.tabKey);
        return {
          attachmentMissing: item.attachmentMissing,
          checkStatus: item.checkStatus,
          itemName: item.itemName,
          matchedCount: item.matchedCount,
          matchedRecordIds: item.matchedRecordIds,
          missingFields: item.missingFields,
          moduleKey: item.moduleKey,
          moduleName: moduleMeta.moduleName,
          relationSummary: item.relationSummary ?? {},
          requiredCount: item.requiredCount,
          suggestion: item.suggestion,
          tabKey: item.tabKey,
          tabName: moduleMeta.itemName,
        };
      }),
      readinessScore: check.readinessScore,
      source,
    };
  }

  private getProfileModuleLabel(
    moduleKey: string,
    tabKey: string,
  ): { itemName: string; moduleName: string } {
    const matched = this.getProfileStatItemConfigs().find(
      (item) => item.moduleKey === moduleKey && item.tabKey === tabKey,
    );

    return {
      itemName: matched?.itemName ?? tabKey,
      moduleName: matched?.moduleName ?? moduleKey,
    };
  }

  private normalizeDate(value?: null | string): Date | null {
    const normalized = this.toNullableString(value);
    if (!normalized) {
      return null;
    }

    return new Date(`${normalized.slice(0, 10)}T00:00:00+08:00`);
  }

  private formatDate(value: Date | null | string): null | string {
    if (!value) {
      return null;
    }

    return formatDateTimeInBjt(value).slice(0, 10);
  }

  private async requireUser(userId: number): Promise<UserEntity> {
    const user = await this.userRepository.findById(String(userId));
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  private async getOrCreateClientUserProfile(
    userId: number,
  ): Promise<ClientUserProfileEntity> {
    const existing = await this.clientUserProfileRepo.findOne({
      where: {
        userId: String(userId),
      },
    });
    if (existing) {
      return existing;
    }

    const profile = this.clientUserProfileRepo.create({
      currentEnterpriseId: null,
      position: null,
      remark: null,
      roleName: null,
      userId: String(userId),
    });

    try {
      return await this.clientUserProfileRepo.save(profile);
    } catch (error) {
      // The client shell loads several profile endpoints together after login.
      // Another request may win the unique insert between our read and save.
      const databaseError = error as {
        code?: unknown;
        driverError?: { code?: unknown };
      };
      const isDuplicateEntry =
        databaseError.code === 'ER_DUP_ENTRY' ||
        databaseError.driverError?.code === 'ER_DUP_ENTRY';
      if (!isDuplicateEntry) {
        throw error;
      }

      const committedProfile = await this.clientUserProfileRepo.findOne({
        where: {
          userId: String(userId),
        },
      });
      if (committedProfile) {
        return committedProfile;
      }

      throw error;
    }
  }

  private async resolveCompanyContext(userId: number): Promise<{
    companies: AccessibleCompany[];
    currentEnterpriseId: null | string;
    profile: ClientUserProfileEntity;
  }> {
    const [companies, profile] = await Promise.all([
      this.listAccessibleCompanies(userId),
      this.getOrCreateClientUserProfile(userId),
    ]);

    if (!companies.length) {
      return {
        companies,
        currentEnterpriseId: null,
        profile,
      };
    }

    const candidateCurrentEnterpriseId = profile.currentEnterpriseId
      ? String(profile.currentEnterpriseId)
      : null;
    const matchedCurrentCompany = candidateCurrentEnterpriseId
      ? companies.find(
          (item) => String(item.enterprise.id) === candidateCurrentEnterpriseId,
        )
      : null;

    const nextCurrentEnterpriseId =
      matchedCurrentCompany?.enterprise.id ??
      companies.find((item) => item.bindingDefault)?.enterprise.id ??
      companies[0]?.enterprise.id ??
      null;

    if (
      nextCurrentEnterpriseId &&
      String(profile.currentEnterpriseId ?? '') !==
        String(nextCurrentEnterpriseId)
    ) {
      profile.currentEnterpriseId = String(nextCurrentEnterpriseId);
      await this.clientUserProfileRepo.save(profile);
    }

    return {
      companies,
      currentEnterpriseId: nextCurrentEnterpriseId
        ? String(nextCurrentEnterpriseId)
        : null,
      profile,
    };
  }

  private async listAccessibleCompanies(
    userId: number,
  ): Promise<AccessibleCompany[]> {
    if (this.iamCompanyScope.isEnabled()) {
      return this.listIamAccessibleCompanies(userId);
    }
    const [ownerBindings, teacherBindings, userBindings] = await Promise.all([
      this.enterpriseOwnerRepo.find({
        order: {
          id: 'ASC',
        },
        relations: {
          enterprise: true,
        },
        where: {
          status: 1,
          userId: String(userId),
        },
      }),
      this.enterpriseTeacherRepo.find({
        order: {
          id: 'ASC',
        },
        relations: {
          enterprise: true,
        },
        where: {
          status: 1,
          teacherUserId: String(userId),
        },
      }),
      this.enterpriseUserRepo.find({
        order: {
          id: 'ASC',
          isDefault: 'DESC',
        },
        relations: {
          enterprise: true,
        },
        where: {
          status: 1,
          userId: String(userId),
        },
      }),
    ]);

    const companyMap = new Map<string, AccessibleCompany>();

    ownerBindings.forEach((binding) => {
      if (!binding.enterprise || binding.enterprise.status !== 1) {
        return;
      }

      companyMap.set(String(binding.enterpriseId), {
        bindingDefault: true,
        enterprise: binding.enterprise,
        roleName: '企业负责人',
      });
    });

    teacherBindings.forEach((binding) => {
      if (!binding.enterprise || binding.enterprise.status !== 1) {
        return;
      }

      const key = String(binding.enterpriseId);
      const existing = companyMap.get(key);
      if (existing) {
        return;
      }

      companyMap.set(key, {
        bindingDefault: false,
        enterprise: binding.enterprise,
        roleName: '\u9879\u76ee\u8001\u5e08',
      });
    });

    userBindings.forEach((binding) => {
      if (!binding.enterprise || binding.enterprise.status !== 1) {
        return;
      }

      const key = String(binding.enterpriseId);
      const existing = companyMap.get(key);
      if (existing) {
        existing.bindingDefault =
          existing.bindingDefault || binding.isDefault === 1;
        return;
      }

      companyMap.set(key, {
        bindingDefault: binding.isDefault === 1,
        enterprise: binding.enterprise,
        roleName: '企业用户',
      });
    });

    return [...companyMap.values()].sort((left, right) => {
      if (left.bindingDefault !== right.bindingDefault) {
        return left.bindingDefault ? -1 : 1;
      }
      return Number(left.enterprise.id) - Number(right.enterprise.id);
    });
  }

  private toClientCompany(
    item: AccessibleCompany,
    currentEnterpriseId: null | string,
  ): ClientCompanyItem {
    const isCurrent = String(item.enterprise.id) === String(currentEnterpriseId);
    return {
      salesOwner: item.enterprise.salesOwner ?? '',
      preDeclarationYear: item.enterprise.preDeclarationYear ?? null,
      enterpriseProjects: item.enterprise.enterpriseProjects ?? [],
      creditCode: item.enterprise.creditCode,
      id: String(item.enterprise.id),
      industry: item.enterprise.industry,
      isCurrent,
      isDefault: item.bindingDefault || isCurrent,
      name: item.enterprise.name,
      profileStatus: item.enterprise.profileStatus,
      roleName: item.roleName,
      shortName: item.enterprise.shortName,
      status: item.enterprise.status as 0 | 1,
    };
  }

  private toClientMe(
    user: UserEntity,
    profile: ClientUserProfileEntity,
  ): Record<string, unknown> {
    return {
      email: user.email,
      id: String(user.id),
      mobile: user.phone,
      name: user.realName,
      phone: user.phone,
      position: profile.position,
      realName: user.realName,
      roleInCompany: profile.roleName,
      username: user.username,
    };
  }

  private toClientEnterpriseContact(entity: EnterpriseContactEntity) {
    return {
      email: entity.email,
      id: String(entity.id),
      isDefault: entity.isDefault === 1,
      name: entity.name,
      phone: entity.phone,
      position: entity.position,
      remark: entity.remark,
      roleName: entity.roleName,
    };
  }

  private toClientMaterialRecord(
    entity: EnterpriseMaterialEntity,
    request?: Request,
  ) {
    let importSummary: null | Record<string, unknown> = null;
    if (entity.remark) {
      try {
        const parsed = JSON.parse(entity.remark) as Record<string, unknown>;
        importSummary = parsed && typeof parsed === 'object' ? parsed : null;
      } catch {
        importSummary = null;
      }
    }

    return {
      errorCount: entity.errorCount,
      fileName: entity.fileName,
      filePath: entity.filePath,
      id: String(entity.id),
      importSummary,
      materialType: entity.materialType,
      remark: entity.remark,
      status: entity.status,
      templateId: entity.templateId,
      templateName: entity.templateName,
      uploadTime: formatDateTimeInBjt(entity.createdAt),
      url: buildUploadPublicUrl(entity.filePath, request),
    };
  }

  private async listIamAccessibleCompanies(
    userId: number,
  ): Promise<AccessibleCompany[]> {
    const scopes = this.iamCompanyScope.getPrimedCompanyScopes(userId);
    const hasAllScope = scopes.some((scope) => scope.dataScope === 'all');
    const sourceIds = [...new Set(scopes.map((scope) => scope.sourceCompanyId))];
    if (!hasAllScope && sourceIds.length === 0) return [];

    const enterprises = await this.enterpriseRepo.find({
      order: { id: 'ASC' },
      where: hasAllScope ? { status: 1 } : { id: In(sourceIds), status: 1 },
    });
    const scopeByEnterpriseId = new Map(
      scopes.map((scope) => [scope.sourceCompanyId, scope]),
    );

    return enterprises.map((enterprise) => {
      const scope = scopeByEnterpriseId.get(String(enterprise.id));
      return {
        bindingDefault: Boolean(scope?.isDefault),
        enterprise,
        roleName: this.toCompanyRoleName(scope?.relationType),
      };
    });
  }

  private toCompanyRoleName(relationType?: string): string {
    if (relationType === 'owner') return '企业负责人';
    if (relationType === 'project_teacher') return '项目老师';
    return relationType === 'all' ? '全量数据管理员' : '企业用户';
  }

  private resolveUploadPreviewContentType(filename: string): string {
    const extension = extname(filename).toLowerCase();
    const types: Record<string, string> = {
      '.gif': 'image/gif',
      '.jpeg': 'image/jpeg',
      '.jpg': 'image/jpeg',
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.txt': 'text/plain; charset=utf-8',
      '.webp': 'image/webp',
    };
    return types[extension] ?? 'application/octet-stream';
  }

  private buildClientProtectedAccessUrl(
    accessPath: string,
    request?: Request,
  ): string {
    if (!request) {
      return accessPath;
    }

    const forwardedProtocol = request.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const forwardedHost = request.get('x-forwarded-host')?.split(',')[0]?.trim();
    const protocol = forwardedProtocol || request.protocol;
    const host = forwardedHost || request.get('host') || '';
    return host ? `${protocol}://${host}${accessPath}` : accessPath;
  }

  private emptyEnterpriseProfileStats() {
    return {
      attachmentRecords: 0,
      calculatedAt: null,
      completedModules: 0,
      completenessRate: 0,
      enterpriseId: null,
      healthScore: 0,
      highTechReadiness: this.buildHighTechProfileReadiness([]),
      items: [],
      missingModules: [],
      totalModules: 0,
      totalRecords: 0,
    };
  }

  private async calculateProfileStatItem(
    enterpriseId: string,
    config: ProfileStatItemConfig,
  ): Promise<ProfileStatItemPayload> {
    const where: Record<string, unknown> = { enterpriseId };
    if (config.moduleKey !== 'basic') {
      where.status = 1;
    }
    if (config.recordType) {
      where.recordType = config.recordType;
    }

    const rows = await config.repository.find({ where });
    const recordCount = rows.length;
    const attachmentCount = rows.filter((row: Record<string, unknown>) =>
      (config.attachmentFields ?? []).some((field) =>
        this.isProfileStatValueFilled(row[field]),
      ),
    ).length;
    const missingFields = this.getProfileStatMissingFields(rows, config);
    const isCompleted =
      recordCount >= config.requiredMinCount && missingFields.length === 0;
    const recordScore =
      config.requiredMinCount > 0
        ? Math.min(recordCount / config.requiredMinCount, 1) * 70
        : 70;
    const attachmentScore =
      recordCount === 0
        ? 0
        : (config.attachmentFields?.length ?? 0) > 0
          ? attachmentCount > 0
            ? 30
            : 0
          : 30;
    const score = this.roundStatNumber(recordScore + attachmentScore);
    const summary = isCompleted
      ? `${config.itemName}已完善`
      : `${config.itemName}待完善`;

    return {
      attachmentCount,
      isCompleted,
      itemName: config.itemName,
      missingFields,
      moduleKey: config.moduleKey,
      moduleName: config.moduleName,
      recordCount,
      requiredMinCount: config.requiredMinCount,
      score,
      summary,
      tabKey: config.tabKey,
    };
  }

  private getProfileStatMissingFields(
    rows: Array<Record<string, unknown>>,
    config: ProfileStatItemConfig,
  ) {
    const missingFields: string[] = [];
    if (rows.length < config.requiredMinCount) {
      missingFields.push('record_count');
    }

    (config.requiredFields ?? []).forEach((field) => {
      const hasValue = rows.some((row) => this.isProfileStatValueFilled(row[field]));
      if (!hasValue) {
        missingFields.push(field);
      }
    });

    if (
      rows.length > 0 &&
      (config.attachmentFields?.length ?? 0) > 0 &&
      !rows.some((row) =>
        (config.attachmentFields ?? []).some((field) =>
          this.isProfileStatValueFilled(row[field]),
        ),
      )
    ) {
      missingFields.push('attachment');
    }

    return missingFields;
  }

  private isProfileStatValueFilled(value: unknown) {
    return value !== undefined && value !== null && String(value).trim() !== '';
  }

  private roundStatNumber(value: number) {
    return Math.round(value * 100) / 100;
  }

  private toEnterpriseProfileStatsPayload(
    stat: EnterpriseProfileStatEntity,
    items: EnterpriseProfileStatItemEntity[],
  ) {
    return {
      attachmentRecords: stat.attachmentRecords,
      calculatedAt: stat.calculatedAt.toISOString(),
      completedModules: stat.completedModules,
      completenessRate: Number(stat.completenessRate),
      enterpriseId: stat.enterpriseId,
      healthScore: Number(stat.healthScore),
      highTechReadiness: this.buildHighTechProfileReadiness(
        items.map((item) => ({
          attachmentCount: item.attachmentCount,
          isCompleted: item.isCompleted === 1,
          itemName: item.itemName,
          missingFields: this.parseProfileStatJsonArray(item.missingFields),
          moduleKey: item.moduleKey as EnterpriseProfileModuleKey,
          moduleName: item.moduleName,
          recordCount: item.recordCount,
          requiredMinCount: item.requiredMinCount,
          score: Number(item.score),
          summary: item.summary ?? '',
          tabKey: item.tabKey,
        })),
      ),
      items: items.map((item) => ({
        attachmentCount: item.attachmentCount,
        isCompleted: item.isCompleted === 1,
        itemName: item.itemName,
        missingFields: this.parseProfileStatJsonArray(item.missingFields),
        moduleKey: item.moduleKey,
        moduleName: item.moduleName,
        recordCount: item.recordCount,
        requiredMinCount: item.requiredMinCount,
        score: Number(item.score),
        summary: item.summary,
        tabKey: item.tabKey,
      })),
      missingModules: this.parseProfileStatJsonArray(stat.missingModules),
      totalModules: stat.totalModules,
      totalRecords: stat.totalRecords,
    };
  }

  private buildHighTechProfileReadiness(
    items: ProfileStatItemPayload[],
  ): HighTechProfileReadiness {
    const criticalKeys = new Set([
      'finance/financial',
      'finance/taxAudit',
      'employee/employees',
      'property/intellectualProperty',
      'property/researchProject',
      'property/productService',
      'property/transformation',
      'contract/contracts',
      'contract/invoices',
      'document/documents',
    ]);
    const criticalItems = items.filter((item) =>
      criticalKeys.has(`${item.moduleKey}/${item.tabKey}`),
    );
    const gaps = criticalItems
      .filter((item) => !item.isCompleted)
      .map((item) => ({
        actionText: '去企业资料补齐',
        blocking: item.recordCount === 0 || item.missingFields.includes('attachment'),
        description:
          item.recordCount === 0
            ? `${item.itemName}暂无资料，建议优先补齐。`
            : `${item.itemName}还有 ${item.missingFields.length} 个字段或附件缺口。`,
        itemName: item.itemName,
        moduleKey: item.moduleKey,
        tabKey: item.tabKey,
      }));
    const totalItems = criticalItems.length;
    const readyItems = criticalItems.filter((item) => item.isCompleted).length;
    const readinessRate = this.roundStatNumber(
      totalItems > 0 ? (readyItems / totalItems) * 100 : 0,
    );
    const status =
      gaps.some((item) => item.blocking) || readinessRate < 60
        ? 'high_risk'
        : gaps.length > 0
          ? 'needs_completion'
          : 'ready';

    return {
      gaps,
      readinessRate,
      readyItems,
      status,
      summary:
        status === 'ready'
          ? '高企申报关键资料已基本齐备。'
          : `高企申报关键资料还有 ${gaps.length} 个缺口，建议在企业资料中补齐。`,
      totalItems,
    };
  }

  private parseProfileStatJsonArray(value: null | string) {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private getProfileStatItemConfigs(): ProfileStatItemConfig[] {
    return [
      {
        itemName: '基本信息',
        moduleKey: 'basic',
        moduleName: '基本信息',
        repository: this.enterpriseBasicInfoRepo,
        requiredFields: ['name', 'creditCode', 'legalPersonName', 'industry'],
        requiredMinCount: 1,
        tabKey: 'info',
      },
      {
        itemName: '财务数据',
        moduleKey: 'finance',
        moduleName: '财税资料',
        recordType: 'financial',
        repository: this.enterpriseFinanceRecordRepo,
        requiredFields: ['year'],
        requiredMinCount: 1,
        tabKey: 'financial',
      },
      {
        attachmentFields: ['filePath'],
        itemName: '纳税审计',
        moduleKey: 'finance',
        moduleName: '财税资料',
        recordType: 'tax_audit',
        repository: this.enterpriseFinanceRecordRepo,
        requiredFields: ['year'],
        requiredMinCount: 1,
        tabKey: 'taxAudit',
      },
      {
        attachmentFields: ['ygFiles'],
        itemName: '员工资料',
        moduleKey: 'employee',
        moduleName: '员工资料',
        repository: this.enterpriseEmployeeRecordRepo,
        requiredFields: ['ygName'],
        requiredMinCount: 1,
        tabKey: 'employees',
      },
      {
        attachmentFields: ['softWorkFile'],
        itemName: '知识产权',
        moduleKey: 'property',
        moduleName: '研发与知识产权',
        recordType: 'intellectual_property',
        repository: this.enterprisePropertyRecordRepo,
        requiredFields: ['softWorkName'],
        requiredMinCount: 1,
        tabKey: 'intellectualProperty',
      },
      {
        attachmentFields: ['lxbgFile'],
        itemName: '研发项目',
        moduleKey: 'property',
        moduleName: '研发与知识产权',
        recordType: 'research_project',
        repository: this.enterprisePropertyRecordRepo,
        requiredFields: ['kyProjectName'],
        requiredMinCount: 1,
        tabKey: 'researchProject',
      },
      {
        attachmentFields: ['proofFiles'],
        itemName: '高新产品/服务',
        moduleKey: 'property',
        moduleName: '研发与知识产权',
        recordType: 'product_service',
        repository: this.enterprisePropertyRecordRepo,
        requiredFields: ['psName'],
        requiredMinCount: 1,
        tabKey: 'productService',
      },
      {
        attachmentFields: ['proofFiles'],
        itemName: '成果转化',
        moduleKey: 'property',
        moduleName: '研发与知识产权',
        recordType: 'transformation',
        repository: this.enterprisePropertyRecordRepo,
        requiredFields: ['transformationName'],
        requiredMinCount: 1,
        tabKey: 'transformation',
      },
      {
        attachmentFields: ['htPath'],
        itemName: '合同',
        moduleKey: 'contract',
        moduleName: '合同发票',
        recordType: 'contract',
        repository: this.enterpriseContractRecordRepo,
        requiredFields: ['htName'],
        requiredMinCount: 1,
        tabKey: 'contracts',
      },
      {
        itemName: '发票',
        moduleKey: 'contract',
        moduleName: '合同发票',
        recordType: 'invoice',
        repository: this.enterpriseContractRecordRepo,
        requiredFields: ['fpNum'],
        requiredMinCount: 1,
        tabKey: 'invoices',
      },
      {
        attachmentFields: ['filePath'],
        itemName: '制度文件',
        moduleKey: 'document',
        moduleName: '制度文件',
        repository: this.enterpriseDocumentRecordRepo,
        requiredFields: ['fileTitle'],
        requiredMinCount: 1,
        tabKey: 'documents',
      },
      {
        attachmentFields: ['zsPath'],
        itemName: '企业证书',
        moduleKey: 'certificate',
        moduleName: '企业证书',
        repository: this.enterpriseCertificateRecordRepo,
        requiredFields: ['zsName'],
        requiredMinCount: 1,
        tabKey: 'certificates',
      },
      {
        attachmentFields: ['photoFiles'],
        itemName: '企业照片',
        moduleKey: 'photo',
        moduleName: '照片',
        repository: this.enterprisePhotoRecordRepo,
        requiredFields: ['photoTitle'],
        requiredMinCount: 1,
        tabKey: 'photos',
      },
      {
        itemName: '企业账号',
        moduleKey: 'account',
        moduleName: '企业账号',
        repository: this.enterpriseAccountRecordRepo,
        requiredFields: ['ptName', 'zhNumber'],
        requiredMinCount: 1,
        tabKey: 'accounts',
      },
    ];
  }

  private getProfileRecordConfig(
    moduleKey: string,
    tabKey: string,
  ): ProfileRecordConfig {
    const key = `${moduleKey}/${tabKey}`;
    const configMap: Record<string, ProfileRecordConfig> = {
      'account/accounts': {
        fields: {
          b_email: 'bEmail',
          b_phone: 'bPhone',
          charge: 'charge',
          end_date: 'endDate',
          gsbm: 'gsbm',
          pt_name: 'ptName',
          pt_url: 'ptUrl',
          remark: 'remark',
          zh_number: 'zhNumber',
          zh_password: 'zhPassword',
          zh_status: 'zhStatus',
          zh_type: 'zhType',
        },
        repository: this.enterpriseAccountRecordRepo,
      },
      'contract/contracts': {
        fields: {
          end_date: 'endDate',
          ht_des: 'htDes',
          ht_money: 'htMoney',
          ht_name: 'htName',
          ht_num: 'htNum',
          ht_path: 'htPath',
          ht_status: 'htStatus',
          kh_name: 'khName',
          qd_date: 'qdDate',
          start_date: 'startDate',
        },
        recordType: 'contract',
        repository: this.enterpriseContractRecordRepo,
      },
      'contract/invoices': {
        fields: {
          fp_date: 'fpDate',
          fp_money: 'fpMoney',
          fp_num: 'fpNum',
          fp_status: 'fpStatus',
          ht_id: 'htId',
          remark: 'remark',
          zf_date: 'zfDate',
        },
        recordType: 'invoice',
        repository: this.enterpriseContractRecordRepo,
      },
      'document/documents': {
        fields: {
          file_class: 'fileClass',
          file_path: 'filePath',
          file_remark: 'fileRemark',
          file_start_date: 'fileStartDate',
          file_status: 'fileStatus',
          file_title: 'fileTitle',
          file_version: 'fileVersion',
        },
        repository: this.enterpriseDocumentRecordRepo,
      },
      'employee/employees': {
        fields: {
          annual_work_days: 'annualWorkDays',
          department: 'department',
          education_file: 'educationFile',
          entry_date: 'entryDate',
          id_card: 'idCard',
          is_active: 'isActive',
          is_kjyf: 'isKjyf',
          labor_contract_file: 'laborContractFile',
          position: 'position',
          remark: 'remark',
          rd_projects: 'rdProjects',
          social_security_file: 'socialSecurityFile',
          title_file: 'titleFile',
          yg_files: 'ygFiles',
          yg_lx: 'ygLx',
          yg_lxgg: 'ygLxgg',
          yg_name: 'ygName',
          yg_nl: 'ygNl',
          yg_qr: 'ygQr',
          yg_sex: 'ygSex',
          yg_wj: 'ygWj',
          yg_xl: 'ygXl',
          yg_zc: 'ygZc',
        },
        repository: this.enterpriseEmployeeRecordRepo,
      },
      'finance/financial': {
        fields: {
          fz: 'fz',
          fzl: 'fzl',
          high_tech_income: 'highTechIncome',
          lr_total: 'lrTotal',
          main_business_income: 'mainBusinessIncome',
          net_assets: 'netAssets',
          net_profit: 'netProfit',
          q: 'q',
          rd_depreciation: 'rdDepreciation',
          rd_design_fee: 'rdDesignFee',
          rd_direct_input: 'rdDirectInput',
          rd_entrusted_development: 'rdEntrustedDevelopment',
          rd_equipment_debugging_fee: 'rdEquipmentDebuggingFee',
          rd_intangible_amortization: 'rdIntangibleAmortization',
          rd_other_expense: 'rdOtherExpense',
          rd_personnel_cost: 'rdPersonnelCost',
          remark: 'remark',
          total_revenue: 'totalRevenue',
          xxsr: 'xxsr',
          year: 'year',
          yffy: 'yffy',
          zxc: 'zxc',
        },
        recordType: 'financial',
        repository: this.enterpriseFinanceRecordRepo,
      },
      'finance/taxAudit': {
        fields: {
          file_class: 'fileClass',
          file_path: 'filePath',
          remark: 'remark',
          tax_category: 'taxCategory',
          year: 'year',
        },
        recordType: 'tax_audit',
        repository: this.enterpriseFinanceRecordRepo,
      },
      'media/certificates': {
        fields: {
          qualification_code: 'qualificationCode',
          valid_until: 'validUntil',
          zs_class: 'zsClass',
          zs_name: 'zsName',
          zs_path: 'zsPath',
        },
        repository: this.enterpriseCertificateRecordRepo,
      },
      'media/photos': {
        fields: {
          photo_des: 'photoDes',
          photo_files: 'photoFiles',
          photo_status: 'photoStatus',
          photo_title: 'photoTitle',
          ps_date: 'psDate',
        },
        repository: this.enterprisePhotoRecordRepo,
      },
      'property/intellectualProperty': {
        fields: {
          advanced_degree: 'advancedDegree',
          apply_date: 'applyDate',
          authorize_date: 'authorizeDate',
          inventor: 'inventor',
          ip_code: 'ipCode',
          ip_level: 'ipLevel',
          ip_tech_category: 'ipTechCategory',
          is_core_ip: 'isCoreIp',
          obtain_method: 'obtainMethod',
          related_ps_ids: 'relatedPsIds',
          related_rd_ids: 'relatedRdIds',
          related_transformation_ids: 'relatedTransformationIds',
          remark: 'remark',
          right_holder: 'rightHolder',
          soft_work_file: 'softWorkFile',
          soft_work_name: 'softWorkName',
          soft_work_num: 'softWorkNum',
          soft_work_status: 'softWorkStatus',
          soft_work_type: 'softWorkType',
          support_effect: 'supportEffect',
        },
        recordType: 'intellectual_property',
        repository: this.enterprisePropertyRecordRepo,
      },
      'property/researchProject': {
        fields: {
          core_technology: 'coreTechnology',
          end_date: 'endDate',
          fund_amount: 'fundAmount',
          fund_source: 'fundSource',
          innovation_points: 'innovationPoints',
          init_date: 'initDate',
          ky_project_des: 'kyProjectDes',
          ky_project_leader: 'kyProjectLeader',
          ky_project_name: 'kyProjectName',
          ky_project_num: 'kyProjectNum',
          ky_project_status: 'kyProjectStatus',
          lxbg_file: 'lxbgFile',
          project_type: 'projectType',
          rd_budget: 'rdBudget',
          rd_expense_total: 'rdExpenseTotal',
          rd_organization_method: 'rdOrganizationMethod',
          related_ip_ids: 'relatedIpIds',
          related_ps_ids: 'relatedPsIds',
          related_transformation_ids: 'relatedTransformationIds',
          stage_result: 'stageResult',
        },
        recordType: 'research_project',
        repository: this.enterprisePropertyRecordRepo,
      },
      'property/productService': {
        fields: {
          competitive_advantage: 'competitiveAdvantage',
          high_tech_income: 'highTechIncome',
          last_year_income: 'lastYearIncome',
          proof_files: 'proofFiles',
          ps_code: 'psCode',
          ps_name: 'psName',
          related_contract_ids: 'relatedContractIds',
          related_invoice_ids: 'relatedInvoiceIds',
          related_ip_ids: 'relatedIpIds',
          related_rd_ids: 'relatedRdIds',
          related_transformation_ids: 'relatedTransformationIds',
          remark: 'remark',
          tech_description: 'techDescription',
          tech_field: 'techField',
          tech_index: 'techIndex',
          tech_source: 'techSource',
        },
        recordType: 'product_service',
        repository: this.enterprisePropertyRecordRepo,
      },
      'property/transformation': {
        fields: {
          application_scene: 'applicationScene',
          customer_name: 'customerName',
          proof_files: 'proofFiles',
          related_contract_ids: 'relatedContractIds',
          related_invoice_ids: 'relatedInvoiceIds',
          related_ip_ids: 'relatedIpIds',
          related_ps_ids: 'relatedPsIds',
          related_rd_ids: 'relatedRdIds',
          remark: 'remark',
          transformation_code: 'transformationCode',
          transformation_income: 'transformationIncome',
          transformation_method: 'transformationMethod',
          transformation_name: 'transformationName',
          transformation_year: 'transformationYear',
        },
        recordType: 'transformation',
        repository: this.enterprisePropertyRecordRepo,
      },
    };

    const config = configMap[key];
    if (!config) {
      throw new NotFoundException('企业资料模块不存在');
    }

    return config;
  }

  private async findProfileRecordOrFail(
    config: ProfileRecordConfig,
    enterpriseId: string,
    id: string,
  ) {
    const where: Record<string, unknown> = {
      enterpriseId,
      id,
      status: 1,
    };
    if (config.recordType) {
      where.recordType = config.recordType;
    }

    return await config.repository.findOne({ where });
  }

  private async assertClientInvoiceContractScope(
    enterpriseId: string,
    contractId: unknown,
  ): Promise<void> {
    const htId = this.toNullableStringFromUnknown(contractId);
    if (!htId) {
      return;
    }

    const contract = await this.enterpriseContractRecordRepo.findOne({
      where: { enterpriseId, id: htId, recordType: 'contract', status: 1 },
    });
    if (!contract) {
      throw new BadRequestException('关联合同不存在或不属于当前企业');
    }
  }

  private toProfileRecordEntityData(
    payload: Record<string, unknown>,
    config: ProfileRecordConfig,
  ) {
    const entityData: Record<string, unknown> = {};
    if (config.recordType) {
      entityData.recordType = config.recordType;
    }

    Object.entries(config.fields).forEach(([payloadField, entityField]) => {
      entityData[entityField] = this.normalizeProfileRecordValue(
        payload[payloadField],
        entityField,
      );
    });

    return entityData;
  }

  private normalizeClientCertificateQualification(entityData: Record<string, unknown>) {
    const qualificationCode = entityData.qualificationCode;
    if (!isEnterpriseCertificateType(qualificationCode)) {
      throw new BadRequestException('请选择固定证书类型');
    }
    const certificateName = this.toNullableStringFromUnknown(entityData.zsName);
    if (!certificateName) {
      throw new BadRequestException('其他证书请填写具体证书名称');
    }
    entityData.qualificationCode = qualificationCode;
    entityData.zsName = certificateName;
  }

  private toProfileRecordPayload(
    entity: Record<string, unknown>,
    config: ProfileRecordConfig,
  ) {
    const payload: Record<string, unknown> = {
      create_time:
        entity.createdAt instanceof Date ? entity.createdAt.toISOString() : undefined,
      id: String(entity.id),
    };

    Object.entries(config.fields).forEach(([payloadField, entityField]) => {
      payload[payloadField] = entity[entityField];
    });

    return payload;
  }

  private async enrichClientPropertyRelationLabels(
    enterpriseId: string,
    items: Record<string, unknown>[],
  ): Promise<void> {
    const rows = await this.enterprisePropertyRecordRepo.find({
      where: { enterpriseId, status: 1 },
    });
    const recordsByType = new Map<string, Map<string, string>>();
    const addRecords = (
      recordType: string,
      codeField: keyof EnterprisePropertyRecordEntity,
      nameField: keyof EnterprisePropertyRecordEntity,
    ) => {
      const records = new Map<string, string>();
      rows
        .filter((row) => row.recordType === recordType)
        .forEach((row) => {
          const code = this.toNullableStringFromUnknown(row[codeField]);
          const name = this.toNullableStringFromUnknown(row[nameField]);
          if (code || name) {
            records.set(
              String(row.id),
              this.formatClientPropertyRelationLabel(code, name),
            );
          }
        });
      recordsByType.set(recordType, records);
    };

    addRecords('intellectual_property', 'ipCode', 'softWorkName');
    addRecords('research_project', 'kyProjectNum', 'kyProjectName');
    addRecords('product_service', 'psCode', 'psName');
    addRecords('transformation', 'transformationCode', 'transformationName');

    const relationConfig: Array<{
      field: 'related_ip_ids' | 'related_ps_ids' | 'related_rd_ids' | 'related_transformation_ids';
      labelField: string;
      recordType: string;
    }> = [
      { field: 'related_ip_ids', labelField: 'related_ip_labels', recordType: 'intellectual_property' },
      { field: 'related_rd_ids', labelField: 'related_rd_labels', recordType: 'research_project' },
      { field: 'related_ps_ids', labelField: 'related_ps_labels', recordType: 'product_service' },
      {
        field: 'related_transformation_ids',
        labelField: 'related_transformation_labels',
        recordType: 'transformation',
      },
    ];
    items.forEach((item) => {
      relationConfig.forEach(({ field, labelField, recordType }) => {
        const ids = this.parseRelationIds(
          this.toNullableStringFromUnknown(item[field]),
        );
        if (ids.length === 0) {
          item[labelField] = null;
          return;
        }
        const labelMap = recordsByType.get(recordType) ?? new Map();
        const ipRows = rows.filter(
          (row) => row.recordType === 'intellectual_property',
        );
        const orderedIds = this.sortClientRelationIdsByRelatedIpCode(
          ids,
          recordType,
          rows,
          ipRows,
        );
        item[labelField] = orderedIds
          .map((id) => labelMap.get(id) ?? id)
          .filter(Boolean)
          .join(',');
      });
    });
  }

  private async enrichClientPropertyDraftRelationLabels(
    enterpriseId: string,
    items: ClientAiDraftItem[],
  ): Promise<void> {
    const rows = await this.enterprisePropertyRecordRepo.find({
      where: { enterpriseId, status: 1 },
    });
    const ipRows = rows.filter(
      (row) => row.recordType === 'intellectual_property',
    );
    const relationLabels = new Map<string, Map<string, string>>([
      [
        'intellectual_property',
        new Map(
          rows
            .filter((row) => row.recordType === 'intellectual_property')
            .map((row) => [
              String(row.id),
              this.formatClientPropertyRelationLabel(row.ipCode, row.softWorkName),
            ]),
        ),
      ],
      [
        'research_project',
        new Map(
          rows
            .filter((row) => row.recordType === 'research_project')
            .map((row) => [
              String(row.id),
              this.formatClientPropertyRelationLabel(
                row.kyProjectNum,
                row.kyProjectName,
              ),
            ]),
        ),
      ],
      [
        'product_service',
        new Map(
          rows
            .filter((row) => row.recordType === 'product_service')
            .map((row) => [
              String(row.id),
              this.formatClientPropertyRelationLabel(row.psCode, row.psName),
            ]),
        ),
      ],
      [
        'transformation',
        new Map(
          rows
            .filter((row) => row.recordType === 'transformation')
            .map((row) => [
              String(row.id),
              this.formatClientPropertyRelationLabel(
                row.transformationCode,
                row.transformationName,
              ),
            ]),
        ),
      ],
    ]);
    const relationConfig = [
      ['related_ip_ids', 'related_ip_labels', 'intellectual_property'],
      ['related_rd_ids', 'related_rd_labels', 'research_project'],
      ['related_ps_ids', 'related_ps_labels', 'product_service'],
      [
        'related_transformation_ids',
        'related_transformation_labels',
        'transformation',
      ],
    ] as const;

    items.forEach((item) => {
      relationConfig.forEach(([field, labelField, recordType]) => {
        const ids = this.parseRelationIds(
          this.toNullableStringFromUnknown(item.draftPayload[field]),
        );
        const orderedIds = this.sortClientRelationIdsByRelatedIpCode(
          ids,
          recordType,
          rows,
          ipRows,
        );
        item.draftPayload[labelField] = orderedIds
          .map((id) => relationLabels.get(recordType)?.get(id) ?? id)
          .join('、');
      });
    });
  }

  private formatClientPropertyRelationLabel(
    code: null | string,
    name: null | string,
  ): string {
    if (code && name) {
      return `${code} - ${name}`;
    }
    return code ?? name ?? '';
  }

  private getProfileRecordAttachmentPaths(
    entity: Record<string, unknown>,
    config: ProfileRecordConfig,
  ): string[] {
    const attachmentFields = Object.values(config.fields).filter((field) =>
      /(?:Path|File|Files)$/.test(field),
    );
    return [
      ...new Set(
        attachmentFields.flatMap((field) =>
          this.parseProfileRecordAttachmentPaths(entity[field]),
        ),
      ),
    ];
  }

  private parseProfileRecordAttachmentPaths(value: unknown): string[] {
    const values = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? (() => {
            try {
              const parsed = JSON.parse(value) as unknown;
              return Array.isArray(parsed) ? parsed : [value];
            } catch {
              return value.split(/[\n,;]+/u);
            }
          })()
        : [];

    return values
      .map((item) => normalizeStoredUploadPath(String(item)))
      .filter((item): item is string => Boolean(item));
  }

  private normalizeProfileRecordValue(value: unknown, entityField: string) {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const numericFields = new Set([
      'fileClass',
      'fileStatus',
      'fpStatus',
      'fundSource',
      'annualWorkDays',
      'isActive',
      'isCoreIp',
      'htStatus',
      'isKjyf',
      'kyProjectStatus',
      'fz',
      'highTechIncome',
      'lrTotal',
      'mainBusinessIncome',
      'netAssets',
      'netProfit',
      'photoStatus',
      'q',
      'rdDepreciation',
      'rdDesignFee',
      'rdDirectInput',
      'rdEntrustedDevelopment',
      'rdEquipmentDebuggingFee',
      'rdIntangibleAmortization',
      'rdOtherExpense',
      'rdPersonnelCost',
      'softWorkStatus',
      'softWorkType',
      'totalRevenue',
      'xxsr',
      'yffy',
      'ygLx',
      'ygLxgg',
      'ygNl',
      'ygQr',
      'ygSex',
      'ygWj',
      'ygXl',
      'ygZc',
      'zhStatus',
      'zhType',
      'zsClass',
      'zxc',
    ]);

    if (entityField === 'isCoreIp') {
      return this.normalizeYesNoValue(String(value), 0);
    }

    return numericFields.has(entityField) ? Number(value) : String(value);
  }

  private async getClientEnterpriseBasicProfileByEnterpriseId(
    enterpriseId: string,
  ): Promise<ClientEnterpriseBasicProfile> {
    const [enterprise, basicInfo, contacts, shareholders] = await Promise.all([
      this.enterpriseRepo.findOne({ where: { id: enterpriseId } }),
      this.enterpriseBasicInfoRepo.findOne({ where: { enterpriseId } }),
      this.enterpriseContactRepo.find({
        order: {
          isDefault: 'DESC',
          id: 'ASC',
        },
        where: {
          enterpriseId,
          status: 1,
        },
      }),
      this.enterprisePersonRepo.find({
        order: { id: 'ASC' },
        where: {
          enterpriseId,
          personType: 'shareholder',
        },
      }),
    ]);
    if (!enterprise) {
      throw new NotFoundException('企业不存在');
    }

    const extra = this.getClientBasicProfileExtra(basicInfo);
    const defaultContact = contacts[0];
    const industry = basicInfo?.industry ?? enterprise.industry;

    return {
      company_address: basicInfo?.regLocation ?? enterprise.address,
      company_name: basicInfo?.name ?? enterprise.name,
      companyIntro: this.toNullableStringFromUnknown(extra.companyIntro),
      contacts_email:
        defaultContact?.email ?? enterprise.contactEmail ?? basicInfo?.email ?? null,
      contacts_fax: this.toNullableStringFromUnknown(extra.contacts_fax),
      contacts_idcard: this.toNullableStringFromUnknown(extra.contacts_idcard),
      contacts_mobile: this.toNullableStringFromUnknown(extra.contacts_mobile),
      contacts_name: defaultContact?.name ?? enterprise.contactName,
      contacts_phone:
        defaultContact?.phone ?? enterprise.contactPhone ?? basicInfo?.phoneNumber ?? null,
      is_invest: this.normalizeNullableFlag(extra.is_invest),
      is_ipo: this.normalizeNullableFlag(extra.is_ipo),
      js_areas: industry,
      le_person_idcard: this.toNullableStringFromUnknown(extra.le_person_idcard),
      le_person_name: basicInfo?.legalPersonName ?? enterprise.legalPerson,
      le_person_phone: this.toNullableStringFromUnknown(extra.le_person_phone),
      listedCode: this.toNullableStringFromUnknown(extra.listedCode),
      main_areas: this.normalizeMainAreas(
        extra.main_areas ?? (industry ? [industry] : []),
      ),
      register_capital: this.toNullableNumber(basicInfo?.regCapital),
      register_date: this.formatClientDate(basicInfo?.establishTime),
      register_type: basicInfo?.companyOrgType ?? enterprise.enterpriseType,
      shareholders: shareholders.map((item) =>
        this.toClientEnterpriseShareholder(item),
      ),
      tax_id: basicInfo?.creditCode ?? enterprise.creditCode,
      vcAmount: this.toNullableNumber(extra.vcAmount),
      zip_code: this.toNullableStringFromUnknown(extra.zip_code),
    };
  }

  private getClientBasicProfileExtra(
    basicInfo?: EnterpriseBasicInfoEntity | null,
  ): Record<string, unknown> {
    const extraJson = this.parseJsonObject(basicInfo?.extraJson);
    const clientBasicProfile = extraJson.clientBasicProfile;
    return clientBasicProfile &&
      typeof clientBasicProfile === 'object' &&
      !Array.isArray(clientBasicProfile)
      ? (clientBasicProfile as Record<string, unknown>)
      : {};
  }

  private async replaceClientEnterpriseShareholders(
    enterpriseId: string,
    shareholders: SaveClientEnterpriseShareholderDto[],
  ): Promise<void> {
    await this.enterprisePersonRepo.delete({
      enterpriseId,
      personType: 'shareholder',
    });

    const entities = shareholders
      .filter((item) => this.toNullableString(item.xname))
      .map((item) =>
        this.enterprisePersonRepo.create(
          this.toClientEnterpriseShareholderEntityData(enterpriseId, item),
        ),
      );

    if (entities.length > 0) {
      await this.enterprisePersonRepo.save(entities);
    }
  }

  private async requireClientEnterpriseShareholder(
    enterpriseId: string,
    id: string,
  ): Promise<EnterprisePersonEntity> {
    const shareholder = await this.enterprisePersonRepo.findOne({
      where: {
        enterpriseId,
        id,
        personType: 'shareholder',
      },
    });
    if (!shareholder) {
      throw new NotFoundException('股东不存在');
    }

    return shareholder;
  }

  private toClientEnterpriseShareholder(
    entity: EnterprisePersonEntity,
  ): ClientEnterpriseShareholder {
    const extra = this.parseJsonObject(entity.extraJson);
    return {
      citizen_type: this.toNullableNumber(extra.citizen_type),
      id: String(entity.id),
      idcard: this.toNullableStringFromUnknown(extra.idcard),
      invest_money: this.toNullableNumber(extra.invest_money),
      xname: entity.name,
    };
  }

  private toClientEnterpriseShareholderEntityData(
    enterpriseId: string,
    input: SaveClientEnterpriseShareholderDto,
  ): Partial<EnterprisePersonEntity> {
    const name = this.normalizeRequiredText(input.xname, '股东姓名不能为空');
    const idcard = this.toNullableString(input.idcard);
    const citizenType = this.toNullableNumber(input.citizen_type) ?? 1;
    const investMoney = this.toNullableNumber(input.invest_money);

    return {
      enterpriseId,
      extraJson: JSON.stringify({
        citizen_type: citizenType,
        idcard,
        invest_money: investMoney,
      }),
      isLegalPerson: 0,
      name,
      personType: 'shareholder',
      phone: null,
      position: `股东:${idcard ?? name}`,
      source: 'client_basic_profile',
    };
  }

  private async upsertDefaultEnterpriseContact(
    enterpriseId: string,
    input: {
      email: null | string;
      name: null | string;
      phone: null | string;
    },
  ): Promise<void> {
    if (!input.name && !input.phone && !input.email) {
      return;
    }

    const existing = await this.enterpriseContactRepo.findOne({
      order: {
        isDefault: 'DESC',
        id: 'ASC',
      },
      where: {
        enterpriseId,
        status: 1,
      },
    });

    if (existing) {
      existing.email = input.email;
      existing.isDefault = 1;
      existing.name = input.name ?? existing.name;
      existing.phone = input.phone;
      await this.clearDefaultContacts(enterpriseId, String(existing.id));
      await this.enterpriseContactRepo.save(existing);
      return;
    }

    await this.enterpriseContactRepo.save(
      this.enterpriseContactRepo.create({
        email: input.email,
        enterpriseId,
        isDefault: 1,
        name: input.name ?? '默认联系人',
        phone: input.phone,
        status: 1,
      }),
    );
  }

  private parseClientDate(value: null | string | undefined): Date | null {
    const text = this.toNullableString(value);
    if (!text) {
      return null;
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private formatClientDate(value: Date | null | undefined): null | string {
    return value ? formatDateTimeInBjt(value).slice(0, 10) : null;
  }

  private normalizeMainAreas(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.toNullableStringFromUnknown(item))
        .filter((item): item is string => Boolean(item));
    }

    const text = this.toNullableStringFromUnknown(value);
    if (!text) {
      return [];
    }

    return text
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private normalizeNullableFlag(value: unknown): 0 | 1 | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    return Number(value) === 1 ? 1 : 0;
  }

  private toNullableNumber(value: unknown): null | number {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private normalizeConfidenceScore(
    value: unknown,
    fallback: unknown,
    min = 0,
    max = 100,
  ): number {
    const numberValue =
      this.toNullableNumber(value) ?? this.toNullableNumber(fallback) ?? min;
    return Math.min(max, Math.max(min, numberValue));
  }

  private normalizeOptionalConfidenceScore(
    value: unknown,
    fallback?: unknown,
  ): null | number {
    const numberValue =
      this.toNullableNumber(value) ?? this.toNullableNumber(fallback);
    return numberValue === null ? null : Math.min(100, Math.max(0, numberValue));
  }

  private toNullableNumericString(value: unknown): null | string {
    const numberValue = this.toNullableNumber(value);
    return numberValue === null ? null : String(numberValue);
  }

  private toNullableStringFromUnknown(value: unknown): null | string {
    return typeof value === 'string' ? this.toNullableString(value) : null;
  }

  private parseJsonObject(value: null | string | undefined): Record<string, unknown> {
    if (!value) {
      return {};
    }

    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  private async requireCurrentEnterpriseId(userId: number): Promise<string> {
    const enterpriseId = await this.getCurrentEnterpriseIdOrNull(userId);
    if (!enterpriseId) {
      throw new NotFoundException('当前账号未绑定企业');
    }

    return enterpriseId;
  }

  private async getCurrentEnterpriseIdOrNull(
    userId: number,
  ): Promise<null | string> {
    const context = await this.resolveCompanyContext(userId);
    return context.currentEnterpriseId;
  }

  private async clearDefaultContacts(
    enterpriseId: string,
    excludeId?: string,
  ): Promise<void> {
    const contacts = await this.enterpriseContactRepo.find({
      where: {
        enterpriseId,
        status: 1,
      },
    });

    const toSave = contacts
      .filter((item) => String(item.id) !== String(excludeId ?? ''))
      .filter((item) => item.isDefault === 1)
      .map((item) => {
        item.isDefault = 0;
        return item;
      });

    if (toSave.length > 0) {
      await this.enterpriseContactRepo.save(toSave);
    }
  }

  private requireBuiltinTemplate(id: string): BuiltinMaterialTemplate {
    const template = BUILTIN_MATERIAL_TEMPLATES.find((item) => item.id === id);
    if (!template) {
      throw new NotFoundException('材料模板不存在');
    }

    return template;
  }

  private normalizeRequiredText(
    value: null | string | undefined,
    message: string,
  ): string {
    const text = value?.trim();
    if (!text) {
      throw new BadRequestException(message);
    }

    return text;
  }

  private toNullableString(value: null | string | undefined): null | string {
    if (value === undefined || value === null) {
      return null;
    }

    const text = value.trim();
    return text ? text : null;
  }

  private generateEnterpriseCode(): string {
    return `CLIENT_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;
  }

  private generateDeclarationNo(): string {
    const date = formatDateTimeInBjt(new Date()).slice(0, 10).replaceAll('-', '');
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `SB${date}${suffix}`;
  }
}
