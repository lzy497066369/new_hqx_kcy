import type { HighTechProject } from '#/api/client/high-tech';

type Interval = { start: number; end: number };
const DAY = 86_400_000;

function projectGroups(rows: HighTechProject[]) {
  const years = new Map<number, Map<string, HighTechProject[]>>();
  for (const row of rows) {
    const year = row.year;
    if (year === null || !Number.isInteger(year) || year < 1900 || year > 2100) continue;
    let groups = years.get(year);
    if (!groups) years.set(year, (groups = new Map()));
    // An unfinished RD number must not merge unrelated input rows.
    const key = row.rdNumber.trim().toUpperCase() || row.id;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return years;
}

/** Accept both the old YYYY.MM ranges and full calendar dates without rewriting them. */
function parsePeriod(value: string): Interval | undefined {
  const normalized = value.trim().replace(/年|月/gu, '-').replace(/日/gu, '');
  const match = normalized.match(
    /^(\d{4})[-./](\d{1,2})(?:[-./](\d{1,2}))?-?\s*(?:至|到|—+|–|~|～|-)\s*(\d{4})[-./](\d{1,2})(?:[-./](\d{1,2}))?-?$/u,
  );
  if (!match) return;
  const endpoint = (offset: number, end: boolean) => {
    const year = Number(match[offset]);
    const month = Number(match[offset + 1]);
    if (year < 1900 || year > 2100 || month < 1 || month > 12) return NaN;
    const day = match[offset + 2]
      ? Number(match[offset + 2])
      : end ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 1;
    const timestamp = Date.UTC(year, month - 1, day);
    const date = new Date(timestamp);
    return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? timestamp : NaN;
  };
  const start = endpoint(1, false);
  const end = endpoint(4, true);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return;
  return { start, end };
}

function uncovered(year: number, rows: HighTechProject[]): Interval[] {
  const last = Date.UTC(year, 11, 31);
  let cursor = Date.UTC(year, 0, 1);
  const intervals = rows.flatMap((row) => {
    const period = parsePeriod(row.researchPeriod);
    return period ? [period] : [];
  }).sort((a, b) => a.start - b.start);
  const gaps: Interval[] = [];
  for (const interval of intervals) {
    if (interval.end < cursor || interval.start > last) continue;
    if (interval.start > cursor) gaps.push({ start: cursor, end: interval.start - DAY });
    cursor = Math.max(cursor, interval.end + DAY);
    if (cursor > last) break;
  }
  if (cursor <= last) gaps.push({ start: cursor, end: last });
  return gaps;
}

function formatPeriod(year: number, startMonth: number, endMonth: number) {
  const start = new Date(Date.UTC(year, startMonth - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, endMonth, 0)).toISOString().slice(0, 10);
  return `${start}—${end}`;
}

/** Fill blanks only. Existing nonblank values, including unrecognized text, are immutable here. */
export function assignMissingResearchPeriods(rows: HighTechProject[]): boolean {
  let changed = false;
  const fill = (group: HighTechProject[], period: string) => {
    for (const row of group) {
      if (row.researchPeriod.trim()) continue;
      row.researchPeriod = period;
      changed = true;
    }
  };
  for (const [year, groups] of projectGroups(rows)) {
    const pending: HighTechProject[][] = [];
    for (const group of groups.values()) {
      const existing = group.find((row) => row.researchPeriod.trim());
      if (existing) fill(group, existing.researchPeriod);
      else pending.push(group);
    }
    if (!pending.length) continue;
    const yearRows = [...groups.values()].flat();
    for (const [index, group] of pending.entries()) {
      let startMonth = pending.length > 1 ? 1 + Math.round(index * 4 / (pending.length - 1)) : 1;
      let endMonth = startMonth + 7;
      if (pending.length === 1) {
        // A single blank project must bridge every remaining gap, including day-level gaps.
        const gaps = uncovered(year, yearRows);
        const first = gaps[0];
        const last = gaps.at(-1);
        if (first && last) {
          startMonth = new Date(first.start).getUTCMonth() + 1;
          endMonth = new Date(last.end).getUTCMonth() + 1;
          startMonth = Math.min(startMonth, 5);
          endMonth = Math.max(endMonth, startMonth + 7);
        }
        if (groups.size === 1) { startMonth = 1; endMonth = 12; }
      }
      fill(group, formatPeriod(year, startMonth, endMonth));
    }
  }
  return changed;
}

export function researchPeriodWarnings(rows: HighTechProject[]): string[] {
  const warnings: string[] = [];
  for (const [year, groups] of projectGroups(rows)) {
    const yearRows = [...groups.values()].flat();
    const invalid = yearRows.some((row) => row.researchPeriod.trim() && !parsePeriod(row.researchPeriod));
    if (invalid) warnings.push(`${year}年有研发周期格式无法识别，无法确认全年覆盖，请核对；已填写时间保持不变。`);
    else if (uncovered(year, yearRows).length) warnings.push(`${year}年研发周期尚未连续覆盖1月1日至12月31日，请核对；已填写时间保持不变。`);
    if (yearRows.some((row) => {
      const period = parsePeriod(row.researchPeriod);
      return period && (period.start < Date.UTC(year, 0, 1) || period.end > Date.UTC(year, 11, 31));
    })) warnings.push(`${year}年有研发周期超出项目所属年份，请核对；已填写时间保持不变。`);
    if ([...groups.values()].some((group) => new Set(group.map((row) => row.researchPeriod.trim()).filter(Boolean)).size > 1)) {
      warnings.push(`${year}年同一RD的关联记录存在不同研发周期，请核对；已填写时间保持不变。`);
    }
  }
  return warnings;
}
