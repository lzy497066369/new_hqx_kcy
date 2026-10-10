import { shallowRef } from 'vue';

import { defineStore } from 'pinia';

export interface EnterpriseContextValue {
  id: string;
  name?: string;
}

export type EnterpriseMaterialLedgerTabs = Record<string, string>;

/**
 * 后台企业服务相关页面共用的当前企业上下文。
 * 路由中显式传入的 enterpriseId 仍然优先，用于保留可分享、可回退的页面地址。
 */
export const useEnterpriseContextStore = defineStore('enterprise-context', () => {
  const currentEnterpriseId = shallowRef<string>();
  const currentEnterpriseName = shallowRef<string>();
  const materialLedgerTabs = shallowRef<EnterpriseMaterialLedgerTabs>({});

  function clearCurrentEnterprise() {
    currentEnterpriseId.value = undefined;
    currentEnterpriseName.value = undefined;
  }

  function getMaterialLedgerTab(section: string) {
    return materialLedgerTabs.value[section];
  }

  function setMaterialLedgerTab(section: string, tab?: string) {
    const nextTabs = { ...materialLedgerTabs.value };
    if (tab) nextTabs[section] = tab;
    else delete nextTabs[section];
    materialLedgerTabs.value = nextTabs;
  }

  function setCurrentEnterprise(enterprise?: EnterpriseContextValue | string) {
    const enterpriseId = typeof enterprise === 'string' ? enterprise : enterprise?.id;
    const enterpriseName = typeof enterprise === 'string' ? undefined : enterprise?.name;
    const changed = currentEnterpriseId.value !== enterpriseId;

    currentEnterpriseId.value = enterpriseId || undefined;
    currentEnterpriseName.value = enterpriseId
      ? (enterpriseName || (changed ? undefined : currentEnterpriseName.value))
      : undefined;
  }

  function $reset() {
    clearCurrentEnterprise();
    materialLedgerTabs.value = {};
  }

  return {
    $reset,
    clearCurrentEnterprise,
    currentEnterpriseId,
    currentEnterpriseName,
    getMaterialLedgerTab,
    materialLedgerTabs,
    setCurrentEnterprise,
    setMaterialLedgerTab,
  };
}, {
  persist: {
    pick: ['currentEnterpriseId', 'currentEnterpriseName', 'materialLedgerTabs'],
  },
});
