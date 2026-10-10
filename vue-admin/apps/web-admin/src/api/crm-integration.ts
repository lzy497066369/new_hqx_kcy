import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export interface CrmIntegrationKey {
  createdAt: Date | string;
  expiresAt: Date | null | string;
  id: string;
  keyId: string;
  lastUsedAt: Date | null | string;
  scopes: string[];
  status: number;
  updatedAt: Date | string;
}

export interface CrmIntegrationClient {
  allowedIpCidrs: null | string;
  appId: string;
  createdAt: Date | string;
  id: string;
  keys: CrmIntegrationKey[];
  name: string;
  rateLimitPerMinute: number;
  status: number;
  updatedAt: Date | string;
}

export interface CrmIntegrationInboundRequest {
  clientId: string;
  createdAt: Date | string;
  failureReason: null | string;
  id: string;
  processStatus: 'accepted' | 'failed' | 'processing' | 'skipped' | 'success';
  processedAt: Date | null | string;
  requestType: 'contract' | 'execution_order';
  sourceRequestId: string;
  syncRecordId: null | string;
  syncRecordType: null | 'contract' | 'execution_order';
  updatedAt: Date | string;
}

export interface CreatedCrmIntegrationKey extends CrmIntegrationKey {
  secret: string;
}

export function getCrmIntegrationClientsApi() {
  return requestClient.get<CrmIntegrationClient[]>('/crm-integration/clients');
}

export function createCrmIntegrationClientApi(data: {
  allowedIpCidrs?: string;
  appId?: string;
  name: string;
  rateLimitPerMinute?: number;
}) {
  return requestClient.post<CrmIntegrationClient>('/crm-integration/clients', data);
}

export function createCrmIntegrationKeyApi(clientId: string, data: {
  expiresAt?: string;
  keyId?: string;
  scopes?: string;
}) {
  return requestClient.post<CreatedCrmIntegrationKey>(`/crm-integration/clients/${clientId}/keys`, data);
}

export function disableCrmIntegrationKeyApi(id: string) {
  return requestClient.post<CrmIntegrationKey>(`/crm-integration/keys/${id}/disable`);
}

export function getCrmIntegrationRequestsApi(params: Recordable<any>) {
  return requestClient.get<{ items: CrmIntegrationInboundRequest[]; total: number }>(
    '/crm-integration/requests',
    { params },
  );
}

export function retryCrmIntegrationRequestApi(id: string) {
  return requestClient.post<CrmIntegrationInboundRequest>(`/crm-integration/requests/${id}/retry`);
}
