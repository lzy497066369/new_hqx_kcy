export function formatFinanceAmount(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : String(value);
}
