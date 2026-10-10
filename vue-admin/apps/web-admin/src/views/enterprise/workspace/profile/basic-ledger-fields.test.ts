import { describe, expect, it } from 'vitest';

import { basicLedgerFields } from './basic-ledger-fields';

describe('basic ledger field coverage', () => {
  it('keeps the client enterprise location fields in the material ledger form', () => {
    expect(basicLedgerFields).toEqual(['province', 'city', 'district']);
  });
});
