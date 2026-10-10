import { reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import type { IpAllocationPreview } from '#/api/client/high-tech';
import { allocationSnapshot, applyIpAllocation } from './ip-allocation';
import { emptyDraft, newIpItem, newProject, stepError, buildMaterialContent } from './model';

function fixture() {
  const draft = emptyDraft();
  const row = newProject([]);
  row.rdNumber = 'RD01';
  row.activityName = '工业控制研发';
  row.researchPeriod = '2025-01-01—2025-12-31';
  row.psNumber = 'PS01';
  row.achievementNumber = '成果89';
  row.achievementName = '已有成果';
  row.techField = '工业控制';
  draft.projects = [row];
  draft.ipSummary = ['a', 'b'].map((id, index) => ({ ...newIpItem(draft.ipSummary), id, number: `IP0${index + 1}`, name: `控制软件${id}`, patentType: '软件著作权', legalStatus: '授权', patentNumber: `SR-${id}`, patentee: '测试公司', applicationDate: '2025-06-01', grantDate: '2025-09-01' }));
  const preview: IpAllocationPreview = {
    assignments: draft.ipSummary.map((ip, index) => ({ ipId: ip.id, projectId: row.id, rdNumber: row.rdNumber, round: index === 0 ? 'spread' : 'append', similarNames: index === 0 ? [] : [draft.ipSummary[0]!.name], timing: 'within', reason: '控制' })),
    strategy: 'spread_then_similar', nameGroups: [], preserved: [], unassigned: [], warnings: [],
    distribution: [{ projectId: row.id, rdNumber: row.rdNumber, existingCount: 0, addedCount: 2 }],
  };
  return { draft, preview };
}

describe('IP allocation draft application', () => {
  it('fills the five existing IP columns across nine unnamed RDs without generating names or overwriting outcomes', () => {
    const draft = emptyDraft();
    const periods = [
      '2023-01-01—2023-08-31', '2023-03-01—2023-10-31', '2023-05-01—2023-12-31',
      '2024-01-01—2024-08-31', '2024-03-01—2024-10-31', '2024-05-01—2024-12-31',
      '2025-01-01—2025-08-31', '2025-03-01—2025-10-31', '2025-05-01—2025-12-31',
    ];
    draft.projects = periods.flatMap((period, index) => [0, 1].map((branch) => ({
      ...newProject([]), id: `rd-${index + 1}-${branch}`, rdNumber: `RD0${index + 1}`,
      activityName: '', researchPeriod: period, techField: '服务器/客户端操作系统',
      achievementNumber: `成果${String(index * 2 + branch + 1).padStart(2, '0')}`,
      achievementName: branch ? '保留的成果' : '',
    })));
    const dates = ['2024-12-20', '2025-02-11', '2025-02-11', '2025-02-11', '2025-02-12', '2025-03-12', '2025-04-17'];
    draft.ipSummary = ['商品推荐系统', '安全预警系统', '供应链平台', '库存管理系统', '会员积分系统', '决策分析平台', '数据可视化平台']
      .map((name, index) => ({ ...newIpItem([]), id: `ip-${index + 1}`, number: `IP0${index + 1}`, name,
        patentType: '软件著作权', patentNumber: `SR-${index + 1}`, grantDate: '2025-10-17',
        applicationDate: dates[index]!, legalStatus: '授权', patentee: '测试企业' }));
    const rdForIp = [6, 1, 2, 3, 4, 7, 8];
    const preview: IpAllocationPreview = {
      ...fixture().preview,
      assignments: draft.ipSummary.map((ip, index) => ({ ipId: ip.id,
        projectId: `rd-${rdForIp[index]}-0`, rdNumber: `RD0${rdForIp[index]}`,
        round: 'spread', similarNames: [],
        timing: index === 0 || index >= 5 ? 'within' : 'after', reason: '第一轮分散分配' })),
    };
    const before = JSON.stringify(draft.projects);
    const result = applyIpAllocation(draft, preview, allocationSnapshot(draft));
    expect(JSON.stringify(draft.projects)).toBe(before);
    expect(result).toHaveLength(18);
    for (const ip of draft.ipSummary) {
      const row = result.find((item) => item.ipNumber === ip.number);
      expect(row).toMatchObject({ rdNumber: `RD0${rdForIp[draft.ipSummary.indexOf(ip)]}`,
        activityName: '', ipNumber: ip.number, ipName: ip.name, authorizationNumber: ip.patentNumber,
        applicationDate: ip.applicationDate, authorizationDate: ip.grantDate, ipType: ip.patentType });
    }
    expect(result.filter((row) => row.achievementName === '保留的成果')).toHaveLength(9);
    expect(result.every((row) => row.techField === '服务器/客户端操作系统')).toBe(true);
    expect(result.filter((row) => row.ipNumber)).toHaveLength(7);
  });
  it('atomically fills a vacant row and creates only the necessary branch, preserving PS and historical achievement data', () => {
    const { draft, preview } = fixture();
    const reactiveDraft = reactive(draft);
    const snapshot = allocationSnapshot(reactiveDraft);
    const rows = applyIpAllocation(reactiveDraft, preview, snapshot);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: draft.projects[0]!.id, ipNumber: 'IP01', psNumber: 'PS01', achievementNumber: '成果89', achievementName: '已有成果' });
    expect(rows[1]).toMatchObject({ rdNumber: 'RD01', researchPeriod: draft.projects[0]!.researchPeriod, ipNumber: 'IP02', ipName: '控制软件b', authorizationNumber: 'SR-b', ipType: '软件著作权' });
    expect(rows[1]!.achievementNumber).not.toBe(rows[0]!.achievementNumber);
    expect(draft.projects).toHaveLength(1);
    expect(draft.projects[0]!.ipName).toBe('');
    draft.projects = rows;
    expect(() => applyIpAllocation(draft, preview, allocationSnapshot(draft))).toThrow(/重复/);
  });
  it('rejects stale data, duplicate identities and capacity failure without mutating any rows', () => {
    const { draft, preview } = fixture();
    const snapshot = allocationSnapshot(draft);
    draft.projects[0]!.activityName = '已经改变';
    expect(() => applyIpAllocation(draft, preview, snapshot)).toThrow(/已变化/);
    const newSnapshot = allocationSnapshot(draft);
    draft.ipSummary[1]!.number = 'IP01';
    expect(() => applyIpAllocation(draft, preview, allocationSnapshot(draft))).toThrow(/重复/);
    draft.ipSummary[1]!.number = 'IP02';
    draft.projects[0]!.researchPeriod = '2026-01-01—2026-12-31';
    expect(() => applyIpAllocation(draft, preview, newSnapshot)).toThrow(/已变化/);
    draft.projects = Array.from({ length: 200 }, (_, index) => ({ ...newProject([]), id: String(index), rdNumber: `RD${index}`, ipName: '已占用' }));
    preview.assignments[0]!.projectId = '0';
    preview.assignments[1]!.projectId = '0';
    const before = JSON.stringify(draft.projects);
    expect(() => applyIpAllocation(draft, preview, allocationSnapshot(draft))).toThrow(/200条/);
    expect(JSON.stringify(draft.projects)).toBe(before);
  });
  it('permits an RD with no IP without manufacturing empty intellectual-property material', () => {
    const { draft } = fixture();
    const row = draft.projects[0]!;
    row.acquisitionMethod = '';
    expect(stepError({ ...draft, currentStep: 2 }, 2)).toBeTruthy(); // Other mandatory basic facts remain mandatory.
    expect(buildMaterialContent('property', '示例企业', draft)).not.toContain('｜\n授权号：');
  });
});
