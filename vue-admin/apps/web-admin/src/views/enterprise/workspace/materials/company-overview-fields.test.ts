import { describe, expect, it } from 'vitest';

import { companyOverviewFields } from './company-overview-fields';

describe('company overview field coverage', () => {
  it('keeps the client dashboard indicators, import reminders and recent operations', () => {
    expect(companyOverviewFields).toEqual([
      'highTechIndicators',
      'financeTrend',
      'recentMaterials',
      'recentOperations',
      'moduleStats',
      'completionActions',
    ]);
  });
});
