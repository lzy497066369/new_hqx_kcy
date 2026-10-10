import { requestClient } from '#/api/request';

export interface PolicyProjectItem {
  applicableObjects: null | string;
  basicDescription: null | string;
  createTime: string;
  enabled: number;
  id: string;
  name: string;
  policyType: null | string;
  updateTime: string;
}

export interface PolicyProjectListResult {
  items: PolicyProjectItem[];
  total: number;
}

export interface PolicyProjectQuery {
  enabled?: number | string;
  name?: string;
  page?: number;
  pageSize?: number;
  policyType?: string;
}

export interface PolicyProjectForm {
  applicableObjects: string;
  basicDescription?: string;
  enabled?: number;
  name: string;
  policyType: string;
}

export interface DeclarationSchemeForm {
  capabilities: Record<string, boolean>;
  effectiveEndDate?: null | string;
  effectiveStartDate?: null | string;
  flowPresetId?: null | string;
  flowTemplate?: unknown;
  materialPresetId?: null | string;
  materialRules?: unknown;
  qualificationPresetId?: null | string;
  qualificationRules?: unknown;
  regionId?: null | string;
  schemeName: string;
  scorePresetId?: null | string;
  scoreRules?: unknown;
  version: string;
}

export interface DeclarationSchemeItem extends DeclarationSchemeForm {
  id: string;
  projectId: string;
  status: 'draft' | 'published';
  updateTime: string;
}

export type DeclarationPresetType =
  | 'enterprise'
  | 'flow'
  | 'material'
  | 'qualification'
  | 'score';

export interface DeclarationPresetForm {
  description?: null | string;
  name: string;
  payload: unknown;
  presetType: DeclarationPresetType;
  version: string;
}

export interface DeclarationPresetItem extends DeclarationPresetForm {
  createTime: string;
  id: string;
  status: 'draft' | 'published';
  updateTime: string;
}

export function getPolicyProjectsApi(params?: PolicyProjectQuery) {
  return requestClient.get<PolicyProjectListResult>('/policy/projects', {
    params,
  });
}

export function getPolicyProjectDetailApi(id: string) {
  return requestClient.get<PolicyProjectItem>(`/policy/projects/${id}`);
}

export function createPolicyProjectApi(data: PolicyProjectForm) {
  return requestClient.post<PolicyProjectItem>('/policy/projects', data);
}

export function updatePolicyProjectApi(id: string, data: PolicyProjectForm) {
  return requestClient.put<PolicyProjectItem>(`/policy/projects/${id}`, data);
}

export function enablePolicyProjectApi(id: string) {
  return requestClient.post<PolicyProjectItem>(`/policy/projects/${id}/enable`);
}

export function disablePolicyProjectApi(id: string) {
  return requestClient.post<PolicyProjectItem>(
    `/policy/projects/${id}/disable`,
  );
}

export function getDeclarationSchemesApi(projectId: string) {
  return requestClient.get<DeclarationSchemeItem[]>(
    `/policy/projects/${projectId}/declaration-schemes`,
  );
}

export function createDeclarationSchemeApi(
  projectId: string,
  data: DeclarationSchemeForm,
) {
  return requestClient.post<DeclarationSchemeItem>(
    `/policy/projects/${projectId}/declaration-schemes`,
    data,
  );
}

export function updateDeclarationSchemeApi(
  id: string,
  data: Partial<DeclarationSchemeForm>,
) {
  return requestClient.put<DeclarationSchemeItem>(
    `/policy/projects/declaration-schemes/${id}`,
    data,
  );
}

export function publishDeclarationSchemeApi(id: string) {
  return requestClient.post<DeclarationSchemeItem>(
    `/policy/projects/declaration-schemes/${id}/publish`,
  );
}

export function getDeclarationPresetsApi(type: DeclarationPresetType) {
  return requestClient.get<DeclarationPresetItem[]>('/policy/declaration-presets', {
    params: { type },
  });
}

export function createDeclarationPresetApi(data: DeclarationPresetForm) {
  return requestClient.post<DeclarationPresetItem>('/policy/declaration-presets', data);
}

export function updateDeclarationPresetApi(
  id: string,
  data: Partial<DeclarationPresetForm>,
) {
  return requestClient.put<DeclarationPresetItem>(`/policy/declaration-presets/${id}`, data);
}

export function publishDeclarationPresetApi(id: string) {
  return requestClient.post<DeclarationPresetItem>(`/policy/declaration-presets/${id}/publish`);
}
