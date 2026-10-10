export interface AccountLedgerSummary {
  disabled: number;
  enabled: number;
  total: number;
}

export function summarizeAccountLedger(
  records: Array<Record<string, unknown>>,
): AccountLedgerSummary {
  return records.reduce<AccountLedgerSummary>(
    (summary, record) => ({
      disabled: summary.disabled + (record.zhStatus === 0 || record.zhStatus === '0' ? 1 : 0),
      enabled: summary.enabled + (record.zhStatus === 1 || record.zhStatus === '1' ? 1 : 0),
      total: summary.total + 1,
    }),
    { disabled: 0, enabled: 0, total: 0 },
  );
}
