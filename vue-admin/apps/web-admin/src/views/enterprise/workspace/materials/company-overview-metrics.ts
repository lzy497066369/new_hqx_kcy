import type { MaterialSectionKey } from './material-section';

export type CompanyOverviewMetricKey =
  | 'attachments'
  | 'completeness'
  | 'declarations'
  | 'health';

export type CompanyOverviewMetricTarget =
  | { type: 'declarations' }
  | { section: MaterialSectionKey; type: 'materials' };

export function getCompanyOverviewMetricTarget(
  key: CompanyOverviewMetricKey,
): CompanyOverviewMetricTarget {
  if (key === 'attachments') return { section: 'company', type: 'materials' };
  if (key === 'declarations') return { type: 'declarations' };
  return { section: 'company', type: 'materials' };
}
