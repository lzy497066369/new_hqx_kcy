import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Like, Repository } from 'typeorm';

import { DeclarationPresetEntity } from '../../infrastructure/database/entities/declaration-preset.entity';
import { DeclarationSchemeEntity } from '../../infrastructure/database/entities/declaration-scheme.entity';
import { PolicyProjectEntity } from '../../infrastructure/database/entities/policy-project.entity';
import { ProjectMaterialRequirementEntity } from '../../infrastructure/database/entities/project-material-requirement.entity';
import { ProjectMaterialRequirementItemEntity } from '../../infrastructure/database/entities/project-material-requirement-item.entity';
import { RegionEntity } from '../../infrastructure/database/entities/region.entity';
import { ClientPolicyConfig, ClientPolicyProjectConfig, loadClientPolicyConfig } from './client-policy.config';

const REGION_MARKER_PREFIX = 'client-policy-code:';

@Injectable()
export class ClientPolicyConfigService implements OnModuleInit {
  private readonly logger = new Logger(ClientPolicyConfigService.name);

  constructor(
    @InjectRepository(RegionEntity) private readonly regionRepo: Repository<RegionEntity>,
    @InjectRepository(PolicyProjectEntity) private readonly projectRepo: Repository<PolicyProjectEntity>,
    @InjectRepository(ProjectMaterialRequirementEntity) private readonly requirementRepo: Repository<ProjectMaterialRequirementEntity>,
    @InjectRepository(ProjectMaterialRequirementItemEntity) private readonly requirementItemRepo: Repository<ProjectMaterialRequirementItemEntity>,
    @InjectRepository(DeclarationSchemeEntity) private readonly schemeRepo: Repository<DeclarationSchemeEntity>,
    @InjectRepository(DeclarationPresetEntity) private readonly presetRepo: Repository<DeclarationPresetEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const config = await loadClientPolicyConfig();
    await this.sync(config);
    this.logger.log(`客户端策略配置已加载（版本 ${config.version}，区域 ${config.regions.length} 个，项目 ${config.projects.length} 个）`);
  }

  private async sync(config: ClientPolicyConfig): Promise<void> {
    await this.syncRegions(config);
    for (const project of config.projects) await this.syncProject(project);
  }

  private async syncRegions(config: ClientPolicyConfig): Promise<void> {
    const byCode = new Map<string, RegionEntity>();
    for (const item of config.regions) {
      const marker = `${REGION_MARKER_PREFIX}${item.code}`;
      const entity = await this.regionRepo.findOne({ where: { remark: marker } });
      const region = entity ?? this.regionRepo.create({
        parentId: null,
        name: item.name,
        level: item.level,
        status: 1,
        sortNum: 0,
        remark: marker,
      });
      region.name = item.name;
      region.level = item.level;
      region.parentId = null;
      region.status = item.status ?? 1;
      region.sortNum = item.sortNum ?? 0;
      region.remark = item.remark ? `${marker} | ${item.remark}` : marker;
      byCode.set(item.code, await this.regionRepo.save(region));
    }
    for (const item of config.regions) {
      const region = byCode.get(item.code);
      if (!region) continue;
      region.parentId = item.parentCode ? String(byCode.get(item.parentCode)?.id ?? '') || null : null;
      await this.regionRepo.save(region);
    }
    const managed = await this.regionRepo.find({ where: { remark: Like(`${REGION_MARKER_PREFIX}%`) } });
    const active = new Set(config.regions.map((item) => item.code));
    for (const region of managed) {
      const code = region.remark?.slice(REGION_MARKER_PREFIX.length).split(' | ')[0];
      if (code && !active.has(code) && region.status === 1) {
        region.status = 0;
        await this.regionRepo.save(region);
      }
    }
  }

  private async syncProject(input: ClientPolicyProjectConfig): Promise<void> {
    let project = await this.projectRepo.findOne({ where: { code: input.code } });
    project = project ?? this.projectRepo.create({ code: input.code, name: input.name });
    project.name = input.name;
    project.policyType = input.policyType ?? null;
    project.applicableObjects = input.applicableObjects ?? null;
    project.basicDescription = input.basicDescription ?? null;
    project.enabled = input.enabled ?? 1;
    project.sortNum = input.sortNum ?? 0;
    project.remark = input.remark ?? '由 config/client-policy.config.json 维护';
    project = await this.projectRepo.save(project);

    if (input.materials) await this.syncMaterials(project, input);
    if (input.scheme) await this.syncScheme(project, input.scheme);
  }

  private async syncMaterials(project: PolicyProjectEntity, input: ClientPolicyProjectConfig): Promise<void> {
    const materials = input.materials;
    if (!materials) return;
    let requirement = await this.requirementRepo.findOne({ where: { projectId: String(project.id) } });
    requirement = requirement ?? this.requirementRepo.create({ projectId: String(project.id), requirementName: materials.requirementName });
    requirement.requirementName = materials.requirementName;
    requirement.description = materials.description ?? null;
    requirement.version = materials.version ?? 'v1';
    requirement.enabled = materials.enabled ?? 1;
    requirement = await this.requirementRepo.save(requirement);
    for (const item of materials.items ?? []) {
      let row = await this.requirementItemRepo.findOne({ where: { requirementId: String(requirement.id), moduleKey: item.moduleKey, tabKey: item.tabKey, itemName: item.itemName } });
      row = row ?? this.requirementItemRepo.create({ requirementId: String(requirement.id), moduleKey: item.moduleKey, tabKey: item.tabKey, itemName: item.itemName });
      row.requirementDesc = item.requirementDesc ?? null;
      row.requiredCount = item.requiredCount ?? 1;
      row.requiredYears = item.requiredYears ? JSON.stringify(item.requiredYears) : null;
      row.requiredFields = item.requiredFields ? JSON.stringify(item.requiredFields) : null;
      row.attachmentRequired = item.attachmentRequired ?? 0;
      row.isRequired = item.isRequired ?? 1;
      row.scoreWeight = item.scoreWeight ?? 1;
      row.sortOrder = item.sortOrder ?? 0;
      row.enabled = item.enabled ?? 1;
      await this.requirementItemRepo.save(row);
    }
  }

  private async syncScheme(project: PolicyProjectEntity, input: NonNullable<ClientPolicyProjectConfig['scheme']>): Promise<void> {
    const presets = new Map<string, DeclarationPresetEntity>();
    for (const preset of input.presets ?? []) {
      let row = await this.presetRepo.findOne({ where: { presetType: preset.presetType, name: preset.name, version: preset.version ?? 'v1' } });
      row = row ?? this.presetRepo.create({ presetType: preset.presetType, name: preset.name, version: preset.version ?? 'v1' });
      row.status = preset.status ?? 'published';
      row.description = preset.description ?? null;
      row.payloadJson = JSON.stringify(preset.payload ?? {});
      presets.set(preset.presetType, await this.presetRepo.save(row));
    }
    let scheme = await this.schemeRepo.findOne({ where: { projectId: String(project.id), regionId: IsNull() } });
    scheme = scheme ?? this.schemeRepo.create({ projectId: String(project.id), regionId: null, schemeName: input.schemeName });
    scheme.schemeName = input.schemeName;
    scheme.version = input.version ?? 'v1';
    scheme.status = input.status ?? 'published';
    scheme.effectiveStartDate = input.effectiveStartDate ? new Date(input.effectiveStartDate) : null;
    scheme.effectiveEndDate = input.effectiveEndDate ? new Date(input.effectiveEndDate) : null;
    scheme.enterprisePresetId = presets.get('enterprise')?.id ? String(presets.get('enterprise')?.id) : scheme.enterprisePresetId ?? null;
    scheme.qualificationPresetId = presets.get('qualification')?.id ? String(presets.get('qualification')?.id) : scheme.qualificationPresetId ?? null;
    scheme.materialPresetId = presets.get('material')?.id ? String(presets.get('material')?.id) : scheme.materialPresetId ?? null;
    scheme.scorePresetId = presets.get('score')?.id ? String(presets.get('score')?.id) : scheme.scorePresetId ?? null;
    scheme.flowPresetId = presets.get('flow')?.id ? String(presets.get('flow')?.id) : scheme.flowPresetId ?? null;
    scheme.qualificationRulesJson = this.toJson(input.qualificationRules);
    scheme.materialRulesJson = this.toJson(input.materialRules);
    scheme.scoreRulesJson = this.toJson(input.scoreRules);
    scheme.flowTemplateJson = this.toJson(input.flowTemplate);
    scheme.capabilitiesJson = this.toJson(input.capabilities);
    await this.schemeRepo.save(scheme);
  }

  private toJson(value: unknown): string | null {
    return value === undefined ? null : JSON.stringify(value ?? {});
  }
}
