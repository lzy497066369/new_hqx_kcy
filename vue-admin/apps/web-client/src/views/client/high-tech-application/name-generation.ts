import type { HighTechProject, NameGeneration } from '#/api/client/high-tech';
import { groupProjectRows } from './project-rows';

/** Resolve the complete response before replacing any editable table data. */
export function applyGeneratedNames(projects: HighTechProject[], result: NameGeneration): HighTechProject[] {
  const groups = groupProjectRows(projects);
  if ((result.version !== 2 && result.version !== 3) || result.status !== 'generated' || result.evidenceSource !== 'ip_and_rd_names'
    || result.rds.length !== groups.length || result.mappings.length !== projects.length || !result.products.length) {
    throw new Error('名称生成结果不完整，原有数据已保留');
  }
  const rds = new Map(result.rds.map((rd) => [rd.id, rd]));
  const mappings = new Map(result.mappings.map((mapping) => [mapping.projectId, mapping]));
  const achievements = new Map(result.achievements.map((item) => [item.id, item]));
  const products = new Map(result.products.map((item) => [item.id, item]));
  const assigned = result.products.flatMap((product) => product.achievementIds);
  if (result.products.some((product) => !product.achievementIds.length)
    || assigned.length !== achievements.size || new Set(assigned).size !== achievements.size
    || assigned.some((id) => !achievements.has(id))) throw new Error('PS须完整且不重复归并全部成果');
  if (rds.size !== groups.length || mappings.size !== projects.length
    || achievements.size !== result.achievements.length || products.size !== result.products.length) {
    throw new Error('名称生成关联编号重复');
  }
  const rdByRow = new Map(groups.flatMap((group) => group.map((row) => [row.id, rds.get(group[0]!.id)] as const)));
  const used = new Set(result.mappings.map((mapping) => mapping.achievementId));
  if (used.size !== achievements.size || [...used].some((id) => !achievements.has(id))) throw new Error('名称生成成果映射不完整');
  const psNumbers = new Map(result.products.map((product, index) => [product.id, `PS${String(index + 1).padStart(2, '0')}`]));
  const name = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim() || value.length > 512) throw new Error('生成名称无效');
    return value.trim();
  };
  return projects.map((row) => {
    const rd = rdByRow.get(row.id);
    const mapping = mappings.get(row.id);
    if (!rd || !mapping) throw new Error('名称生成缺少对应项目行');
    const achievement = achievements.get(mapping.achievementId);
    const product = products.get(mapping.productId);
    if (!achievement || achievement.rdId !== rd.id || !product || !product.achievementIds.includes(achievement.id)) {
      throw new Error('名称生成关联不正确，原有数据已保留');
    }
    const activityName = name(rd.name);
    const achievementName = name(achievement.name);
    const psName = name(product.name);
    if (result.version === 3 && (!/^.+的研发$/u.test(activityName) || !/^.+技术$/u.test(achievementName) || !/^.+(?:产品|服务)$/u.test(psName))) {
      throw new Error('生成名称形式不正确，原有数据已保留');
    }
    return { ...row, activityName, achievementName, psName,
      psNumber: result.version === 3 ? psNumbers.get(product.id)! : row.psNumber };
  });
}

export function generatedNameReasons(result: NameGeneration | undefined, projects: HighTechProject[], rowId: string): string {
  if (!result) return '';
  const group = groupProjectRows(projects).find((group) => group.some((row) => row.id === rowId));
  const rd = result.rds.find((item) => item.id === group?.[0]?.id);
  const mapping = result.mappings.find((item) => item.projectId === rowId);
  const achievement = result.achievements.find((item) => item.id === mapping?.achievementId);
  const product = result.products.find((item) => item.id === mapping?.productId);
  const references = rd?.referenceRdIds.map((id) => projects.find((row) => row.id === id)?.rdNumber ?? id).join('、');
  const semantics = result.analyses.filter((item) => achievement?.ipIds.includes(item.ipId)).map((item) =>
    `IP技术语义：${[item.technicalObject, item.coreFunction, item.technicalDirection, item.applicationScenario].filter(Boolean).join('、')}`);
  return [...semantics, achievement && `成果生成名称「${achievement.name}」：${achievement.reason}`, rd && `RD生成名称「${rd.name}」：${rd.reason}`, references && `无IP，参考RD：${references}`, product && `PS归并名称「${product.name}」：${product.reason}`].filter(Boolean).join('\n');
}
