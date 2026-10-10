import type { HighTechProject } from './high-tech.model';

export interface IpNameAnalysis {
  ipId: string;
  technicalObject: string;
  coreFunction: string;
  technicalProblem: string;
  technicalSolution: string;
  applicationScenario: string;
  technicalDirection: string;
  keywords: string[];
  confidence: 'low' | 'medium';
}
export interface NameTheme { id: string; name: string; ipIds: string[]; reason: string }
export interface GeneratedRd { id: string; name: string; themeIds: string[]; ipIds: string[]; referenceRdIds: string[]; reason: string }
export interface GeneratedAchievement { id: string; name: string; rdId: string; ipIds: string[]; reason: string }
export interface GeneratedProduct { id: string; name: string; achievementIds: string[]; reason: string }
export interface NameMapping { projectId: string; achievementId: string; productId: string }
export interface NameGeneration {
  version: 2 | 3;
  generatedAt: string;
  status: 'generated';
  evidenceSource: 'ip_and_rd_names';
  analyses: IpNameAnalysis[];
  themes: NameTheme[];
  rds: GeneratedRd[];
  achievements: GeneratedAchievement[];
  products: GeneratedProduct[];
  mappings: NameMapping[];
  warnings: string[];
}

export function usableRdName(value: string): boolean {
  return Boolean(value.trim()) && !/^(待补充研发资料|待填写|RD\d+)$/iu.test(value.trim());
}

export function nameSources(projects: HighTechProject[]) {
  const sources = new Map<string, { id: string; name: string; type: string; authorizationNumber: string; authorizationDate: string; rowIds: string[] }>();
  const byRow = new Map<string, string>();
  for (const row of projects) {
    if (!row.ipName.trim()) continue;
    // A stable project row identifies the source, independent of renumberable IP labels.
    const key = JSON.stringify([row.authorizationNumber.trim().toUpperCase(), row.ipName.trim(), row.ipType.trim()]);
    let source = sources.get(key);
    if (!source) {
      source = { id: row.id, name: row.ipName.trim(), type: row.ipType, authorizationNumber: row.authorizationNumber,
        authorizationDate: row.authorizationDate, rowIds: [] };
      sources.set(key, source);
    }
    source.rowIds.push(row.id);
    byRow.set(row.id, source.id);
  }
  const groups = new Map<string, HighTechProject[]>();
  for (const row of projects) {
    const key = row.rdNumber.trim().toUpperCase() || row.id;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return { sources: [...sources.values()], byRow, groups: [...groups.values()].map((rows) => ({
    id: rows[0].id, rdNumber: rows[0].rdNumber, existingName: rows.find((row) => usableRdName(row.activityName))?.activityName ?? '', rowIds: rows.map((row) => row.id),
    ipIds: [...new Set(rows.map((row) => byRow.get(row.id)).filter((id): id is string => Boolean(id)))],
  })) };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('结果不是JSON对象');
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 512, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) throw new Error('结果字段缺失或文本过长');
  return value.trim();
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error('结果数组缺失或超过200项');
  return value;
}
function refs(value: unknown, allowed: Set<string>, empty = false): string[] {
  const ids = array(value).map((id) => text(id, 64));
  if ((!empty && !ids.length) || new Set(ids).size !== ids.length || ids.some((id) => !allowed.has(id))) throw new Error('关联编号无效、重复或缺失');
  return ids;
}
function unique<T extends { id: string }>(items: T[]): T[] {
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error('结果编号重复');
  return items;
}
const nameKey = (name: string) => name.replace(/[\s\p{P}]/gu, '').toLowerCase();
function uniqueNames(items: { name: string }[]) {
  const names = items.map((item) => nameKey(item.name));
  if (new Set(names).size !== names.length) throw new Error('技术名称重复，请归并而非同义拆分');
}

export function validateNameAnalysis(value: unknown, projects: HighTechProject[]) {
  const body = object(value);
  const allowed = new Set(nameSources(projects).sources.map((source) => source.id));
  const analyses = array(body.analyses).map((value): IpNameAnalysis => {
    const item = object(value);
    const ipId = text(item.ipId, 64);
    if (!allowed.has(ipId) || !['low', 'medium'].includes(String(item.confidence))) throw new Error('IP解析编号或可信度不正确');
    const fields = ['technicalObject', 'coreFunction', 'technicalProblem', 'technicalSolution', 'applicationScenario', 'technicalDirection'] as const;
    const profile = Object.fromEntries(fields.map((field) => [field, text(item[field], 240, true)])) as Pick<IpNameAnalysis, typeof fields[number]>;
    const keywords = array(item.keywords).map((word) => text(word, 64));
    if (keywords.length > 12) throw new Error('技术关键词过多');
    return { ipId, ...profile, keywords, confidence: item.confidence as IpNameAnalysis['confidence'] };
  });
  if (analyses.length !== allowed.size || new Set(analyses.map((item) => item.ipId)).size !== allowed.size) throw new Error('IP解析未完整覆盖输入');
  const themes = unique(array(body.themes).map((value): NameTheme => {
    const item = object(value);
    return { id: text(item.id, 64), name: text(item.name), ipIds: refs(item.ipIds, allowed), reason: text(item.reason) };
  }));
  const assigned = themes.flatMap((theme) => theme.ipIds);
  if (assigned.length !== allowed.size || new Set(assigned).size !== allowed.size) throw new Error('技术主题须完整且不重复覆盖IP');
  uniqueNames(themes);
  return { analyses, themes };
}

export function validateAchievementPlan(value: unknown, projects: HighTechProject[], enforceNaming = true) {
  const body = object(value);
  const { groups, byRow, sources } = nameSources(projects);
  const achievements = unique(array(body.achievements).map((value): GeneratedAchievement => {
    const item = object(value);
    const rdId = text(item.rdId, 64);
    const group = groups.find((group) => group.id === rdId);
    if (!group) throw new Error('成果引用不存在的RD');
    const name = text(item.name);
    if (enforceNaming && !/^.+技术$/u.test(name)) throw new Error('成果名称应采用“XXX技术”的形式');
    const ipIds = refs(item.ipIds, new Set(group.ipIds), !group.ipIds.length);
    if (sources.some((source) => nameKey(source.name) === nameKey(name))) throw new Error('成果不能直接复制IP名称');
    return { id: text(item.id, 64), name, rdId, ipIds, reason: text(item.reason) };
  }));
  uniqueNames(achievements);
  const mappings = array(body.mappings).map((value) => {
    const item = object(value);
    const projectId = text(item.projectId, 64);
    const group = groups.find((group) => group.rowIds.includes(projectId));
    if (!group) throw new Error('映射项目行不存在');
    const achievementId = text(item.achievementId, 64);
    const achievement = achievements.find((achievement) => achievement.id === achievementId);
    if (!achievement || achievement.rdId !== group.id) throw new Error('成果不属于对应RD');
    const ipId = byRow.get(projectId);
    if (ipId && !achievement.ipIds.includes(ipId)) throw new Error('成果未关联所在行IP');
    return { projectId, achievementId };
  });
  if (mappings.length !== projects.length || new Set(mappings.map((mapping) => mapping.projectId)).size !== projects.length) throw new Error('映射须完整覆盖现有行');
  if (achievements.some((achievement) => !mappings.some((mapping) => mapping.achievementId === achievement.id))) throw new Error('存在未使用的成果');
  for (const group of groups) {
    if (!achievements.some((achievement) => achievement.rdId === group.id)
      || group.ipIds.some((ipId) => !achievements.some((achievement) => achievement.rdId === group.id && achievement.ipIds.includes(ipId)))) throw new Error('RD缺少成果或IP关联');
  }
  return { achievements, mappings };
}

export function validateRdPlan(value: unknown, analysis: Pick<NameGeneration, 'analyses' | 'themes'>, projects: HighTechProject[], enforceNaming = true) {
  const body = object(value);
  const { groups } = nameSources(projects);
  const themeIds = new Set(analysis.themes.map((theme) => theme.id));
  const rds = unique(array(body.rds).map((value): GeneratedRd => {
    const item = object(value);
    const id = text(item.id, 64);
    const group = groups.find((group) => group.id === id);
    if (!group) throw new Error('RD编号不存在');
    const ipIds = refs(item.ipIds, new Set(group.ipIds), true);
    if (ipIds.length !== group.ipIds.length) throw new Error('RD必须综合本项目全部IP');
    const themes = refs(item.themeIds, themeIds, true);
    if (ipIds.some((ipId) => !analysis.themes.some((theme) => themes.includes(theme.id) && theme.ipIds.includes(ipId)))
      || themes.some((id) => !analysis.themes.find((theme) => theme.id === id)!.ipIds.some((ipId) => ipIds.includes(ipId)))) throw new Error('RD主题与IP不一致');
    const referenceRdIds = refs(item.referenceRdIds, new Set(groups.filter((other) => other.id !== id && (other.ipIds.length || usableRdName(other.existingName))).map((other) => other.id)), true);
    if (ipIds.length ? referenceRdIds.length > 0 : referenceRdIds.length === 0) throw new Error('无IP项目必须参考其他有IP或已有名称的RD，有IP项目应使用自身IP');
    const name = text(item.name);
    if (!usableRdName(name)) throw new Error('RD必须生成具体研发名称');
    if (enforceNaming && !/^.+的研发$/u.test(name)) throw new Error('研发活动名称应采用“XXX的研发”的形式');
    return { id, name, ipIds, themeIds: themes, referenceRdIds, reason: text(item.reason) };
  }));
  if (rds.length !== groups.length) throw new Error('不得增加或减少既有RD槽位');
  uniqueNames(rds);
  const { achievements, mappings } = validateAchievementPlan(body, projects, enforceNaming);
  if (achievements.some((achievement) => rds.some((rd) => nameKey(achievement.name) === nameKey(rd.name)))) throw new Error('RD与成果不能使用相同名称');
  return { rds, achievements, mappings };
}

export function validateNamePlan(value: unknown, analysis: Pick<NameGeneration, 'analyses' | 'themes'>, projects: HighTechProject[], enforceNaming = true) {
  const body = object(value);
  const { rds, achievements, mappings: rdMappings } = validateRdPlan(body, analysis, projects, enforceNaming);
  const products = unique(array(body.products).map((value): GeneratedProduct => {
    const item = object(value);
    const name = text(item.name);
    if (enforceNaming && !/^.+(?:产品|服务)$/u.test(name)) throw new Error('PS名称应采用“XXX产品”或“XXX服务”的形式');
    if ([...rds, ...achievements].some((entry) => nameKey(entry.name) === nameKey(name))) throw new Error('PS名称须与RD和成果区分');
    return { id: text(item.id, 64), name, achievementIds: refs(item.achievementIds, new Set(achievements.map((achievement) => achievement.id))), reason: text(item.reason) };
  }));
  uniqueNames(products);
  const assigned = products.flatMap((product) => product.achievementIds);
  if (assigned.length !== achievements.length || new Set(assigned).size !== achievements.length) throw new Error('PS须完整且不重复归并全部成果');
  const rawMappings = array(body.mappings);
  const mappings = rdMappings.map((mapping, index): NameMapping => {
    const productId = text(object(rawMappings[index]).productId, 64);
    const product = products.find((product) => product.id === productId);
    if (!product || !product.achievementIds.includes(mapping.achievementId)) throw new Error('PS未包含对应项目的科技成果');
    return { ...mapping, productId: product.id };
  });
  return { rds, achievements, products, mappings };
}

/** Revalidate the current metadata format; old generated names remain editable without v1 metadata. */
export function normalizeNameGeneration(value: unknown, projects: HighTechProject[]): NameGeneration | undefined {
  const body = object(value);
  if (body.version === 1) return undefined;
  if ((body.version !== 2 && body.version !== 3) || body.status !== 'generated' || body.evidenceSource !== 'ip_and_rd_names') throw new Error('生成记录状态不正确');
  const generatedAt = text(body.generatedAt, 40);
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('生成时间不正确');
  const analysis = validateNameAnalysis(body, projects);
  const plan = validateNamePlan(body, analysis, projects, body.version === 3);
  return { version: body.version as 2 | 3, generatedAt, status: 'generated', evidenceSource: 'ip_and_rd_names', ...analysis, ...plan,
    warnings: array(body.warnings).map((warning) => text(warning)) };
}
