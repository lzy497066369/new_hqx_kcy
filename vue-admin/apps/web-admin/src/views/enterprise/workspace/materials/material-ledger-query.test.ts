import { describe, expect, it } from 'vitest';

import { resolveMaterialLedgerTab } from './material-ledger-query';

describe('material ledger query', () => {
  it('accepts a tab only when it belongs to the target material section', () => {
    expect(resolveMaterialLedgerTab('intellectual_property', 'rd')).toBe('rd');
    expect(resolveMaterialLedgerTab('finance', 'rd')).toBeUndefined();
  });
});
