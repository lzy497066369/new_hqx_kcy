import { describe, expect, it } from 'vitest';
import { emptyDraft } from './model';
import { deleteProjectRow, groupProjectRows, insertProjectRow, normalizeProjectRows, projectGroupWarnings, projectRowSpan, SHARED_PROJECT_FIELDS, updateProjectRow } from './project-rows';

// Historical drafts may still contain one branch per RD.
function legacyRows() {
  return groupProjectRows(emptyDraft().projects).map((group) => group[0]!);
}

describe('RD projects and branches', () => {
  it('inserts independent RD after all branches, preserving IDs, periods and related fields', () => {
    const rows = legacyRows();
    const first = rows[0]!;
    const next = rows[1]!;
    const originalPeriod = first.researchPeriod;
    first.ipName = '已有专利';
    const branch = insertProjectRow(rows, first.id, true)!;
    expect(rows.slice(0, 3).map((row) => row.id)).toEqual([first.id, branch.id, next.id]);
    expect(branch.ipName).toBe('');
    expect(branch.rdNumber).toBe(first.rdNumber);
    for (const field of SHARED_PROJECT_FIELDS) expect(branch[field]).toBe(first[field]);
    const independent = insertProjectRow(rows, first.id)!;
    const independentBranches = groupProjectRows(rows)[1]!;
    expect(independentBranches).toHaveLength(2);
    expect(rows.slice(0, 5).map((row) => row.id)).toEqual([first.id, branch.id, ...independentBranches.map((row) => row.id), next.id]);
    expect(rows.slice(0, 5).map((row) => row.rdNumber)).toEqual(['RD01', 'RD01', 'RD02', 'RD02', 'RD03']);
    for (const field of SHARED_PROJECT_FIELDS) expect(independentBranches[1]![field]).toBe(independent[field]);
    expect(independent.activityName).toBe('');
    expect(independent.year).toBe(first.year);
    expect(independent.researchPeriod).not.toBe('');
    expect(first.researchPeriod).toBe(originalPeriod);
    expect(first.ipName).toBe('已有专利');
    expect(rows.map((row) => row.achievementNumber)).toEqual(rows.map((_, index) => `成果${String(index + 1).padStart(2, '0')}`));
    expect(new Set(rows.map((row) => row.id)).size).toBe(12);
  });
  it('inserts branches immediately after the selected row and synchronizes shared fields only', () => {
    const rows = legacyRows();
    const first = rows[0]!;
    const branch1 = insertProjectRow(rows, first.id, true)!;
    const branch2 = insertProjectRow(rows, first.id, true)!;
    expect(rows.slice(0, 3).map((row) => row.id)).toEqual([first.id, branch2.id, branch1.id]);
    for (const [field, value] of [['year', 2022], ['activityName', '共享项目名'], ['researchPeriod', '人工指定时间']] as const) {
      expect(updateProjectRow(rows, branch1.id, field, value)).toBe(true);
      expect(rows.slice(0, 3).map((row) => row[field])).toEqual([value, value, value]);
    }
    updateProjectRow(rows, branch1.id, 'ipName', '分支独有专利');
    expect(first.ipName).toBe('');
    expect(branch2.ipName).toBe('');
    expect(branch1.ipName).toBe('分支独有专利');
    expect(updateProjectRow(rows, first.id, 'rdNumber', 'RD88')).toBe(false);
    expect(updateProjectRow(rows, first.id, 'achievementNumber', '成果88')).toBe(false);
  });
  it('deletes individual rows, promotes surviving branches, and renumbers after removing a group', () => {
    const rows = legacyRows();
    const first = rows[0]!;
    first.activityName = '保留研发项目';
    const branch = insertProjectRow(rows, first.id, true)!;
    branch.ipName = '分支专利';
    const next = rows[2]!;
    deleteProjectRow(rows, first.id);
    expect(rows[0]).toBe(branch);
    expect(branch.activityName).toBe('保留研发项目');
    expect(branch.ipName).toBe('分支专利');
    expect(branch.rdNumber).toBe('RD01');
    expect(branch.achievementNumber).toBe('成果01');
    deleteProjectRow(rows, branch.id);
    expect(rows[0]).toBe(next);
    expect(next.rdNumber).toBe('RD01');
    expect(next.achievementNumber).toBe('成果01');
    expect(deleteProjectRow(rows, 'missing')).toBe(false);
  });
  it('synchronizes PS names by PS number across RD groups and keeps unassigned rows isolated', () => {
    const rows = legacyRows().slice(0, 5);
    rows[0]!.psNumber = 'PS01';
    rows[1]!.psNumber = ' ps01 ';
    rows[2]!.psNumber = 'PS02';
    rows[3]!.psNumber = '';
    rows[4]!.psNumber = '';
    updateProjectRow(rows, rows[0]!.id, 'psName', '智能监测产品');
    expect(rows.map((row) => row.psName)).toEqual(['智能监测产品', '智能监测产品', undefined, undefined, undefined]);
    updateProjectRow(rows, rows[3]!.id, 'psName', '独立服务');
    expect(rows[3]!.psName).toBe('独立服务');
    expect(rows[4]!.psName).toBeUndefined();
  });
  it('groups legacy nonadjacent records without losing conflicting field values', () => {
    const rows = legacyRows().slice(0, 3);
    rows[2]!.rdNumber = rows[0]!.rdNumber;
    rows[2]!.activityName = '历史冲突值';
    const ids = rows.map((row) => row.id);
    const periods = new Map(rows.map((row) => [row.id, row.researchPeriod]));
    expect(normalizeProjectRows(rows)).toBe(true);
    expect(rows.map((row) => row.id)).toEqual([ids[0], ids[2], ids[1]]);
    expect(rows.map((row) => row.rdNumber)).toEqual(['RD01', 'RD01', 'RD02']);
    for (const row of rows) expect(row.researchPeriod).toBe(periods.get(row.id));
    const group = groupProjectRows(rows)[0]!;
    expect(projectRowSpan(group, group[0]!, 'rdNumber')).toBe(2);
    expect(projectRowSpan(group, group[1]!, 'rdNumber')).toBe(0);
    expect(projectRowSpan(group, group[0]!, 'activityName')).toBe(1);
    expect(projectRowSpan(group, group[1]!, 'activityName')).toBe(1);
    expect(projectGroupWarnings([group]).join()).toContain('研发活动名称、研发周期不一致');
    expect(normalizeProjectRows(rows)).toBe(false);
    updateProjectRow(rows, group[0]!.id, 'activityName', '核对后的项目名称');
    updateProjectRow(rows, group[0]!.id, 'researchPeriod', group[0]!.researchPeriod);
    expect(projectGroupWarnings([group])).toEqual([]);
    expect(projectRowSpan(group, group[0]!, 'activityName')).toBe(2);
  });
  it('handles empty tables, invalid anchors, unset years and the 200-record cap', () => {
    const rows = legacyRows().slice(0, 0);
    expect(insertProjectRow(rows, undefined, true)).toBeUndefined();
    expect(insertProjectRow(rows, 'missing')).toBeUndefined();
    const first = insertProjectRow(rows)!;
    expect(first.rdNumber).toBe('RD01');
    expect(first.achievementNumber).toBe('成果01');
    expect(rows).toHaveLength(2);
    expect(rows[1]!.rdNumber).toBe('RD01');
    expect(rows[1]!.achievementNumber).toBe('成果02');
    first.year = null;
    const second = insertProjectRow(rows, first.id)!;
    expect(second.year).toBeNull();
    expect(second.researchPeriod).toBe('');
    while (rows.length < 200) insertProjectRow(rows, first.id, true);
    expect(insertProjectRow(rows, first.id)).toBeUndefined();
    expect(insertProjectRow(rows, first.id, true)).toBeUndefined();
    expect(rows.at(-1)!.achievementNumber).toBe('成果200');
    deleteProjectRow(rows, rows[1]!.id);
    const ids = rows.map((row) => row.id);
    expect(insertProjectRow(rows, first.id)).toBeUndefined();
    expect(rows.map((row) => row.id)).toEqual(ids);
    expect(insertProjectRow(rows, first.id, true)).toBeDefined();
    deleteProjectRow(rows, rows[1]!.id);
    deleteProjectRow(rows, rows[1]!.id);
    expect(insertProjectRow(rows, first.id)).toBeDefined();
    expect(rows).toHaveLength(200);
  });
});
