import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export interface EnterpriseUserItem {
  createTime?: string;
  email?: null | string;
  enterpriseId: string;
  enterpriseName: string;
  id: string;
  isDefault: 0 | 1;
  name: string;
  password?: string;
  phone?: null | string;
  remark?: null | string;
  status: 0 | 1;
  updateTime?: string;
  userId: string;
  username: string;
}

export interface EnterpriseUserForm {
  email?: null | string;
  enterpriseId?: string;
  isDefault?: 0 | 1;
  name?: string;
  password?: string;
  phone?: null | string;
  remark?: null | string;
  status?: 0 | 1;
  username?: string;
}

export function getEnterpriseUsersApi(params: Recordable<any>) {
  return requestClient.get<{ items: EnterpriseUserItem[]; total: number }>(
    '/enterprise/user/list',
    { params },
  );
}

export function getEnterpriseUserDetailApi(id: string) {
  return requestClient.get<EnterpriseUserItem>(`/enterprise/user/${id}`);
}

export function createEnterpriseUserApi(data: EnterpriseUserForm) {
  return requestClient.post<EnterpriseUserItem>('/enterprise/user', data);
}

export function updateEnterpriseUserApi(id: string, data: EnterpriseUserForm) {
  return requestClient.put<EnterpriseUserItem>(`/enterprise/user/${id}`, data);
}

export function resetEnterpriseUserPasswordApi(id: string) {
  return requestClient.post(`/enterprise/user/${id}/reset-password`);
}

export function deleteEnterpriseUserApi(id: string) {
  return requestClient.delete(`/enterprise/user/${id}`);
}
