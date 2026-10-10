import { describe, expect, it } from 'vitest';

import { createCompanyOverviewIndicators } from './company-overview-indicators';

describe('company overview indicators', () => {
  it('opens each high-tech metric in its matching material ledger tab', () => {
    expect(
      createCompanyOverviewIndicators({
        financialYears: 3,
        intellectualPropertyCount: 4,
        productServiceCount: 5,
        researchEmployeeCount: 6,
        researchProjectCount: 7,
        transformationCount: 8,
      }).map((item) => item.target),
    ).toEqual([
      { section: 'finance', tab: 'financial' },
      { section: 'employee' },
      { section: 'intellectual_property', tab: 'ip' },
      { section: 'intellectual_property', tab: 'rd' },
      { section: 'intellectual_property', tab: 'ps' },
      { section: 'intellectual_property', tab: 'transformation' },
    ]);
  });
});
