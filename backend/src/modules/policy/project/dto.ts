export interface PolicyProjectInput {
  applicableObjects?: string;
  basicDescription?: null | string;
  enabled?: number | string;
  name?: string;
  policyType?: string;
}

export interface ProjectMaterialRequirementInput {
  description?: null | string;
  enabled?: number | string;
  requirementName?: string;
  version?: null | string;
}

export interface ProjectMaterialRequirementItemInput {
  attachmentRequired?: number | string;
  enabled?: number | string;
  id?: string;
  isRequired?: number | string;
  itemName?: string;
  moduleKey?: string;
  requirementDesc?: null | string;
  requirementId?: string;
  requiredCount?: number | string;
  requiredFields?: null | string;
  requiredYears?: null | string;
  scoreWeight?: number | string;
  sortOrder?: number | string;
  tabKey?: string;
}

export interface DeclarationSchemeInput {
  capabilities?: Record<string, boolean>;
  effectiveEndDate?: null | string;
  effectiveStartDate?: null | string;
  flowTemplate?: unknown;
  flowPresetId?: null | string;
  materialRules?: unknown;
  materialPresetId?: null | string;
  qualificationRules?: unknown;
  qualificationPresetId?: null | string;
  regionId?: null | string;
  schemeName?: string;
  scoreRules?: unknown;
  scorePresetId?: null | string;
  version?: string;
}
