import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';

export interface UpdateProfileParams {
  email?: string | null;
  introduction?: string | null;
  phone?: string | null;
  realName?: string;
  username?: string;
}

export interface UpdatePasswordParams {
  newPassword: string;
  oldPassword: string;
}

export async function getUserInfoApi() {
  return requestClient.get<UserInfo>('/user/info');
}

export async function updateProfileApi(data: UpdateProfileParams) {
  return requestClient.post<UserInfo>('/user/profile', data);
}

export async function updatePasswordApi(data: UpdatePasswordParams) {
  return requestClient.post<void>('/user/password', data);
}
