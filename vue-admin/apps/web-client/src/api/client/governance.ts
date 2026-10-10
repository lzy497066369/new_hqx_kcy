import { requestClient } from '#/api/request';

export interface GovernanceRegion {
  id: string;
  name: string;
  status: number;
  projectAccountCount: number;
  enterpriseCount: number;
}

export interface GovernanceAccount {
  id: string;
  name: string;
  username: string;
  status: number;
  enterpriseCount: number;
}

export interface GovernanceEnterprise {
  id: string;
  name: string;
  creditCode: string;
  salesOwner: string;
  enterpriseProjects: string[];
  preDeclarationYear: number | null;
  profileStatus: string;
  regionId: string;
  regionName: string;
  projectUserId: string;
  projectUsername: string;
  projectName: string;
}

export interface GovernanceEnterpriseDetail extends GovernanceEnterprise {
  code: string;
  shortName: string;
  legalPerson: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  industry: string;
  enterpriseType: string;
  province: string;
  city: string;
  district: string;
  address: string;
  remark: string;
}

export interface GovernanceOverview {
  scope: 'overall';
  regions: GovernanceRegion[];
  projectAccounts: GovernanceAccount[];
  enterprises: GovernanceEnterprise[];
}

export interface CreateGovernanceEnterprise {
  name: string;
  regionId: string;
  salesOwner: string;
  enterpriseProjects: string[];
  preDeclarationYear: number;
}

export interface CreateGovernanceAccount {
  name: string;
  username: string;
  password: string;
  email?: string;
  phone?: string;
}

export interface GovernanceFilters {
  keyword?: string;
  regionId?: string;
  distribution?: 'assigned' | 'pending';
}

export type ExcelField = 'name' | 'region' | 'salesOwner' | 'enterpriseProjects' | 'preDeclarationYear';
export interface ExcelRow {
  rowNumber: number;
  name: string;
  region: string;
  salesOwner: string;
  enterpriseProjects: string;
  preDeclarationYear: string;
  status: 'ready' | 'duplicate' | 'error' | 'success';
  issues: string[];
}
export interface ExcelSummary {
  rows: ExcelRow[];
  total: number;
  ready: number;
  success: number;
  duplicate: number;
  failed: number;
}
export interface ExcelPreview extends ExcelSummary {
  token: string;
  sheets: string[];
  sheetName: string;
  headerRow: number;
  columns: { index: number; label: string }[];
  mapping: Partial<Record<ExcelField, number>>;
  missingFields: string[];
}

const base = '/client/governance';
const blobOptions = { responseType: 'blob' as const, responseReturn: 'body' as const };
export const getGovernanceOverviewApi = () => requestClient.get<GovernanceOverview>(`${base}/overview`);
export const getGovernanceEnterpriseApi = (id: string) => requestClient.get<GovernanceEnterpriseDetail>(`${base}/enterprises/${id}`);
export const createGovernanceEnterpriseApi = (data: CreateGovernanceEnterprise) => requestClient.post(`${base}/enterprises`, data);
export const createGovernanceAccountApi = (data: CreateGovernanceAccount) => requestClient.post(`${base}/accounts`, data);
export const distributeGovernanceEnterprisesApi = (accountId: string, enterpriseIds: string[]) => requestClient.post(`${base}/project-accounts/${accountId}/enterprises`, { enterpriseIds });
export const deleteGovernanceEnterpriseApi = (id: string) => requestClient.delete(`${base}/enterprises/${id}`);
export const deleteGovernanceAccountApi = (id: string) => requestClient.delete(`${base}/accounts/${id}`);
export const downloadGovernanceTemplateApi = () => requestClient.get<Blob>(`${base}/enterprises/excel/template`, blobOptions);
export const exportGovernanceEnterprisesApi = (params: GovernanceFilters) => requestClient.get<Blob>(`${base}/enterprises/excel/export`, { params, ...blobOptions });
export const downloadGovernanceIssuesApi = (token: string) => requestClient.get<Blob>(`${base}/enterprises/excel/issues/${token}`, blobOptions);
export const confirmGovernanceExcelApi = (token: string) => requestClient.post<ExcelSummary>(`${base}/enterprises/excel/confirm`, { token });
export function previewGovernanceExcelApi(file: File, options: { sheetName?: string; headerRow?: number; mapping?: Partial<Record<ExcelField, number>> } = {}) {
  const data = new FormData();
  data.append('file', file);
  if (options.sheetName) data.append('sheetName', options.sheetName);
  if (options.headerRow) data.append('headerRow', String(options.headerRow));
  if (options.mapping) data.append('mapping', JSON.stringify(options.mapping));
  return requestClient.post<ExcelPreview>(`${base}/enterprises/excel/preview`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
