import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export interface ClientPolicyRegionConfig {
  code: string;
  name: string;
  level: string;
  parentCode?: string | null;
  sortNum?: number;
  status?: number;
  remark?: string | null;
}

export interface ClientPolicyMaterialItemConfig {
  moduleKey: string;
  tabKey: string;
  itemName: string;
  requirementDesc?: string | null;
  requiredCount?: number;
  requiredYears?: string[] | null;
  requiredFields?: string[] | null;
  attachmentRequired?: number;
  isRequired?: number;
  scoreWeight?: number;
  sortOrder?: number;
  enabled?: number;
}

export interface ClientPolicyMaterialConfig {
  requirementName: string;
  description?: string | null;
  version?: string;
  enabled?: number;
  items?: ClientPolicyMaterialItemConfig[];
}

export interface ClientPolicyPresetConfig {
  presetType: 'enterprise' | 'flow' | 'material' | 'qualification' | 'score';
  name: string;
  version?: string;
  status?: 'draft' | 'published';
  description?: string | null;
  payload: unknown;
}

export interface ClientPolicySchemeConfig {
  schemeName: string;
  version?: string;
  status?: 'draft' | 'published';
  effectiveStartDate?: string | null;
  effectiveEndDate?: string | null;
  qualificationRules?: unknown;
  materialRules?: unknown;
  scoreRules?: unknown;
  flowTemplate?: unknown;
  capabilities?: unknown;
  presets?: ClientPolicyPresetConfig[];
}

export interface ClientPolicyProjectConfig {
  code: string;
  name: string;
  policyType?: string | null;
  applicableObjects?: string | null;
  basicDescription?: string | null;
  enabled?: number;
  sortNum?: number;
  remark?: string | null;
  materials?: ClientPolicyMaterialConfig;
  scheme?: ClientPolicySchemeConfig;
}

export interface ClientPolicyConfig {
  version: string;
  regions: ClientPolicyRegionConfig[];
  projects: ClientPolicyProjectConfig[];
}

const CONFIG_FILE = 'client-policy.config.json';

export async function loadClientPolicyConfig(): Promise<ClientPolicyConfig> {
  const candidates = [
    resolve(process.cwd(), 'config', CONFIG_FILE),
    resolve(__dirname, '../../../config', CONFIG_FILE),
    join(__dirname, CONFIG_FILE),
  ];
  let lastError: unknown;
  for (const file of candidates) {
    try {
      const raw = await readFile(file, 'utf8');
      const parsed = JSON.parse(raw) as Partial<ClientPolicyConfig>;
      return validateClientPolicyConfig(parsed, file);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`无法读取客户端策略配置文件 ${CONFIG_FILE}: ${String(lastError)}`);
}

function validateClientPolicyConfig(value: Partial<ClientPolicyConfig>, source: string): ClientPolicyConfig {
  if (!value || typeof value.version !== 'string') {
    throw new Error(`客户端策略配置缺少 version: ${source}`);
  }
  if (!Array.isArray(value.regions) || !Array.isArray(value.projects)) {
    throw new Error(`客户端策略配置的 regions/projects 必须是数组: ${source}`);
  }
  const regionCodes = new Set<string>();
  for (const region of value.regions) {
    if (!region || !region.code || !region.name || !region.level) {
      throw new Error(`客户端策略配置存在无效区域: ${source}`);
    }
    if (regionCodes.has(region.code)) throw new Error(`区域 code 重复: ${region.code}`);
    regionCodes.add(region.code);
  }
  const projectCodes = new Set<string>();
  for (const project of value.projects) {
    if (!project || !project.code || !project.name) {
      throw new Error(`客户端策略配置存在无效项目: ${source}`);
    }
    if (projectCodes.has(project.code)) throw new Error(`项目 code 重复: ${project.code}`);
    projectCodes.add(project.code);
  }
  for (const region of value.regions) {
    if (region.parentCode && !regionCodes.has(region.parentCode)) {
      throw new Error(`区域 ${region.code} 的 parentCode 不存在: ${region.parentCode}`);
    }
  }
  return {
    version: value.version,
    regions: value.regions,
    projects: value.projects,
  };
}
