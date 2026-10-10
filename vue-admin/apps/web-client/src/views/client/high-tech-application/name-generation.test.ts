import { describe, expect, it } from 'vitest';
import { emptyDraft } from './model';
import { applyGeneratedNames, generatedNameReasons } from './name-generation';
import { nameGenerationFixture } from './name-generation.fixture';

describe('generated name application', () => {
  it('atomically changes names and PS numbers and retains nine RD slots and IP data', () => {
    const projects = emptyDraft().projects;
    const before = structuredClone(projects);
    const result = nameGenerationFixture(projects);
    const updated = applyGeneratedNames(projects, result);
    expect(projects).toEqual(before);
    expect(result.rds).toHaveLength(9);
    expect(updated).toHaveLength(projects.length);
    updated.forEach((row, index) => {
      const original = before[index]!;
      expect(row).toEqual({ ...original, activityName: result.rds[Math.floor(index / 2)]!.name,
        achievementName: result.achievements[Math.floor(index / 2)]!.name, psName: '综合监测产品', psNumber: 'PS01' });
    });
  });
  it('rejects missing achievement and PS mappings without changing previous names', () => {
    const projects = emptyDraft().projects;
    const result = nameGenerationFixture(projects);
    const before = structuredClone(projects);
    Object.assign(result.mappings[0]!, { achievementId: null, productId: null });
    expect(() => applyGeneratedNames(projects, result)).toThrow();
    expect(projects).toEqual(before);
  });
  it('rejects incomplete, duplicate or wrong-parent mappings without partially modifying rows', () => {
    const projects = emptyDraft().projects;
    const before = structuredClone(projects);
    for (const mutate of [
      (result: ReturnType<typeof nameGenerationFixture>) => { result.rds.pop(); },
      (result: ReturnType<typeof nameGenerationFixture>) => { result.rds[0]!.id = 'unknown'; },
      (result: ReturnType<typeof nameGenerationFixture>) => { result.mappings[0]!.projectId = result.mappings[1]!.projectId; },
      (result: ReturnType<typeof nameGenerationFixture>) => { result.mappings[0]!.achievementId = 'A1'; },
      (result: ReturnType<typeof nameGenerationFixture>) => { result.products[0]!.achievementIds = []; },
      (result: ReturnType<typeof nameGenerationFixture>) => { result.products.push({ ...result.products[0]!, id: 'P02' }); },
      (result: ReturnType<typeof nameGenerationFixture>) => { result.mappings[0]!.productId = 'P02'; },
      (result: ReturnType<typeof nameGenerationFixture>) => { result.rds[8]!.name = ''; },
      (result: ReturnType<typeof nameGenerationFixture>) => { result.rds[0]!.name = '监测技术研发'; },
      (result: ReturnType<typeof nameGenerationFixture>) => { result.achievements[0]!.name = '监测系统'; },
      (result: ReturnType<typeof nameGenerationFixture>) => { result.products[0]!.name = '监测设备'; },
    ]) {
      const result = nameGenerationFixture(projects); mutate(result);
      expect(() => applyGeneratedNames(projects, result)).toThrow();
      expect(projects).toEqual(before);
    }
  });
  it('retains generation and reference reasons when display names are manually renamed', () => {
    const projects = emptyDraft().projects;
    const result = nameGenerationFixture(projects);
    result.rds[0]!.referenceRdIds = [projects[2]!.id];
    projects[0]!.activityName = '手工修改';
    const reasons = generatedNameReasons(result, projects, projects[0]!.id);
    expect(reasons).toContain('RD生成名称「监测方向1技术的研发」');
    expect(reasons).toContain('无IP，参考RD：RD02');
    expect(reasons).toContain('成果生成名称');
    expect(reasons).toContain('PS归并名称');
    expect(reasons.indexOf('成果生成名称')).toBeLessThan(reasons.indexOf('RD生成名称'));
    expect(generatedNameReasons(undefined, projects, projects[0]!.id)).toBe('');
  });
  it('assigns distinct PS numbers for unrelated groups and shares one PS across related RDs', () => {
    const projects = emptyDraft().projects;
    const result = nameGenerationFixture(projects);
    result.products[0]!.achievementIds = ['A0', 'A1'];
    result.products.push({ id: 'P02', name: '数据加密服务', achievementIds: result.achievements.slice(2).map((item) => item.id), reason: '独立加密用途' });
    result.mappings.forEach((mapping) => { if (!['A0', 'A1'].includes(mapping.achievementId)) mapping.productId = 'P02'; });
    const updated = applyGeneratedNames(projects, result);
    expect(updated.slice(0, 4).every((row) => row.psNumber === 'PS01' && row.psName === '综合监测产品')).toBe(true);
    expect(updated.slice(4).every((row) => row.psNumber === 'PS02' && row.psName === '数据加密服务')).toBe(true);
  });
  it('accepts legacy names without renumbering existing PS data', () => {
    const projects = emptyDraft().projects;
    const result = nameGenerationFixture(projects);
    result.version = 2;
    result.rds.forEach((rd) => { rd.name = rd.name.replace('的研发', '研发'); });
    result.products[0]!.name = '综合监测设备';
    const updated = applyGeneratedNames(projects, result);
    expect(updated.every((row, index) => row.psNumber === projects[index]!.psNumber && row.psName === '综合监测设备')).toBe(true);
  });
});
