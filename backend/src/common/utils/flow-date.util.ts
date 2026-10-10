const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/u;

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  return month >= 1
    && month <= 12
    && day >= 1
    && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Parses a fixed flow window date in Beijing time when an offset is omitted. */
export function parseFlowDate(value: unknown, endOfDay = false): Date | null {
  if (typeof value !== 'string') return null;

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(value);
  if (dateOnlyMatch) {
    const [year, month, day] = dateOnlyMatch.slice(1).map(Number);
    if (!isValidCalendarDate(year, month, day)) return null;
    const time = endOfDay ? '23:59:59' : '00:00:00';
    return new Date(`${value}T${time}+08:00`);
  }

  const dateTimeMatch = DATE_TIME_PATTERN.exec(value);
  if (!dateTimeMatch) return null;
  const [year, month, day, hour, minute, second = '0', timezone] = dateTimeMatch.slice(1);
  if (
    !isValidCalendarDate(Number(year), Number(month), Number(day))
    || Number(hour) > 23
    || Number(minute) > 59
    || Number(second) > 59
  ) {
    return null;
  }

  const date = new Date(timezone ? value : `${value}+08:00`);
  return Number.isNaN(date.valueOf()) ? null : date;
}

/** Normalizes dates returned by the database, including MySQL DATE strings. */
export function normalizeFlowDate(value: unknown, endOfDay = false): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? null : value;
  }

  return parseFlowDate(value, endOfDay);
}
