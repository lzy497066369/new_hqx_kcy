import { describe, expect, it } from 'vitest';

import { getEnterpriseRiskTarget } from './enterprise-risk-target';

describe('enterprise risk targets', () => {
  it('opens profile risks in the material ledger', () => {
    expect(getEnterpriseRiskTarget('profile-status')).toEqual({
      section: 'basic',
      type: 'materials',
    });
    expect(getEnterpriseRiskTarget('profile-completeness')).toEqual({
      section: 'company',
      type: 'materials',
    });
  });

  it('opens declaration risks in enterprise declaration management', () => {
    expect(getEnterpriseRiskTarget('declaration-material-12')).toEqual({
      declarationId: '12',
      type: 'declarations',
    });
  });

  it('opens evidence chain risks in the evidence ledger tab', () => {
    expect(getEnterpriseRiskTarget('evidence-chain-breaks')).toEqual({
      section: 'intellectual_property',
      tab: 'evidence',
      type: 'materials',
    });
  });
});
