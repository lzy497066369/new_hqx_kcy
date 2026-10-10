import type { HighTechProject } from '#/api/client/high-tech';
import { DEFAULT_PROJECT_BRANCH_COUNT, newProject, newProjectBranches } from './model';
import { assignMissingResearchPeriods } from './research-period';

export const SHARED_PROJECT_FIELDS = ['rdNumber', 'year', 'activityName', 'researchPeriod'] as const;
export type SharedProjectField = (typeof SHARED_PROJECT_FIELDS)[number];
export const PROJECT_ROW_LIMIT = 200;

export function groupProjectRows(rows: HighTechProject[]): HighTechProject[][] {
  const groups = new Map<string, HighTechProject[]>();
  for (const row of rows) {
    const key = row.rdNumber.trim().toUpperCase() || row.id;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Keep branches adjacent and number projects/achievements in visible order. */
export function normalizeProjectRows(rows: HighTechProject[]): boolean {
  const groups = groupProjectRows(rows);
  const ordered = groups.flat();
  let changed = ordered.some((row, index) => row !== rows[index]);
  let achievement = 0;
  groups.forEach((group, index) => {
    const rdNumber = `RD${String(index + 1).padStart(2, '0')}`;
    group.forEach((row) => {
      const achievementNumber = `成果${String(++achievement).padStart(2, '0')}`;
      changed ||= row.rdNumber !== rdNumber || row.achievementNumber !== achievementNumber;
      row.rdNumber = rdNumber;
      row.achievementNumber = achievementNumber;
    });
  });
  if (changed) rows.splice(0, rows.length, ...ordered);
  return changed;
}

export function projectRowSpan(group: HighTechProject[], row: HighTechProject, field: SharedProjectField) {
  // Never hide conflicting historical data behind the first row's value.
  if (group.some((item) => item[field] !== group[0]![field])) return 1;
  return group[0]?.id === row.id ? group.length : 0;
}

export function projectGroupWarnings(groups: HighTechProject[][]): string[] {
  const labels = { year: '年份', activityName: '研发活动名称', researchPeriod: '研发周期' };
  return groups.flatMap((group) => {
    const conflicts = (['year', 'activityName', 'researchPeriod'] as const)
      .filter((field) => group.some((row) => row[field] !== group[0]![field]));
    return conflicts.length
      ? [`${group[0]!.rdNumber}的${conflicts.map((field) => labels[field]).join('、')}不一致，暂不合并这些字段，原值已保留；修改其中一条会同步至该RD全部分支。`]
      : [];
  });
}

export function insertProjectRow(rows: HighTechProject[], afterId?: string, branch = false): HighTechProject | undefined {
  if (rows.length + (branch ? 1 : DEFAULT_PROJECT_BRANCH_COUNT) > PROJECT_ROW_LIMIT) return;
  const anchor = rows.find((row) => row.id === afterId);
  if ((afterId || branch) && !anchor) return;
  const createdRows = branch
    ? [newProject(rows, anchor?.year ?? undefined)]
    : newProjectBranches(rows, anchor?.year ?? undefined);
  const created = createdRows[0]!;
  let index = rows.length;
  if (anchor) {
    if (branch) {
      for (const field of SHARED_PROJECT_FIELDS) {
        if (field === 'year') created.year = anchor.year;
        else created[field] = anchor[field];
      }
      index = rows.indexOf(anchor) + 1;
    } else {
      for (const row of createdRows) row.year = anchor.year;
      const group = groupProjectRows(rows).find((items) => items.some((row) => row.id === anchor.id))!;
      index = rows.indexOf(group[group.length - 1]!) + 1;
    }
  }
  rows.splice(index, 0, ...createdRows);
  normalizeProjectRows(rows);
  assignMissingResearchPeriods(rows);
  return created;
}

export function deleteProjectRow(rows: HighTechProject[], id: string): boolean {
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return false;
  rows.splice(index, 1);
  normalizeProjectRows(rows);
  return true;
}

export function updateProjectRow(rows: HighTechProject[], id: string, field: Exclude<keyof HighTechProject, 'id'>, value?: number | string | null): boolean {
  if (field === 'rdNumber' || field === 'achievementNumber') return false;
  const row = rows.find((item) => item.id === id);
  if (!row) return false;
  const shared = SHARED_PROJECT_FIELDS.some((key) => key === field);
  const psNumber = row.psNumber.trim().toUpperCase();
  const targets = shared ? groupProjectRows(rows).find((group) => group.includes(row))!
    : field === 'psName' && psNumber ? rows.filter((item) => item.psNumber.trim().toUpperCase() === psNumber) : [row];
  const normalized = field === 'year'
    ? value === null || value === undefined || value === '' ? null : Number(value)
    : String(value ?? '');
  let changed = false;
  for (const target of targets) {
    if (target[field] === normalized) continue;
    if (field === 'year') target.year = normalized as number | null;
    else target[field] = normalized as string;
    changed = true;
  }
  return changed;
}
