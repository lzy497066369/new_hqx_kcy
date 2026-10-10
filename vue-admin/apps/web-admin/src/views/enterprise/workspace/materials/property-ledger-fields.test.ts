import { describe, expect, it } from 'vitest';

import { propertyLedgerFields } from './property-ledger-fields';

describe('property ledger field coverage', () => {
  it('keeps the client IP scoring, attachment and evidence-link fields', () => {
    expect(propertyLedgerFields.ip).toEqual([
      'ipLevel',
      'advancedDegree',
      'supportEffect',
      'softWorkFile',
      'relatedRdIds',
      'relatedPsIds',
      'relatedTransformationIds',
    ]);
  });

  it('keeps the client RD, PS and transformation evidence fields', () => {
    expect(propertyLedgerFields.rd).toEqual([
      'lxbgFile',
      'relatedIpIds',
      'relatedPsIds',
      'relatedTransformationIds',
    ]);
    expect(propertyLedgerFields.ps).toEqual([
      'psCode',
      'proofFiles',
      'relatedIpIds',
      'relatedRdIds',
      'relatedTransformationIds',
      'relatedContractIds',
      'relatedInvoiceIds',
    ]);
    expect(propertyLedgerFields.transformation).toEqual([
      'proofFiles',
      'relatedIpIds',
      'relatedRdIds',
      'relatedPsIds',
      'relatedContractIds',
      'relatedInvoiceIds',
    ]);
  });
});
