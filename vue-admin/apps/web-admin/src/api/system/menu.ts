import { requestClient } from '#/api/request';
import type { PortalType, PortalTypeParams } from './portal-type';

export namespace SystemMenuApi {
  export const MenuTypes = ['catalog', 'menu', 'button'] as const;

  export interface SystemMenu {
    [key: string]: any;
    authCode?: string;
    children?: SystemMenu[];
    component?: string;
    createTime?: string;
    id: string;
    meta?: {
      icon?: string;
      title: string;
    };
    name: string;
    orderNum?: number;
    parentId?: null | string;
    path: string;
    portalType?: PortalType;
    redirect?: string;
    status: 0 | 1;
    type: (typeof MenuTypes)[number];
    updateTime?: string;
  }
}

async function getMenuList(params?: PortalTypeParams) {
  return requestClient.get<Array<SystemMenuApi.SystemMenu>>('/system/menu/list', {
    params,
  });
}

async function isMenuNameExists(
  name: string,
  id?: SystemMenuApi.SystemMenu['id'],
  portalType?: PortalType,
) {
  return requestClient.get<boolean>('/system/menu/name-exists', {
    params: { id, name, portalType },
  });
}

async function isMenuPathExists(
  path: string,
  id?: SystemMenuApi.SystemMenu['id'],
  portalType?: PortalType,
) {
  return requestClient.get<boolean>('/system/menu/path-exists', {
    params: { id, path, portalType },
  });
}

async function createMenu(
  data: Omit<SystemMenuApi.SystemMenu, 'children' | 'id'>,
) {
  return requestClient.post('/system/menu', data);
}

async function updateMenu(
  id: string,
  data: Omit<SystemMenuApi.SystemMenu, 'children' | 'id'>,
) {
  return requestClient.put(`/system/menu/${id}`, data);
}

async function deleteMenu(id: string, portalType?: PortalType) {
  return requestClient.delete(`/system/menu/${id}`, {
    params: { portalType },
  });
}

export {
  createMenu,
  deleteMenu,
  getMenuList,
  isMenuNameExists,
  isMenuPathExists,
  updateMenu,
};
