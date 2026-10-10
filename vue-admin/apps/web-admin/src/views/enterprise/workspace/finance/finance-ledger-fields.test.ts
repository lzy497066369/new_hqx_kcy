import { describe, expect, it } from 'vitest';

import { financeLedgerFields } from './finance-ledger-fields';

describe('finance ledger field coverage', () => {
  it('keeps the client financial income, quarter and research expense fields', () => {
    expect(financeLedgerFields).toEqual([
      'q',
      'xxsr',
      'remark',
      'rdPersonnelCost',
      'rdDirectInput',
      'rdDepreciation',
      'rdIntangibleAmortization',
      'rdDesignFee',
      'rdEquipmentDebuggingFee',
      'rdEntrustedDevelopment',
      'rdOtherExpense',
    ]);
  });
});
