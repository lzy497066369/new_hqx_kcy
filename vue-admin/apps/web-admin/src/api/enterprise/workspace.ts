import { requestClient } from '#/api/request';

import type { EnterpriseProfileItem } from './profiles';

export interface EnterpriseWorkspaceRisk {
  code: string;
  description: string;
  level: 'high' | 'low' | 'medium';
  title: string;
}

export interface EnterpriseWorkspaceOverview {
  evidenceChainBreaks: number;
  expiringDeclarations: number;
  incompleteProfiles: number;
  materialPending: number;
  reviewingDeclarations: number;
  totalEnterprises: number;
}

export type EnterpriseMaterialLedgerType =
  | 'account'
  | 'certificate'
  | 'contract'
  | 'document'
  | 'employee'
  | 'finance'
  | 'intellectual_property'
  | 'invoice'
  | 'photo'
  | 'product_service'
  | 'research_project'
  | 'transformation';

export interface EnterpriseMaterialLedgerItem {
  enterpriseId: string;
  enterpriseName: string;
  id: string;
  summary: null | string;
  title: string;
  type: EnterpriseMaterialLedgerType;
  updatedAt: Date | string;
}

export interface EnterpriseMaterialLedgerQuery {
  enterpriseId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  type?: EnterpriseMaterialLedgerType;
}

export interface EnterpriseWorkspaceSummary {
  declarations: Array<{
    currentNodeName: null | string;
    deadline: Date | null | string;
    id: string;
    missingMaterialCount: number;
    progress: number;
    projectName: string;
    rejectedReason: null | string;
    status: string;
    updatedAt: Date | string;
  }>;
  financeTrend: Array<{
    highTechIncome: null | string;
    rdExpense: null | string;
    xxsr: null | string;
    year: null | string;
  }>;
  highTechIndicators: {
    financialYears: number;
    intellectualPropertyCount: number;
    productServiceCount: number;
    researchEmployeeCount: number;
    researchProjectCount: number;
    transformationCount: number;
  };
  metrics: {
    activeDeclarations: number;
    attachmentRecords: number;
    completenessRate: number;
    completedModules: number;
    healthScore: number;
    totalModules: number;
  };
  moduleStats: Array<{
    attachmentCount: number;
    isCompleted: boolean;
    itemName: string;
    missingFields: string[];
    moduleKey: string;
    moduleName: string;
    recordCount: number;
    score: number;
    tabKey: string;
  }>;
  profile: EnterpriseProfileItem;
  recentMaterials: Array<{
    errorCount: number;
    fileName: null | string;
    id: string;
    status: string;
    templateName: null | string;
    updatedAt: Date | string;
  }>;
  recentOperations: Array<{
    action: string;
    createdAt: Date | string;
    id: string;
    module: string;
    operatorName: string;
    success: boolean;
  }>;
  risks: EnterpriseWorkspaceRisk[];
}

export type EnterpriseEvidenceChainNodeType =
  | 'intellectual_property'
  | 'product_service'
  | 'research_project'
  | 'transformation';

export interface EnterpriseEvidenceChain {
  breaks: Array<{
    code: string;
    description: string;
    nodeId: string;
    nodeName: string;
    nodeType: EnterpriseEvidenceChainNodeType;
    routeName: string;
    severity: 'high' | 'medium';
    title: string;
  }>;
  nodes: Array<{
    code: string;
    id: string;
    links: Partial<Record<EnterpriseEvidenceChainNodeType, string[]>>;
    name: string;
    type: EnterpriseEvidenceChainNodeType;
  }>;
  stats: {
    breakCount: number;
    connectedNodeCount: number;
    intellectualPropertyCount: number;
    productServiceCount: number;
    researchProjectCount: number;
    transformationCount: number;
  };
}

export interface EnterpriseWorkspaceDeclarationReviewInput {
  action: 'approve' | 'return';
  comment?: string;
}

export interface EnterpriseWorkspaceDeclaration {
  currentNodeName: null | string;
  deadline: Date | null | string;
  id: string;
  missingMaterialCount: number;
  progress: number;
  projectId: string;
  projectName: string;
  rejectedReason: null | string;
  status: string;
  updatedAt: Date | string;
}

export interface EnterpriseDeclarationLedgerItem extends EnterpriseWorkspaceDeclaration {
  enterpriseId: string;
  enterpriseName: string;
}

export interface EnterpriseDeclarationLedgerParams {
  deadlineWithinDays?: number;
  enterpriseId?: string;
  keyword?: string;
  missingMaterials?: boolean;
  page?: number;
  pageSize?: number;
  status?: string;
}
export interface EnterpriseWorkspaceDeclarationFlowNode {
  code: string;
  description?: string;
  executionStatus?: 'in_progress' | 'overdue' | 'pending' | 'unconfigured';
  name: string;
  preconditions?: EnterpriseWorkspaceQualificationPresetResult[];
  qualificationStatus?: 'eligible' | 'ineligible';
  role?: string;
  timeRule?: { endDate?: string; mode?: string; startDate?: string };
  type: string;
}

export interface EnterpriseWorkspaceDeclarationDetail extends EnterpriseWorkspaceDeclaration {
  configuration: EnterpriseWorkspaceDeclarationConfiguration;
  flowTemplate: null | {
    nodes: EnterpriseWorkspaceDeclarationFlowNode[];
  };
  flowHistory: Array<{
    at: null | string;
    from: null | string;
    reason: null | string;
    to: null | string;
  }>;
  gaoxinScore: null | EnterpriseWorkspaceGaoxinScore;
  materialCheck: null | {
    checkedAt: Date | string;
    checkStatus: string;
    items: Array<{
      checkStatus?: string;
      itemName?: string;
      missingFields?: string[];
      moduleKey?: string;
      suggestion?: string;
      tabKey?: string;
    }>;
    missingItems: number;
    readinessScore: number;
    riskLevel: string;
  };
  matchedScheme: EnterpriseWorkspaceDeclarationConfiguration['scheme'];
  qualification: null | {
    missing: string[];
    status: 'eligible' | 'ineligible';
  };
}

export interface EnterpriseWorkspaceQualificationRuleResult {
  actual: null | number;
  expected: number;
  key: string;
  label: string;
  operator: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | string;
  passed: boolean;
  source: string;
  type: 'certificate' | 'metric';
  unit: string;
  valueType: 'boolean' | 'number';
}

export interface EnterpriseWorkspaceQualificationPresetResult {
  description: null | string;
  id: string;
  name: string;
  rules: EnterpriseWorkspaceQualificationRuleResult[];
  status: 'eligible' | 'ineligible';
  version: null | string;
}

export interface EnterpriseWorkspaceDeclarationConfiguration {
  flow: {
    nodes: EnterpriseWorkspaceDeclarationFlowNode[];
    preset: null | { description: null | string; id: string; name: string; version: string };
  };
  material: {
    items: Array<{
      attachmentRequired?: number;
      isRequired?: number;
      itemName?: string;
      moduleKey?: string;
      requiredCount?: number;
      requiredFields?: string[];
      requiredYears?: string[];
      requirementDesc?: string;
      scoreWeight?: number;
      sortOrder?: number;
      tabKey?: string;
    }>;
    preset: null | { description: null | string; id: string; name: string; version: string };
  };
  qualification: {
    mode: 'all' | 'any';
    preset: null | { description: null | string; id: string; name: string; version: string };
    rules: EnterpriseWorkspaceQualificationRuleResult[];
    status: 'eligible' | 'ineligible';
  };
  scheme: null | { id: string; name: string; version: string };
  score: {
    preset: null | { description: null | string; id: string; name: string; version: string };
    rules: Record<string, unknown>;
  };
}

export interface EnterpriseWorkspaceGaoxinScore {
  categories: Array<{
    deductions: string[];
    key: string;
    label: string;
    maxScore: number;
    score: number;
    subItems: Array<{
      basis: string;
      expertReviewRequired: boolean;
      grade: string;
      key: string;
      label: string;
      maxScore: number;
      score: number;
      scoreRange: string;
    }>;
  }>;
  passScore: number;
  passed: boolean;
  riskLevel: 'high' | 'low' | 'medium';
  ruleVersion?: string;
  summary: string;
  totalScore: number;
}
export interface EnterpriseWorkspaceCandidateProject {
  canCreate: boolean;
  deadline: Date | null | string;
  existingDeclarationId: null | string;
  id: string;
  name: string;
  policyCount: number;
  policyType: null | string;
  qualificationMissing: string[];
  scheme: null | { id: string; name: string; version: string };
}
export interface EnterpriseWorkspaceTodo {
  description: string;
  key: string;
  level: 'high' | 'low' | 'medium';
  routeName: string;
  title: string;
}

export interface EnterpriseWorkspaceContact {
  email: null | string;
  id: string;
  isDefault: boolean;
  name: string;
  phone: null | string;
  position: null | string;
  remark: null | string;
  roleName: null | string;
}

export interface EnterpriseWorkspaceContactInput {
  email?: null | string;
  isDefault?: boolean;
  name: string;
  phone?: null | string;
  position?: null | string;
  remark?: null | string;
  roleName?: null | string;
}

export interface EnterpriseWorkspaceProfileInput {
  address?: null | string;
  city?: null | string;
  contactEmail?: null | string;
  contactName?: null | string;
  contactPhone?: null | string;
  creditCode?: string;
  district?: null | string;
  enterpriseType?: null | string;
  industry?: null | string;
  legalPerson?: null | string;
  name?: string;
  profileStatus?: string;
  province?: null | string;
  remark?: null | string;
  shortName?: null | string;
}

export interface EnterpriseWorkspaceBasicProfileShareholder {
  citizenType: 1 | 2 | 3 | null;
  id: string;
  idCard: null | string;
  investMoney: null | number;
  name: string;
}

export interface EnterpriseWorkspaceBasicProfileInput {
  address: null | string;
  companyIntro: null | string;
  companyName: string;
  contactEmail: null | string;
  contactFax: null | string;
  contactIdCard: null | string;
  contactMobile: null | string;
  contactName: null | string;
  contactPhone: null | string;
  isInvest: 0 | 1 | null;
  isIpo: 0 | 1 | null;
  legalPersonIdCard: null | string;
  legalPersonName: null | string;
  legalPersonPhone: null | string;
  listedCode: null | string;
  mainAreas: string[];
  province: null | string;
  city: null | string;
  district: null | string;
  registerCapital: null | number;
  registerDate: string;
  registerType: null | string;
  shareholders: EnterpriseWorkspaceBasicProfileShareholder[];
  taxId: string;
  technologyArea: null | string;
  vcAmount: null | number;
  zipCode: null | string;
}

export interface EnterpriseWorkspaceFinancialRecord {
  fz: null | number;
  fzl: null | string;
  highTechIncome: null | number;
  id: string;
  lrTotal: null | number;
  mainBusinessIncome: null | number;
  netAssets: null | number;
  netProfit: null | number;
  q: null | number;
  rdDepreciation: null | number;
  rdDesignFee: null | number;
  rdDirectInput: null | number;
  rdEntrustedDevelopment: null | number;
  rdEquipmentDebuggingFee: null | number;
  rdExpense: null | number;
  rdIntangibleAmortization: null | number;
  rdOtherExpense: null | number;
  rdPersonnelCost: null | number;
  remark: null | string;
  status: number;
  totalRevenue: null | number;
  xxsr: null | number;
  year: null | string;
  zxc: null | number;
}

export interface EnterpriseWorkspaceTaxAudit {
  fileClass: null | number;
  filePath: null | string;
  id: string;
  remark: null | string;
  status: number;
  taxCategory: null | string;
  year: null | string;
}

export interface EnterpriseWorkspaceFinanceAiDraftPayload {
  confidence: number;
  documentType?: 'financial_statement' | 'other' | 'tax_audit';
  financial?: null | Record<string, unknown>;
  parseStatus: 'partial' | 'review_required' | 'success' | string;
  reviewWarnings: string[];
  sourceFileName: string;
  sourceMaterialId?: null | string;
  sourcePreviewUrl?: null | string;
  taxAudit?: null | Record<string, unknown>;
  year: string;
}

export interface EnterpriseWorkspaceFinanceAiDraft {
  draftPayload: EnterpriseWorkspaceFinanceAiDraftPayload;
  id: string;
  status: string;
}

export type EnterpriseWorkspaceTaxAuditInput = Omit<
  EnterpriseWorkspaceTaxAudit,
  'id' | 'status' | 'year'
> & { year: string };

export interface EnterpriseWorkspaceEmployee {
  annualWorkDays: null | number;
  department: null | string;
  educationFile: null | string;
  entryDate: null | string;
  id: string;
  idCard: null | string;
  isActive: boolean;
  isKjyf: boolean;
  laborContractFile: null | string;
  position: null | string;
  rdProjects: null | string;
  remark: null | string;
  socialSecurityFile: null | string;
  titleFile: null | string;
  ygFiles: null | string;
  ygLx: null | number;
  ygLxgg: boolean;
  ygName: null | string;
  ygNl: null | number;
  ygQr: boolean;
  ygSex: null | number;
  ygWj: boolean;
  ygXl: null | number;
  ygZc: null | number;
}

export interface EnterpriseWorkspaceContract {
  endDate: null | string;
  htDes: null | string;
  htMoney: null | string;
  htName: null | string;
  htNum: null | string;
  htPath: null | string;
  htStatus: null | number;
  id: string;
  khName: null | string;
  qdDate: null | string;
  startDate: null | string;
}
export type EnterpriseWorkspaceContractInput = Omit<
  EnterpriseWorkspaceContract,
  'id' | 'htName'
> & { htName: string };
export interface EnterpriseWorkspaceInvoice {
  fpDate: null | string;
  fpMoney: null | string;
  fpNum: null | string;
  fpPath: null | string;
  fpStatus: null | number;
  htId: null | string;
  id: string;
  remark: null | string;
  zfDate: null | string;
}
export type EnterpriseWorkspaceInvoiceInput = Omit<
  EnterpriseWorkspaceInvoice,
  'id' | 'fpNum'
> & { fpNum: string };
export interface EnterpriseWorkspaceDocument {
  fileClass: null | number;
  filePath: null | string;
  fileRemark: null | string;
  fileStartDate: null | string;
  fileStatus: null | number;
  fileTitle: null | string;
  fileVersion: null | string;
  id: string;
}
export type EnterpriseWorkspaceDocumentInput = Omit<
  EnterpriseWorkspaceDocument,
  'id' | 'fileTitle'
> & { fileTitle: string };
export interface EnterpriseWorkspaceCertificate {
  id: string;
  qualificationCode: null | string;
  validUntil: null | string;
  zsClass: null | number;
  zsName: null | string;
  zsPath: null | string;
}
export type EnterpriseWorkspaceCertificateInput = Omit<
  EnterpriseWorkspaceCertificate,
  'id' | 'zsName'
> & { zsName: string };
export interface EnterpriseWorkspaceAccount {
  bEmail: null | string;
  bPhone: null | string;
  charge: null | string;
  endDate: null | string;
  gsbm: null | string;
  hasPassword: boolean;
  id: string;
  ptName: null | string;
  ptUrl: null | string;
  remark: null | string;
  zhNumber: null | string;
  zhStatus: null | number;
  zhType: null | number;
}
export interface EnterpriseWorkspaceAccountInput extends Omit<
  EnterpriseWorkspaceAccount,
  'hasPassword' | 'id' | 'ptName' | 'zhNumber'
> {
  ptName: string;
  zhNumber: string;
  zhPassword?: null | string;
}
export interface EnterpriseWorkspaceArchiveRecords {
  accounts: EnterpriseWorkspaceAccount[];
  certificates: EnterpriseWorkspaceCertificate[];
  contracts: EnterpriseWorkspaceContract[];
  documents: EnterpriseWorkspaceDocument[];
  invoices: EnterpriseWorkspaceInvoice[];
}
export interface EnterpriseWorkspaceContractRecognitionDraftPayload {
  confidence?: null | number;
  end_date?: null | string;
  ht_des?: null | string;
  ht_money?: null | string;
  ht_name?: null | string;
  ht_num?: null | string;
  ht_path?: null | string;
  ht_status?: null | number;
  kh_name?: null | string;
  qd_date?: null | string;
  recognition_note?: null | string;
  review_warnings?: string[];
  source_file_name?: null | string;
  start_date?: null | string;
}

export interface EnterpriseWorkspaceContractRecognitionDraft {
  draftPayload: EnterpriseWorkspaceContractRecognitionDraftPayload;
  id: string;
  sourceIds: string[];
  status: 'approved' | 'rejected' | 'reviewing' | string;
  taskId: null | string;
}

export interface EnterpriseWorkspaceContractRecognitionUploadResult {
  drafts: EnterpriseWorkspaceContractRecognitionDraft[];
  taskId: string;
  total: number;
}

export interface EnterpriseWorkspaceInvoiceRecognitionDraftPayload {
  confidence?: null | number;
  contract_number?: null | string;
  document_type?: null | string;
  fp_date?: null | string;
  fp_money?: null | string;
  fp_num?: null | string;
  fp_path?: null | string;
  fp_status?: null | number;
  ht_id?: null | string;
  purchaser_name?: null | string;
  recognition_note?: null | string;
  remark?: null | string;
  review_warnings?: string[];
  source_file_name?: null | string;
  zf_date?: null | string;
}

export interface EnterpriseWorkspaceInvoiceRecognitionDraft {
  draftPayload: EnterpriseWorkspaceInvoiceRecognitionDraftPayload;
  id: string;
  sourceIds: string[];
  status: 'approved' | 'rejected' | 'reviewing' | string;
  taskId: null | string;
}

export interface EnterpriseWorkspaceInvoiceRecognitionUploadResult {
  drafts: EnterpriseWorkspaceInvoiceRecognitionDraft[];
  taskId: string;
  total: number;
}

export interface EnterpriseWorkspaceGaoxinDocumentDraft {
  content: string;
  fileClass: number;
  key: string;
  missingEvidence: string[];
  recommended: boolean;
  scoreItem: string;
  scoreMax: number;
  title: string;
}

export interface EnterpriseWorkspaceGaoxinDocumentPackage {
  drafts: EnterpriseWorkspaceGaoxinDocumentDraft[];
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
  scoreRules: Array<{ description: string; maxScore: number; title: string }>;
  summary: string;
}

export interface EnterpriseWorkspaceGaoxinDocumentAdoptResult {
  savedItems: EnterpriseWorkspaceDocument[];
  skippedItems: Array<{ key: string; title: string }>;
  summary: string;
}

export interface EnterpriseWorkspacePhoto {
  id: string;
  photoDes: null | string;
  photoFiles: null | string;
  photoStatus: null | number;
  photoTitle: null | string;
  psDate: null | string;
  updatedAt: Date | string;
}

export type EnterpriseWorkspacePhotoInput = Omit<
  EnterpriseWorkspacePhoto,
  'id' | 'photoTitle' | 'updatedAt'
> & { photoTitle: string };

export interface EnterpriseWorkspaceMaterialTemplate {
  description: string;
  fileName: string;
  id: string;
  materialType: string;
  name: string;
  required: boolean;
  updateTime: string;
  version: string;
}

export interface EnterpriseWorkspaceMaterialRecord {
  errorCount: number;
  fileName: null | string;
  filePath: null | string;
  id: string;
  importSummary: null | Record<string, unknown>;
  materialType: null | string;
  remark: null | string;
  status: string;
  templateId: null | string;
  templateName: null | string;
  uploadTime: string;
  url: null | string;
}

export interface EnterpriseWorkspaceMaterialError {
  fieldName: null | string;
  id: string;
  message: string;
  rawValue: null | string;
  rowNumber: null | number;
  sheetName: null | string;
  suggestion: null | string;
}

export type EnterpriseWorkspaceAttachmentType =
  | 'certificate'
  | 'contract'
  | 'document'
  | 'employee'
  | 'intellectual_property'
  | 'invoice'
  | 'photo'
  | 'tax-audit';

export interface EnterpriseWorkspaceIntellectualProperty {
  advancedDegree: null | string;
  applyDate: null | string;
  authorizeDate: null | string;
  id: string;
  inventor: null | string;
  ipCode: null | string;
  ipLevel: null | string;
  isCoreIp: boolean;
  obtainMethod: null | string;
  relatedPsIds: string[];
  relatedRdIds: string[];
  relatedTransformationIds: string[];
  remark: null | string;
  rightHolder: null | string;
  softWorkFile: null | string;
  softWorkName: null | string;
  softWorkNum: null | string;
  softWorkStatus: null | number;
  softWorkType: null | number;
  supportEffect: null | string;
}

export type EnterpriseWorkspaceIntellectualPropertyInput = Omit<
  EnterpriseWorkspaceIntellectualProperty,
  'id' | 'ipCode' | 'softWorkName'
> & { softWorkName: string };

export interface EnterpriseWorkspaceIpRecognitionDraftPayload {
  apply_date?: null | string;
  authorize_date?: null | string;
  confidence?: null | number;
  duplicate_status?: 'draft_duplicate' | 'existing_record' | 'none' | 'unchecked';
  duplicate_warning?: null | string;
  recognition_note?: null | string;
  review_warnings?: string[];
  right_holder?: null | string;
  soft_work_name?: null | string;
  soft_work_num?: null | string;
  soft_work_type?: null | number;
  source_file_name?: null | string;
}

export interface EnterpriseWorkspaceIpRecognitionDraft {
  draftPayload: EnterpriseWorkspaceIpRecognitionDraftPayload;
  id: string;
  sourceIds: string[];
  status: 'approved' | 'rejected' | 'reviewing' | string;
  taskId: null | string;
}
export interface EnterpriseWorkspaceResearchProject {
  coreTechnology: null | string;
  endDate: null | string;
  fundAmount: null | string;
  fundSource: null | number;
  id: string;
  initDate: null | string;
  innovationPoints: null | string;
  kyProjectDes: null | string;
  kyProjectLeader: null | string;
  kyProjectName: null | string;
  kyProjectNum: null | string;
  kyProjectStatus: null | number;
  lxbgFile: null | string;
  projectType: null | string;
  rdBudget: null | string;
  rdExpenseTotal: null | string;
  rdOrganizationMethod: null | string;
  relatedIpIds: string[];
  relatedPsIds: string[];
  relatedTransformationIds: string[];
  remark: null | string;
  stageResult: null | string;
}
export type EnterpriseWorkspaceResearchProjectInput = Omit<
  EnterpriseWorkspaceResearchProject,
  'id' | 'kyProjectName'
> & { kyProjectName: string };
export interface EnterpriseWorkspaceProductService {
  competitiveAdvantage: null | string;
  highTechIncome: null | string;
  id: string;
  lastYearIncome: null | string;
  proofFiles: null | string;
  psCode: null | string;
  psName: null | string;
  relatedContractIds: string[];
  relatedInvoiceIds: string[];
  relatedIpIds: string[];
  relatedRdIds: string[];
  relatedTransformationIds: string[];
  remark: null | string;
  techDescription: null | string;
  techField: null | string;
  techIndex: null | string;
  techSource: null | string;
}
export type EnterpriseWorkspaceProductServiceInput = Omit<
  EnterpriseWorkspaceProductService,
  'id' | 'psName'
> & { psName: string };
export interface EnterpriseWorkspaceTransformation {
  applicationScene: null | string;
  customerName: null | string;
  id: string;
  proofFiles: null | string;
  relatedContractIds: string[];
  relatedInvoiceIds: string[];
  relatedIpIds: string[];
  relatedPsIds: string[];
  relatedRdIds: string[];
  remark: null | string;
  transformationIncome: null | string;
  transformationCode: null | string;
  transformationMethod: null | string;
  transformationName: null | string;
}
export type EnterpriseWorkspaceTransformationInput = Omit<
  EnterpriseWorkspaceTransformation,
  'id' | 'transformationName'
> & { transformationName: string };

export interface EnterpriseWorkspaceAiDraft {
  createTime?: null | string;
  draftPayload: Record<string, unknown>;
  id: string;
  sourceIds: string[];
  status: 'approved' | 'rejected' | 'reviewing' | string;
  taskId: null | string;
}

export interface EnterpriseWorkspaceAiTask {
  createTime: null | string;
  errorMessage: null | string;
  finishedAt: null | string;
  id: string;
  inputSnapshot: Record<string, unknown>;
  scene: string;
  status: string;
  updateTime: null | string;
}

export interface EnterpriseWorkspaceEmployeeList {
  items: EnterpriseWorkspaceEmployee[];
  page: number;
  pageSize: number;
  stats: { activeCount: number; researchCount: number; total: number };
  total: number;
}

export interface EnterpriseWorkspaceEmployeeListParams {
  activeStatus?: 'active' | 'all' | 'inactive';
  employeeType?: number;
  keyword?: string;
  page?: number;
  pageSize?: number;
  researchStatus?: 'all' | 'no' | 'yes';
}

export type EnterpriseWorkspaceEmployeeInput = Omit<
  EnterpriseWorkspaceEmployee,
  'id' | 'ygName'
> & {
  ygName: string;
};

export type EnterpriseWorkspaceEmployeeImportAction =
  | 'create'
  | 'error'
  | 'skip'
  | 'update';

export interface EnterpriseWorkspaceEmployeeImportError {
  fieldName: null | string;
  message: string;
  rawValue?: null | string;
  rowNumber: number;
  sheetName?: null | string;
  suggestion?: null | string;
}

export interface EnterpriseWorkspaceEmployeeImportPreviewRow {
  action: EnterpriseWorkspaceEmployeeImportAction;
  data: {
    department?: null | string;
    id_card?: null | string;
    is_active?: null | number;
    is_kjyf?: null | number;
    position?: null | string;
    yg_name?: null | string;
    yg_nl?: null | number;
    yg_sex?: null | number;
  };
  errors: EnterpriseWorkspaceEmployeeImportError[];
  importable: boolean;
  key: string;
  matchedEmployeeId: null | string;
  rowNumber: number;
  sheetName: string;
}

export interface EnterpriseWorkspaceEmployeeImportPreview {
  materialId: string;
  rows: EnterpriseWorkspaceEmployeeImportPreviewRow[];
  source: {
    companyName: null | string;
    creditCode: null | string;
    fileName: string;
    fileType: 'excel' | 'pdf' | 'unknown';
    queryPeriod: null | string;
    recognitionMode: 'excel' | 'pdf_text' | 'unknown' | 'vision';
  };
  summary: {
    createCount: number;
    errorCount: number;
    importableCount: number;
    readCount: number;
    skippedCount: number;
    status: 'invalid' | 'partial' | 'valid';
    updateCount: number;
  };
}

export interface EnterpriseWorkspaceEmployeeImportResult {
  materialId: string;
  summary: {
    createCount?: number;
    employeeCount: number;
    errorCount: number;
    importableCount?: number;
    skippedCount?: number;
    status: 'invalid' | 'partial' | 'valid';
    updateCount?: number;
  };
}

export type EnterpriseWorkspaceFinancialRecordInput = Partial<
  Omit<EnterpriseWorkspaceFinancialRecord, 'id' | 'status'>
> & { year: string };

async function getEnterpriseWorkspaceSummaryApi(enterpriseId: string) {
  return requestClient.get<EnterpriseWorkspaceSummary>(
    `/enterprise-workspace/enterprises/${enterpriseId}/summary`,
  );
}

async function getEnterpriseWorkspaceOverviewApi() {
  return requestClient.get<EnterpriseWorkspaceOverview>(
    '/enterprise-workspace/overview',
  );
}

async function getEnterpriseMaterialLedgerApi(
  params: EnterpriseMaterialLedgerQuery,
) {
  return requestClient.get<{
    items: EnterpriseMaterialLedgerItem[];
    page: number;
    pageSize: number;
    total: number;
  }>('/enterprise-workspace/materials', { params });
}

async function getEnterpriseEvidenceChainApi(enterpriseId: string) {
  return requestClient.get<EnterpriseEvidenceChain>(
    `/enterprise-workspace/enterprises/${enterpriseId}/evidence-chain`,
  );
}

async function getEnterpriseWorkspaceTodosApi(enterpriseId: string) {
  return requestClient.get<EnterpriseWorkspaceTodo[]>(
    `/enterprise-workspace/enterprises/${enterpriseId}/todos`,
  );
}

async function reviewEnterpriseWorkspaceDeclarationApi(
  enterpriseId: string,
  declarationId: string,
  data: EnterpriseWorkspaceDeclarationReviewInput,
) {
  return requestClient.post(
    `/enterprise-workspace/enterprises/${enterpriseId}/declarations/${declarationId}/review`,
    data,
  );
}

async function getEnterpriseWorkspaceDeclarationsApi(enterpriseId: string) {
  return requestClient.get<EnterpriseWorkspaceDeclaration[]>(
    `/enterprise-workspace/enterprises/${enterpriseId}/declarations`,
  );
}

async function getEnterpriseDeclarationLedgerApi(
  params: EnterpriseDeclarationLedgerParams,
) {
  return requestClient.get<{
    items: EnterpriseDeclarationLedgerItem[];
    page: number;
    pageSize: number;
    total: number;
  }>('/enterprise-workspace/declarations', { params });
}

async function getEnterpriseWorkspaceDeclarationDetailApi(
  enterpriseId: string,
  declarationId: string,
) {
  return requestClient.get<EnterpriseWorkspaceDeclarationDetail>(
    `/enterprise-workspace/enterprises/${enterpriseId}/declarations/${declarationId}`,
  );
}

async function getEnterpriseWorkspaceCandidateProjectsApi(
  enterpriseId: string,
) {
  return requestClient.get<EnterpriseWorkspaceCandidateProject[]>(
    `/enterprise-workspace/enterprises/${enterpriseId}/candidate-projects`,
  );
}

async function createEnterpriseWorkspaceDeclarationDraftApi(
  enterpriseId: string,
  projectId: string,
) {
  return requestClient.post<EnterpriseWorkspaceDeclaration>(
    `/enterprise-workspace/enterprises/${enterpriseId}/declarations`,
    { projectId },
  );
}

async function submitEnterpriseWorkspaceDeclarationApi(
  enterpriseId: string,
  declarationId: string,
) {
  return requestClient.post<EnterpriseWorkspaceDeclaration>(
    `/enterprise-workspace/enterprises/${enterpriseId}/declarations/${declarationId}/submit`,
  );
}

async function getEnterpriseWorkspaceProfileApi(enterpriseId: string) {
  return requestClient.get<EnterpriseProfileItem>(
    `/enterprise-workspace/enterprises/${enterpriseId}/profile`,
  );
}

async function updateEnterpriseWorkspaceProfileApi(
  enterpriseId: string,
  data: EnterpriseWorkspaceProfileInput,
) {
  return requestClient.put<EnterpriseProfileItem>(
    `/enterprise-workspace/enterprises/${enterpriseId}/profile`,
    data,
  );
}

async function getEnterpriseWorkspaceBasicProfileApi(enterpriseId: string) {
  return requestClient.get<EnterpriseWorkspaceBasicProfileInput>(
    `/enterprise-workspace/enterprises/${enterpriseId}/basic-profile`,
  );
}

async function updateEnterpriseWorkspaceBasicProfileApi(
  enterpriseId: string,
  data: EnterpriseWorkspaceBasicProfileInput,
) {
  return requestClient.put<EnterpriseWorkspaceBasicProfileInput>(
    `/enterprise-workspace/enterprises/${enterpriseId}/basic-profile`,
    data,
  );
}

async function getEnterpriseWorkspaceContactsApi(enterpriseId: string) {
  return requestClient.get<EnterpriseWorkspaceContact[]>(
    `/enterprise-workspace/enterprises/${enterpriseId}/contacts`,
  );
}

async function createEnterpriseWorkspaceContactApi(
  enterpriseId: string,
  data: EnterpriseWorkspaceContactInput,
) {
  return requestClient.post<EnterpriseWorkspaceContact>(
    `/enterprise-workspace/enterprises/${enterpriseId}/contacts`,
    data,
  );
}

async function updateEnterpriseWorkspaceContactApi(
  enterpriseId: string,
  contactId: string,
  data: EnterpriseWorkspaceContactInput,
) {
  return requestClient.put<EnterpriseWorkspaceContact>(
    `/enterprise-workspace/enterprises/${enterpriseId}/contacts/${contactId}`,
    data,
  );
}

async function deleteEnterpriseWorkspaceContactApi(
  enterpriseId: string,
  contactId: string,
) {
  return requestClient.delete<void>(
    `/enterprise-workspace/enterprises/${enterpriseId}/contacts/${contactId}`,
  );
}

async function getEnterpriseWorkspaceFinancialRecordsApi(
  enterpriseId: string,
  includeDeleted = false,
) {
  return requestClient.get<EnterpriseWorkspaceFinancialRecord[]>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/financial${includeDeleted ? '?includeDeleted=true' : ''}`,
  );
}

async function getEnterpriseWorkspaceTaxAuditsApi(
  enterpriseId: string,
  includeDeleted = false,
) {
  return requestClient.get<EnterpriseWorkspaceTaxAudit[]>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/tax-audits${includeDeleted ? '?includeDeleted=true' : ''}`,
  );
}

async function getEnterpriseWorkspaceArchiveRecordsApi(enterpriseId: string) {
  return requestClient.get<EnterpriseWorkspaceArchiveRecords>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records`,
  );
}
async function uploadEnterpriseWorkspaceContractRecognitionPdfsApi(
  enterpriseId: string,
  files: File[],
) {
  const data = new FormData();
  files.forEach((file) => data.append('files', file));
  return requestClient.post<EnterpriseWorkspaceContractRecognitionUploadResult>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/contracts/recognition/uploads`,
    data,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180_000 },
  );
}
async function getEnterpriseWorkspaceContractRecognitionDraftsApi(enterpriseId: string) {
  return requestClient.get<{
    items: EnterpriseWorkspaceContractRecognitionDraft[];
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/contracts/recognition/drafts`,
  );
}
async function approveEnterpriseWorkspaceContractRecognitionDraftsApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{
    failed: Array<{ draftId: string; reason: string }>;
    success: Array<{ draftId: string; recordId: string }>;
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/contracts/recognition/approve`,
    { ids },
    { timeout: 180_000 },
  );
}
async function updateEnterpriseWorkspaceContractRecognitionDraftApi(
  enterpriseId: string,
  draftId: string,
  data: EnterpriseWorkspaceContractRecognitionDraftPayload,
) {
  return requestClient.put<EnterpriseWorkspaceContractRecognitionDraft>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/contracts/recognition/drafts/${draftId}`,
    { data },
  );
}
async function rejectEnterpriseWorkspaceContractRecognitionDraftsApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{
    failed: Array<{ draftId: string; reason: string }>;
    success: Array<{ draftId: string }>;
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/contracts/recognition/reject`,
    { ids },
  );
}
async function retryEnterpriseWorkspaceContractRecognitionDraftsApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{
    failed: Array<{ draftId: string; reason: string }>;
    success: EnterpriseWorkspaceContractRecognitionDraft[];
    taskId: string;
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/contracts/recognition/retry`,
    { ids },
    { timeout: 180_000 },
  );
}
async function deleteEnterpriseWorkspaceContractRecognitionDraftApi(
  enterpriseId: string,
  draftId: string,
) {
  return requestClient.delete<{ draftId: string; success: boolean }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/contracts/recognition/drafts/${draftId}`,
  );
}
async function uploadEnterpriseWorkspaceInvoiceRecognitionPdfsApi(
  enterpriseId: string,
  files: File[],
) {
  const data = new FormData();
  files.forEach((file) => data.append('files', file));
  return requestClient.post<EnterpriseWorkspaceInvoiceRecognitionUploadResult>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/invoices/recognition/uploads`,
    data,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180_000 },
  );
}
async function getEnterpriseWorkspaceInvoiceRecognitionDraftsApi(enterpriseId: string) {
  return requestClient.get<{
    items: EnterpriseWorkspaceInvoiceRecognitionDraft[];
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/invoices/recognition/drafts`,
  );
}
async function approveEnterpriseWorkspaceInvoiceRecognitionDraftsApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{
    failed: Array<{ draftId: string; reason: string }>;
    success: Array<{ draftId: string; recordId: string }>;
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/invoices/recognition/approve`,
    { ids },
    { timeout: 180_000 },
  );
}
async function updateEnterpriseWorkspaceInvoiceRecognitionDraftApi(
  enterpriseId: string,
  draftId: string,
  data: EnterpriseWorkspaceInvoiceRecognitionDraftPayload,
) {
  return requestClient.put<EnterpriseWorkspaceInvoiceRecognitionDraft>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/invoices/recognition/drafts/${draftId}`,
    { data },
  );
}
async function rejectEnterpriseWorkspaceInvoiceRecognitionDraftsApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{
    failed: Array<{ draftId: string; reason: string }>;
    success: Array<{ draftId: string }>;
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/invoices/recognition/reject`,
    { ids },
  );
}
async function retryEnterpriseWorkspaceInvoiceRecognitionDraftsApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{
    failed: Array<{ draftId: string; reason: string }>;
    success: EnterpriseWorkspaceInvoiceRecognitionDraft[];
    taskId: string;
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/invoices/recognition/retry`,
    { ids },
    { timeout: 180_000 },
  );
}
async function deleteEnterpriseWorkspaceInvoiceRecognitionDraftApi(
  enterpriseId: string,
  draftId: string,
) {
  return requestClient.delete<{ draftId: string; success: boolean }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/invoices/recognition/drafts/${draftId}`,
  );
}
async function getEnterpriseWorkspaceGaoxinDocumentPackageApi(enterpriseId: string) {
  return requestClient.get<EnterpriseWorkspaceGaoxinDocumentPackage>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/documents/gaoxin-package`,
  );
}
async function adoptEnterpriseWorkspaceGaoxinDocumentPackageApi(
  enterpriseId: string,
  keys: string[],
) {
  return requestClient.post<EnterpriseWorkspaceGaoxinDocumentAdoptResult>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/documents/gaoxin-package/adopt`,
    { keys },
  );
}
async function createEnterpriseWorkspaceArchiveRecordApi<T>(
  enterpriseId: string,
  type: 'accounts' | 'certificates' | 'contracts' | 'documents' | 'invoices',
  data: T,
) {
  return requestClient.post<T>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/${type}`,
    data,
  );
}
async function updateEnterpriseWorkspaceArchiveRecordApi<T>(
  enterpriseId: string,
  type: 'accounts' | 'certificates' | 'contracts' | 'documents' | 'invoices',
  recordId: string,
  data: T,
) {
  return requestClient.put<T>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/${type}/${recordId}`,
    data,
  );
}
async function deleteEnterpriseWorkspaceArchiveRecordApi(
  enterpriseId: string,
  type: 'accounts' | 'certificates' | 'contracts' | 'documents' | 'invoices',
  recordId: string,
) {
  return requestClient.delete<void>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/${type}/${recordId}`,
  );
}
async function deleteEnterpriseWorkspaceCertificatesApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{ deletedCount: number }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-records/certificates/batch-delete`,
    { ids },
  );
}

async function getEnterpriseWorkspaceEmployeesApi(
  enterpriseId: string,
  params: EnterpriseWorkspaceEmployeeListParams = {},
) {
  return requestClient.get<EnterpriseWorkspaceEmployeeList>(
    `/enterprise-workspace/enterprises/${enterpriseId}/employees`,
    { params },
  );
}

async function createEnterpriseWorkspaceEmployeeApi(
  enterpriseId: string,
  data: EnterpriseWorkspaceEmployeeInput,
) {
  return requestClient.post<EnterpriseWorkspaceEmployee>(
    `/enterprise-workspace/enterprises/${enterpriseId}/employees`,
    data,
  );
}

async function updateEnterpriseWorkspaceEmployeeApi(
  enterpriseId: string,
  employeeId: string,
  data: EnterpriseWorkspaceEmployeeInput,
) {
  return requestClient.put<EnterpriseWorkspaceEmployee>(
    `/enterprise-workspace/enterprises/${enterpriseId}/employees/${employeeId}`,
    data,
  );
}

async function uploadEnterpriseWorkspaceEmployeeAttachmentApi(
  enterpriseId: string,
  file: File,
) {
  const data = new FormData();
  data.append('file', file);
  return requestClient.post<{ path: string }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/employees/attachments`,
    data,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
}

async function uploadEnterpriseWorkspaceArchiveAttachmentApi(
  enterpriseId: string,
  file: File,
) {
  const data = new FormData();
  data.append('file', file);
  return requestClient.post<{ path: string }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/archive-attachments`,
    data,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
}

async function deleteEnterpriseWorkspaceEmployeeApi(
  enterpriseId: string,
  employeeId: string,
) {
  return requestClient.delete<void>(
    `/enterprise-workspace/enterprises/${enterpriseId}/employees/${employeeId}`,
  );
}

async function getEnterpriseWorkspaceIntellectualPropertiesApi(
  enterpriseId: string,
) {
  return requestClient.get<{
    items: EnterpriseWorkspaceIntellectualProperty[];
    stats: { coreCount: number; grantedCount: number; total: number };
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/intellectual-properties`,
  );
}
async function createEnterpriseWorkspaceIntellectualPropertyApi(
  enterpriseId: string,
  data: EnterpriseWorkspaceIntellectualPropertyInput,
) {
  return requestClient.post<EnterpriseWorkspaceIntellectualProperty>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/intellectual-properties`,
    data,
  );
}
async function updateEnterpriseWorkspaceIntellectualPropertyApi(
  enterpriseId: string,
  propertyId: string,
  data: EnterpriseWorkspaceIntellectualPropertyInput,
) {
  return requestClient.put<EnterpriseWorkspaceIntellectualProperty>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/intellectual-properties/${propertyId}`,
    data,
  );
}
async function deleteEnterpriseWorkspaceIntellectualPropertyApi(
  enterpriseId: string,
  propertyId: string,
) {
  return requestClient.delete<void>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/intellectual-properties/${propertyId}`,
  );
}

async function clearEnterpriseWorkspacePropertyResearchDataApi(enterpriseId: string) {
  return requestClient.post<{
    draftCount: number;
    materialCount: number;
    recordCount: number;
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/clear-all`,
  );
}

async function uploadEnterpriseWorkspaceIpRecognitionPdfsApi(
  enterpriseId: string,
  files: File[],
) {
  const data = new FormData();
  files.forEach((file) => data.append('files', file));
  return requestClient.post<{
    drafts: EnterpriseWorkspaceIpRecognitionDraft[];
    taskId: string;
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/ip-recognition/uploads`,
    data,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180_000 },
  );
}

async function getEnterpriseWorkspaceIpRecognitionDraftsApi(
  enterpriseId: string,
) {
  return requestClient.get<{
    items: EnterpriseWorkspaceIpRecognitionDraft[];
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/ip-recognition/drafts`,
  );
}

async function getEnterpriseWorkspaceAiTasksApi(enterpriseId: string) {
  return requestClient.get<{
    items: EnterpriseWorkspaceAiTask[];
    total: number;
  }>(`/enterprise-workspace/enterprises/${enterpriseId}/ai-tasks`);
}

async function deleteEnterpriseWorkspaceAiTaskApi(
  enterpriseId: string,
  taskId: string,
) {
  return requestClient.delete<{ success: boolean; taskId: string }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/ai-tasks/${taskId}`,
  );
}

async function approveEnterpriseWorkspaceIpRecognitionDraftsApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{
    failed: Array<{ draftId: string; reason: string }>;
    success: Array<{ draftId: string; recordId: string }>;
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/ip-recognition/approve`,
    { ids },
    { timeout: 180_000 },
  );
}

async function updateEnterpriseWorkspaceIpRecognitionDraftApi(
  enterpriseId: string,
  draftId: string,
  data: EnterpriseWorkspaceIpRecognitionDraftPayload,
) {
  return requestClient.put<EnterpriseWorkspaceIpRecognitionDraft>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/ip-recognition/drafts/${draftId}`,
    { data },
  );
}

async function rejectEnterpriseWorkspaceIpRecognitionDraftsApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{
    failed: Array<{ draftId: string; reason: string }>;
    success: Array<{ draftId: string }>;
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/ip-recognition/reject`,
    { ids },
  );
}

async function retryEnterpriseWorkspaceIpRecognitionDraftsApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{
    failed: Array<{ draftId: string; reason: string }>;
    success: EnterpriseWorkspaceIpRecognitionDraft[];
    taskId: string;
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/ip-recognition/retry`,
    { ids },
    { timeout: 180_000 },
  );
}

async function deleteEnterpriseWorkspaceIpRecognitionDraftApi(
  enterpriseId: string,
  draftId: string,
) {
  return requestClient.delete<{ draftId: string; success: boolean }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/ip-recognition/drafts/${draftId}`,
  );
}
async function getEnterpriseWorkspaceResearchProjectsApi(enterpriseId: string) {
  return requestClient.get<EnterpriseWorkspaceResearchProject[]>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/research-projects`,
  );
}
async function createEnterpriseWorkspaceResearchProjectApi(
  enterpriseId: string,
  data: EnterpriseWorkspaceResearchProjectInput,
) {
  return requestClient.post<EnterpriseWorkspaceResearchProject>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/research-projects`,
    data,
  );
}
async function updateEnterpriseWorkspaceResearchProjectApi(
  enterpriseId: string,
  propertyId: string,
  data: EnterpriseWorkspaceResearchProjectInput,
) {
  return requestClient.put<EnterpriseWorkspaceResearchProject>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/research-projects/${propertyId}`,
    data,
  );
}
async function deleteEnterpriseWorkspaceResearchProjectApi(
  enterpriseId: string,
  propertyId: string,
) {
  return requestClient.delete<void>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/research-projects/${propertyId}`,
  );
}

async function createEnterpriseWorkspaceResearchAutoMatchTaskApi(
  enterpriseId: string,
  data: { ipIds?: string[]; targetCount?: number } = {},
) {
  return requestClient.post<{ taskId: string; total: number; warning: null | string }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/research/generation/auto-match/tasks`,
    data,
    { timeout: 180_000 },
  );
}

async function getEnterpriseWorkspaceResearchGenerationDraftsApi(
  enterpriseId: string,
) {
  return requestClient.get<{ items: EnterpriseWorkspaceAiDraft[]; total: number }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/research/generation/drafts`,
  );
}

async function approveEnterpriseWorkspaceResearchGenerationDraftsApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{
    failed: Array<{ draftId: string; reason: string }>;
    success: Array<{ draftId: string; recordId: string }>;
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/research/generation/approve`,
    { ids },
    { timeout: 180_000 },
  );
}

async function deleteEnterpriseWorkspaceResearchGenerationDraftsApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{
    failed: Array<{ draftId: string; reason: string }>;
    success: Array<{ draftId: string }>;
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/research/generation/drafts/batch-delete`,
    { ids },
  );
}

async function getEnterpriseWorkspaceProductServicesApi(enterpriseId: string) {
  return requestClient.get<EnterpriseWorkspaceProductService[]>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/product-services`,
  );
}
async function createEnterpriseWorkspaceProductServiceApi(
  enterpriseId: string,
  data: EnterpriseWorkspaceProductServiceInput,
) {
  return requestClient.post<EnterpriseWorkspaceProductService>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/product-services`,
    data,
  );
}
async function updateEnterpriseWorkspaceProductServiceApi(
  enterpriseId: string,
  id: string,
  data: EnterpriseWorkspaceProductServiceInput,
) {
  return requestClient.put<EnterpriseWorkspaceProductService>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/product-services/${id}`,
    data,
  );
}
async function deleteEnterpriseWorkspaceProductServiceApi(
  enterpriseId: string,
  id: string,
) {
  return requestClient.delete<void>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/product-services/${id}`,
  );
}

async function createEnterpriseWorkspaceProductServiceGenerationTaskApi(
  enterpriseId: string,
  data: { businessMode?: 'auto' | 'mixed' | 'product' | 'service'; includeExisting?: boolean; rdIds?: string[]; targetCount?: number } = {},
) {
  return requestClient.post<{ taskId: string; total: number }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/product-services/generation/tasks`,
    data,
    { timeout: 180_000 },
  );
}

async function getEnterpriseWorkspaceProductServiceGenerationDraftsApi(
  enterpriseId: string,
) {
  return requestClient.get<{ items: EnterpriseWorkspaceAiDraft[]; total: number }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/product-services/generation/drafts`,
  );
}

async function approveEnterpriseWorkspaceProductServiceGenerationDraftsApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{
    failed: Array<{ draftId: string; reason: string }>;
    success: Array<{ draftId: string; recordId: string }>;
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/product-services/generation/approve`,
    { ids },
    { timeout: 180_000 },
  );
}
async function getEnterpriseWorkspaceTransformationsApi(enterpriseId: string) {
  return requestClient.get<EnterpriseWorkspaceTransformation[]>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/transformations`,
  );
}
async function createEnterpriseWorkspaceTransformationApi(
  enterpriseId: string,
  data: EnterpriseWorkspaceTransformationInput,
) {
  return requestClient.post<EnterpriseWorkspaceTransformation>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/transformations`,
    data,
  );
}
async function updateEnterpriseWorkspaceTransformationApi(
  enterpriseId: string,
  id: string,
  data: EnterpriseWorkspaceTransformationInput,
) {
  return requestClient.put<EnterpriseWorkspaceTransformation>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/transformations/${id}`,
    data,
  );
}
async function deleteEnterpriseWorkspaceTransformationApi(
  enterpriseId: string,
  id: string,
) {
  return requestClient.delete<void>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/transformations/${id}`,
  );
}

async function createEnterpriseWorkspaceTransformationGenerationTaskApi(
  enterpriseId: string,
  data: { businessMode?: 'auto' | 'mixed' | 'product' | 'service'; ipIds?: string[]; targetCount?: number } = {},
) {
  return requestClient.post<{ taskId: string; total: number }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/transformations/generation/tasks`,
    data,
    { timeout: 180_000 },
  );
}

async function getEnterpriseWorkspaceTransformationGenerationDraftsApi(
  enterpriseId: string,
) {
  return requestClient.get<{ items: EnterpriseWorkspaceAiDraft[]; total: number }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/transformations/generation/drafts`,
  );
}

async function approveEnterpriseWorkspaceTransformationGenerationDraftsApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{
    failed: Array<{ draftId: string; reason: string }>;
    success: Array<{ draftId: string; recordId: string }>;
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/transformations/generation/approve`,
    { ids },
    { timeout: 180_000 },
  );
}

async function downloadEnterpriseWorkspaceEmployeeTemplateApi(
  enterpriseId: string,
) {
  return requestClient.get<Blob>(
    `/enterprise-workspace/enterprises/${enterpriseId}/employees/template`,
    { responseReturn: 'body', responseType: 'blob' },
  );
}

async function downloadEnterpriseWorkspaceEmployeeExportApi(
  enterpriseId: string,
) {
  return requestClient.get<Blob>(
    `/enterprise-workspace/enterprises/${enterpriseId}/employees/export`,
    { responseReturn: 'body', responseType: 'blob' },
  );
}

async function previewEnterpriseWorkspaceEmployeeImportApi(
  enterpriseId: string,
  file: File,
) {
  const data = new FormData();
  data.append('file', file);
  return requestClient.post<EnterpriseWorkspaceEmployeeImportPreview>(
    `/enterprise-workspace/enterprises/${enterpriseId}/employees/import/preview`,
    data,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180_000,
    },
  );
}

async function confirmEnterpriseWorkspaceEmployeeImportApi(
  enterpriseId: string,
  materialId: string,
  skippedKeys: string[] = [],
) {
  return requestClient.post<EnterpriseWorkspaceEmployeeImportResult>(
    `/enterprise-workspace/enterprises/${enterpriseId}/employees/import/confirm`,
    { materialId, skippedKeys },
  );
}

async function createEnterpriseWorkspaceFinancialRecordApi(
  enterpriseId: string,
  data: EnterpriseWorkspaceFinancialRecordInput,
) {
  return requestClient.post<EnterpriseWorkspaceFinancialRecord>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/financial`,
    data,
  );
}

async function updateEnterpriseWorkspaceFinancialRecordApi(
  enterpriseId: string,
  recordId: string,
  data: EnterpriseWorkspaceFinancialRecordInput,
) {
  return requestClient.put<EnterpriseWorkspaceFinancialRecord>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/financial/${recordId}`,
    data,
  );
}

async function deleteEnterpriseWorkspaceFinancialRecordApi(
  enterpriseId: string,
  recordId: string,
) {
  return requestClient.delete<void>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/financial/${recordId}`,
  );
}

async function restoreEnterpriseWorkspaceFinancialRecordApi(
  enterpriseId: string,
  recordId: string,
) {
  return requestClient.post<EnterpriseWorkspaceFinancialRecord>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/financial/${recordId}/restore`,
  );
}

async function createEnterpriseWorkspaceTaxAuditApi(
  enterpriseId: string,
  data: EnterpriseWorkspaceTaxAuditInput,
) {
  return requestClient.post<EnterpriseWorkspaceTaxAudit>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/tax-audits`,
    data,
  );
}

async function updateEnterpriseWorkspaceTaxAuditApi(
  enterpriseId: string,
  recordId: string,
  data: EnterpriseWorkspaceTaxAuditInput,
) {
  return requestClient.put<EnterpriseWorkspaceTaxAudit>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/tax-audits/${recordId}`,
    data,
  );
}

async function deleteEnterpriseWorkspaceTaxAuditApi(
  enterpriseId: string,
  recordId: string,
) {
  return requestClient.delete<void>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/tax-audits/${recordId}`,
  );
}

async function restoreEnterpriseWorkspaceTaxAuditApi(
  enterpriseId: string,
  recordId: string,
) {
  return requestClient.post<EnterpriseWorkspaceTaxAudit>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/tax-audits/${recordId}/restore`,
  );
}

async function uploadEnterpriseWorkspaceFinanceAiParseFilesApi(
  enterpriseId: string,
  files: File[],
) {
  const data = new FormData();
  files.forEach((file) => data.append('files', file));
  return requestClient.post<{ drafts: EnterpriseWorkspaceFinanceAiDraft[] }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/ai-parse/uploads`,
    data,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180_000 },
  );
}

async function getEnterpriseWorkspaceFinanceAiParseDraftsApi(
  enterpriseId: string,
) {
  return requestClient.get<{ items: EnterpriseWorkspaceFinanceAiDraft[] }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/ai-parse/drafts`,
    { timeout: 180_000 },
  );
}

async function approveEnterpriseWorkspaceFinanceAiParseDraftsApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{ failed: Array<{ draftId: string; reason: string }>; success: Array<{ draftId: string; recordIds: string[] }> }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/ai-parse/approve`,
    { ids },
    { timeout: 180_000 },
  );
}

async function updateEnterpriseWorkspaceFinanceAiParseDraftApi(
  enterpriseId: string,
  draftId: string,
  data: EnterpriseWorkspaceFinanceAiDraftPayload,
) {
  return requestClient.put<EnterpriseWorkspaceFinanceAiDraft>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/ai-parse/drafts/${draftId}`,
    { data },
  );
}

async function rejectEnterpriseWorkspaceFinanceAiParseDraftsApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{
    failed: Array<{ draftId: string; reason: string }>;
    success: Array<{ draftId: string }>;
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/ai-parse/reject`,
    { ids },
  );
}

async function retryEnterpriseWorkspaceFinanceAiParseDraftsApi(
  enterpriseId: string,
  ids: string[],
) {
  return requestClient.post<{
    failed: Array<{ draftId: string; reason: string }>;
    success: EnterpriseWorkspaceFinanceAiDraft[];
    total: number;
  }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/ai-parse/retry`,
    { ids },
    { timeout: 180_000 },
  );
}

async function deleteEnterpriseWorkspaceFinanceAiParseDraftApi(
  enterpriseId: string,
  draftId: string,
) {
  return requestClient.delete<{ draftId: string; success: boolean }>(
    `/enterprise-workspace/enterprises/${enterpriseId}/finance/ai-parse/drafts/${draftId}`,
  );
}

async function getEnterpriseWorkspacePhotosApi(enterpriseId: string) {
  return requestClient.get<EnterpriseWorkspacePhoto[]>(
    `/enterprise-workspace/enterprises/${enterpriseId}/photos`,
  );
}

async function createEnterpriseWorkspacePhotoApi(
  enterpriseId: string,
  data: EnterpriseWorkspacePhotoInput,
) {
  return requestClient.post<EnterpriseWorkspacePhoto>(
    `/enterprise-workspace/enterprises/${enterpriseId}/photos`,
    data,
  );
}

async function updateEnterpriseWorkspacePhotoApi(
  enterpriseId: string,
  photoId: string,
  data: EnterpriseWorkspacePhotoInput,
) {
  return requestClient.put<EnterpriseWorkspacePhoto>(
    `/enterprise-workspace/enterprises/${enterpriseId}/photos/${photoId}`,
    data,
  );
}

async function deleteEnterpriseWorkspacePhotoApi(
  enterpriseId: string,
  photoId: string,
) {
  return requestClient.delete<void>(
    `/enterprise-workspace/enterprises/${enterpriseId}/photos/${photoId}`,
  );
}

async function getEnterpriseWorkspaceMaterialTemplatesApi() {
  return requestClient.get<EnterpriseWorkspaceMaterialTemplate[]>(
    '/enterprise-workspace/material-templates',
  );
}

async function downloadEnterpriseWorkspaceMaterialTemplateApi(templateId: string) {
  return requestClient.get<Blob>(
    `/enterprise-workspace/material-templates/${templateId}/download`,
    { responseReturn: 'body', responseType: 'blob' },
  );
}

async function getEnterpriseWorkspaceMaterialsApi(enterpriseId: string) {
  return requestClient.get<EnterpriseWorkspaceMaterialRecord[]>(
    `/enterprise-workspace/enterprises/${enterpriseId}/materials`,
  );
}

async function getEnterpriseWorkspaceMaterialErrorsApi(
  enterpriseId: string,
  materialId: string,
) {
  return requestClient.get<EnterpriseWorkspaceMaterialError[]>(
    `/enterprise-workspace/enterprises/${enterpriseId}/materials/${materialId}/errors`,
  );
}

async function previewEnterpriseWorkspaceMaterialApi(
  enterpriseId: string,
  materialId: string,
) {
  return requestClient.get<Blob>(
    `/enterprise-workspace/enterprises/${enterpriseId}/materials/${materialId}/preview`,
    { responseReturn: 'body', responseType: 'blob' },
  );
}

async function previewEnterpriseWorkspaceAttachmentApi(
  enterpriseId: string,
  attachmentType: EnterpriseWorkspaceAttachmentType,
  recordId: string,
  filePath: string,
) {
  return requestClient.get<Blob>(
    `/enterprise-workspace/enterprises/${enterpriseId}/attachments/${attachmentType}/${recordId}/preview?path=${encodeURIComponent(filePath)}`,
    { responseReturn: 'body', responseType: 'blob' },
  );
}

async function previewEnterpriseWorkspaceIntellectualPropertySourceApi(
  enterpriseId: string,
  propertyId: string,
) {
  return requestClient.get<Blob>(
    `/enterprise-workspace/enterprises/${enterpriseId}/properties/intellectual-properties/${propertyId}/source-file`,
    { responseReturn: 'body', responseType: 'blob' },
  );
}

async function uploadEnterpriseWorkspaceMaterialApi(
  enterpriseId: string,
  templateId: string,
  file: File,
) {
  const data = new FormData();
  data.append('templateId', templateId);
  data.append('file', file);
  return requestClient.post<EnterpriseWorkspaceMaterialRecord>(
    `/enterprise-workspace/enterprises/${enterpriseId}/materials/upload`,
    data,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
}

export {
  createEnterpriseWorkspaceContactApi,
  createEnterpriseWorkspaceDeclarationDraftApi,
  createEnterpriseWorkspaceArchiveRecordApi,
  createEnterpriseWorkspaceEmployeeApi,
  createEnterpriseWorkspaceIntellectualPropertyApi,
  createEnterpriseWorkspaceResearchProjectApi,
  createEnterpriseWorkspaceResearchAutoMatchTaskApi,
  createEnterpriseWorkspaceProductServiceApi,
  createEnterpriseWorkspaceProductServiceGenerationTaskApi,
  createEnterpriseWorkspaceTransformationApi,
  createEnterpriseWorkspaceTransformationGenerationTaskApi,
  createEnterpriseWorkspaceFinancialRecordApi,
  createEnterpriseWorkspaceTaxAuditApi,
  clearEnterpriseWorkspacePropertyResearchDataApi,
  approveEnterpriseWorkspaceFinanceAiParseDraftsApi,
  approveEnterpriseWorkspaceContractRecognitionDraftsApi,
  approveEnterpriseWorkspaceInvoiceRecognitionDraftsApi,
  approveEnterpriseWorkspaceIpRecognitionDraftsApi,
  approveEnterpriseWorkspaceResearchGenerationDraftsApi,
  deleteEnterpriseWorkspaceResearchGenerationDraftsApi,
  approveEnterpriseWorkspaceProductServiceGenerationDraftsApi,
  approveEnterpriseWorkspaceTransformationGenerationDraftsApi,
  adoptEnterpriseWorkspaceGaoxinDocumentPackageApi,
  deleteEnterpriseWorkspaceContactApi,
  deleteEnterpriseWorkspaceContractRecognitionDraftApi,
  deleteEnterpriseWorkspaceInvoiceRecognitionDraftApi,
  deleteEnterpriseWorkspaceArchiveRecordApi,
  deleteEnterpriseWorkspaceCertificatesApi,
  deleteEnterpriseWorkspaceEmployeeApi,
  deleteEnterpriseWorkspaceIntellectualPropertyApi,
  deleteEnterpriseWorkspaceIpRecognitionDraftApi,
  deleteEnterpriseWorkspaceResearchProjectApi,
  deleteEnterpriseWorkspaceProductServiceApi,
  deleteEnterpriseWorkspaceTransformationApi,
  downloadEnterpriseWorkspaceEmployeeTemplateApi,
  downloadEnterpriseWorkspaceEmployeeExportApi,
  deleteEnterpriseWorkspaceFinancialRecordApi,
  deleteEnterpriseWorkspaceFinanceAiParseDraftApi,
  deleteEnterpriseWorkspaceTaxAuditApi,
  restoreEnterpriseWorkspaceFinancialRecordApi,
  restoreEnterpriseWorkspaceTaxAuditApi,
  deleteEnterpriseWorkspacePhotoApi,
  getEnterpriseWorkspaceContactsApi,
  getEnterpriseWorkspaceArchiveRecordsApi,
  getEnterpriseWorkspaceContractRecognitionDraftsApi,
  getEnterpriseWorkspaceInvoiceRecognitionDraftsApi,
  getEnterpriseWorkspaceGaoxinDocumentPackageApi,
  getEnterpriseEvidenceChainApi,
  getEnterpriseWorkspaceDeclarationDetailApi,
  getEnterpriseDeclarationLedgerApi,
  getEnterpriseWorkspaceCandidateProjectsApi,
  getEnterpriseWorkspaceDeclarationsApi,
  getEnterpriseWorkspaceFinancialRecordsApi,
  getEnterpriseWorkspaceFinanceAiParseDraftsApi,
  getEnterpriseWorkspaceTaxAuditsApi,
  getEnterpriseWorkspacePhotosApi,
  getEnterpriseWorkspaceMaterialsApi,
  getEnterpriseWorkspaceMaterialErrorsApi,
  previewEnterpriseWorkspaceMaterialApi,
  previewEnterpriseWorkspaceAttachmentApi,
  previewEnterpriseWorkspaceIntellectualPropertySourceApi,
  getEnterpriseWorkspaceMaterialTemplatesApi,
  downloadEnterpriseWorkspaceMaterialTemplateApi,
  getEnterpriseWorkspaceEmployeesApi,
  getEnterpriseWorkspaceIntellectualPropertiesApi,
  getEnterpriseWorkspaceIpRecognitionDraftsApi,
  getEnterpriseWorkspaceAiTasksApi,
  deleteEnterpriseWorkspaceAiTaskApi,
  getEnterpriseWorkspaceResearchProjectsApi,
  getEnterpriseWorkspaceResearchGenerationDraftsApi,
  getEnterpriseWorkspaceProductServicesApi,
  getEnterpriseWorkspaceProductServiceGenerationDraftsApi,
  getEnterpriseWorkspaceTransformationsApi,
  getEnterpriseWorkspaceTransformationGenerationDraftsApi,
  getEnterpriseWorkspaceTodosApi,
  getEnterpriseWorkspaceProfileApi,
  getEnterpriseWorkspaceBasicProfileApi,
  getEnterpriseMaterialLedgerApi,
  getEnterpriseWorkspaceOverviewApi,
  getEnterpriseWorkspaceSummaryApi,
  previewEnterpriseWorkspaceEmployeeImportApi,
  reviewEnterpriseWorkspaceDeclarationApi,
  rejectEnterpriseWorkspaceIpRecognitionDraftsApi,
  rejectEnterpriseWorkspaceContractRecognitionDraftsApi,
  rejectEnterpriseWorkspaceInvoiceRecognitionDraftsApi,
  rejectEnterpriseWorkspaceFinanceAiParseDraftsApi,
  retryEnterpriseWorkspaceFinanceAiParseDraftsApi,
  retryEnterpriseWorkspaceContractRecognitionDraftsApi,
  retryEnterpriseWorkspaceInvoiceRecognitionDraftsApi,
  retryEnterpriseWorkspaceIpRecognitionDraftsApi,
  submitEnterpriseWorkspaceDeclarationApi,
  confirmEnterpriseWorkspaceEmployeeImportApi,
  updateEnterpriseWorkspaceContactApi,
  updateEnterpriseWorkspaceArchiveRecordApi,
  updateEnterpriseWorkspaceContractRecognitionDraftApi,
  updateEnterpriseWorkspaceInvoiceRecognitionDraftApi,
  updateEnterpriseWorkspaceEmployeeApi,
  updateEnterpriseWorkspaceFinanceAiParseDraftApi,
  uploadEnterpriseWorkspaceEmployeeAttachmentApi,
  uploadEnterpriseWorkspaceArchiveAttachmentApi,
  updateEnterpriseWorkspaceIntellectualPropertyApi,
  updateEnterpriseWorkspaceIpRecognitionDraftApi,
  updateEnterpriseWorkspaceResearchProjectApi,
  updateEnterpriseWorkspaceProductServiceApi,
  updateEnterpriseWorkspaceTransformationApi,
  updateEnterpriseWorkspacePhotoApi,
  createEnterpriseWorkspacePhotoApi,
  uploadEnterpriseWorkspaceMaterialApi,
  uploadEnterpriseWorkspaceFinanceAiParseFilesApi,
  uploadEnterpriseWorkspaceIpRecognitionPdfsApi,
  uploadEnterpriseWorkspaceContractRecognitionPdfsApi,
  uploadEnterpriseWorkspaceInvoiceRecognitionPdfsApi,
  updateEnterpriseWorkspaceFinancialRecordApi,
  updateEnterpriseWorkspaceTaxAuditApi,
  updateEnterpriseWorkspaceProfileApi,
  updateEnterpriseWorkspaceBasicProfileApi,
};
