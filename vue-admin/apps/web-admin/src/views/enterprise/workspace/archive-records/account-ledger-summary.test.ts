import { describe, expect, it } from 'vitest';

import { summarizeAccountLedger } from './account-ledger-summary';

describe('account ledger summary', () => {
  it('summarizes total, enabled, and disabled enterprise accounts', () => {
    expect(
      summarizeAccountLedger([
        { zhStatus: 1 },
        { zhStatus: 0 },
        { zhStatus: 1 },
        { zhStatus: null },
      ]),
    ).toEqual({ disabled: 1, enabled: 2, total: 4 });
  });
});
