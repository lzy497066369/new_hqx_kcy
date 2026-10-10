import { computed, ref, shallowRef } from 'vue';

import { defineStore } from 'pinia';

import {
  getClientCompaniesApi,
  getClientEnterpriseProfileApi,
  getClientMeApi,
  getCurrentClientCompanyApi,
  switchCurrentClientCompanyApi,
  updateClientEnterpriseProfileApi,
  updateClientMeApi,
} from '#/api/client';
import type {
  ClientAccountApi,
  ClientCompanyApi,
  ClientEnterpriseApi,
} from '#/api/client';

export const useClientEnterpriseStore = defineStore('client-enterprise', () => {
  const me = ref<ClientAccountApi.ClientMe>();
  const companies = ref<ClientCompanyApi.ClientCompany[]>([]);
  const currentCompany = ref<ClientCompanyApi.ClientCompany>();
  const enterpriseProfile = ref<ClientEnterpriseApi.ClientEnterpriseProfile>();
  const loading = shallowRef(false);
  const switching = shallowRef(false);
  const initialized = shallowRef(false);
  const errorMessage = shallowRef('');

  const hasCompanies = computed(() => companies.value.length > 0);
  const currentCompanyId = computed(() => currentCompany.value?.id ?? '');
  const currentCompanyName = computed(
    () =>
      currentCompany.value?.shortName ??
      currentCompany.value?.name ??
      enterpriseProfile.value?.shortName ??
      enterpriseProfile.value?.name ??
      '',
  );

  async function refreshContext() {
    loading.value = true;
    errorMessage.value = '';
    try {
      const [nextMe, nextCompanies, nextCurrentCompany] = await Promise.all([
        getClientMeApi(),
        getClientCompaniesApi(),
        getCurrentClientCompanyApi(),
      ]);

      me.value = nextMe;
      companies.value = nextCompanies;
      currentCompany.value =
        nextCurrentCompany ??
        nextCompanies.find((company) => company.isCurrent) ??
        nextCompanies.find((company) => company.isDefault) ??
        nextCompanies[0];

      await refreshEnterpriseProfile();
      initialized.value = true;
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : '客户端企业上下文加载失败';
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function refreshEnterpriseProfile() {
    if (!currentCompany.value) {
      enterpriseProfile.value = undefined;
      return;
    }

    enterpriseProfile.value = await getClientEnterpriseProfileApi();
  }

  async function switchCompany(companyId: string) {
    if (!companyId || companyId === currentCompanyId.value) {
      return;
    }

    switching.value = true;
    errorMessage.value = '';
    try {
      const nextCompany = await switchCurrentClientCompanyApi({ companyId });
      currentCompany.value =
        nextCompany ?? companies.value.find((company) => company.id === companyId);
      companies.value = companies.value.map((company) => ({
        ...company,
        isCurrent: company.id === companyId,
        isDefault: company.id === companyId,
      }));
      await refreshEnterpriseProfile();
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : '当前企业切换失败';
      throw error;
    } finally {
      switching.value = false;
    }
  }

  async function updateMe(data: ClientAccountApi.UpdateClientMeParams) {
    const nextMe = await updateClientMeApi(data);
    me.value = nextMe;
    return nextMe;
  }

  async function updateEnterpriseProfile(
    data: ClientEnterpriseApi.UpdateClientEnterpriseProfileParams,
  ) {
    const nextProfile = await updateClientEnterpriseProfileApi(data);
    enterpriseProfile.value = nextProfile;
    if (currentCompany.value && nextProfile.name) {
      currentCompany.value = {
        ...currentCompany.value,
        creditCode: nextProfile.creditCode,
        name: nextProfile.name,
        profileStatus: nextProfile.profileStatus,
        shortName: nextProfile.shortName,
        status: nextProfile.status,
      };
    }
    return nextProfile;
  }

  function $reset() {
    me.value = undefined;
    companies.value = [];
    currentCompany.value = undefined;
    enterpriseProfile.value = undefined;
    loading.value = false;
    switching.value = false;
    initialized.value = false;
    errorMessage.value = '';
  }

  return {
    $reset,
    companies,
    currentCompany,
    currentCompanyId,
    currentCompanyName,
    enterpriseProfile,
    errorMessage,
    hasCompanies,
    initialized,
    loading,
    me,
    refreshContext,
    refreshEnterpriseProfile,
    switchCompany,
    switching,
    updateEnterpriseProfile,
    updateMe,
  };
});
