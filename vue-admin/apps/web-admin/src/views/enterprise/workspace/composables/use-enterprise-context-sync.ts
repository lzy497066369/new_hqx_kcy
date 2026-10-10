import type { MaybeRefOrGetter } from 'vue';

import { toValue, watch } from 'vue';

import { useEnterpriseContextStore } from '#/store/enterprise-context';

/**
 * 将当前路由中的企业范围同步到后台统一企业上下文。
 * 路由参数仍是页面数据的唯一来源，避免全局状态覆盖可分享的链接。
 */
export function useEnterpriseContextSync(
  enterpriseId: MaybeRefOrGetter<string>,
) {
  const enterpriseContextStore = useEnterpriseContextStore();

  watch(
    () => toValue(enterpriseId),
    (currentEnterpriseId) => {
      if (currentEnterpriseId) {
        enterpriseContextStore.setCurrentEnterprise(currentEnterpriseId);
      }
    },
    { immediate: true },
  );
}
