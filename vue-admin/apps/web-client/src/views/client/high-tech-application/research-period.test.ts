import { describe, expect, it } from 'vitest';
import { newProject } from './model';
import { assignMissingResearchPeriods, researchPeriodWarnings } from './research-period';

function projects(count: number, year = 2023) {
  const rows: ReturnType<typeof newProject>[] = [];
  for (let index = 0; index < count; index++) rows.push(newProject(rows, year));
  return rows;
}

function expectFullYear(rows: ReturnType<typeof projects>, year: number) {
  const ranges = rows.map((row) => row.researchPeriod.split('—').map((date) => Date.parse(`${date}T00:00:00Z`)));
  for (let day = Date.UTC(year, 0, 1); day <= Date.UTC(year, 11, 31); day += 86_400_000) {
    expect(ranges.some(([start, end]) => start! <= day && day <= end!), new Date(day).toISOString()).toBe(true);
  }
  expect(researchPeriodWarnings(rows)).toEqual([]);
}

describe('automatic research periods', () => {
  it.each([2023, 2024, 1900, 2000, 2100])('covers every day in %i with one project', (year) => {
    const rows = projects(1, year);
    expect(assignMissingResearchPeriods(rows)).toBe(true);
    expect(rows[0]!.researchPeriod).toBe(`${year}-01-01—${year}-12-31`);
    expectFullYear(rows, year);
  });
  it.each([2, 3, 4, 5, 8, 12, 200])('uses eight-month periods covering all days for %i projects', (count) => {
    const rows = projects(count, 2024);
    assignMissingResearchPeriods(rows);
    for (const row of rows) {
      const [start, end] = row.researchPeriod.split('—').map((date) => new Date(`${date}T00:00:00Z`));
      expect(end!.getUTCMonth() - start!.getUTCMonth() + 1).toBe(8);
      expect(start!.getUTCFullYear()).toBe(2024);
      expect(end!.getUTCFullYear()).toBe(2024);
    }
    expectFullYear(rows, 2024);
  });
  it('distributes separate years independently and is idempotent', () => {
    const rows = [...projects(2, 2023), ...projects(1, 2024)];
    assignMissingResearchPeriods(rows);
    expect(rows.map((row) => row.researchPeriod)).toEqual([
      '2023-01-01—2023-08-31', '2023-05-01—2023-12-31', '2024-01-01—2024-12-31',
    ]);
    expect(assignMissingResearchPeriods(rows)).toBe(false);
  });
  it.each([
    ['2023.01—2023.08', '2023-05-01—2023-12-31'],
    ['2023-05-01 至 2023-12-31', '2023-01-01—2023-08-31'],
    ['2023年5月1日到2023年8月31日', '2023-01-01—2023-12-31'],
    ['2023年1月—2023年8月', '2023-05-01—2023-12-31'],
    ['2023/1/1~2023/8/31', '2023-05-01—2023-12-31'],
    ['2023-01-01-2023-08-31', '2023-05-01—2023-12-31'],
    ['2023-01-02—2023-12-31', '2023-01-01—2023-08-31'],
  ])('preserves %s while filling the remaining gap', (existing, expected) => {
    const rows = projects(2);
    rows[0]!.researchPeriod = existing;
    assignMissingResearchPeriods(rows);
    expect(rows[0]!.researchPeriod).toBe(existing);
    expect(rows[1]!.researchPeriod).toBe(expected);
    expect(researchPeriodWarnings(rows)).toEqual([]);
  });
  it('fills an interior gap on a leap day', () => {
    const rows = projects(3, 2024);
    rows[0]!.researchPeriod = '2024-01-01—2024-02-28';
    rows[1]!.researchPeriod = '2024-03-01—2024-12-31';
    assignMissingResearchPeriods(rows);
    expectFullYear(rows, 2024);
  });
  it('counts duplicate RD associations once and reuses an existing period verbatim', () => {
    const rows = projects(2);
    rows[1]!.rdNumber = rows[0]!.rdNumber;
    assignMissingResearchPeriods(rows);
    expect(rows.map((row) => row.researchPeriod)).toEqual(['2023-01-01—2023-12-31', '2023-01-01—2023-12-31']);
    rows[0]!.researchPeriod = ' 2023.02—2023.09 ';
    rows[1]!.researchPeriod = '';
    assignMissingResearchPeriods(rows);
    expect(rows[1]!.researchPeriod).toBe(' 2023.02—2023.09 ');
    expect(researchPeriodWarnings(rows).join()).toContain('尚未连续覆盖');
  });
  it('reports gaps, invalid dates, wrong years and conflicts without rewriting supplied values', () => {
    const rows = projects(2);
    rows[0]!.researchPeriod = '2023-01-01—2023-02-28';
    rows[1]!.researchPeriod = '2023-03-02—2023-12-31';
    const snapshot = JSON.stringify(rows);
    expect(assignMissingResearchPeriods(rows)).toBe(false);
    expect(researchPeriodWarnings(rows).join()).toContain('尚未连续覆盖');
    expect(JSON.stringify(rows)).toBe(snapshot);
    rows[0]!.researchPeriod = '2023-02-29—2023-12-31';
    expect(researchPeriodWarnings(rows).join()).toContain('无法识别');
    rows[0]!.researchPeriod = '2022.01—2023.12';
    expect(researchPeriodWarnings(rows).join()).toContain('超出项目所属年份');
    rows[1]!.rdNumber = rows[0]!.rdNumber;
    expect(researchPeriodWarnings(rows).join()).toContain('同一RD');
  });
  it('does not overwrite unrecognized text and leaves invalid years for normal form validation', () => {
    const rows = projects(3);
    rows[0]!.researchPeriod = '原有时间待核对';
    rows[1]!.year = null;
    rows[2]!.year = 2023.5;
    const snapshot = JSON.stringify(rows);
    expect(assignMissingResearchPeriods(rows)).toBe(false);
    expect(JSON.stringify(rows)).toBe(snapshot);
    expect(researchPeriodWarnings(rows).join()).toContain('无法识别');
  });
});
