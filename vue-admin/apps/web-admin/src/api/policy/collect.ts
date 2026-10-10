import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';

export interface PolicyCollectJob {
  createTime: string;
  cronExpression: null | string;
  departmentName: null | string;
  enabled: number;
  id: string;
  keywords: null | string;
  lastRunAt: null | string;
  name: string;
  nextRunAt: null | string;
  officialDomainRules: null | string;
  ownerName: null | string;
  ownerUserId: null | string;
  policyCategory: string;
  policyCategoryName: string;
  projectId: string;
  projectName: string;
  regionId: null | string;
  regionName: string;
  regionScope: string;
  regionScopeName: string;
  updateTime: string;
}

export interface PolicyCollectRun {
  aiTaskId: null | string;
  changedCount: number;
  createTime: string;
  currentStep: null | string;
  errorMessage: null | string;
  finishedAt: null | string;
  id: string;
  ignoredCount: number;
  jobId: string;
  jobName: string;
  newCount: number;
  progress: number;
  sameCount: number;
  searchedKeywords: null | PolicyCollectSearchSnapshot | string[];
  startedAt: null | string;
  status: string;
  stepMessage: null | string;
  totalCount: number;
  uncertainCount: number;
  updateTime: string;
}

export interface PolicyCollectSearchSnapshot {
  keywords?: string[];
  publishDateEnd?: string;
  publishDateStart?: string;
  queries?: string[];
  rawResultCount?: number;
  resultCount?: number;
  searchTaskId?: string;
  systemDate?: string;
  warnings?: string[];
}

export interface PolicyCollectRunItem {
  aiReason: null | string;
  aiTaskId: null | string;
  compareStatus: 'changed' | 'ignored' | 'new' | 'same' | 'uncertain' | string;
  createTime: string;
  documentNo: null | string;
  id: string;
  issuingAgency: null | string;
  matchedPolicyFileId: null | string;
  officialConfidence: null | string;
  officialUrl: null | string;
  officialVerified: number;
  policyCategory: string;
  policyCategoryName: string;
  projectId: string;
  projectName: string;
  publishDate: null | string;
  regionId: null | string;
  regionName: string;
  runId: string;
  status: string;
  summary: null | string;
  title: string;
  updateTime: string;
}

export interface PolicyCollectJobForm {
  cronExpression?: string;
  departmentName?: string;
  enabled?: number;
  keywords?: string;
  name?: string;
  officialDomainRules?: string;
  policyCategory?: string;
  projectId: string;
  regionId?: null | string;
  regionScope?: string;
}

export interface PolicyCollectWorkbenchSummary {
  changedPolicyCount: number;
  latestNotifications: PolicyCollectNotification[];
  lastRun: null | PolicyCollectRun;
  newPolicyCount: number;
  pendingReviewCount: number;
  unreadNotificationCount: number;
  uncertainCount: number;
}

export interface PolicyCollectNotification {
  content: null | string;
  createTime: string;
  id: string;
  jobId: null | string;
  readAt: null | string;
  runId: null | string;
  runItemId: null | string;
  status: string;
  targetUserId: null | string;
  title: string;
  type: string;
  updateTime: string;
}

export function getPolicyCollectJobsApi(params?: Record<string, any>) {
  return requestClient.get<{ items: PolicyCollectJob[]; total: number }>(
    '/policy/collect-jobs',
    { params },
  );
}

export function createPolicyCollectJobApi(data: PolicyCollectJobForm) {
  return requestClient.post<PolicyCollectJob>('/policy/collect-jobs', data);
}

export function updatePolicyCollectJobApi(id: string, data: PolicyCollectJobForm) {
  return requestClient.put<PolicyCollectJob>(`/policy/collect-jobs/${id}`, data);
}

export function runPolicyCollectJobApi(id: string) {
  return requestClient.post<PolicyCollectRun>(`/policy/collect-jobs/${id}/run`);
}

export function deletePolicyCollectJobApi(id: string) {
  return requestClient.delete(`/policy/collect-jobs/${id}`);
}

export function enablePolicyCollectJobApi(id: string) {
  return requestClient.post<PolicyCollectJob>(`/policy/collect-jobs/${id}/enable`);
}

export function disablePolicyCollectJobApi(id: string) {
  return requestClient.post<PolicyCollectJob>(`/policy/collect-jobs/${id}/disable`);
}

export function getPolicyCollectRunsApi(params?: Record<string, any>) {
  return requestClient.get<{ items: PolicyCollectRun[]; total: number }>(
    '/policy/collect-runs',
    { params },
  );
}

export function getPolicyCollectRunApi(id: string) {
  return requestClient.get<PolicyCollectRun>(`/policy/collect-runs/${id}`);
}

export function getPolicyCollectRunItemsApi(id: string) {
  return requestClient.get<PolicyCollectRunItem[]>(
    `/policy/collect-runs/${id}/items`,
  );
}

export function createPolicyCollectRunProgressStream(id: string) {
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  const accessStore = useAccessStore();
  const baseUrl = apiURL.replace(/\/$/, '');
  const url = new URL(
    `${baseUrl}/policy/collect-runs/${id}/progress-stream`,
    window.location.origin,
  );
  if (accessStore.accessToken) {
    url.searchParams.set('access_token', accessStore.accessToken);
  }
  return new EventSource(url.toString());
}

export function getPolicyCollectReviewItemsApi(params?: Record<string, any>) {
  return requestClient.get<{ items: PolicyCollectRunItem[]; total: number }>(
    '/policy/collect-review-items',
    { params },
  );
}

export function importPolicyCollectReviewItemApi(id: string) {
  return requestClient.post(`/policy/collect-review-items/${id}/import`);
}

export function savePolicyCollectReviewItemAsNewApi(id: string) {
  return requestClient.post(`/policy/collect-review-items/${id}/save-as-new`);
}

export function updatePolicyCollectReviewItemExistingApi(
  id: string,
  data: { policyFileId?: string } = {},
) {
  return requestClient.post<PolicyCollectRunItem>(
    `/policy/collect-review-items/${id}/update-existing`,
    data,
  );
}

export function linkPolicyCollectReviewItemExistingApi(
  id: string,
  data: { policyFileId?: string } = {},
) {
  return requestClient.post<PolicyCollectRunItem>(
    `/policy/collect-review-items/${id}/link-existing`,
    data,
  );
}

export function ignorePolicyCollectReviewItemApi(id: string) {
  return requestClient.post<PolicyCollectRunItem>(
    `/policy/collect-review-items/${id}/ignore`,
  );
}

export function getPolicyCollectWorkbenchSummaryApi() {
  return requestClient.get<PolicyCollectWorkbenchSummary>(
    '/policy/collect-workbench/summary',
  );
}

export function getPolicyCollectNotificationsApi(params?: Record<string, any>) {
  return requestClient.get<{ items: PolicyCollectNotification[]; total: number }>(
    '/policy/collect-notifications',
    { params },
  );
}

export function getPolicyCollectNotificationApi(id: string) {
  return requestClient.get<PolicyCollectNotification>(
    `/policy/collect-notifications/${id}`,
  );
}

export function markPolicyCollectNotificationReadApi(id: string) {
  return requestClient.post<PolicyCollectNotification>(
    `/policy/collect-notifications/${id}/read`,
  );
}
