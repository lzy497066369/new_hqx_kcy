export type FinanceTab = 'financial' | 'taxAudit';

const financeTabs: readonly FinanceTab[] = ['financial', 'taxAudit'];

export function resolveFinanceTab(value: unknown): FinanceTab {
  return financeTabs.includes(value as FinanceTab)
    ? (value as FinanceTab)
    : 'financial';
}
