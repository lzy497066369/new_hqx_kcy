import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemRoleApi {
  export interface SystemRole {
    [key: string]: any;
    code?: string;
    id: string;
    name: string;
    permissions?: string[];
    remark?: string;
    status: 0 | 1;
  }
}

async function getRoleList(params: Recordable<any>) {
  return requestClient.get<{ items: Array<SystemRoleApi.SystemRole>; total: number }>(
    '/system/role/list',
    {
      params,
    },
  );
}

async function createRole(data: Omit<SystemRoleApi.SystemRole, 'id'>) {
  return requestClient.post('/system/role', data);
}

async function updateRole(
  id: string,
  data: Omit<SystemRoleApi.SystemRole, 'id'>,
) {
  return requestClient.put(`/system/role/${id}`, data);
}

async function deleteRole(id: string) {
  return requestClient.delete(`/system/role/${id}`);
}

export { createRole, deleteRole, getRoleList, updateRole };
