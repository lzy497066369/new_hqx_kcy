import { requestClient } from '#/api/request';

export namespace AuthApi {
  export interface LoginParams {
    password?: string;
    username?: string;
  }

  export interface LoginResult {
    accessToken: string;
  }
}

export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/auth/login', data);
}

export async function logoutApi() {
  return requestClient.post('/auth/logout');
}

export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/auth/codes');
}
