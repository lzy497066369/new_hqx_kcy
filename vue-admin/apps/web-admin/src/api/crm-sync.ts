import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export type CrmSyncProcessStatus = 'failed' | 'processing' | 'received' | 'skipped' | 'success';
export type CrmSyncEventType = 'cancelled' | 'created' | 'updated';

export interface CrmSyncAttempt {
  attemptType: 'automatic' | 'retry';
  createdAt: Date | string;
  failureReason: null | string;
  id: string;
  operatorName: null | string;
  result: unknown;
  status: 'failed' | 'skipped' | 'success';
}

export interface CrmContractSyncRecord {
  accountManagerName: null | string;
  companyName: string;
  contractName: null | string;
  contractNo: null | string;
  createdAt: Date | string;
  customerContractNo: null | string;
  duplicate?: boolean;
  eventType: CrmSyncEventType;
  enterpriseId: null | string;
  enterpriseName: null | string;
  failureReason: null | string;
  id: string;
  lastProcessedAt: Date | null | string;
  processStatus: CrmSyncProcessStatus;
  retryCount: number;
  sequenceNo: null | string;
  sourceRecordId: null | string;
  sourceRequestId: string;
  sourceUpdatedAt: Date | null | string;
  sourceVersion: null | string;
  updatedAt: Date | string;
  vendorName: null | string;
}

export interface CrmExecutionOrderSyncRecord {
  accountManagerName: null | string;
  companyName: string;
  contractNo: null | string;
  contractReviewStatus: null | string;
  createdAt: Date | string;
  declarationIds: Record<string, string>;
  duplicate?: boolean;
  eventType: CrmSyncEventType;
  enterpriseId: null | string;
  enterpriseName: null | string;
  executionDepartment: null | string;
  executionOrderName: string;
  failureReason: null | string;
  id: string;
  intellectualPropertyCount: null | number;
  isCarriedForward: null | string;
  lastProcessedAt: Date | null | string;
  orderNo: string;
  processStatus: CrmSyncProcessStatus;
  productManagerName: null | string;
  projectCodes: string[];
  retryCount: number;
  sourceRecordId: null | string;
  sourceRequestId: string;
  sourceUpdatedAt: Date | null | string;
  sourceVersion: null | string;
  updatedAt: Date | string;
}

export type CrmSyncRecord = CrmContractSyncRecord | CrmExecutionOrderSyncRecord;

export type CrmSyncRecordDetail = CrmSyncRecord & {
  attempts: CrmSyncAttempt[];
  payload: unknown;
};

async function getCrmContractSyncRecordsApi(params: Recordable<any>) {
  return requestClient.get<{ items: CrmContractSyncRecord[]; total: number }>(
    '/crm-sync/contracts',
    { params },
  );
}

async function getCrmContractSyncRecordDetailApi(id: string) {
  return requestClient.get<CrmSyncRecordDetail>(`/crm-sync/contracts/${id}`);
}

async function retryCrmContractSyncRecordApi(id: string) {
  return requestClient.post<CrmContractSyncRecord>(`/crm-sync/contracts/${id}/retry`);
}

async function getCrmExecutionOrderSyncRecordsApi(params: Recordable<any>) {
  return requestClient.get<{
    items: CrmExecutionOrderSyncRecord[];
    total: number;
  }>('/crm-sync/execution-orders', { params });
}

async function getCrmExecutionOrderSyncRecordDetailApi(id: string) {
  return requestClient.get<CrmSyncRecordDetail>(
    `/crm-sync/execution-orders/${id}`,
  );
}

async function retryCrmExecutionOrderSyncRecordApi(id: string) {
  return requestClient.post<CrmExecutionOrderSyncRecord>(
    `/crm-sync/execution-orders/${id}/retry`,
  );
}

export {
  getCrmContractSyncRecordDetailApi,
  getCrmContractSyncRecordsApi,
  getCrmExecutionOrderSyncRecordDetailApi,
  getCrmExecutionOrderSyncRecordsApi,
  retryCrmContractSyncRecordApi,
  retryCrmExecutionOrderSyncRecordApi,
};
