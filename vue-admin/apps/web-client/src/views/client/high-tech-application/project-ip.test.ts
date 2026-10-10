import { describe, expect, it } from 'vitest';
import { newIpItem, newProject } from './model';
import { normalizeProjectAcquisitionMethods, projectIpOptions, projectIpValues, selectProjectIp } from './project-ip';

const items = [
  { ...newIpItem([]), id: 'ip-one', number: 'IP01', name: '控制软件', patentNumber: 'SR001', patentType: '软件著作权', applicationDate: '2024-01-01', grantDate: '2025-01-01' },
  { ...newIpItem([]), id: 'ip-two', number: 'IP02', name: '装置外观', patentNumber: 'CN002', patentType: '外观设计', applicationDate: '2025-01-01', grantDate: '2026-01-01' },
];

describe('project IP selection', () => {
  it('fills and replaces all mapped fields while preserving other project fields', () => {
    const row = { ...newProject([]), activityName: '研发活动', acquisitionMethod: '转让取得', achievementName: '原有成果' };
    for (const ip of items) {
      expect(selectProjectIp(row, items, ip.number)).toBe(true);
      expect(row).toMatchObject(projectIpValues(ip));
      expect(row).toMatchObject({ activityName: '研发活动', acquisitionMethod: '转让取得', achievementName: '原有成果' });
    }
    expect(selectProjectIp(row, items, 'IP02')).toBe(false);
    expect(selectProjectIp(row, items, '')).toBe(true);
    expect(row).toMatchObject(projectIpValues());
    expect(row.acquisitionMethod).toBe('');
  });

  it('clears stale acquisition even when all IP fields are already empty', () => {
    const row = { ...newProject([]), acquisitionMethod: '原始取得' };
    expect(selectProjectIp(row, items, '')).toBe(true);
    expect(row.acquisitionMethod).toBe('');
    expect(selectProjectIp(row, items, '')).toBe(false);
  });

  it('normalizes only unlinked acquisition methods without deleting historical IP text', () => {
    const rows = [
      { ...newProject([]), ipNumber: '  ', ipName: '历史名称', acquisitionMethod: '原始取得' },
      { ...newProject([]), ipNumber: 'IP01', acquisitionMethod: '转让取得' },
    ];
    expect(normalizeProjectAcquisitionMethods(rows)).toBe(true);
    expect(rows[0]).toMatchObject({ ipName: '历史名称', acquisitionMethod: '' });
    expect(rows[1]!.acquisitionMethod).toBe('转让取得');
    expect(normalizeProjectAcquisitionMethods(rows)).toBe(false);
  });

  it('rejects unknown selections without changing data', () => {
    const row = newProject([]);
    const before = { ...row };
    expect(selectProjectIp(row, items, 'IP99')).toBe(false);
    expect(row).toEqual(before);
  });

  it('sources options from the summary and preserves historical references visibly', () => {
    expect(projectIpOptions(items)).toEqual([
      { value: '', label: '无', disabled: false },
      { value: 'IP01', label: 'IP01 · 控制软件', disabled: false },
      { value: 'IP02', label: 'IP02 · 装置外观', disabled: false },
    ]);
    expect(projectIpOptions(items, 'IP01')).toHaveLength(3);
    expect(projectIpOptions(items, 'IP01、IP99').at(-1)).toMatchObject({ value: 'IP01、IP99', disabled: true });
    expect(projectIpOptions([{ ...items[0]!, number: '' }])).toEqual([{ value: '', label: '无', disabled: false }]);
  });
});
