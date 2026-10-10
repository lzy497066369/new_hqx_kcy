export type FlowNodeRole = '' | 'consultant' | 'enterprise';

export type FlowNodeType = 'auto' | 'end' | 'manual';

export type FlowTimeRuleMode = 'always' | 'annual_window' | 'date_range' | 'relative_days';

export interface FlowTimeRule {
  endDate?: string;
  endDay?: number;
  endMonth?: number;
  endOffsetDays?: number;
  maxHandleDays?: number;
  // New templates always use date_range. The remaining modes are retained so
  // published historical snapshots can still be rendered correctly.
  mode: FlowTimeRuleMode;
  startDay?: number;
  startDate?: string;
  startMonth?: number;
  startOffsetDays?: number;
}

export type QualificationMode = 'all' | 'any';

export type QualificationRule = CertificateQualificationRule | MetricQualificationRule;

export interface CertificateQualificationRule {
  certificateType: string;
  type: 'certificate_exists';
}

export interface MetricQualificationRule {
  key: EnterpriseMetricKey;
  operator: EnterpriseMetricOperator;
  type: 'metric';
  value: number;
}

export interface QualificationRuleConfig {
  mode: QualificationMode;
  rules: QualificationRule[];
}

export type EnterpriseMetricKey =
  | 'account_high_tech_declaration_exists'
  | 'account_soft_copyright_exists'
  | 'balance_sheet_exists'
  | 'business_license_exists'
  | 'contract_count'
  | 'employee_attachment_count'
  | 'employee_attachment_coverage_ratio'
  | 'employee_count'
  | 'equipment_photo_exists'
  | 'enterprise_age_days'
  | 'finance_year_count'
  | 'financial_statement_exists'
  | 'gaoxin_financial_period_complete'
  | 'core_ip_exists'
  | 'ip_count'
  | 'ip_rd_ps_chain_complete'
  | 'invoice_count'
  | 'latest_high_tech_income'
  | 'latest_high_tech_income_ratio'
  | 'latest_total_revenue'
  | 'personnel_info_exists'
  | 'sequence_ledger_exists'
  | 'site_photo_exists'
  | 'tech_employee_count'
  | 'tech_employee_ratio'
  | 'three_year_rd_expense_ratio'
  | 'three_year_rd_expense_ratio_required'
  | 'three_year_rd_expense_ratio_qualified'
  | 'training_photo_exists';

export type EnterpriseMetricOperator = 'eq' | 'gte' | 'gt' | 'lte' | 'lt';

export interface EnterpriseMetricRule {
  key: EnterpriseMetricKey;
  label: string;
  operator: EnterpriseMetricOperator;
  value: number;
}

export interface EnterprisePresetConfig {
  mode: QualificationMode;
  rules: EnterpriseMetricRule[];
}

export interface SchemeMaterialRule {
  attachmentRequired: 0 | 1;
  isRequired: 0 | 1;
  itemName: string;
  moduleKey: string;
  requiredCount: number;
  requiredFields?: string[];
  requiredYears?: string[];
  requirementDesc?: string;
  scoreWeight?: number;
  sortOrder?: number;
  tabKey: string;
}

export interface ScoreLadderStep {
  min: number;
  score: number;
}

export type ScoreMethod = 'fixed' | 'ladder' | 'ratio' | 'threshold';

export interface ScoreRule {
  label: string;
  ladder?: ScoreLadderStep[];
  maxScore: number;
  method: ScoreMethod;
  score?: number;
  source: string;
  threshold?: number;
}

export interface ScoreRuleConfig {
  items: ScoreRule[];
  passScore: number;
}

export interface FlowNode {
  code: string;
  description?: string;
  name: string;
  qualificationPresetIds?: string[];
  role?: FlowNodeRole;
  timeRule?: FlowTimeRule;
  type: FlowNodeType;
}

export interface FlowTemplate {
  nodes: FlowNode[];
}
