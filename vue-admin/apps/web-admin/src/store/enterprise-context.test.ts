import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useEnterpriseContextStore } from './enterprise-context';

describe('enterprise context store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('keeps the selected enterprise identity and display name together', () => {
    const store = useEnterpriseContextStore();

    store.setCurrentEnterprise({ id: 'enterprise-a', name: '企业 A' });

    expect(store.currentEnterpriseId).toBe('enterprise-a');
    expect(store.currentEnterpriseName).toBe('企业 A');
  });

  it('clears a stale display name when only a different enterprise id is known', () => {
    const store = useEnterpriseContextStore();
    store.setCurrentEnterprise({ id: 'enterprise-a', name: '企业 A' });

    store.setCurrentEnterprise('enterprise-b');

    expect(store.currentEnterpriseId).toBe('enterprise-b');
    expect(store.currentEnterpriseName).toBeUndefined();
  });

  it('keeps the selected material tabs outside of the route', () => {
    const store = useEnterpriseContextStore();

    store.setMaterialLedgerTab('intellectual_property', 'rd');

    expect(store.getMaterialLedgerTab('intellectual_property')).toBe('rd');
    expect(store.materialLedgerTabs).toEqual({ intellectual_property: 'rd' });
  });
});
