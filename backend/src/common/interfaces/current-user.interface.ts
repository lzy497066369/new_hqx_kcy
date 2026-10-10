import type { AuthPortal } from '../../modules/auth/auth.types';

export interface CurrentUser {
  appCode?: string;
  email?: string | null;
  homePath?: string;
  id: number;
  iamAccessToken?: string;
  permissions?: string[];
  phone?: string | null;
  portal?: AuthPortal;
  realName: string;
  roles: string[];
  sourceUserId?: string;
  username: string;
  roleNames?: string[];
}
