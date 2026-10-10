export interface PolicyCollectJobInput {
  cronExpression?: null | string;
  departmentName?: null | string;
  enabled?: number | string;
  keywords?: null | string;
  name?: string;
  officialDomainRules?: null | string;
  policyCategory?: null | string;
  projectId?: string;
  regionId?: null | string;
  regionScope?: null | string;
}

export interface PolicyCollectReviewPolicyFileInput {
  policyFileId?: string;
}
