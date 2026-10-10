import { computed, shallowRef } from 'vue';

import { defineStore } from 'pinia';

import { getCurrentClientCompanyApi } from '#/api';
import type { ClientCompany } from '#/api';

export const useClientContextStore = defineStore('client-context', () => {
  const currentCompany = shallowRef<ClientCompany | null>(null);

  const companyDisplayName = computed(() => {
    const company = currentCompany.value;
    return company?.shortName || company?.name || '';
  });

  async function loadCurrentCompany() {
    try {
      currentCompany.value = await getCurrentClientCompanyApi();
    } catch {
      currentCompany.value = null;
    }

    return currentCompany.value;
  }

  function clearCurrentCompany() {
    currentCompany.value = null;
  }

  function $reset() {
    clearCurrentCompany();
  }

  return {
    $reset,
    clearCurrentCompany,
    companyDisplayName,
    currentCompany,
    loadCurrentCompany,
  };
});
