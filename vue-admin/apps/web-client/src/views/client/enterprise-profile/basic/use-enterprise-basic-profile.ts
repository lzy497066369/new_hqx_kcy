import type { useClientEnterpriseStore } from '#/store';

import { computed, ref, shallowRef, watch } from 'vue';

import { message } from 'antdv-next';

import {
  getClientEnterpriseBasicProfileApi,
  updateClientEnterpriseBasicProfileApi,
} from '#/api/client';

import {
  cloneEnterpriseBasicProfile,
  createEnterpriseBasicSavePayload,
  getEnterpriseBasicCompleteness,
  mapEnterpriseProfileToBasicProfile,
} from './profile-helpers';

type ClientEnterpriseStore = ReturnType<typeof useClientEnterpriseStore>;

export function useEnterpriseBasicProfile(store: ClientEnterpriseStore) {
  const form = ref(cloneEnterpriseBasicProfile());
  const shareholders = ref(form.value.shareholders ?? []);
  const loading = shallowRef(false);
  const saving = shallowRef(false);
  const remoteState = shallowRef<'idle' | 'synced' | 'unavailable'>('idle');
  const remoteHint = shallowRef('');

  const localBaseline = ref(cloneEnterpriseBasicProfile());

  const completeness = computed(() =>
    getEnterpriseBasicCompleteness(form.value),
  );

  function applyProfile(nextProfile = cloneEnterpriseBasicProfile()) {
    const normalizedProfile = cloneEnterpriseBasicProfile(nextProfile);

    form.value = {
      ...normalizedProfile,
      shareholders: [],
    };
    shareholders.value = normalizedProfile.shareholders ?? [];
    localBaseline.value = cloneEnterpriseBasicProfile(normalizedProfile);
  }

  function hydrateFromStore() {
    applyProfile(mapEnterpriseProfileToBasicProfile(store.enterpriseProfile));
    remoteState.value = 'idle';
    remoteHint.value = '';
  }

  async function refreshRemoteProfile() {
    if (!store.currentCompany) {
      return;
    }

    loading.value = true;
    remoteHint.value = '';
    try {
      const remoteProfile = await getClientEnterpriseBasicProfileApi();
      applyProfile(remoteProfile);
      remoteState.value = 'synced';
    } catch (error) {
      remoteState.value = 'unavailable';
      remoteHint.value =
        error instanceof Error && error.message
          ? error.message
          : '基础资料加载失败，请稍后重试。';
    } finally {
      loading.value = false;
    }
  }

  async function saveProfile() {
    saving.value = true;
    remoteHint.value = '';

    try {
      const nextProfile = await updateClientEnterpriseBasicProfileApi(
        createEnterpriseBasicSavePayload(form.value, shareholders.value),
      );

      applyProfile(nextProfile);
      remoteState.value = 'synced';
      message.success('基础资料已保存');
      await store.refreshEnterpriseProfile().catch(() => {});
    } finally {
      saving.value = false;
    }
  }

  function resetProfile() {
    applyProfile(localBaseline.value);
  }

  watch(
    () => [store.currentCompanyId, store.enterpriseProfile] as const,
    () => {
      hydrateFromStore();
    },
    { immediate: true },
  );

  return {
    completeness,
    form,
    loading,
    refreshRemoteProfile,
    remoteHint,
    remoteState,
    resetProfile,
    saveProfile,
    saving,
    shareholders,
  };
}
