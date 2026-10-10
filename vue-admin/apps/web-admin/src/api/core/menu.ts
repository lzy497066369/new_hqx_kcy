import type { RouteRecordStringComponent } from '@vben/types';

import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';
import { isIamAuthEnabled } from '#/auth/iam-sso';

/**
 * 获取用户所有菜单
 */
export async function getAllMenusApi() {
  if (isIamAuthEnabled()) {
    const issuer = String(import.meta.env.VITE_IAM_ISSUER).replace(/\/$/, '');
    const appCode = String(import.meta.env.VITE_APP_CODE);
    const accessStore = useAccessStore();
    const response = await fetch(
      `${issuer}/iam/me/apps/${encodeURIComponent(appCode)}/menus`,
      {
        headers: {
          authorization: `Bearer ${accessStore.accessToken}`,
        },
      },
    );
    const menus: unknown = await response.json();
    if (!response.ok || !Array.isArray(menus)) {
      throw new Error('IAM menu response is invalid');
    }
    return menus as RouteRecordStringComponent[];
  }
  return requestClient.get<RouteRecordStringComponent[]>('/menu/all');
}
