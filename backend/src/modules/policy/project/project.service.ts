import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';

import { formatDateTimeInBjt } from '../../../common/utils/date.util';
import { parseFlowDate } from '../../../common/utils/flow-date.util';
import { PolicyProjectEntity } from '../../../infrastructure/database/entities/policy-project.entity';
import { DeclarationSchemeEntity } from '../../../infrastructure/database/entities/declaration-scheme.entity';
import {
  DeclarationPresetEntity,
  type DeclarationPresetType,
} from '../../../infrastructure/database/entities/declaration-preset.entity';
import { ProjectMaterialRequirementEntity } from '../../../infrastructure/database/entities/project-material-requirement.entity';
import { ProjectMaterialRequirementItemEntity } from '../../../infrastructure/database/entities/project-material-requirement-item.entity';
import { RegionEntity } from '../../../infrastructure/database/entities/region.entity';
import { RegionPolicyFileEntity } from '../../../infrastructure/database/entities/region-policy-file.entity';
import { toNullableString, toNumber, toStringId } from '../../system/shared/system.utils';
import {
  PolicyProjectInput,
  ProjectMaterialRequirementInput,
  ProjectMaterialRequirementItemInput,
  DeclarationSchemeInput,
} from './dto';

type PolicyProjectItem = {
  applicableObjects: string | null;
  basicDescription: string | null;
  createTime: string;
  enabled: number;
  id: string;
  name: string;
  policyType: string | null;
  updateTime: string;
};

type ProjectMaterialRequirementItem = {
  attachmentRequired: number;
  enabled: number;
  id: string;
  isRequired: number;
  itemName: string;
  moduleKey: string;
  requirementDesc: null | string;
  requirementId: string;
  requiredCount: number;
  requiredFields: null | string;
  requiredYears: null | string;
  scoreWeight: number;
  sortOrder: number;
  tabKey: string;
  updateTime: string;
};

type ProjectMaterialRequirement = {
  createTime: string;
  description: null | string;
  enabled: number;
  id: string;
  projectId: string;
  requirementName: string;
  updateTime: string;
  version: string;
};

type DeclarationCapabilities = {
  exportPackage: boolean;
  gaoxinScore: boolean;
  score: boolean;
};

type DeclarationSchemeItem = {
  capabilities: DeclarationCapabilities;
  effectiveEndDate: null | string;
  effectiveStartDate: null | string;
  flowTemplate: unknown;
  flowPresetId: null | string;
  id: string;
  materialRules: unknown;
  materialPresetId: null | string;
  projectId: string;
  qualificationRules: unknown;
  qualificationPresetId: null | string;
  regionId: null | string;
  schemeName: string;
  scoreRules: unknown;
  scorePresetId: null | string;
  status: 'draft' | 'published';
  updateTime: string;
  version: string;
};

@Injectable()
export class PolicyProjectService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PolicyProjectEntity)
    private readonly projectRepo: Repository<PolicyProjectEntity>,
    @InjectRepository(DeclarationSchemeEntity)
    private readonly declarationSchemeRepo: Repository<DeclarationSchemeEntity>,
    @InjectRepository(DeclarationPresetEntity)
    private readonly declarationPresetRepo: Repository<DeclarationPresetEntity>,
    @InjectRepository(ProjectMaterialRequirementEntity)
    private readonly projectMaterialRequirementRepo: Repository<ProjectMaterialRequirementEntity>,
    @InjectRepository(ProjectMaterialRequirementItemEntity)
    private readonly projectMaterialRequirementItemRepo: Repository<ProjectMaterialRequirementItemEntity>,
    @InjectRepository(RegionPolicyFileEntity)
    private readonly fileRepo: Repository<RegionPolicyFileEntity>,
    @InjectRepository(RegionEntity)
    private readonly regionRepo: Repository<RegionEntity>,
  ) {}

  async list(query: Record<string, string | string[] | undefined>): Promise<{ items: PolicyProjectItem[]; total: number }> {
    const rows = await this.projectRepo.find({
      order: {
        updatedAt: 'DESC',
        id: 'DESC',
      },
    });

    let items = rows.map((row) => this.toItem(row));
    const name = this.getQueryValue(query.name)?.trim().toLowerCase();
    const policyType = this.getQueryValue(query.policyType)?.trim().toLowerCase();
    const enabled = this.getQueryValue(query.enabled);

    if (name) {
      items = items.filter((item) => item.name.toLowerCase().includes(name));
    }
    if (policyType) {
      items = items.filter((item) => (item.policyType ?? '').toLowerCase().includes(policyType));
    }
    if (enabled !== undefined) {
      items = items.filter((item) => String(item.enabled) === enabled);
    }

    const page = Math.max(Number(this.getQueryValue(query.page) ?? 1), 1);
    const pageSizeValue = this.getQueryValue(query.pageSize);
    const pageSize = Math.max(Number((pageSizeValue ?? items.length) || 10), 1);
    const start = (page - 1) * pageSize;

    return {
      items: items.slice(start, start + pageSize),
      total: items.length,
    };
  }

  async detail(id: string): Promise<PolicyProjectItem> {
    return this.toItem(await this.requireProject(id));
  }

  async create(input: PolicyProjectInput): Promise<PolicyProjectItem> {
    const entity = this.projectRepo.create({
      applicableObjects: this.normalizeRequiredText(input.applicableObjects, '适用对象不能为空'),
      basicDescription: toNullableString(input.basicDescription),
      code: this.generateInternalCode(),
      enabled: this.normalizeEnabled(input.enabled, 1),
      name: this.normalizeRequiredText(input.name, '项目名称不能为空'),
      policyType: this.normalizeRequiredText(input.policyType, '政策类型不能为空'),
      remark: null,
      sortNum: 0,
    });

    return this.toItem(await this.projectRepo.save(entity));
  }

  async update(id: string, input: PolicyProjectInput): Promise<PolicyProjectItem> {
    const entity = await this.requireProject(id);

    if (input.name !== undefined) {
      entity.name = this.normalizeRequiredText(input.name, '项目名称不能为空');
    }
    if (input.policyType !== undefined) {
      entity.policyType = this.normalizeRequiredText(input.policyType, '政策类型不能为空');
    }
    if (input.applicableObjects !== undefined) {
      entity.applicableObjects = this.normalizeRequiredText(input.applicableObjects, '适用对象不能为空');
    }
    if (input.basicDescription !== undefined) {
      entity.basicDescription = toNullableString(input.basicDescription);
    }
    if (input.enabled !== undefined) {
      entity.enabled = this.normalizeEnabled(input.enabled, entity.enabled);
    }

    const saved = await this.projectRepo.save(entity);
    await this.fileRepo.update({ projectId: saved.id }, { projectName: saved.name });
    return this.toItem(saved);
  }

  async setEnabled(id: string, enabled: number): Promise<PolicyProjectItem> {
    const entity = await this.requireProject(id);
    entity.enabled = this.normalizeEnabled(enabled, entity.enabled);
    return this.toItem(await this.projectRepo.save(entity));
  }

  async remove(id: string): Promise<void> {
    const entity = await this.requireProject(id);

    const fileCount = await this.fileRepo.count({ where: { projectId: entity.id } });
    if (fileCount > 0) {
      throw new BadRequestException('请先删除引用该项目的区域政策文件');
    }

    await this.projectRepo.delete({ id: entity.id });
  }

  async getProjectMaterialRequirementDetail(projectId: string): Promise<{
    items: ProjectMaterialRequirementItem[];
    requirement: null | ProjectMaterialRequirement;
  }> {
    await this.requireProject(projectId);
    const requirement = await this.projectMaterialRequirementRepo.findOne({
      order: { id: 'DESC' },
      where: { projectId: toStringId(projectId) },
    });

    if (!requirement) {
      return {
        items: [],
        requirement: null,
      };
    }

    return this.toProjectMaterialRequirementDetail(requirement);
  }

  async saveProjectMaterialRequirement(
    projectId: string,
    input: ProjectMaterialRequirementInput,
  ): Promise<{
    items: ProjectMaterialRequirementItem[];
    requirement: ProjectMaterialRequirement;
  }> {
    const project = await this.requireProject(projectId);
    const existed = await this.projectMaterialRequirementRepo.findOne({
      order: { id: 'DESC' },
      where: { projectId: project.id },
    });
    const entity =
      existed ??
      this.projectMaterialRequirementRepo.create({
        enabled: 1,
        projectId: project.id,
        version: 'v1',
      });

    entity.requirementName = this.normalizeRequiredText(
      input.requirementName ?? entity.requirementName ?? `${project.name}材料要求`,
      '材料要求名称不能为空',
    );
    entity.description = toNullableString(input.description);
    entity.version = this.normalizeRequiredText(
      input.version ?? entity.version ?? 'v1',
      '版本号不能为空',
    );
    entity.enabled = this.normalizeEnabled(input.enabled, entity.enabled ?? 1);

    const saved = await this.projectMaterialRequirementRepo.save(entity);
    return this.toProjectMaterialRequirementDetail(saved) as Promise<{
      items: ProjectMaterialRequirementItem[];
      requirement: ProjectMaterialRequirement;
    }>;
  }

  async createProjectMaterialRequirementItem(
    input: ProjectMaterialRequirementItemInput,
  ): Promise<ProjectMaterialRequirementItem> {
    const requirement = await this.requireProjectMaterialRequirement(
      input.requirementId,
    );
    const entity = this.projectMaterialRequirementItemRepo.create({
      requirementId: requirement.id,
    });
    this.assignProjectMaterialRequirementItem(entity, input);

    return this.toProjectMaterialRequirementItem(
      await this.projectMaterialRequirementItemRepo.save(entity),
    );
  }

  async updateProjectMaterialRequirementItem(
    id: string,
    input: ProjectMaterialRequirementItemInput,
  ): Promise<ProjectMaterialRequirementItem> {
    const entity = await this.requireProjectMaterialRequirementItem(id);
    this.assignProjectMaterialRequirementItem(entity, input);

    return this.toProjectMaterialRequirementItem(
      await this.projectMaterialRequirementItemRepo.save(entity),
    );
  }

  async deleteProjectMaterialRequirementItem(id: string): Promise<void> {
    const entity = await this.requireProjectMaterialRequirementItem(id);
    await this.projectMaterialRequirementItemRepo.delete({ id: entity.id });
  }

  async listDeclarationSchemes(projectId: string): Promise<DeclarationSchemeItem[]> {
    await this.requireProject(projectId);
    const rows = await this.declarationSchemeRepo.find({
      order: { updatedAt: 'DESC', id: 'DESC' },
      where: { projectId: toStringId(projectId) },
    });
    return rows.map((row) => this.toDeclarationSchemeItem(row));
  }

  async saveDeclarationScheme(
    projectId: string,
    input: DeclarationSchemeInput,
  ): Promise<DeclarationSchemeItem> {
    const project = await this.requireProject(projectId);
    const regionId = await this.resolveSchemeRegionId(input.regionId);
    const presets = await this.resolveSchemePresets(input);
    const flowTemplate = presets.flow
      ? await this.freezeFlowNodeQualificationPresets(this.parseConfigJson(presets.flow.payloadJson, {}))
      : input.flowTemplate;
    if (flowTemplate !== undefined) this.validateFlowTemplate(flowTemplate);
    const entity = this.declarationSchemeRepo.create({
      capabilitiesJson: JSON.stringify(this.normalizeCapabilities(input.capabilities)),
      effectiveEndDate: this.normalizeOptionalDate(input.effectiveEndDate),
      effectiveStartDate: this.normalizeOptionalDate(input.effectiveStartDate),
      enterprisePresetId: null,
      enterprisePresetJson: null,
      flowPresetId: presets.flow?.id ?? null,
      flowTemplateJson: this.normalizeConfigJson(flowTemplate ?? this.defaultFlowTemplate(), '流程配置'),
      materialPresetId: presets.material?.id ?? null,
      materialRulesJson: presets.material?.payloadJson ?? this.normalizeConfigJson(input.materialRules ?? [], '材料规则'),
      projectId: project.id,
      qualificationPresetId: presets.qualification?.id ?? null,
      qualificationRulesJson: presets.qualification?.payloadJson ?? this.normalizeConfigJson(input.qualificationRules ?? { mode: 'all', rules: [] }, '资格规则'),
      regionId,
      schemeName: this.normalizeRequiredText(
        input.schemeName,
        '申报方案名称不能为空',
      ),
      scorePresetId: presets.score?.id ?? null,
      scoreRulesJson: presets.score?.payloadJson ?? this.normalizeConfigJson(input.scoreRules ?? { passScore: 0, items: [] }, '评分规则'),
      status: 'draft',
      version: this.normalizeRequiredText(input.version ?? 'v1', '版本不能为空'),
    });
    return this.toDeclarationSchemeItem(await this.declarationSchemeRepo.save(entity));
  }

  async updateDeclarationScheme(
    id: string,
    input: DeclarationSchemeInput,
  ): Promise<DeclarationSchemeItem> {
    const entity = await this.requireDeclarationScheme(id);
    if (entity.status === 'published') {
      throw new BadRequestException('已发布方案不可直接修改，请新建版本后发布');
    }
    if (input.schemeName !== undefined) entity.schemeName = this.normalizeRequiredText(input.schemeName, '申报方案名称不能为空');
    if (input.version !== undefined) entity.version = this.normalizeRequiredText(input.version, '版本不能为空');
    if (input.regionId !== undefined) entity.regionId = await this.resolveSchemeRegionId(input.regionId);
    if (input.effectiveStartDate !== undefined) entity.effectiveStartDate = this.normalizeOptionalDate(input.effectiveStartDate);
    if (input.effectiveEndDate !== undefined) entity.effectiveEndDate = this.normalizeOptionalDate(input.effectiveEndDate);
    const presets = await this.resolveSchemePresets(input);
    if (input.qualificationPresetId !== undefined) {
      entity.qualificationPresetId = presets.qualification?.id ?? null;
      entity.qualificationRulesJson = presets.qualification?.payloadJson ?? this.normalizeConfigJson(input.qualificationRules ?? { mode: 'all', rules: [] }, '资格规则');
    } else if (input.qualificationRules !== undefined) entity.qualificationRulesJson = this.normalizeConfigJson(input.qualificationRules, '资格规则');
    if (input.materialPresetId !== undefined) {
      entity.materialPresetId = presets.material?.id ?? null;
      entity.materialRulesJson = presets.material?.payloadJson ?? this.normalizeConfigJson(input.materialRules ?? [], '材料规则');
    } else if (input.materialRules !== undefined) entity.materialRulesJson = this.normalizeConfigJson(input.materialRules, '材料规则');
    if (input.scorePresetId !== undefined) {
      entity.scorePresetId = presets.score?.id ?? null;
      entity.scoreRulesJson = presets.score?.payloadJson ?? this.normalizeConfigJson(input.scoreRules ?? { passScore: 0, items: [] }, '评分规则');
    } else if (input.scoreRules !== undefined) entity.scoreRulesJson = this.normalizeConfigJson(input.scoreRules, '评分规则');
    if (input.flowPresetId !== undefined) {
      const flowTemplate = presets.flow
        ? await this.freezeFlowNodeQualificationPresets(this.parseConfigJson(presets.flow.payloadJson, {}))
        : input.flowTemplate ?? this.defaultFlowTemplate();
      this.validateFlowTemplate(
        flowTemplate,
      );
      entity.flowPresetId = presets.flow?.id ?? null;
      entity.flowTemplateJson = this.normalizeConfigJson(flowTemplate, '流程配置');
    } else if (input.flowTemplate !== undefined) {
      this.validateFlowTemplate(input.flowTemplate);
      entity.flowTemplateJson = this.normalizeConfigJson(input.flowTemplate, '流程配置');
    }
    if (input.capabilities !== undefined) entity.capabilitiesJson = JSON.stringify(this.normalizeCapabilities(input.capabilities));
    return this.toDeclarationSchemeItem(await this.declarationSchemeRepo.save(entity));
  }

  async publishDeclarationScheme(id: string): Promise<DeclarationSchemeItem> {
    const entity = await this.requireDeclarationScheme(id);
    const missing = [
      ['准入条件预设', entity.qualificationPresetId],
      ['材料清单预设', entity.materialPresetId],
      ['评分模型预设', entity.scorePresetId],
      ['流程模板预设', entity.flowPresetId],
    ].filter(([, value]) => !value).map(([label]) => label);
    if (missing.length > 0) {
      throw new BadRequestException(`发布前还需要配置：${missing.join('、')}`);
    }
    this.validateFlowTemplate(this.parseConfigJson(entity.flowTemplateJson, {}));
    return this.dataSource.transaction(async (manager) => {
      const schemes = await manager.find(DeclarationSchemeEntity, {
        lock: { mode: 'pessimistic_write' },
        where: {
          projectId: entity.projectId,
          regionId: entity.regionId ?? IsNull(),
          status: 'published',
        },
      });
      if (schemes.length > 0) {
        await manager.update(
          DeclarationSchemeEntity,
          schemes.map((item) => item.id),
          { status: 'draft' },
        );
      }
      entity.status = 'published';
      return this.toDeclarationSchemeItem(await manager.save(DeclarationSchemeEntity, entity));
    });
  }

  private async requireDeclarationScheme(id: string): Promise<DeclarationSchemeEntity> {
    const entity = await this.declarationSchemeRepo.findOne({ where: { id: toStringId(id) } });
    if (!entity) throw new NotFoundException('申报方案不存在');
    return entity;
  }

  private async resolveSchemePresets(input: DeclarationSchemeInput) {
    const [qualification, material, score, flow] = await Promise.all([
      this.resolvePreset(input.qualificationPresetId, 'qualification'),
      this.resolvePreset(input.materialPresetId, 'material'),
      this.resolvePreset(input.scorePresetId, 'score'),
      this.resolvePreset(input.flowPresetId, 'flow'),
    ]);
    return { qualification, material, score, flow };
  }

  private async resolvePreset(
    id: null | string | undefined,
    presetType: DeclarationPresetType,
  ): Promise<DeclarationPresetEntity | null> {
    if (id === undefined || id === null || id === '') return null;
    const entity = await this.declarationPresetRepo.findOne({
      where: { id: toStringId(id), presetType, status: 'published' },
    });
    if (!entity) throw new BadRequestException('所选预设不存在或尚未发布');
    return entity;
  }

  private normalizeCapabilities(value: Record<string, boolean> | undefined): DeclarationCapabilities {
    const capabilities = value ?? {};
    const gaoxinScore = capabilities.gaoxinScore === true;
    const exportPackage = capabilities.exportPackage === true;
    return {
      exportPackage,
      gaoxinScore,
      score: capabilities.score !== false,
    };
  }

  private async resolveSchemeRegionId(value: null | string | undefined): Promise<null | string> {
    const regionId = toNullableString(value);
    if (!regionId) return null;
    const region = await this.regionRepo.findOne({ where: { id: regionId, status: 1 } });
    if (!region) throw new BadRequestException('适用地区不存在或已停用');
    return String(region.id);
  }

  private async freezeFlowNodeQualificationPresets(value: unknown): Promise<unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const template = value as { nodes?: unknown };
    if (!Array.isArray(template.nodes)) return value;
    const presetIds = [...new Set(template.nodes.flatMap((node) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return [];
      const ids = (node as { qualificationPresetIds?: unknown }).qualificationPresetIds;
      return Array.isArray(ids)
        ? ids.map((id) => String(id).trim()).filter(Boolean)
        : [];
    }))];
    if (presetIds.length === 0) return value;

    const presets = await this.declarationPresetRepo.find({
      where: { id: In(presetIds), presetType: 'qualification', status: 'published' },
    });
    const presetMap = new Map(presets.map((preset) => [String(preset.id), preset]));
    const missingIds = presetIds.filter((id) => !presetMap.has(id));
    if (missingIds.length > 0) {
      throw new BadRequestException(`节点准入条件预设不可用：${missingIds.join('、')}`);
    }

    return {
      ...template,
      nodes: template.nodes.map((node) => {
        if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
        const item = node as Record<string, unknown>;
        const ids = Array.isArray(item.qualificationPresetIds)
          ? item.qualificationPresetIds.map((id) => String(id).trim()).filter(Boolean)
          : [];
        return {
          ...item,
          qualificationSnapshots: ids.map((id) => {
            const preset = presetMap.get(id)!;
            return {
              name: preset.name,
              rules: this.parseConfigJson(preset.payloadJson, { mode: 'all', rules: [] }),
            };
          }),
        };
      }),
    };
  }

  private normalizeConfigJson(value: unknown, label: string): string {
    if (!value || typeof value !== 'object') throw new BadRequestException(`${label}必须为对象或数组`);
    return JSON.stringify(value);
  }

  private validateFlowTemplate(value: unknown): void {
    const template = value as { nodes?: unknown };
    if (!template || typeof template !== 'object' || !Array.isArray(template.nodes) || template.nodes.length === 0) {
      throw new BadRequestException('流程模板至少需要配置一个节点');
    }
    const nodes = template.nodes as Array<Record<string, unknown>>;
    const names = new Set<string>();
    nodes.forEach((node, index) => {
      const code = String(node.code ?? '').trim();
      const name = String(node.name ?? '').trim();
      const timeRule = node.timeRule as Record<string, unknown> | undefined;
      const startDate = typeof timeRule?.startDate === 'string' ? timeRule.startDate : '';
      const endDate = typeof timeRule?.endDate === 'string' ? timeRule.endDate : '';
      if (!code || !name) throw new BadRequestException(`第 ${index + 1} 个流程节点的编码和名称不能为空`);
      if (names.has(name)) throw new BadRequestException('流程节点名称不能重复');
      names.add(name);
      if (timeRule?.mode !== 'date_range' || !this.isValidFlowDate(startDate) || !this.isValidFlowDate(endDate)) {
        throw new BadRequestException(`节点“${name}”必须配置有效的开始日期和截止日期`);
      }
      if (this.parseFlowDate(startDate)!.getTime() > this.parseFlowDate(endDate, true)!.getTime()) {
        throw new BadRequestException(`节点“${name}”的开始日期不能晚于截止日期`);
      }
    });
    const endNodes = nodes.filter((node) => node.type === 'end');
    if (endNodes.length !== 1 || nodes.at(-1)?.type !== 'end') {
      throw new BadRequestException('流程必须且只能有一个结束节点，并且结束节点必须位于最后');
    }
  }

  private isValidFlowDate(value: string): boolean {
    return parseFlowDate(value) !== null;
  }

  private parseFlowDate(value: string, endOfDay = false): Date | null {
    return parseFlowDate(value, endOfDay);
  }

  private normalizeOptionalDate(value: null | string | undefined): Date | null {
    const text = toNullableString(value);
    if (!text) return null;
    const date = new Date(text);
    if (Number.isNaN(date.valueOf())) throw new BadRequestException('生效日期格式不正确');
    return date;
  }

  private defaultFlowTemplate() {
    return {
      nodes: [
        { code: 'precheck', name: '预检', type: 'auto', timeRule: { mode: 'date_range' } },
        { code: 'enterprise_submit', name: '企业提交', role: 'enterprise', type: 'auto', timeRule: { mode: 'date_range' } },
        { code: 'review', name: '审核', role: 'consultant', type: 'auto', timeRule: { mode: 'date_range' } },
        { code: 'completed', name: '完成', type: 'end', timeRule: { mode: 'date_range' } },
      ],
    };
  }

  private toDeclarationSchemeItem(row: DeclarationSchemeEntity): DeclarationSchemeItem {
    return {
      capabilities: this.normalizeCapabilities(this.parseConfigJson<Record<string, boolean>>(row.capabilitiesJson, {})),
      effectiveEndDate: row.effectiveEndDate ? row.effectiveEndDate.toISOString().slice(0, 10) : null,
      effectiveStartDate: row.effectiveStartDate ? row.effectiveStartDate.toISOString().slice(0, 10) : null,
      flowTemplate: this.parseConfigJson(row.flowTemplateJson, { nodes: [] }),
      flowPresetId: row.flowPresetId ? String(row.flowPresetId) : null,
      id: String(row.id),
      materialRules: this.parseConfigJson(row.materialRulesJson, []),
      materialPresetId: row.materialPresetId ? String(row.materialPresetId) : null,
      projectId: String(row.projectId),
      qualificationRules: this.parseConfigJson(row.qualificationRulesJson, { mode: 'all', rules: [] }),
      qualificationPresetId: row.qualificationPresetId ? String(row.qualificationPresetId) : null,
      regionId: row.regionId ? String(row.regionId) : null,
      schemeName: row.schemeName,
      scoreRules: this.parseConfigJson(row.scoreRulesJson, { passScore: 0, items: [] }),
      scorePresetId: row.scorePresetId ? String(row.scorePresetId) : null,
      status: row.status,
      updateTime: formatDateTimeInBjt(row.updatedAt),
      version: row.version,
    };
  }

  private parseConfigJson<T>(value: null | string, fallback: T): T {
    if (!value) return fallback;
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }

  private async requireProject(id: string): Promise<PolicyProjectEntity> {
    const entity = await this.projectRepo.findOne({ where: { id: toStringId(id) } });
    if (!entity) {
      throw new NotFoundException('统一政策项目不存在');
    }

    return entity;
  }

  private async requireProjectMaterialRequirement(
    id: string | undefined,
  ): Promise<ProjectMaterialRequirementEntity> {
    if (!id) {
      throw new BadRequestException('材料要求 ID 不能为空');
    }

    const entity = await this.projectMaterialRequirementRepo.findOne({
      where: { id: toStringId(id) },
    });
    if (!entity) {
      throw new NotFoundException('项目材料要求不存在');
    }

    return entity;
  }

  private async requireProjectMaterialRequirementItem(
    id: string,
  ): Promise<ProjectMaterialRequirementItemEntity> {
    const entity = await this.projectMaterialRequirementItemRepo.findOne({
      where: { id: toStringId(id) },
    });
    if (!entity) {
      throw new NotFoundException('项目材料要求项不存在');
    }

    return entity;
  }

  private getQueryValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private normalizeRequiredText(value: string | undefined, message: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(message);
    }

    return normalized;
  }

  private normalizeEnabled(value: number | string | undefined, fallback: number): number {
    const enabled = toNumber(value, fallback);
    if (enabled !== 0 && enabled !== 1) {
      throw new BadRequestException('启用状态不合法');
    }

    return enabled;
  }

  private normalizeJsonText(value: null | string | undefined): null | string {
    const normalized = toNullableString(value);
    if (!normalized) {
      return null;
    }

    try {
      JSON.parse(normalized);
    } catch {
      throw new BadRequestException('JSON 字段格式不合法');
    }

    return normalized;
  }

  private assignProjectMaterialRequirementItem(
    entity: ProjectMaterialRequirementItemEntity,
    input: ProjectMaterialRequirementItemInput,
  ) {
    entity.moduleKey = this.normalizeRequiredText(input.moduleKey, '资料模块不能为空');
    entity.tabKey = this.normalizeRequiredText(input.tabKey, '资料子模块不能为空');
    entity.itemName = this.normalizeRequiredText(input.itemName, '材料名称不能为空');
    entity.requirementDesc = toNullableString(input.requirementDesc);
    entity.requiredCount = Math.max(toNumber(input.requiredCount, 1), 1);
    entity.requiredYears = this.normalizeJsonText(input.requiredYears);
    entity.requiredFields = this.normalizeJsonText(input.requiredFields);
    entity.attachmentRequired = this.normalizeEnabled(
      input.attachmentRequired,
      entity.attachmentRequired ?? 0,
    );
    entity.isRequired = this.normalizeEnabled(input.isRequired, entity.isRequired ?? 1);
    entity.scoreWeight = Math.max(Number(input.scoreWeight ?? entity.scoreWeight ?? 1), 0);
    entity.sortOrder = toNumber(input.sortOrder, entity.sortOrder ?? 0);
    entity.enabled = this.normalizeEnabled(input.enabled, entity.enabled ?? 1);
  }

  private generateInternalCode(): string {
    return `POLICY_PROJECT_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  private toItem(row: PolicyProjectEntity): PolicyProjectItem {
    return {
      applicableObjects: row.applicableObjects,
      basicDescription: row.basicDescription,
      createTime: formatDateTimeInBjt(row.createdAt),
      enabled: row.enabled,
      id: String(row.id),
      name: row.name,
      policyType: row.policyType,
      updateTime: formatDateTimeInBjt(row.updatedAt),
    };
  }

  private async toProjectMaterialRequirementDetail(
    requirement: ProjectMaterialRequirementEntity,
  ): Promise<{
    items: ProjectMaterialRequirementItem[];
    requirement: ProjectMaterialRequirement;
  }> {
    const items = await this.projectMaterialRequirementItemRepo.find({
      order: {
        sortOrder: 'ASC',
        id: 'ASC',
      },
      where: {
        requirementId: requirement.id,
      },
    });

    return {
      items: items.map((item) => this.toProjectMaterialRequirementItem(item)),
      requirement: this.toProjectMaterialRequirement(requirement),
    };
  }

  private toProjectMaterialRequirement(
    row: ProjectMaterialRequirementEntity,
  ): ProjectMaterialRequirement {
    return {
      createTime: formatDateTimeInBjt(row.createdAt),
      description: row.description,
      enabled: row.enabled,
      id: String(row.id),
      projectId: String(row.projectId),
      requirementName: row.requirementName,
      updateTime: formatDateTimeInBjt(row.updatedAt),
      version: row.version,
    };
  }

  private toProjectMaterialRequirementItem(
    row: ProjectMaterialRequirementItemEntity,
  ): ProjectMaterialRequirementItem {
    return {
      attachmentRequired: row.attachmentRequired,
      enabled: row.enabled,
      id: String(row.id),
      isRequired: row.isRequired,
      itemName: row.itemName,
      moduleKey: row.moduleKey,
      requirementDesc: row.requirementDesc,
      requirementId: String(row.requirementId),
      requiredCount: row.requiredCount,
      requiredFields: row.requiredFields,
      requiredYears: row.requiredYears,
      scoreWeight: Number(row.scoreWeight),
      sortOrder: row.sortOrder,
      tabKey: row.tabKey,
      updateTime: formatDateTimeInBjt(row.updatedAt),
    };
  }
}
