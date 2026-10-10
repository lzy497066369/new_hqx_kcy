import type { EnterpriseWorkspaceBasicProfileInput } from '#/api';

import { shallowRef, watch } from 'vue';
import {
  getEnterpriseWorkspaceBasicProfileApi,
  updateEnterpriseWorkspaceBasicProfileApi,
} from '#/api';

import { useEnterpriseContextStore } from '#/store';

export function useEnterpriseBasicProfile() {
  const enterpriseContextStore = useEnterpriseContextStore();
  const profile = shallowRef<EnterpriseWorkspaceBasicProfileInput>();
  const loading = shallowRef(false);
  const saving = shallowRef(false);

  function enterpriseId() {
    return enterpriseContextStore.currentEnterpriseId ?? '';
  }

  async function load() {
    const id = enterpriseId();
    if (!id) {
      profile.value = undefined;
      return;
    }

    loading.value = true;
    try {
      profile.value = await getEnterpriseWorkspaceBasicProfileApi(id);
    } finally {
      loading.value = false;
    }
  }

  async function save(data: EnterpriseWorkspaceBasicProfileInput) {
    const id = enterpriseId();
    saving.value = true;
    try {
      profile.value = await updateEnterpriseWorkspaceBasicProfileApi(id, data);
      return profile.value;
    } finally {
      saving.value = false;
    }
  }

  watch(
    () => enterpriseContextStore.currentEnterpriseId,
    () => void load(),
    { immediate: true },
  );

  return { loading, profile, save, saving };
}
