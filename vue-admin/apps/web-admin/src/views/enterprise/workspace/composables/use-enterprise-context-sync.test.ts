import { nextTick, shallowRef } from 'vue';

import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import { useEnterpriseContextStore } from '#/store/enterprise-context';

import { useEnterpriseContextSync } from './use-enterprise-context-sync';

describe('enterprise route context sync', () => {
  it('writes a route enterprise id to the shared enterprise context', async () => {
    setActivePinia(createPinia());
    const enterpriseId = shallowRef('enterprise-a');

    useEnterpriseContextSync(enterpriseId);
    await nextTick();
    expect(useEnterpriseContextStore().currentEnterpriseId).toBe('enterprise-a');

    enterpriseId.value = 'enterprise-b';
    await nextTick();
    expect(useEnterpriseContextStore().currentEnterpriseId).toBe('enterprise-b');
  });
});
