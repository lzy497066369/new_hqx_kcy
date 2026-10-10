import { describe, expect, it } from 'vitest';

import { isEnterpriseProfileIncomplete } from '../../../../../../../backend/src/modules/enterprise/profile/profile-completeness';

describe('enterprise profile completeness', () => {
  it('treats non-approved profiles as incomplete even when their material completeness is 100%', () => {
    expect(isEnterpriseProfileIncomplete('pending_review', 100)).toBe(true);
  });

  it('treats approved profiles below 100% material completeness as incomplete', () => {
    expect(isEnterpriseProfileIncomplete('approved', 99.99)).toBe(true);
  });

  it('treats approved profiles at 100% material completeness as complete', () => {
    expect(isEnterpriseProfileIncomplete('approved', 100)).toBe(false);
  });
});
