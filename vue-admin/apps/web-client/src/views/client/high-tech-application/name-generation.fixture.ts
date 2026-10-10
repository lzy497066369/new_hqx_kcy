import type { HighTechProject, NameGeneration } from '#/api/client/high-tech';
import { groupProjectRows } from './project-rows';

export function nameGenerationFixture(projects: HighTechProject[]): NameGeneration {
  const groups = groupProjectRows(projects);
  return {
    version: 3, generatedAt: '2026-10-09T08:00:00Z', status: 'generated', evidenceSource: 'ip_and_rd_names',
    analyses: [], themes: [], warnings: [],
    rds: groups.map((group, index) => ({ id: group[0]!.id, name: `监测方向${index + 1}技术的研发`,
      ipIds: group.map((row) => row.id), themeIds: ['T01'], referenceRdIds: [], reason: 'IP名称中的监测功能' })),
    achievements: groups.map((group, index) => ({ id: `A${index}`, rdId: group[0]!.id,
      name: `监测能力${index + 1}技术`, ipIds: group.map((row) => row.id), reason: 'IP技术特征所形成的监测能力' })),
    products: [{ id: 'P01', name: '综合监测产品', achievementIds: groups.map((_, index) => `A${index}`),
      reason: '全部研发方向与成果共同支撑监测功能' }],
    mappings: groups.flatMap((group, index) => group.map((row) => ({ projectId: row.id, achievementId: `A${index}`, productId: 'P01' }))),
  };
}
