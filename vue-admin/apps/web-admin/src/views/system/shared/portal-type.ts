import type { PortalType } from '#/api/system/portal-type';

export const DEFAULT_PORTAL_TYPE: PortalType = 'admin';

export const portalTypeOptions: Array<{ label: string; value: PortalType }> = [
  { label: '后台端', value: 'admin' },
  { label: '客户端', value: 'client' },
];
