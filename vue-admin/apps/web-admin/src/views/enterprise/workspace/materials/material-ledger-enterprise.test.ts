import { describe, expect, it } from 'vitest';

import { resolveMaterialLedgerEnterpriseId } from './material-ledger-enterprise';

describe('material ledger enterprise selection', () => {
  it('uses the enterprise selected in a material ledger URL when it is visible', () => {
    expect(
      resolveMaterialLedgerEnterpriseId(['enterprise-a', 'enterprise-b'], 'enterprise-b'),
    ).toBe('enterprise-b');
  });

  it('falls back to the first visible enterprise for an invalid URL value', () => {
    expect(
      resolveMaterialLedgerEnterpriseId(['enterprise-a', 'enterprise-b'], 'enterprise-x'),
    ).toBe('enterprise-a');
  });

  it('uses the shared enterprise context when the route has no visible enterprise', () => {
    expect(
      resolveMaterialLedgerEnterpriseId(
        ['enterprise-a', 'enterprise-b'],
        undefined,
        'enterprise-b',
      ),
    ).toBe('enterprise-b');
  });
});
