import type { Recordable, UserInfo } from '@vben/types';

import { shallowRef } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'antdv-next';
import { defineStore } from 'pinia';

import { getAccessCodesApi, getUserInfoApi, loginApi, logoutApi } from '#/api';
import { normalizeHomePath } from '#/router/home-path';

function normalizeUserInfo(userInfo: UserInfo) {
  const resolvedUserId = userInfo.userId ?? (userInfo as UserInfo & { id?: string | number }).id;
  return {
    ...userInfo,
    avatar: userInfo.avatar ?? '',
    userId: String(resolvedUserId ?? ''),
  };
}

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();
  const loginLoading = shallowRef(false);

  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;
      const { accessToken } = await loginApi(params);
      if (!accessToken) {
        return { userInfo };
      }

      accessStore.setAccessToken(accessToken);
      const [resolvedUserInfo, accessCodes] = await Promise.all([
        fetchUserInfo(),
        getAccessCodesApi(),
      ]);
      userInfo = resolvedUserInfo;
      accessStore.setAccessCodes(accessCodes);
      accessStore.setLoginExpired(false);

      if (onSuccess) {
        await onSuccess();
      } else {
        await router.push(normalizeHomePath(userInfo.homePath));
      }

      notification.success({
        description: userInfo.realName,
        duration: 3,
        title: '登录成功',
      });
    } finally {
      loginLoading.value = false;
    }

    return { userInfo };
  }

  async function logout(redirect: boolean = true) {
    try {
      await logoutApi();
    } catch {
      // The local state must still be cleared after an expired backend session.
    }
    resetAllStores();
    accessStore.setLoginExpired(false);
    await router.replace({
      path: LOGIN_PATH,
      query: redirect
        ? { redirect: encodeURIComponent(router.currentRoute.value.fullPath) }
        : {},
    });
  }

  async function fetchUserInfo() {
    const userInfo = await getUserInfoApi();
    userStore.setUserInfo(normalizeUserInfo(userInfo));
    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    fetchUserInfo,
    loginLoading,
    logout,
  };
});
