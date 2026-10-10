import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { formatDateTimeInBjt } from '../../../common/utils/date.util';
import {
  buildUploadPublicUrl,
  normalizeStoredUploadPath,
} from '../../../common/utils/upload.util';
import { PolicyCollectRunItemEntity } from '../../../infrastructure/database/entities/policy-collect-run-item.entity';
import { PolicyProjectEntity } from '../../../infrastructure/database/entities/policy-project.entity';
import { RegionPolicyFileEntity } from '../../../infrastructure/database/entities/region-policy-file.entity';
import { RegionEntity } from '../../../infrastructure/database/entities/region.entity';
import { RoleEntity } from '../../../infrastructure/database/entities/role.entity';
import { UserEntity } from '../../../infrastructure/database/entities/user.entity';
import { toNullableString, toStringId } from '../../system/shared/system.utils';
import { RegionAccessService } from '../shared/region-access.service';
import { RegionPolicyFileInput } from './dto';

type RegionPolicyFileAiAnalysis = null | {
  aiReason: null | string;
  aiTaskId: null | string;
  officialConfidence: null | string;
  officialVerified: number;
  rawText: null | string;
  sourceRunItemId: string;
  structuredResult: null | unknown;
  summary: null | string;
};

type RegionPolicyFileItem = {
  aiAnalysis: RegionPolicyFileAiAnalysis;
  aiConfidence: null | string;
  applicationLevel: null | string;
  conditionText: null | string;
  content: null | string;
  createTime: string;
  documentNo: null | string;
  endDate: null | string;
  fileName: null | string;
  fileUrl: null | string;
  id: string;
  importedByAi: number;
  issuingAgency: null | string;
  materialText: null | string;
  officialFileUrl: null | string;
  officialPublishDate: null | string;
  officialSourceName: null | string;
  ownerName: string;
  ownerUserId: string;
  policyCategory: string;
  policyCategoryName: string;
  projectId: string;
  projectName: string;
  regionId: null | string;
  regionName: string;
  remark: null | string;
  sourceRunItemId: null | string;
  startDate: null | string;
  status: string;
  subsidyAmountMax: null | string;
  subsidyAmountMin: null | string;
  subsidyText: null | string;
  targetObjects: null | string;
  templateFileId: null | string;
  templateFileName: null | string;
  title: string;
  updateTime: string;
};

type RegionPolicyFileDefaults = {
  content: null | string;
  ownerName: null | string;
  ownerUserId: null | string;
  projectId: null | string;
  projectName: null | string;
  templateFileId: null | string;
  templateFileName: null | string;
  title: null | string;
};

const POLICY_FILE_STATUSES = [
  'incomplete',
  'draft',
  'published',
  'archived',
  'expired',
] as const;

type PolicyFileStatus = (typeof POLICY_FILE_STATUSES)[number];

const POLICY_CATEGORY_LABELS: Record<string, string> = {
  all: '全部',
  notice: '申报通知',
  other: '其他',
  publicity: '公示情况',
  reward: '奖补情况',
};

@Injectable()
export class RegionPolicyFileService {
  constructor(
    @InjectRepository(RegionPolicyFileEntity)
    private readonly fileRepo: Repository<RegionPolicyFileEntity>,
    @InjectRepository(PolicyCollectRunItemEntity)
    private readonly collectRunItemRepo: Repository<PolicyCollectRunItemEntity>,
    @InjectRepository(RegionEntity)
    private readonly regionRepo: Repository<RegionEntity>,
    @InjectRepository(PolicyProjectEntity)
    private readonly projectRepo: Repository<PolicyProjectEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    private readonly regionAccessService: RegionAccessService,
  ) {}

  async list(
    query: Record<string, string | string[] | undefined>,
    request?: Request,
    user?: CurrentUser,
  ): Promise<{ items: RegionPolicyFileItem[]; total: number }> {
    const rows = await this.fileRepo.find({
      order: {
        id: 'DESC',
      },
    });

    let items = rows.map((row) => this.toItem(row, request));
    const allowedRegionIds = await this.regionAccessService.getAccessibleRegionIds(user);
    if (allowedRegionIds !== null) {
      items = items.filter((item) => item.regionId && allowedRegionIds.has(item.regionId));
    }
    const title = this.getQueryValue(query.title)?.trim().toLowerCase();
    const regionId = this.getQueryValue(query.regionId);
    const projectId = this.getQueryValue(query.projectId);
    const ownerUserId = this.getQueryValue(query.ownerUserId);
    const policyCategory = this.getQueryValue(query.policyCategory);
    const status = this.getQueryValue(query.status);

    if (title) {
      items = items.filter((item) => item.title.toLowerCase().includes(title));
    }
    if (regionId) {
      const regionIds = await this.collectRegionIds(regionId);
      items = items.filter((item) => item.regionId && regionIds.has(item.regionId));
    }
    if (projectId) {
      items = items.filter((item) => item.projectId === projectId);
    }
    if (ownerUserId) {
      items = items.filter((item) => item.ownerUserId === ownerUserId);
    }
    if (policyCategory) {
      items = items.filter((item) => item.policyCategory === policyCategory);
    }
    if (status) {
      items = items.filter((item) => item.status === status);
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

  async detail(
    id: string,
    request?: Request,
    user?: CurrentUser,
  ): Promise<RegionPolicyFileItem> {
    const entity = await this.getFileOrThrow(id);
    await this.regionAccessService.assertCanAccessRegion(user, entity.regionId);
    return this.toItem(
      entity,
      request,
      await this.resolveAiAnalysis(entity.sourceRunItemId),
    );
  }

  async getDefaults(
    query: Record<string, string | string[] | undefined>,
    user?: CurrentUser,
  ): Promise<RegionPolicyFileDefaults> {
    const regionId = this.getQueryValue(query.regionId);
    const projectId = this.getQueryValue(query.projectId);

    const region = regionId ? await this.resolveEnabledRegion(regionId) : null;
    if (region) {
      await this.regionAccessService.assertCanAccessRegion(user, region.id);
    }
    const project = projectId
      ? await this.resolveEnabledProject(projectId)
      : null;
    const owner = region ? await this.resolveFallbackOwner(user) : null;

    return {
      content: project?.basicDescription ?? null,
      ownerName: owner?.realName ?? null,
      ownerUserId: owner?.id ?? null,
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
      templateFileId: null,
      templateFileName: null,
      title: project?.name ?? null,
    };
  }

  async create(
    input: RegionPolicyFileInput,
    request?: Request,
    user?: CurrentUser,
  ): Promise<RegionPolicyFileItem> {
    const region = input.regionId
      ? await this.resolveEnabledRegion(input.regionId)
      : null;
    await this.regionAccessService.assertCanAccessRegion(user, region?.id, {
      allowAllForAdmin: true,
    });
    const project = await this.resolveEnabledProject(input.projectId);
    const defaults = this.getProjectDefaults(project);
    const owner = await this.resolveFallbackOwner(user);

    const entity = this.fileRepo.create({
      applicationLevel: toNullableString(input.applicationLevel),
      conditionText: toNullableString(input.conditionText),
      content: this.resolveContent(input.content, defaults.content),
      endDate: this.normalizeDate(input.endDate),
      fileName: toNullableString(input.fileName),
      fileUrl: normalizeStoredUploadPath(input.fileUrl),
      materialText: toNullableString(input.materialText),
      officialFileUrl: toNullableString(input.officialFileUrl),
      ownerName: owner.realName,
      ownerUserId: owner.id,
      policyCategory: this.normalizePolicyCategory(input.policyCategory),
      projectId: project.id,
      projectName: project.name,
      regionId: region?.id ?? null,
      regionName: region?.name ?? '全部区域',
      remark: toNullableString(input.remark),
      startDate: this.normalizeDate(input.startDate),
      status: this.normalizeStatus(input.status),
      subsidyAmountMax: this.normalizeDecimal(input.subsidyAmountMax),
      subsidyAmountMin: this.normalizeDecimal(input.subsidyAmountMin),
      subsidyText: toNullableString(input.subsidyText),
      targetObjects: toNullableString(input.targetObjects),
      templateFileId: toNullableString(input.templateFileId),
      templateFileName: toNullableString(input.templateFileName),
      title: this.resolveTitle(input.title, defaults.title),
    });

    return this.toItem(await this.fileRepo.save(entity), request);
  }

  async update(
    id: string,
    input: RegionPolicyFileInput,
    request?: Request,
    user?: CurrentUser,
  ): Promise<RegionPolicyFileItem> {
    const entity = await this.getFileOrThrow(id);
    await this.regionAccessService.assertCanAccessRegion(user, entity.regionId);

    let region = entity.regionId
      ? await this.regionRepo.findOne({ where: { id: entity.regionId } })
      : null;

    if (input.title !== undefined) {
      entity.title = this.resolveTitle(input.title);
    }
    if (input.regionId !== undefined) {
      region = input.regionId
        ? await this.resolveEnabledRegion(input.regionId)
        : null;
      await this.regionAccessService.assertCanAccessRegion(user, region?.id, {
        allowAllForAdmin: true,
      });
      entity.regionId = region?.id ?? null;
      entity.regionName = region?.name ?? '全部区域';
    }
    if (input.projectId !== undefined) {
      const project = await this.resolveEnabledProject(input.projectId);
      entity.projectId = project.id;
      entity.projectName = project.name;
    }
    if (input.regionId !== undefined) {
      const owner = await this.resolveFallbackOwner(user);
      entity.ownerName = owner.realName;
      entity.ownerUserId = owner.id;
    }
    if (input.content !== undefined) {
      entity.content = toNullableString(input.content);
    }
    if (input.startDate !== undefined) {
      entity.startDate = this.normalizeDate(input.startDate);
    }
    if (input.endDate !== undefined) {
      entity.endDate = this.normalizeDate(input.endDate);
    }
    if (input.subsidyAmountMin !== undefined) {
      entity.subsidyAmountMin = this.normalizeDecimal(input.subsidyAmountMin);
    }
    if (input.subsidyAmountMax !== undefined) {
      entity.subsidyAmountMax = this.normalizeDecimal(input.subsidyAmountMax);
    }
    if (input.subsidyText !== undefined) {
      entity.subsidyText = toNullableString(input.subsidyText);
    }
    if (input.applicationLevel !== undefined) {
      entity.applicationLevel = toNullableString(input.applicationLevel);
    }
    if (input.conditionText !== undefined) {
      entity.conditionText = toNullableString(input.conditionText);
    }
    if (input.materialText !== undefined) {
      entity.materialText = toNullableString(input.materialText);
    }
    if (input.targetObjects !== undefined) {
      entity.targetObjects = toNullableString(input.targetObjects);
    }
    if (input.fileName !== undefined) {
      entity.fileName = toNullableString(input.fileName);
    }
    if (input.fileUrl !== undefined) {
      entity.fileUrl = normalizeStoredUploadPath(input.fileUrl);
    }
    if (input.officialFileUrl !== undefined) {
      entity.officialFileUrl = toNullableString(input.officialFileUrl);
    }
    if (input.policyCategory !== undefined) {
      entity.policyCategory = this.normalizePolicyCategory(input.policyCategory);
    }
    if (input.remark !== undefined) {
      entity.remark = toNullableString(input.remark);
    }
    if (input.status !== undefined) {
      entity.status = this.normalizeStatus(input.status);
    }
    if (input.templateFileId !== undefined) {
      entity.templateFileId = toNullableString(input.templateFileId);
    }
    if (input.templateFileName !== undefined) {
      entity.templateFileName = toNullableString(input.templateFileName);
    }

    return this.toItem(await this.fileRepo.save(entity), request);
  }

  async publish(
    id: string,
    request?: Request,
    user?: CurrentUser,
  ): Promise<RegionPolicyFileItem> {
    return this.patchStatus(id, 'published', request, user);
  }

  async archive(
    id: string,
    request?: Request,
    user?: CurrentUser,
  ): Promise<RegionPolicyFileItem> {
    return this.patchStatus(id, 'archived', request, user);
  }

  async expire(
    id: string,
    request?: Request,
    user?: CurrentUser,
  ): Promise<RegionPolicyFileItem> {
    return this.patchStatus(id, 'expired', request, user);
  }

  async markIncomplete(
    id: string,
    request?: Request,
    user?: CurrentUser,
  ): Promise<RegionPolicyFileItem> {
    return this.patchStatus(id, 'incomplete', request, user);
  }

  async remove(id: string, user?: CurrentUser): Promise<void> {
    const entity = await this.getFileOrThrow(id);
    await this.regionAccessService.assertCanAccessRegion(user, entity.regionId);
    await this.fileRepo.delete({ id: entity.id });
  }

  private async resolveEnabledRegion(
    regionId?: null | string,
  ): Promise<RegionEntity> {
    const normalizedRegionId = toNullableString(regionId);
    if (!normalizedRegionId) {
      throw new BadRequestException('所属区域不能为空');
    }

    const region = await this.regionRepo.findOne({
      where: { id: toStringId(normalizedRegionId) },
    });
    if (!region) {
      throw new BadRequestException('所属区域不存在');
    }
    if (region.status !== 1) {
      throw new BadRequestException('停用区域不能创建政策文件');
    }

    return region;
  }

  private async resolveEnabledProject(
    projectId?: string,
  ): Promise<PolicyProjectEntity> {
    const normalizedProjectId = toNullableString(projectId);
    if (!normalizedProjectId) {
      throw new BadRequestException('统一政策项目不能为空');
    }

    const project = await this.projectRepo.findOne({
      where: { id: toStringId(normalizedProjectId) },
    });
    if (!project) {
      throw new BadRequestException('统一政策项目不存在');
    }
    if (project.enabled !== 1) {
      throw new BadRequestException('统一政策项目未启用，不能引用');
    }

    return project;
  }

  private async patchStatus(
    id: string,
    status: PolicyFileStatus,
    request?: Request,
    user?: CurrentUser,
  ): Promise<RegionPolicyFileItem> {
    const entity = await this.getFileOrThrow(id);
    await this.regionAccessService.assertCanAccessRegion(user, entity.regionId);
    entity.status = status;
    return this.toItem(await this.fileRepo.save(entity), request);
  }

  private normalizeStatus(value?: string): PolicyFileStatus {
    const status = value?.trim();
    if (!status) {
      return 'incomplete';
    }
    if (!POLICY_FILE_STATUSES.includes(status as PolicyFileStatus)) {
      throw new BadRequestException('政策文件状态不合法');
    }

    return status as PolicyFileStatus;
  }

  private normalizePolicyCategory(value?: null | string): string {
    const category = value?.trim() || 'notice';
    if (!POLICY_CATEGORY_LABELS[category]) {
      throw new BadRequestException('政策文件分类不合法');
    }
    return category;
  }

  private getPolicyCategoryLabel(value?: null | string): string {
    return POLICY_CATEGORY_LABELS[this.normalizePolicyCategory(value)];
  }

  private normalizeDate(value?: null | string): Date | null {
    const normalized = toNullableString(value);
    if (!normalized) {
      return null;
    }

    return new Date(`${normalized.slice(0, 10)}T00:00:00+08:00`);
  }

  private normalizeDecimal(value?: null | string): null | string {
    const normalized = toNullableString(value);
    if (!normalized) {
      return null;
    }

    const amount = Number(normalized);
    if (!Number.isFinite(amount)) {
      throw new BadRequestException('奖补金额不合法');
    }

    return amount.toFixed(2);
  }

  private async resolveUser(userId?: null | string): Promise<UserEntity | null> {
    const normalizedUserId = toNullableString(userId);
    if (!normalizedUserId) {
      return null;
    }

    const user = await this.userRepo.findOne({
      where: { id: toStringId(normalizedUserId) },
    });
    if (!user) {
      throw new BadRequestException('负责人不存在');
    }
    if (user.status !== 1) {
      throw new BadRequestException('负责人未启用');
    }

    return user;
  }

  private async getDefaultAdminUser(): Promise<UserEntity> {
    const adminRole = await this.roleRepo.findOne({
      relations: {
        userRoles: {
          user: true,
        },
      },
      where: {
        code: 'admin',
        status: 1,
      },
    });

    const adminUsers =
      adminRole?.userRoles
        ?.map((item) => item.user)
        .filter(
          (item): item is UserEntity => Boolean(item) && item.status === 1,
        )
        .sort(
          (left, right) =>
            left.createdAt.getTime() - right.createdAt.getTime() ||
            Number(left.id) - Number(right.id),
        ) ?? [];

    if (adminUsers.length > 0) {
      return adminUsers[0];
    }

    const adminByUsername = await this.userRepo.find({
      order: {
        id: 'ASC',
      },
      where: {
        status: 1,
        username: 'admin',
      },
    });
    if (adminByUsername.length > 0) {
      return adminByUsername[0];
    }

    throw new BadRequestException('未找到启用的系统管理员用户');
  }

  private async resolveFallbackOwner(user?: CurrentUser): Promise<UserEntity> {
    try {
      return await this.getDefaultAdminUser();
    } catch {
      const currentUser = await this.resolveUser(
        user?.id === undefined ? null : String(user.id),
      );
      if (currentUser) {
        return currentUser;
      }
      throw new BadRequestException('未找到可用的默认负责人');
    }
  }

  private getQueryValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private async getFileOrThrow(id: string): Promise<RegionPolicyFileEntity> {
    const entity = await this.fileRepo.findOne({
      where: { id: toStringId(id) },
    });
    if (!entity) {
      throw new NotFoundException('政策文件不存在');
    }
    return entity;
  }

  private getProjectDefaults(
    project: PolicyProjectEntity,
  ): Pick<RegionPolicyFileDefaults, 'content' | 'title'> {
    return {
      content: project.basicDescription ?? null,
      title: project.name,
    };
  }

  private resolveTitle(value?: null | string, fallback?: null | string): string {
    const title = (toNullableString(value) ?? fallback ?? '').trim();
    if (!title) {
      throw new BadRequestException('政策文件标题不能为空');
    }
    return title;
  }

  private resolveContent(
    value?: null | string,
    fallback?: null | string,
  ): null | string {
    if (value !== undefined) {
      return toNullableString(value);
    }
    return toNullableString(fallback);
  }

  private async collectRegionIds(rootRegionId: string): Promise<Set<string>> {
    const rows = await this.regionRepo.find({
      order: {
        id: 'ASC',
      },
    });

    const childrenMap = new Map<string, string[]>();
    rows.forEach((row) => {
      const parentId = row.parentId ? String(row.parentId) : '';
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)?.push(String(row.id));
    });

    const ids = new Set<string>();
    const queue = [rootRegionId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || ids.has(currentId)) {
        continue;
      }
      ids.add(currentId);
      const children = childrenMap.get(currentId) ?? [];
      children.forEach((childId) => queue.push(childId));
    }

    return ids;
  }

  private toItem(
    row: RegionPolicyFileEntity,
    request?: Request,
    aiAnalysis: RegionPolicyFileAiAnalysis = null,
  ): RegionPolicyFileItem {
    return {
      aiAnalysis,
      aiConfidence: row.aiConfidence,
      applicationLevel: row.applicationLevel,
      conditionText: row.conditionText,
      content: row.content,
      createTime: formatDateTimeInBjt(row.createdAt),
      documentNo: row.documentNo,
      endDate: this.formatDate(row.endDate),
      fileName: row.fileName,
      fileUrl: buildUploadPublicUrl(row.fileUrl, request),
      id: String(row.id),
      importedByAi: row.importedByAi,
      issuingAgency: row.issuingAgency,
      materialText: row.materialText,
      officialFileUrl: row.officialFileUrl,
      officialPublishDate: this.formatDate(row.officialPublishDate),
      officialSourceName: row.officialSourceName,
      ownerName: row.ownerName,
      ownerUserId: row.ownerUserId,
      policyCategory: this.normalizePolicyCategory(row.policyCategory),
      policyCategoryName: this.getPolicyCategoryLabel(row.policyCategory),
      projectId: row.projectId,
      projectName: row.projectName,
      regionId: row.regionId,
      regionName: row.regionName,
      remark: row.remark,
      sourceRunItemId: row.sourceRunItemId
        ? String(row.sourceRunItemId)
        : null,
      startDate: this.formatDate(row.startDate),
      status: row.status,
      subsidyAmountMax: row.subsidyAmountMax,
      subsidyAmountMin: row.subsidyAmountMin,
      subsidyText: row.subsidyText,
      targetObjects: row.targetObjects,
      templateFileId: row.templateFileId,
      templateFileName: row.templateFileName,
      title: row.title,
      updateTime: formatDateTimeInBjt(row.updatedAt),
    };
  }

  private async resolveAiAnalysis(
    sourceRunItemId?: null | string,
  ): Promise<RegionPolicyFileAiAnalysis> {
    if (!sourceRunItemId) {
      return null;
    }

    const item = await this.collectRunItemRepo.findOne({
      where: { id: toStringId(sourceRunItemId) },
    });
    if (!item) {
      return null;
    }

    return {
      aiReason: item.aiReason,
      aiTaskId: item.aiTaskId ? String(item.aiTaskId) : null,
      officialConfidence: item.officialConfidence,
      officialVerified: item.officialVerified,
      rawText: item.rawText,
      sourceRunItemId: String(item.id),
      structuredResult: this.parseJson(item.structuredResult),
      summary: item.summary,
    };
  }

  private parseJson(value: null | string): null | unknown {
    if (!value) {
      return null;
    }
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }

  private formatDate(value: Date | null | string): null | string {
    if (!value) {
      return null;
    }

    return formatDateTimeInBjt(value).slice(0, 10);
  }
}
