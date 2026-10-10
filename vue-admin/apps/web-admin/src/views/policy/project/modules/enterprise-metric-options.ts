import type { EnterpriseMetricKey } from './declaration-scheme-types';

import { enterpriseMetricCatalog } from './enterprise-metric-catalog';

export const enterpriseMetricOptions: Array<{ label: string; value: EnterpriseMetricKey }> = [
  ...enterpriseMetricCatalog.map((item) => ({
    label: `${item.label}（${item.unit}）`,
    value: item.key,
  })),
];
