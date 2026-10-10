import type { Recordable, UserInfo } from '@vben/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'antdv-next';
import { defineStore } from 'pinia';

import { getAccessCodesApi, getUserInfoApi, loginApi, logoutApi } from '#/api';
import { finishIamAuthorization, isIamAuthEnabled, logoutIamSession, startIamAuthorization } from '#/auth/iam-sso';
import { resolveClientHomePath as resolveHomePath } from '#/auth/client-home-path';
import { CLIENT_PERSONA_LABELS, getActiveClientPersona, getPersonaHomePath, hasClientPersona, isClientPersona, setActiveClientPersona } from '#/auth/client-persona';
import { $t } from '#/locales';
import { useClientEnterpriseStore } from './client-enterprise';

function normalizeUserInfo(userInfo: UserInfo) {
  const resolvedUserId =
    userInfo.userId ?? (userInfo as UserInfo & { id?: number | string }).id;
  return {
    ...userInfo,
    avatar: userInfo.avatar ?? '',
    userId: String(resolvedUserId ?? ''),
  };
}

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const clientEnterpriseStore = useClientEnterpriseStore();
  const router = useRouter();

  const loginLoading = ref(false);

  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;
      if (isIamAuthEnabled()) {
        const redirect = router.currentRoute.value.query.redirect;
        const iamRedirect = Array.isArray(redirect)
          ? redirect[0] ?? undefined
          : redirect ?? undefined;
        await startIamAuthorization(iamRedirect, getActiveClientPersona());
        return { userInfo };
      }
      const { accessToken } = await loginApi(params);

      if (accessToken) {
        accessStore.setAccessToken(accessToken);

        const [fetchUserInfoResult, accessCodes] = await Promise.all([
          fetchUserInfo(),
          getAccessCodesApi(),
        ]);

        userInfo = fetchUserInfoResult;
        const selectedPersona = getActiveClientPersona();
        if (!hasClientPersona(userInfo.roles ?? [], selectedPersona)) {
          accessStore.setAccessToken('');
          notification.error({ title: '身份权限不匹配', description: `该账号没有${CLIENT_PERSONA_LABELS[selectedPersona]}权限` });
          return { userInfo: null };
        }
        setActiveClientPersona(selectedPersona);

        userStore.setUserInfo(normalizeUserInfo(userInfo));
        accessStore.setAccessCodes(accessCodes);

        if (accessStore.loginExpired) {
          accessStore.setLoginExpired(false);
        } else {
          onSuccess
            ? await onSuccess?.()
            : await router.push(getPersonaHomePath(selectedPersona));
        }

        if (userInfo?.realName) {
          notification.success({
            description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
            duration: 3,
            title: $t('authentication.loginSuccess'),
          });
        }
      }
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function completeIamLogin() {
    loginLoading.value = true;
    try {
      const { accessToken, claims, redirect } = await finishIamAuthorization();
      const loginTypeQuery = router.currentRoute.value.query.login_type;
      const selectedPersona = Array.isArray(loginTypeQuery) ? loginTypeQuery[0] : loginTypeQuery;
      if (!isClientPersona(selectedPersona) || !hasClientPersona(claims.roles ?? [], selectedPersona)) {
        throw new Error('所选登录身份与账号权限不匹配，请返回登录页重新选择');
      }
      setActiveClientPersona(selectedPersona);
      const userInfo = normalizeUserInfo({ avatar: '', homePath: claims.home_path, realName: claims.name ?? claims.preferred_username ?? '', roles: claims.roles ?? [], userId: claims.sub ?? '', username: claims.preferred_username ?? '' } as UserInfo);
      accessStore.setAccessToken(accessToken);
      userStore.setUserInfo(userInfo);
      accessStore.setAccessCodes(claims.permissions ?? []);
      accessStore.setLoginExpired(false);
      if (selectedPersona === 'enterprise') await clientEnterpriseStore.refreshContext().catch(() => {});
      await router.replace(getPersonaHomePath(selectedPersona) || resolveClientHomePath(redirect || userInfo.homePath));
    } finally { loginLoading.value = false; }
  }

  async function logout(redirect: boolean = true) {
    try {
      if (isIamAuthEnabled()) {
        await logoutIamSession();
      } else {
        await logoutApi();
      }
    } catch {
      // ignore
    }
    resetAllStores();
    accessStore.setLoginExpired(false);

    await router.replace({
      path: LOGIN_PATH,
      query: redirect
        ? {
            redirect: encodeURIComponent(router.currentRoute.value.fullPath),
          }
        : {},
    });
  }

  async function fetchUserInfo() {
    const userInfo = await getUserInfoApi();
    userStore.setUserInfo(normalizeUserInfo(userInfo));
    if (getActiveClientPersona() === 'enterprise') await clientEnterpriseStore.refreshContext().catch(() => {});
    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
  }

  function resolveClientHomePath(redirectOverride?: string) {
    const redirect = redirectOverride ?? router.currentRoute.value.query?.redirect;
    const rawPath = Array.isArray(redirect) ? redirect[0] : redirect;
    return resolveHomePath(rawPath);
  }

  return {
    $reset,
    authLogin,
    completeIamLogin,
    fetchUserInfo,
    loginLoading,
    logout,
  };
});
