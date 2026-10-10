import { describe, expect, it } from 'vitest';

import { getEnterpriseActionTarget } from './enterprise-action-target';

describe('enterprise action targets', () => {
  it('maps profile, declaration and evidence actions into the primary management pages', () => {
    expect(getEnterpriseActionTarget('profile-status')).toEqual({
      section: 'basic',
      type: 'materials',
    });
    expect(getEnterpriseActionTarget('declaration-rejected-declaration-1')).toEqual({
      declarationId: 'declaration-1',
      type: 'declarations',
    });
    expect(getEnterpriseActionTarget('rd-without-ip-1')).toEqual({
      section: 'intellectual_property',
      tab: 'evidence',
      type: 'materials',
    });
  });
});
