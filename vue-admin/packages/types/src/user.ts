import type { BasicUserInfo } from '@vben-core/typings';

interface UserInfo extends BasicUserInfo {
  token?: string;
}

export type { UserInfo };
