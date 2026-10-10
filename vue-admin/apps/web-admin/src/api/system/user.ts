import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';
import type { PortalType } from './portal-type';

export namespace SystemUserApi {
  export interface SystemUser {
    [key: string]: any;
    deptId?: string;
    deptName?: string;
    enterpriseId?: string;
    enterpriseName?: string;
    homePath?: string;
    id: string;
    name: string;
    password?: string;
    permissions?: string[];
    portalType?: PortalType;
    roleIds?: string[];
    roleNames?: string[];
    remark?: string;
    status: 0 | 1;
    username?: string;
  }
}

async function getUserList(params: Recordable<any>) {
  return requestClient.get<{ items: Array<SystemUserApi.SystemUser>; total: number }>(
    '/system/user/list',
    {
      params,
    },
  );
}

async function createUser(data: Omit<SystemUserApi.SystemUser, 'id'>) {
  return requestClient.post('/system/user', data);
}

async function updateUser(
  id: string,
  data: Omit<SystemUserApi.SystemUser, 'id'>,
) {
  return requestClient.put(`/system/user/${id}`, data);
}

async function deleteUser(id: string, portalType?: PortalType) {
  return requestClient.delete(`/system/user/${id}`, {
    params: { portalType },
  });
}

export { createUser, deleteUser, getUserList, updateUser };
