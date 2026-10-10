import type { UploadFile } from 'antdv-next';

import { requestClient } from '#/api/request';

export type PolicyFileStatus =
  | 'archived'
  | 'draft'
  | 'expired'
  | 'incomplete'
  | 'published';

export interface PolicyFileItem {
  aiAnalysis: null | {
    aiReason: null | string;
    aiTaskId: null | string;
    officialConfidence: null | string;
    officialVerified: number;
    rawText: null | string;
    sourceRunItemId: string;
    structuredResult: null | unknown;
    summary: null | string;
  };
  aiConfidence: null | string;
  applicationLevel: null | string;
  conditionText: null | string;
  content: null | string;
  createTime: string;
  documentNo: null | string;
  endDate: null | string;
  fileName: null | string;
  fileUrl: null | string;
  id: string;
  importedByAi: number;
  issuingAgency: null | string;
  materialText: null | string;
  officialFileUrl: null | string;
  officialPublishDate: null | string;
  officialSourceName: null | string;
  ownerName: string;
  ownerUserId: string;
  policyCategory: string;
  policyCategoryName: string;
  projectId: string;
  projectName: string;
  regionId: null | string;
  regionName: string;
  remark: null | string;
  sourceRunItemId: null | string;
  startDate: null | string;
  status: PolicyFileStatus;
  subsidyAmountMax: null | string;
  subsidyAmountMin: null | string;
  subsidyText: null | string;
  targetObjects: null | string;
  templateFileId: null | string;
  templateFileName: null | string;
  title: string;
  updateTime: string;
}

export interface PolicyFileDefaults {
  content: null | string;
  ownerName: null | string;
  ownerUserId: null | string;
  projectId: null | string;
  projectName: null | string;
  templateFileId: null | string;
  templateFileName: null | string;
  title: null | string;
}

export interface PolicyFileListResult {
  items: PolicyFileItem[];
  total: number;
}

export interface PolicyFileQuery {
  ownerUserId?: string;
  policyCategory?: string;
  page?: number;
  pageSize?: number;
  projectId?: string;
  regionId?: string;
  status?: PolicyFileStatus | string;
  title?: string;
}

export interface PolicyFileDefaultsQuery {
  projectId?: string;
  regionId?: string;
}

export interface PolicyFileForm {
  applicationLevel?: string;
  attachmentFiles?: UploadFile[];
  conditionText?: string;
  content?: string;
  endDate?: string;
  fileName?: string;
  fileUrl?: string;
  materialText?: string;
  officialFileUrl?: string;
  ownerUserId?: string;
  policyCategory?: string;
  projectId: string;
  regionId: string;
  remark?: string;
  startDate?: string;
  status?: PolicyFileStatus;
  subsidyAmountMax?: string;
  subsidyAmountMin?: string;
  subsidyText?: string;
  targetObjects?: string;
  templateFileId?: string;
  templateFileName?: string;
  title: string;
}

export interface PolicyFileDraftParseResult {
  confidence: null | string;
  fetchedContent: null | string;
  fetchedUrl: null | string;
  model: string;
  rawContent: string;
  structuredResult: {
    applicationLevel?: null | string;
    conditions?: string[];
    department?: null | string;
    endDate?: null | string;
    materials?: string[];
    policyName?: null | string;
    startDate?: null | string;
    subsidy?: null | string;
    summary?: null | string;
    targetObjects?: string[];
  };
  summary: null | string;
  taskId: string;
  tokenUsage: null | unknown;
}

export function getPolicyFilesApi(params?: PolicyFileQuery) {
  return requestClient.get<PolicyFileListResult>('/policy/files', {
    params,
  });
}

export function getPolicyFileDefaultsApi(params?: PolicyFileDefaultsQuery) {
  return requestClient.get<PolicyFileDefaults>('/policy/files/defaults', {
    params,
  });
}

export function getPolicyFileDetailApi(id: string) {
  return requestClient.get<PolicyFileItem>(`/policy/files/${id}`);
}

export function parsePolicyFileDraftByAiApi(data: PolicyFileForm) {
  return requestClient.post<PolicyFileDraftParseResult>(
    '/policy/files/ai-parse-draft',
    data,
  );
}

export function createPolicyFileApi(data: PolicyFileForm) {
  return requestClient.post<PolicyFileItem>('/policy/files', data);
}

export function updatePolicyFileApi(id: string, data: PolicyFileForm) {
  return requestClient.put<PolicyFileItem>(`/policy/files/${id}`, data);
}

export function publishPolicyFileApi(id: string) {
  return requestClient.post<PolicyFileItem>(`/policy/files/${id}/publish`);
}

export function archivePolicyFileApi(id: string) {
  return requestClient.post<PolicyFileItem>(`/policy/files/${id}/archive`);
}

export function expirePolicyFileApi(id: string) {
  return requestClient.post<PolicyFileItem>(`/policy/files/${id}/expire`);
}

export function markPolicyFileIncompleteApi(id: string) {
  return requestClient.post<PolicyFileItem>(`/policy/files/${id}/incomplete`);
}

export function deletePolicyFileApi(id: string) {
  return requestClient.delete(`/policy/files/${id}`);
}
