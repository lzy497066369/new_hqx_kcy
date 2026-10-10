import type { PortalType } from '../../../common/types/portal-type';

export interface UserInput {
  deptId?: string | null;
  enterpriseId?: string | null;
  homePath?: string | null;
  name?: string;
  password?: string;
  portalType?: PortalType | string;
  roleIds?: string[] | string;
  remark?: string | null;
  status?: number | string;
  username?: string;
}
