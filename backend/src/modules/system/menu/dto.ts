import type { PortalType } from '../../../common/types/portal-type';

export interface MenuInput {
  authCode?: string | null;
  component?: string | null;
  meta?: {
    icon?: string | null;
    title?: string;
  };
  name?: string;
  orderNum?: number | string;
  parentId?: string | null;
  path?: string;
  portalType?: PortalType | string;
  redirect?: string | null;
  status?: number | string;
  type?: 'catalog' | 'menu' | 'button' | string;
}
