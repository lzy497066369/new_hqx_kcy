import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export interface EnterpriseOwnerItem {
  createTime?: string;
  email?: null | string;
  enterpriseId: string;
  enterpriseName: string;
  id: string;
  name: string;
  password?: string;
  phone?: null | string;
  remark?: null | string;
  status: 0 | 1;
  updateTime?: string;
  userId: string;
  username: string;
}

export interface EnterpriseOwnerForm {
  email?: null | string;
  enterpriseId?: string;
  name?: string;
  password?: string;
  phone?: null | string;
  remark?: null | string;
  status?: 0 | 1;
  username?: string;
}

export function getEnterpriseOwnersApi(params: Recordable<any>) {
  return requestClient.get<{ items: EnterpriseOwnerItem[]; total: number }>(
    '/enterprise/owner/list',
    { params },
  );
}

export function getEnterpriseOwnerDetailApi(id: string) {
  return requestClient.get<EnterpriseOwnerItem>(`/enterprise/owner/${id}`);
}

export function createEnterpriseOwnerApi(data: EnterpriseOwnerForm) {
  return requestClient.post<EnterpriseOwnerItem>('/enterprise/owner', data);
}

export function updateEnterpriseOwnerApi(
  id: string,
  data: EnterpriseOwnerForm,
) {
  return requestClient.put<EnterpriseOwnerItem>(`/enterprise/owner/${id}`, data);
}

export function resetEnterpriseOwnerPasswordApi(id: string) {
  return requestClient.post(`/enterprise/owner/${id}/reset-password`);
}

export function deleteEnterpriseOwnerApi(id: string) {
  return requestClient.delete(`/enterprise/owner/${id}`);
}
