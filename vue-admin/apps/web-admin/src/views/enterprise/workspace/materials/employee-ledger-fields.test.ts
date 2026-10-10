import { describe, expect, it } from 'vitest';

import { employeeLedgerFields } from './employee-ledger-fields';

describe('employee ledger field coverage', () => {
  it('keeps the client employee identity, classification and attachment fields', () => {
    expect(employeeLedgerFields).toEqual([
      'ygSex',
      'ygLx',
      'ygNl',
      'ygWj',
      'ygLxgg',
      'ygQr',
      'ygFiles',
      'laborContractFile',
      'socialSecurityFile',
      'educationFile',
      'titleFile',
    ]);
  });
});
