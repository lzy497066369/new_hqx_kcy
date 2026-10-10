import { describe, expect, it } from 'vitest';

import { resolveFinanceTab } from './finance-tab';

describe('finance ledger tabs', () => {
  it('opens the tax audit tab from a material navigation query', () => {
    expect(resolveFinanceTab('taxAudit')).toBe('taxAudit');
  });

  it('falls back to the financial tab for an unknown query', () => {
    expect(resolveFinanceTab('unknown')).toBe('financial');
    expect(resolveFinanceTab(undefined)).toBe('financial');
  });
});
