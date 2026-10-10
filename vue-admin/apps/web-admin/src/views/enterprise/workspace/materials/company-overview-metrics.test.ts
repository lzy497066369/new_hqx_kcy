import { describe, expect, it } from 'vitest';

import { getCompanyOverviewMetricTarget } from './company-overview-metrics';

describe('company overview metric targets', () => {
  it('opens material completeness metrics in the material ledger', () => {
    expect(getCompanyOverviewMetricTarget('health')).toEqual({
      section: 'company',
      type: 'materials',
    });
    expect(getCompanyOverviewMetricTarget('attachments')).toEqual({
      section: 'company',
      type: 'materials',
    });
  });

  it('opens active declarations in declaration management', () => {
    expect(getCompanyOverviewMetricTarget('declarations')).toEqual({
      type: 'declarations',
    });
  });
});
