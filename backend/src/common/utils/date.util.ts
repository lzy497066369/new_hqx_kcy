const OFFSET_HOURS = 8;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDateTimeInBjt(value: Date | string | number): string {
  const date = new Date(value);
  const localDate = new Date(date.getTime() + OFFSET_HOURS * 60 * 60 * 1000);

  return `${localDate.getUTCFullYear()}-${pad(localDate.getUTCMonth() + 1)}-${pad(
    localDate.getUTCDate(),
  )} ${pad(localDate.getUTCHours())}:${pad(localDate.getUTCMinutes())}:${pad(
    localDate.getUTCSeconds(),
  )}`;
}