import type { RequestClientOptions } from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { message } from 'antdv-next';

import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import { isIamAuthEnabled, refreshIamAuthorization } from '#/auth/iam-sso';

import { refreshTokenApi } from './core';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

const BACKEND_SUCCESS_CODE = 0;
let iamRefreshPromise: Promise<string> | undefined;

interface BackendErrorPayload {
  error?: string;
  message?: string;
}

function getBackendErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') {
    return '';
  }

  const payload =
    (
      error as {
        response?: { data?: BackendErrorPayload };
      }
    ).response?.data ??
    (error as BackendErrorPayload);

  if (typeof payload.message === 'string' && payload.message) {
    return payload.message;
  }

  if (typeof payload.error === 'string' && payload.error) {
    return payload.error;
  }

  return '';
}

function showRequestError(defaultMessage: string, error: unknown) {
  const backendMessage = getBackendErrorMessage(error);

  message.error(backendMessage || defaultMessage || $t('page.auth.requestFailed'));
}

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
  });

  async function doReAuthenticate() {
    console.warn($t('page.auth.tokenExpiredWarn'));
    const accessStore = useAccessStore();
    const authStore = useAuthStore();
    accessStore.setAccessToken(null);
    if (
      preferences.app.loginExpiredMode === 'modal' &&
      accessStore.isAccessChecked
    ) {
      accessStore.setLoginExpired(true);
    } else {
      await authStore.logout();
    }
  }

  async function doRefreshToken() {
    const accessStore = useAccessStore();
    const newToken = isIamAuthEnabled()
      ? await refreshIamAuthorizationWithLock()
      : (await refreshTokenApi()).accessToken;
    accessStore.setAccessToken(newToken);
    return newToken;
  }

  function refreshIamAuthorizationWithLock() {
    if (!iamRefreshPromise) {
      iamRefreshPromise = refreshIamAuthorization().finally(() => {
        iamRefreshPromise = undefined;
      });
    }
    return iamRefreshPromise;
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();

      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = preferences.app.locale;
      return config;
    },
  });

  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: 'data',
      successCode: BACKEND_SUCCESS_CODE,
    }),
  );

  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      showRequestError(msg, error);
    }),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

export const baseRequestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});
