import type { PortalType } from '../../../common/types/portal-type';

export interface RoleInput {
  name?: string;
  permissions?: string[] | string;
  portalType?: PortalType | string;
  remark?: string | null;
  status?: number | string;
}
