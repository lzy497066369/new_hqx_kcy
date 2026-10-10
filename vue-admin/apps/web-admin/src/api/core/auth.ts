import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    portal?: 'admin' | 'client';
    username?: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
  }

  export interface RefreshTokenResult {
    accessToken: string;
  }
}

function getRuntimePortal(): 'admin' | 'client' {
  return import.meta.env.VITE_APP_PORTAL === 'client' ? 'client' : 'admin';
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/auth/login', {
    ...data,
    portal: data.portal ?? getRuntimePortal(),
  });
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>(
    '/auth/refresh',
    undefined,
    {
      responseReturn: 'data',
      headers: {
        'X-Portal': getRuntimePortal(),
      },
      skipErrorMessage: true,
      withCredentials: true,
    },
  );
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return requestClient.post('/auth/logout', undefined, {
    headers: {
      'X-Portal': getRuntimePortal(),
    },
    responseReturn: 'data',
    withCredentials: true,
  });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/auth/codes');
}
