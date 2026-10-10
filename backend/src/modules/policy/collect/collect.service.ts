import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { IsNull, LessThan, Repository } from 'typeorm';

import { formatDateTimeInBjt } from '../../../common/utils/date.util';
import type { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { PolicyCollectJobEntity } from '../../../infrastructure/database/entities/policy-collect-job.entity';
import { PolicyCollectNotificationEntity } from '../../../infrastructure/database/entities/policy-collect-notification.entity';
import { PolicyCollectRunEntity } from '../../../infrastructure/database/entities/policy-collect-run.entity';
import { PolicyCollectRunItemEntity } from '../../../infrastructure/database/entities/policy-collect-run-item.entity';
import { PolicyProjectEntity } from '../../../infrastructure/database/entities/policy-project.entity';
import { RegionPolicyFileEntity } from '../../../infrastructure/database/entities/region-policy-file.entity';
import { RegionEntity } from '../../../infrastructure/database/entities/region.entity';
import { AiService } from '../../ai/ai.service';
import type { AiPolicyCollectSearchItem } from '../../ai/ai.types';
import { toNullableString, toNumber, toStringId } from '../../system/shared/system.utils';
import type { RegionPolicyFileInput } from '../file/dto';
import { RegionPolicyFileService } from '../file/file.service';
import { RegionAccessService } from '../shared/region-access.service';
import type {
  PolicyCollectJobInput,
  PolicyCollectReviewPolicyFileInput,
} from './dto';
import { PolicySearchProvider } from './policy-search.provider';

type Query = Record<string, string | string[] | undefined>;

const POLICY_CATEGORY_LABELS: Record<string, string> = {
  all: '全部',
  notice: '申报通知',
  other: '其他',
  publicity: '公示情况',
  reward: '奖补情况',
};

const REGION_SCOPE_LABELS: Record<string, string> = {
  all: '全部',
  city: '市',
  district: '区县',
  province: '省',
};

const DEFAULT_RUN_TIMEOUT_MINUTES = 30;

type PolicyCollectRegionScope = keyof typeof REGION_SCOPE_LABELS;
type PolicyCollectRunStep =
  | 'ai_parse'
  | 'completed'
  | 'comparing'
  | 'failed'
  | 'official_search'
  | 'queued'
  | 'saving'
  | 'search_health_check';

interface PolicyCollectCandidate {
  aiReason: null | string;
  aiTaskId: null | string;
  contentHash: string;
  documentNo: null | string;
  issuingAgency: null | string;
  officialConfidence: null | string;
  officialUrl: null | string;
  officialVerified: number;
  publishDate: Date | null;
  rawText: string;
  structuredResult: Record<string, unknown>;
  summary: null | string;
  title: string;
}

@Injectable()
export class PolicyCollectService {
  private readonly scheduledRunningJobIds = new Set<string>();

  constructor(
    @InjectRepository(PolicyCollectJobEntity)
    private readonly jobRepo: Repository<PolicyCollectJobEntity>,
    @InjectRepository(PolicyCollectRunEntity)
    private readonly runRepo: Repository<PolicyCollectRunEntity>,
    @InjectRepository(PolicyCollectRunItemEntity)
    private readonly itemRepo: Repository<PolicyCollectRunItemEntity>,
    @InjectRepository(PolicyCollectNotificationEntity)
    private readonly notificationRepo: Repository<PolicyCollectNotificationEntity>,
    @InjectRepository(PolicyProjectEntity)
    private readonly projectRepo: Repository<PolicyProjectEntity>,
    @InjectRepository(RegionEntity)
    private readonly regionRepo: Repository<RegionEntity>,
    @InjectRepository(RegionPolicyFileEntity)
    private readonly fileRepo: Repository<RegionPolicyFileEntity>,
    private readonly aiService: AiService,
    private readonly fileService: RegionPolicyFileService,
    private readonly policySearchProvider: PolicySearchProvider,
    private readonly regionAccessService: RegionAccessService,
  ) {}

  async listJobs(query: Query, user?: CurrentUser) {
    const rows = await this.jobRepo.find({ order: { id: 'DESC' } });
    let items = rows.map((row) => this.toJobItem(row));
    items = await this.filterJobItemsByAccess(items, user);
    const keyword = this.getQueryValue(query.keyword)?.trim().toLowerCase();
    const enabled = this.getQueryValue(query.enabled);

    if (keyword) {
      items = items.filter((item) =>
        [item.name, item.projectName, item.regionName, item.keywords ?? '']
          .join(' ')
          .toLowerCase()
          .includes(keyword),
      );
    }
    if (enabled !== undefined) {
      items = items.filter((item) => String(item.enabled) === enabled);
    }

    return this.paginate(items, query);
  }

  async getJob(id: string, user?: CurrentUser) {
    const job = await this.requireJob(id);
    await this.assertCanAccessJob(job, user);
    return this.toJobItem(job);
  }

  async createJob(input: PolicyCollectJobInput, user?: CurrentUser) {
    const project = await this.requireProject(input.projectId);
    const regionScope = this.normalizeRegionScope(input.regionScope, input.regionId);
    await this.assertCanUseJobRegion(regionScope, input.regionId, user);
    const region = await this.resolveJobRegion(regionScope, input.regionId);
    const cronExpression = toNullableString(input.cronExpression);
    const enabled = this.normalizeEnabled(input.enabled, 0);
    const nextRunAt = this.resolveNextRunAt(cronExpression);
    const entity = this.jobRepo.create({
      createdBy: user?.id === undefined ? null : String(user.id),
      cronExpression,
      departmentName: toNullableString(input.departmentName),
      enabled,
      keywords: toNullableString(input.keywords),
      name: this.resolveName(
        input.name,
        project.name,
        region.name,
        this.normalizePolicyCategory(input.policyCategory),
      ),
      nextRunAt: enabled === 1 ? nextRunAt : null,
      officialDomainRules: toNullableString(input.officialDomainRules),
      ownerName: this.regionAccessService.isSystemAdmin(user) ? null : user?.realName,
      ownerUserId: this.regionAccessService.isSystemAdmin(user)
        ? null
        : user?.id === undefined
          ? null
          : String(user.id),
      policyCategory: this.normalizePolicyCategory(input.policyCategory),
      projectId: project.id,
      projectName: project.name,
      regionId: region.id,
      regionName: region.name,
      regionScope,
    });

    return this.toJobItem(await this.jobRepo.save(entity));
  }

  async updateJob(id: string, input: PolicyCollectJobInput, user?: CurrentUser) {
    const entity = await this.requireJob(id);
    await this.assertCanAccessJob(entity, user);
    let project: PolicyProjectEntity | null = null;
    let region: { id: null | string; name: string } | null = null;

    if (input.projectId !== undefined) {
      project = await this.requireProject(input.projectId);
      entity.projectId = project.id;
      entity.projectName = project.name;
    }
    if (input.regionId !== undefined || input.regionScope !== undefined) {
      const nextRegionScope = this.normalizeRegionScope(
        input.regionScope ?? entity.regionScope,
        input.regionId !== undefined ? input.regionId : entity.regionId,
      );
      await this.assertCanUseJobRegion(
        nextRegionScope,
        input.regionId !== undefined ? input.regionId : entity.regionId,
        user,
      );
      region = await this.resolveJobRegion(
        nextRegionScope,
        input.regionId !== undefined ? input.regionId : entity.regionId,
      );
      entity.regionId = region.id;
      entity.regionName = region.name;
      entity.regionScope = nextRegionScope;
    }
    if (input.name !== undefined) {
      entity.name = this.resolveName(
        input.name,
        project?.name ?? entity.projectName,
        region?.name ?? entity.regionName,
        input.policyCategory ?? entity.policyCategory,
      );
    }
    if (input.keywords !== undefined) {
      entity.keywords = toNullableString(input.keywords);
    }
    if (input.departmentName !== undefined) {
      entity.departmentName = toNullableString(input.departmentName);
    }
    if (input.officialDomainRules !== undefined) {
      entity.officialDomainRules = toNullableString(input.officialDomainRules);
    }
    if (input.policyCategory !== undefined) {
      entity.policyCategory = this.normalizePolicyCategory(input.policyCategory);
    }
    if (input.cronExpression !== undefined) {
      entity.cronExpression = toNullableString(input.cronExpression);
      this.resolveNextRunAt(entity.cronExpression);
    }
    if (input.enabled !== undefined) {
      entity.enabled = this.normalizeEnabled(input.enabled, entity.enabled);
    }
    if (input.cronExpression !== undefined || input.enabled !== undefined) {
      entity.nextRunAt =
        entity.enabled === 1 ? this.resolveNextRunAt(entity.cronExpression) : null;
    }

    return this.toJobItem(await this.jobRepo.save(entity));
  }

  async setJobEnabled(id: string, enabled: 0 | 1, user?: CurrentUser) {
    const entity = await this.requireJob(id);
    await this.assertCanAccessJob(entity, user);
    entity.enabled = enabled;
    entity.nextRunAt =
      enabled === 1 ? this.resolveNextRunAt(entity.cronExpression) : null;
    return this.toJobItem(await this.jobRepo.save(entity));
  }

  async removeJob(id: string, user?: CurrentUser) {
    const entity = await this.requireJob(id);
    await this.assertCanAccessJob(entity, user);
    const runningCount = await this.runRepo.count({
      where: { jobId: entity.id, status: 'running' },
    });
    if (runningCount > 0) {
      throw new BadRequestException('采集任务正在执行，暂不能删除');
    }
    await this.jobRepo.delete({ id: entity.id });
  }

  async startJobRun(id: string, user?: CurrentUser) {
    const job = await this.requireJob(id);
    await this.assertCanAccessJob(job, user);
    await this.assertNoRunningRun(job);
    const run = await this.createRun(job);

    void this.executeRun(job, run, user).catch((error) => {
      console.error('[POLICY_COLLECT_ASYNC_RUN_FAILED]', error);
    });

    return this.toRunItem(run);
  }

  async runJob(id: string, user?: CurrentUser) {
    const job = await this.requireJob(id);
    await this.assertCanAccessJob(job, user);
    await this.assertNoRunningRun(job);
    const run = await this.createRun(job);

    return this.executeRun(job, run, user);
  }

  private async executeRun(
    job: PolicyCollectJobEntity,
    run: PolicyCollectRunEntity,
    user?: CurrentUser,
  ) {
    try {
      await this.ensureAiSearchAvailable(job, run, user);
      await this.updateRunStep(run, 'official_search', 25, '正在联网搜索官方政策来源');
      const candidateResult = await this.generateCandidates(job, run, user);
      run.aiTaskId = candidateResult.aiTaskId;
      const candidates = candidateResult.items;
      const savedItems: PolicyCollectRunItemEntity[] = [];

      await this.updateRunStep(
        run,
        'comparing',
        70,
        `正在比对 ${candidates.length} 条候选政策`,
      );
      for (const candidate of candidates) {
        const compare = await this.compareCandidate(job, candidate);
        const status =
          compare.compareStatus === 'same' || compare.compareStatus === 'ignored'
            ? 'ignored'
            : 'pending_review';
        const item = await this.itemRepo.save(
          this.itemRepo.create({
            aiReason: compare.aiReason,
            aiTaskId: candidate.aiTaskId,
            attachmentHash: null,
            attachmentUrl: null,
            compareStatus: compare.compareStatus,
            contentHash: candidate.contentHash,
            documentNo: candidate.documentNo,
            issuingAgency: candidate.issuingAgency,
            jobId: job.id,
            matchedPolicyFileId: compare.matchedPolicyFileId,
            officialConfidence: candidate.officialConfidence,
            officialUrl: candidate.officialUrl,
            officialVerified: candidate.officialVerified,
            policyCategory: this.normalizePolicyCategory(job.policyCategory),
            projectId: job.projectId,
            projectName: job.projectName,
            publishDate: candidate.publishDate,
            rawText: candidate.rawText,
            regionId: job.regionId,
            regionName: job.regionName,
            runId: run.id,
            status,
            structuredResult: JSON.stringify(candidate.structuredResult),
            summary: candidate.summary,
            title: candidate.title,
          }),
        );
        savedItems.push(item);
        await this.createNotificationForItem(item, user);
      }

      if (savedItems.length === 0) {
        await this.createNoResultNotification(job, run, user);
      }

      await this.updateRunStep(run, 'saving', 90, '正在保存采集结果');
      this.fillRunCounts(run, savedItems);
      run.currentStep = 'completed';
      run.progress = 100;
      run.stepMessage = `采集完成，生成 ${savedItems.length} 条结果`;
      run.status = 'success';
      run.finishedAt = new Date();
      job.lastRunAt = run.finishedAt;
      await Promise.all([this.runRepo.save(run), this.jobRepo.save(job)]);
      return this.toRunItem(run);
    } catch (error) {
      await this.markRunFailed(job, run, error, user);
      throw error;
    }
  }

  async listRuns(query: Query, user?: CurrentUser) {
    await this.markStaleRunningRuns();
    const rows = await this.runRepo.find({ order: { id: 'DESC' } });
    let items = rows.map((row) => this.toRunItem(row));
    items = await this.filterRunItemsByAccess(items, user);
    const jobId = this.getQueryValue(query.jobId);
    const status = this.getQueryValue(query.status);

    if (jobId) {
      items = items.filter((item) => item.jobId === jobId);
    }
    if (status) {
      items = items.filter((item) => item.status === status);
    }
    return this.paginate(items, query);
  }

  async getRun(id: string, user?: CurrentUser) {
    await this.markStaleRunningRuns();
    const run = await this.requireRun(id);
    await this.assertCanAccessRun(run, user);
    return this.toRunItem(run);
  }

  async listRunItems(runId: string, user?: CurrentUser) {
    await this.markStaleRunningRuns();
    const run = await this.requireRun(runId);
    await this.assertCanAccessRun(run, user);
    const rows = await this.itemRepo.find({
      order: { id: 'DESC' },
      where: { runId: run.id },
    });
    return rows.map((row) => this.toRunItemDetail(row));
  }

  async listReviewItems(query: Query, user?: CurrentUser) {
    const rows = await this.itemRepo.find({ order: { id: 'DESC' } });
    let items = rows
      .filter((row) => row.status === 'pending_review')
      .map((row) => this.toRunItemDetail(row));
    items = await this.filterReviewItemsByAccess(items, user);
    const compareStatus = this.getQueryValue(query.compareStatus);
    const keyword = this.getQueryValue(query.keyword)?.trim().toLowerCase();

    if (compareStatus) {
      items = items.filter((item) => item.compareStatus === compareStatus);
    }
    if (keyword) {
      items = items.filter((item) =>
        [item.title, item.projectName, item.regionName, item.issuingAgency ?? '']
          .join(' ')
          .toLowerCase()
          .includes(keyword),
      );
    }
    return this.paginate(items, query);
  }

  async getReviewItem(id: string, user?: CurrentUser) {
    const item = await this.requireItem(id);
    await this.assertCanAccessRunItem(item, user);
    return this.toRunItemDetail(item);
  }

  async importReviewItem(id: string, user?: CurrentUser) {
    const item = await this.requireItem(id);
    await this.assertCanAccessRunItem(item, user);
    if (item.status !== 'pending_review') {
      throw new BadRequestException('该采集结果已处理');
    }

    const created = (await this.fileService.create(
      this.buildPolicyFileInput(item, `由政策采集结果 #${item.id} 导入`),
      undefined,
      user,
    )) as { id: string };

    await this.applyPolicyFileSourceFields(created.id, item);

    item.status = 'imported';
    item.reviewedAt = new Date();
    item.reviewedBy = user?.id === undefined ? null : String(user.id);
    await this.itemRepo.save(item);
    return { fileId: created.id, item: this.toRunItemDetail(item) };
  }

  async updateExistingPolicyFile(
    id: string,
    input: PolicyCollectReviewPolicyFileInput,
    user?: CurrentUser,
  ) {
    const item = await this.requireItem(id);
    await this.assertCanAccessRunItem(item, user);
    if (item.status !== 'pending_review') {
      throw new BadRequestException('该采集结果已处理');
    }
    const policyFileId = await this.resolveReviewPolicyFileId(item, input);

    await this.fileService.update(
      policyFileId,
      this.buildPolicyFileInput(item, `由政策采集结果 #${item.id} 更新`),
      undefined,
      user,
    );
    await this.applyPolicyFileSourceFields(policyFileId, item);

    item.status = 'updated';
    item.matchedPolicyFileId = policyFileId;
    item.reviewedAt = new Date();
    item.reviewedBy = user?.id === undefined ? null : String(user.id);
    await this.itemRepo.save(item);
    return { fileId: policyFileId, item: this.toRunItemDetail(item) };
  }

  async linkExistingPolicyFile(
    id: string,
    input: PolicyCollectReviewPolicyFileInput,
    user?: CurrentUser,
  ) {
    const item = await this.requireItem(id);
    await this.assertCanAccessRunItem(item, user);
    if (item.status !== 'pending_review') {
      throw new BadRequestException('该采集结果已处理');
    }
    const policyFileId = await this.resolveReviewPolicyFileId(item, input);

    item.status = 'linked';
    item.matchedPolicyFileId = policyFileId;
    item.reviewedAt = new Date();
    item.reviewedBy = user?.id === undefined ? null : String(user.id);
    await this.itemRepo.save(item);
    return { fileId: policyFileId, item: this.toRunItemDetail(item) };
  }

  async ignoreReviewItem(id: string, user?: CurrentUser) {
    const item = await this.requireItem(id);
    await this.assertCanAccessRunItem(item, user);
    item.status = 'ignored';
    item.reviewedAt = new Date();
    item.reviewedBy = user?.id === undefined ? null : String(user.id);
    return this.toRunItemDetail(await this.itemRepo.save(item));
  }

  async getWorkbenchSummary(user?: CurrentUser) {
    await this.markStaleRunningRuns();
    const rows = await this.itemRepo.find({
      order: { id: 'DESC' },
      where: { status: 'pending_review' },
    });
    const reviewItems = await this.filterReviewEntitiesByAccess(rows, user);
    const lastRun = await this.findLastVisibleRun(user);
    const notifications = await this.findVisibleNotifications(user, 5);
    const unreadNotificationCount = await this.notificationRepo.count({
      where: this.buildNotificationWhere(user, 'unread'),
    });

    return {
      changedPolicyCount: reviewItems.filter((row) => row.compareStatus === 'changed')
        .length,
      lastRun: lastRun ? this.toRunItem(lastRun) : null,
      latestNotifications: notifications.map((row) => this.toNotificationItem(row)),
      newPolicyCount: reviewItems.filter((row) => row.compareStatus === 'new').length,
      pendingReviewCount: reviewItems.length,
      unreadNotificationCount,
      uncertainCount: reviewItems.filter((row) => row.compareStatus === 'uncertain')
        .length,
    };
  }

  async listNotifications(query: Query, user?: CurrentUser) {
    const page = Math.max(Number(this.getQueryValue(query.page) ?? 1), 1);
    const pageSize = Math.max(Number(this.getQueryValue(query.pageSize) ?? 10), 1);
    const [rows, total] = await this.notificationRepo.findAndCount({
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      where: this.buildNotificationWhere(user, this.getQueryValue(query.status)),
    });

    return {
      items: rows.map((row) => this.toNotificationItem(row)),
      total,
    };
  }

  async getNotification(id: string, user?: CurrentUser) {
    const entity = await this.findVisibleNotification(id, user);
    if (!entity) {
      throw new NotFoundException('政策采集通知不存在');
    }
    return this.toNotificationItem(entity);
  }

  async markNotificationRead(id: string, user?: CurrentUser) {
    const entity = await this.findVisibleNotification(id, user);
    if (!entity) {
      throw new NotFoundException('政策采集通知不存在');
    }

    entity.status = 'read';
    entity.readAt = new Date();
    return this.toNotificationItem(await this.notificationRepo.save(entity));
  }

  async runDueJobs() {
    await this.markStaleRunningRuns();
    const now = new Date();
    const jobs = await this.jobRepo.find({
      order: { id: 'ASC' },
      where: { enabled: 1 },
    });

    for (const job of jobs) {
      if (!job.cronExpression) {
        continue;
      }
      const nextRunAt =
        job.nextRunAt ?? this.resolveNextRunAt(job.cronExpression, now);
      if (!job.nextRunAt) {
        job.nextRunAt = nextRunAt;
        await this.jobRepo.save(job);
        continue;
      }
      if (!nextRunAt || nextRunAt.getTime() > now.getTime()) {
        continue;
      }

      const jobId = String(job.id);
      if (this.scheduledRunningJobIds.has(jobId)) {
        continue;
      }

      this.scheduledRunningJobIds.add(jobId);
      try {
        job.nextRunAt = this.resolveNextRunAt(job.cronExpression, now);
        await this.jobRepo.save(job);
        await this.runJob(jobId);
      } catch (error) {
        console.error('[POLICY_COLLECT_SCHEDULE_RUN_FAILED]', error);
      } finally {
        this.scheduledRunningJobIds.delete(jobId);
      }
    }
  }

  private async generateCandidates(
    job: PolicyCollectJobEntity,
    run: PolicyCollectRunEntity,
    user?: CurrentUser,
  ): Promise<{ aiTaskId: string; items: PolicyCollectCandidate[] }> {
    const keywords = this.buildKeywords(job);
    const publishDateRange = this.getPreviousCalendarYearDateRange();
    const systemDate = this.formatDateOnly(new Date());
    await this.updateRunStep(run, 'official_search', 35, '正在搜索官方政策来源');
    const searchResult = await this.policySearchProvider.searchOfficialPolicies(
      {
        bizId: String(run.id),
        jobId: String(job.id),
        jobName: job.name,
        keywords,
        officialDomainRules: job.officialDomainRules,
        policyCategory: this.normalizePolicyCategory(job.policyCategory),
        policyCategoryName: this.getPolicyCategoryLabel(job.policyCategory),
        projectName: job.projectName,
        publishDateEnd: publishDateRange.end,
        publishDateStart: publishDateRange.start,
        regionScope: this.normalizeRegionScope(job.regionScope, job.regionId),
        regionName: job.regionName,
        systemDate,
      },
      user,
    );
    run.searchedKeywords = JSON.stringify({
      keywords,
      publishDateEnd: publishDateRange.end,
      publishDateStart: publishDateRange.start,
      queries: searchResult.queries,
      rawResultCount: searchResult.rawResultCount,
      resultCount: searchResult.results.length,
      searchTaskId: searchResult.searchTaskId,
      systemDate,
      warnings: searchResult.warnings,
    });
    await this.updateRunStep(run, 'ai_parse', 55, '正在解析候选政策内容');
    const aiResult = await this.aiService.runPolicyCollectSearch(
      {
        bizId: String(run.id),
        departmentName: job.departmentName,
        jobId: String(job.id),
        jobName: job.name,
        keywords,
        officialDomainRules: job.officialDomainRules,
        policyCategory: this.normalizePolicyCategory(job.policyCategory),
        policyCategoryName: this.getPolicyCategoryLabel(job.policyCategory),
        projectName: job.projectName,
        publishDateEnd: publishDateRange.end,
        publishDateStart: publishDateRange.start,
        regionName: job.regionName,
        regionScope: this.normalizeRegionScope(job.regionScope, job.regionId),
        searchResults: searchResult.results,
        searchTaskId: searchResult.searchTaskId,
        systemDate,
      },
      user,
    );

    return {
      aiTaskId: aiResult.taskId,
      items: aiResult.items.map((item, index) =>
        this.toCandidateFromAiItem(job, item, aiResult.taskId, index),
      ).filter((candidate) =>
        this.shouldKeepCandidateByPublishDate(candidate, publishDateRange),
      ),
    };
  }

  private async ensureAiSearchAvailable(
    job: PolicyCollectJobEntity,
    run: PolicyCollectRunEntity,
    user?: CurrentUser,
  ): Promise<void> {
    if (process.env.AI_POLICY_COLLECT_REQUIRE_SEARCH_HEALTH === '0') {
      return;
    }

    await this.updateRunStep(run, 'search_health_check', 10, '正在检测 AI 联网搜索能力');
    const health = await this.aiService.searchHealthCheck(user, {
      assertAdmin: false,
    });
    if (health.searchAvailable) {
      return;
    }

    run.aiTaskId = health.taskId;
    run.searchedKeywords = JSON.stringify({
      healthCheck: {
        checkedAt: health.checkedAt,
        searchAvailable: health.searchAvailable,
        sources: health.sources,
        taskId: health.taskId,
        warnings: health.warnings,
      },
      jobId: String(job.id),
    });
    await this.runRepo.save(run);

    const reason = health.warnings.length
      ? health.warnings.join('；')
      : 'AI 自检未返回可核验的联网搜索来源';
    throw new BadRequestException(
      `AI 联网搜索能力不可用，已停止本次政策采集。自检任务：${health.taskId}。原因：${reason}`,
    );
  }

  private async markRunFailed(
    job: PolicyCollectJobEntity,
    run: PolicyCollectRunEntity,
    error: unknown,
    user?: CurrentUser,
  ): Promise<void> {
    run.status = 'failed';
    run.errorMessage = error instanceof Error ? error.message : String(error);
    run.finishedAt = new Date();
    run.currentStep = 'failed';
    run.stepMessage = run.errorMessage;
    await this.runRepo.save(run);
    await this.notificationRepo.save(
      this.notificationRepo.create({
        content: run.errorMessage,
        jobId: job.id,
        runId: run.id,
        targetUserId: await this.resolveNotificationTargetUserId(job.regionId, user),
        title: `${job.name} 执行失败`,
        type: 'run_failed',
      }),
    );
  }

  private async compareCandidate(
    job: PolicyCollectJobEntity,
    candidate: PolicyCollectCandidate,
  ) {
    if (
      !candidate.officialUrl ||
      candidate.officialVerified !== 1 ||
      candidate.officialConfidence === 'low'
    ) {
      return {
        aiReason:
          candidate.aiReason ??
          'AI 未能确认官方正式来源，需人工审查来源真实性。',
        compareStatus: 'uncertain',
        matchedPolicyFileId: null,
      };
    }

    const files = await this.fileRepo.find({
      where: job.regionId
        ? { projectId: job.projectId, regionId: job.regionId }
        : { projectId: job.projectId },
    });
    const matched =
      files.find((file) => file.documentNo && file.documentNo === candidate.documentNo) ??
      files.find((file) => file.title === candidate.title);

    if (!matched) {
      return {
        aiReason: this.mergeReason(
          '未匹配到现有区域政策文件，标记为新增政策。',
          candidate.aiReason,
        ),
        compareStatus: 'new',
        matchedPolicyFileId: null,
      };
    }

    if (matched.sourceHash && matched.sourceHash !== candidate.contentHash) {
      return {
        aiReason: this.mergeReason(
          '匹配到现有政策，但正文 hash 不一致，标记为疑似变更。',
          candidate.aiReason,
        ),
        compareStatus: 'changed',
        matchedPolicyFileId: matched.id,
      };
    }

    return {
      aiReason: this.mergeReason(
        '匹配到现有政策且未发现内容变化。',
        candidate.aiReason,
      ),
      compareStatus: 'same',
      matchedPolicyFileId: matched.id,
    };
  }

  private async createNotificationForItem(
    item: PolicyCollectRunItemEntity,
    user?: CurrentUser,
  ) {
    if (item.status !== 'pending_review') {
      return;
    }
    const type =
      item.compareStatus === 'changed'
        ? 'policy_changed'
        : item.compareStatus === 'uncertain'
          ? 'uncertain'
          : 'new_policy';
    await this.notificationRepo.save(
      this.notificationRepo.create({
        content: item.aiReason,
        jobId: item.jobId,
        runId: item.runId,
        runItemId: item.id,
        targetUserId: await this.resolveNotificationTargetUserId(
          item.regionId,
          user,
        ),
        title: item.title,
        type,
      }),
    );
  }

  private async createNoResultNotification(
    job: PolicyCollectJobEntity,
    run: PolicyCollectRunEntity,
    user?: CurrentUser,
  ) {
    await this.notificationRepo.save(
      this.notificationRepo.create({
        content:
          '本次 AI 未返回符合官方正式文件要求的候选政策，可在政策采集结果中查看 AI 请求记录和原始返回。',
        jobId: job.id,
        runId: run.id,
        targetUserId: await this.resolveNotificationTargetUserId(job.regionId, user),
        title: `${job.name} 未发现候选政策`,
        type: 'no_result',
      }),
    );
  }

  private async resolveNotificationTargetUserId(
    _regionId: null | string,
    user?: CurrentUser,
  ): Promise<null | string> {
    if (!user?.id || this.regionAccessService.isSystemAdmin(user)) {
      return null;
    }
    return String(user.id);
  }

  private async findVisibleNotifications(user?: CurrentUser, take = 5) {
    return this.notificationRepo.find({
      order: { id: 'DESC' },
      take,
      where: this.buildNotificationWhere(user),
    });
  }

  private async findVisibleNotification(id: string, user?: CurrentUser) {
    return this.notificationRepo.findOne({
      where: this.buildNotificationWhere(user).map((where) => ({
        ...where,
        id: toStringId(id),
      })),
    });
  }

  private buildNotificationWhere(user?: CurrentUser, status?: string) {
    if (this.regionAccessService.isSystemAdmin(user)) {
      return status ? [{ status }] : [{}];
    }
    const currentUserId = user?.id === undefined ? null : String(user.id);
    const base = status ? { status } : {};
    if (!currentUserId) {
      return [{ ...base, targetUserId: IsNull() }];
    }
    return [
      { ...base, targetUserId: currentUserId },
      { ...base, targetUserId: IsNull() },
    ];
  }

  private async filterJobItemsByAccess<T extends { regionId: null | string }>(
    items: T[],
    user?: CurrentUser,
  ): Promise<T[]> {
    const accessibleIds = await this.regionAccessService.getAccessibleRegionIds(user);
    if (accessibleIds === null) {
      return items;
    }
    return items.filter((item) => item.regionId && accessibleIds.has(item.regionId));
  }

  private async filterRunItemsByAccess<T extends { jobId: string }>(
    items: T[],
    user?: CurrentUser,
  ): Promise<T[]> {
    const visibleJobIds = await this.getVisibleJobIds(user);
    if (visibleJobIds === null) {
      return items;
    }
    return items.filter((item) => visibleJobIds.has(item.jobId));
  }

  private async filterReviewItemsByAccess<T extends { regionId: null | string }>(
    items: T[],
    user?: CurrentUser,
  ): Promise<T[]> {
    const accessibleIds = await this.regionAccessService.getAccessibleRegionIds(user);
    if (accessibleIds === null) {
      return items;
    }
    return items.filter((item) => item.regionId && accessibleIds.has(item.regionId));
  }

  private async filterReviewEntitiesByAccess(
    rows: PolicyCollectRunItemEntity[],
    user?: CurrentUser,
  ): Promise<PolicyCollectRunItemEntity[]> {
    const accessibleIds = await this.regionAccessService.getAccessibleRegionIds(user);
    if (accessibleIds === null) {
      return rows;
    }
    return rows.filter((row) => row.regionId && accessibleIds.has(String(row.regionId)));
  }

  private async getVisibleJobIds(user?: CurrentUser): Promise<Set<string> | null> {
    const accessibleIds = await this.regionAccessService.getAccessibleRegionIds(user);
    if (accessibleIds === null) {
      return null;
    }
    if (accessibleIds.size === 0) {
      return new Set();
    }
    const jobs = await this.jobRepo.find({ order: { id: 'ASC' } });
    return new Set(
      jobs
        .filter((job) => job.regionId && accessibleIds.has(String(job.regionId)))
        .map((job) => String(job.id)),
    );
  }

  private async assertCanAccessJob(
    job: PolicyCollectJobEntity,
    user?: CurrentUser,
  ): Promise<void> {
    if (!user) {
      return;
    }
    await this.regionAccessService.assertCanAccessRegion(user, job.regionId, {
      allowAllForAdmin: true,
    });
  }

  private async assertCanUseJobRegion(
    scope: PolicyCollectRegionScope,
    regionId: null | string | undefined,
    user?: CurrentUser,
  ): Promise<void> {
    if (!user) {
      return;
    }
    if (scope === 'all') {
      await this.regionAccessService.assertCanAccessRegion(user, null, {
        allowAllForAdmin: true,
      });
      return;
    }
    await this.regionAccessService.assertCanAccessRegion(user, regionId);
  }

  private async assertCanAccessRun(
    run: PolicyCollectRunEntity,
    user?: CurrentUser,
  ): Promise<void> {
    if (!user) {
      return;
    }
    const job = await this.requireJob(String(run.jobId));
    await this.assertCanAccessJob(job, user);
  }

  private async assertCanAccessRunItem(
    item: PolicyCollectRunItemEntity,
    user?: CurrentUser,
  ): Promise<void> {
    if (!user) {
      return;
    }
    await this.regionAccessService.assertCanAccessRegion(user, item.regionId);
  }

  private async findLastVisibleRun(user?: CurrentUser) {
    const rows = await this.runRepo.find({ order: { id: 'DESC' } });
    const items = await this.filterRunItemsByAccess(
      rows.map((row) => ({ jobId: String(row.jobId), row })),
      user,
    );
    return items[0]?.row ?? null;
  }

  private fillRunCounts(
    run: PolicyCollectRunEntity,
    items: PolicyCollectRunItemEntity[],
  ) {
    run.totalCount = items.length;
    run.newCount = items.filter((item) => item.compareStatus === 'new').length;
    run.changedCount = items.filter((item) => item.compareStatus === 'changed')
      .length;
    run.sameCount = items.filter((item) => item.compareStatus === 'same').length;
    run.uncertainCount = items.filter(
      (item) => item.compareStatus === 'uncertain',
    ).length;
    run.ignoredCount = items.filter((item) => item.status === 'ignored').length;
  }

  private async requireJob(id?: string) {
    if (!id) {
      throw new BadRequestException('采集任务不能为空');
    }
    const entity = await this.jobRepo.findOne({ where: { id: toStringId(id) } });
    if (!entity) {
      throw new NotFoundException('政策采集任务不存在');
    }
    return entity;
  }

  private async assertNoRunningRun(job: PolicyCollectJobEntity) {
    await this.markStaleRunningRuns(job.id);
    const runningCount = await this.runRepo.count({
      where: { jobId: job.id, status: 'running' },
    });
    if (runningCount > 0) {
      throw new BadRequestException('该采集任务正在执行，请稍后查看采集结果');
    }
  }

  private async createRun(job: PolicyCollectJobEntity) {
    return this.runRepo.save(
      this.runRepo.create({
        currentStep: 'queued',
        jobId: job.id,
        jobName: job.name,
        progress: 0,
        searchedKeywords: JSON.stringify(this.buildKeywords(job)),
        startedAt: new Date(),
        stepMessage: '采集任务已进入执行队列',
        status: 'running',
      }),
    );
  }

  private async updateRunStep(
    run: PolicyCollectRunEntity,
    step: PolicyCollectRunStep,
    progress: number,
    message: string,
  ): Promise<void> {
    run.currentStep = step;
    run.progress = Math.min(100, Math.max(0, Math.floor(progress)));
    run.stepMessage = this.truncateText(message, 255);
    await this.runRepo.save(run);
  }

  private async markStaleRunningRuns(jobId?: string): Promise<number> {
    const timeoutMinutes = this.getRunTimeoutMinutes();
    const cutoff = new Date(Date.now() - timeoutMinutes * 60_000);
    const rows = await this.runRepo.find({
      where: {
        ...(jobId ? { jobId } : {}),
        startedAt: LessThan(cutoff),
        status: 'running',
      },
    });
    if (rows.length === 0) {
      return 0;
    }

    const now = new Date();
    for (const row of rows) {
      row.errorMessage =
        `采集执行超过 ${timeoutMinutes} 分钟未完成，系统已自动标记为失败。` +
        '可能原因：服务重启、AI 请求超时或后台任务中断。';
      row.finishedAt = now;
      row.currentStep = 'failed';
      row.progress = Math.max(row.progress ?? 0, 0);
      row.stepMessage = row.errorMessage;
      row.status = 'failed';
    }
    await this.runRepo.save(rows);
    return rows.length;
  }

  private getRunTimeoutMinutes(): number {
    const value = Number(process.env.POLICY_COLLECT_RUN_TIMEOUT_MINUTES);
    if (!Number.isFinite(value) || value <= 0) {
      return DEFAULT_RUN_TIMEOUT_MINUTES;
    }
    return Math.max(1, Math.floor(value));
  }

  private async requireRun(id: string) {
    const entity = await this.runRepo.findOne({ where: { id: toStringId(id) } });
    if (!entity) {
      throw new NotFoundException('政策采集执行记录不存在');
    }
    return entity;
  }

  private async requireItem(id: string) {
    const entity = await this.itemRepo.findOne({ where: { id: toStringId(id) } });
    if (!entity) {
      throw new NotFoundException('政策采集结果不存在');
    }
    return entity;
  }

  private async requireProject(id?: string) {
    if (!id) {
      throw new BadRequestException('统一政策项目不能为空');
    }
    const entity = await this.projectRepo.findOne({ where: { id: toStringId(id) } });
    if (!entity) {
      throw new BadRequestException('统一政策项目不存在');
    }
    return entity;
  }

  private async requireRegion(id?: string) {
    if (!id) {
      throw new BadRequestException('采集区域不能为空');
    }
    const entity = await this.regionRepo.findOne({ where: { id: toStringId(id) } });
    if (!entity) {
      throw new BadRequestException('采集区域不存在');
    }
    return entity;
  }

  private async resolveJobRegion(
    scope: PolicyCollectRegionScope,
    regionId?: null | string,
  ): Promise<{ id: null | string; name: string }> {
    if (scope === 'all') {
      return { id: null, name: '全部区域' };
    }
    return this.requireRegion(regionId ?? undefined);
  }

  private buildKeywords(job: PolicyCollectJobEntity) {
    const manual = (job.keywords ?? '')
      .split(/[,\n，、;；]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return [
      ...new Set(
        [
          job.projectName,
          job.regionScope === 'all' ? '' : job.regionName,
          job.policyCategory === 'all' ? '' : this.getPolicyCategoryLabel(job.policyCategory),
          ...manual,
        ].filter(Boolean),
      ),
    ];
  }

  private resolveName(
    value: string | undefined,
    projectName: string,
    regionName: string,
    policyCategory?: null | string,
  ) {
    const name = value?.trim();
    const categoryLabel = this.getPolicyCategoryLabel(policyCategory);
    return name || `${regionName}${projectName}${categoryLabel}政策采集`;
  }

  private normalizeEnabled(value: number | string | undefined, fallback: number) {
    const enabled = toNumber(value, fallback);
    if (enabled !== 0 && enabled !== 1) {
      throw new BadRequestException('启用状态不合法');
    }
    return enabled;
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

  private normalizeRegionScope(
    value?: null | string,
    regionId?: null | string,
  ): PolicyCollectRegionScope {
    const scope = value?.trim() || (regionId ? 'district' : 'all');
    if (!REGION_SCOPE_LABELS[scope]) {
      throw new BadRequestException('采集区域范围不合法');
    }
    if (scope !== 'all' && !toNullableString(regionId)) {
      throw new BadRequestException('采集区域不能为空');
    }
    return scope as PolicyCollectRegionScope;
  }

  private resolveNextRunAt(
    expression?: null | string,
    from: Date = new Date(),
  ): Date | null {
    const cron = expression?.trim();
    if (!cron) {
      return null;
    }

    const intervalNextRunAt = this.resolveIntervalNextRunAt(cron, from);
    if (intervalNextRunAt) {
      return intervalNextRunAt;
    }

    const parts = cron.split(/\s+/);
    if (parts.length !== 5) {
      throw new BadRequestException('定时表达式必须为 5 段 cron 格式');
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    if (dayOfMonth !== '*' || month !== '*' || dayOfWeek !== '*') {
      throw new BadRequestException(
        '当前定时任务仅支持分钟、小时或每日执行，例如 */30 * * * *、0 */2 * * *、0 9 * * *',
      );
    }

    if (minute === '*' && hour === '*') {
      return this.addMinutes(from, 1);
    }

    const minuteInterval = this.parseIntervalPart(minute);
    if (minuteInterval && hour === '*') {
      return this.addMinutes(from, minuteInterval);
    }

    const fixedMinute = this.parseFixedPart(minute, 0, 59, '分钟');
    const hourInterval = this.parseIntervalPart(hour);
    if (hourInterval) {
      const next = this.addHours(from, hourInterval);
      next.setMinutes(fixedMinute, 0, 0);
      if (next.getTime() <= from.getTime()) {
        return this.addHours(next, hourInterval);
      }
      return next;
    }

    const fixedHour = this.parseFixedPart(hour, 0, 23, '小时');
    const next = new Date(from);
    next.setHours(fixedHour, fixedMinute, 0, 0);
    if (next.getTime() <= from.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  private resolveIntervalNextRunAt(expression: string, from: Date): Date | null {
    const match = expression.match(/^P(\d+)(D|W|M|Y)$/);
    if (!match) {
      return null;
    }

    const amount = Number(match[1]);
    const unit = match[2];
    if (!Number.isInteger(amount) || amount < 1) {
      throw new BadRequestException('定时周期不合法');
    }

    const next = new Date(from);
    next.setSeconds(0, 0);
    if (unit === 'D') {
      next.setDate(next.getDate() + amount);
    } else if (unit === 'W') {
      next.setDate(next.getDate() + amount * 7);
    } else if (unit === 'M') {
      next.setMonth(next.getMonth() + amount);
    } else if (unit === 'Y') {
      next.setFullYear(next.getFullYear() + amount);
    }

    return next;
  }

  private parseIntervalPart(value: string): number | null {
    const match = value.match(/^\*\/(\d+)$/);
    if (!match) {
      return null;
    }
    const interval = Number(match[1]);
    if (!Number.isInteger(interval) || interval < 1 || interval > 1440) {
      throw new BadRequestException('定时间隔必须在 1 到 1440 之间');
    }
    return interval;
  }

  private parseFixedPart(
    value: string,
    min: number,
    max: number,
    label: string,
  ): number {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException(`${label}字段不合法`);
    }
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) {
      throw new BadRequestException(`${label}字段不合法`);
    }
    return numberValue;
  }

  private addMinutes(value: Date, minutes: number): Date {
    const next = new Date(value);
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + minutes);
    return next;
  }

  private addHours(value: Date, hours: number): Date {
    const next = new Date(value);
    next.setSeconds(0, 0);
    next.setHours(next.getHours() + hours);
    return next;
  }

  private getStructuredText(row: PolicyCollectRunItemEntity, key: string) {
    const parsed = this.parseJson(row.structuredResult);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const value = (parsed as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      return value.join('\n');
    }
    return typeof value === 'string' && value ? value : null;
  }

  private buildPolicyFileInput(
    item: PolicyCollectRunItemEntity,
    remark: string,
  ): RegionPolicyFileInput {
    return {
      applicationLevel: null,
      conditionText: this.getStructuredText(item, 'conditions'),
      content: item.rawText ?? item.summary,
      endDate: this.getStructuredText(item, 'endDate'),
      materialText: this.getStructuredText(item, 'materials'),
      officialFileUrl: item.officialUrl,
      policyCategory: item.policyCategory,
      projectId: item.projectId,
      regionId: item.regionId,
      remark,
      startDate: this.getStructuredText(item, 'startDate'),
      status: 'draft',
      subsidyText: this.getStructuredText(item, 'subsidy'),
      targetObjects: this.getStructuredText(item, 'targetObjects'),
      title: item.title,
    };
  }

  private async applyPolicyFileSourceFields(
    policyFileId: string,
    item: PolicyCollectRunItemEntity,
  ) {
    await this.fileRepo.update(
      { id: policyFileId },
      {
        aiConfidence: item.officialConfidence,
        documentNo: item.documentNo,
        importedByAi: 1,
        issuingAgency: item.issuingAgency,
        officialPublishDate: item.publishDate,
        officialSourceName: item.issuingAgency,
        policyCategory: item.policyCategory,
        sourceHash: item.contentHash,
        sourceRunItemId: item.id,
      },
    );
  }

  private async resolveReviewPolicyFileId(
    item: PolicyCollectRunItemEntity,
    input: PolicyCollectReviewPolicyFileInput,
  ): Promise<string> {
    const policyFileId = toNullableString(input.policyFileId) ?? item.matchedPolicyFileId;
    if (!policyFileId) {
      throw new BadRequestException('未匹配到可处理的正式政策文件');
    }

    const policyFile = await this.fileRepo.findOne({
      where: { id: toStringId(policyFileId) },
    });
    if (!policyFile) {
      throw new BadRequestException('正式政策文件不存在');
    }
    if (
      String(policyFile.projectId) !== String(item.projectId) ||
      String(policyFile.regionId ?? '') !== String(item.regionId ?? '')
    ) {
      throw new BadRequestException('正式政策文件与采集结果的项目或区域不一致');
    }
    return String(policyFile.id);
  }

  private toCandidateFromAiItem(
    job: PolicyCollectJobEntity,
    item: AiPolicyCollectSearchItem,
    aiTaskId: string,
    index: number,
  ): PolicyCollectCandidate {
    const title =
      this.truncateText(item.title, 255) ??
      `${job.regionName}${job.projectName}候选政策${index + 1}`;
    const summary = this.truncateText(item.summary, 2000);
    const officialUrl = this.truncateText(item.officialUrl, 500);
    const rawText = this.resolveRawText(title, summary, item.rawText, officialUrl);
    const officialVerified =
      item.officialVerified === true || item.officialVerified === 1 ? 1 : 0;
    const officialConfidence = this.normalizeConfidence(
      item.officialConfidence,
      officialVerified,
    );

    return {
      aiReason: this.truncateText(item.aiReason, 2000),
      aiTaskId,
      contentHash: this.hash(
        [rawText, item.documentNo ?? '', officialUrl ?? ''].join('\n'),
      ),
      documentNo: this.truncateText(item.documentNo, 128),
      issuingAgency: this.truncateText(
        item.issuingAgency ?? job.departmentName,
        128,
      ),
      officialConfidence,
      officialUrl,
      officialVerified,
      publishDate: this.parseDate(item.publishDate),
      rawText,
      structuredResult: this.normalizeStructuredResult(item.structuredResult),
      summary,
      title,
    };
  }

  private resolveRawText(
    title: string,
    summary: null | string,
    rawText?: null | string,
    officialUrl?: null | string,
  ): string {
    const trimmedRawText = rawText?.trim();
    if (trimmedRawText) {
      return trimmedRawText;
    }
    return [title, summary, officialUrl].filter(Boolean).join('\n');
  }

  private normalizeStructuredResult(
    value?: null | Record<string, unknown>,
  ): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value;
  }

  private normalizeConfidence(
    value: null | string | undefined,
    officialVerified: number,
  ): null | string {
    const confidence = value?.trim().toLowerCase();
    if (confidence === 'high' || confidence === 'medium' || confidence === 'low') {
      return confidence;
    }
    return officialVerified === 1 ? 'medium' : 'low';
  }

  private parseDate(value?: null | string): Date | null {
    if (!value) {
      return null;
    }
    const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) {
      return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  private getPreviousCalendarYearDateRange(): { end: string; start: string } {
    const year = new Date().getFullYear() - 1;
    return {
      end: `${year}-12-31`,
      start: `${year}-01-01`,
    };
  }

  private shouldKeepCandidateByPublishDate(
    candidate: PolicyCollectCandidate,
    range: { end: string; start: string },
  ): boolean {
    if (!candidate.publishDate) {
      return true;
    }
    const start = this.parseDate(range.start);
    const end = this.parseDate(range.end);
    if (!start || !end) {
      return false;
    }
    return (
      candidate.publishDate.getTime() >= start.getTime() &&
      candidate.publishDate.getTime() <= end.getTime()
    );
  }

  private formatDateOnly(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private truncateText(value: null | string | undefined, max: number): null | string {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
  }

  private mergeReason(primary: string, secondary?: null | string): string {
    return secondary ? `${primary}\nAI 判断：${secondary}` : primary;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private parseJson(value: null | string) {
    if (!value) {
      return null;
    }
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }

  private paginate<T>(items: T[], query: Query) {
    const page = Math.max(Number(this.getQueryValue(query.page) ?? 1), 1);
    const pageSize = Math.max(Number(this.getQueryValue(query.pageSize) ?? 10), 1);
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total: items.length };
  }

  private getQueryValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }

  private toJobItem(row: PolicyCollectJobEntity) {
    return {
      createTime: formatDateTimeInBjt(row.createdAt),
      cronExpression: row.cronExpression,
      departmentName: row.departmentName,
      enabled: row.enabled,
      id: String(row.id),
      keywords: row.keywords,
      lastRunAt: row.lastRunAt ? formatDateTimeInBjt(row.lastRunAt) : null,
      name: row.name,
      nextRunAt: row.nextRunAt ? formatDateTimeInBjt(row.nextRunAt) : null,
      officialDomainRules: row.officialDomainRules,
      ownerName: row.ownerName,
      ownerUserId: row.ownerUserId ? String(row.ownerUserId) : null,
      policyCategory: this.normalizePolicyCategory(row.policyCategory),
      policyCategoryName: this.getPolicyCategoryLabel(row.policyCategory),
      projectId: String(row.projectId),
      projectName: row.projectName,
      regionId: row.regionId ? String(row.regionId) : null,
      regionName: row.regionName,
      regionScope: this.normalizeRegionScope(row.regionScope, row.regionId),
      regionScopeName:
        REGION_SCOPE_LABELS[this.normalizeRegionScope(row.regionScope, row.regionId)],
      updateTime: formatDateTimeInBjt(row.updatedAt),
    };
  }

  private toRunItem(row: PolicyCollectRunEntity) {
    return {
      changedCount: row.changedCount,
      createTime: formatDateTimeInBjt(row.createdAt),
      currentStep: row.currentStep,
      errorMessage: row.errorMessage,
      finishedAt: row.finishedAt ? formatDateTimeInBjt(row.finishedAt) : null,
      aiTaskId: row.aiTaskId ? String(row.aiTaskId) : null,
      id: String(row.id),
      ignoredCount: row.ignoredCount,
      jobId: String(row.jobId),
      jobName: row.jobName,
      newCount: row.newCount,
      progress: row.progress,
      sameCount: row.sameCount,
      searchedKeywords: this.parseJson(row.searchedKeywords),
      startedAt: row.startedAt ? formatDateTimeInBjt(row.startedAt) : null,
      status: row.status,
      stepMessage: row.stepMessage,
      totalCount: row.totalCount,
      uncertainCount: row.uncertainCount,
      updateTime: formatDateTimeInBjt(row.updatedAt),
    };
  }

  private toRunItemDetail(row: PolicyCollectRunItemEntity) {
    return {
      aiReason: row.aiReason,
      aiTaskId: row.aiTaskId ? String(row.aiTaskId) : null,
      compareStatus: row.compareStatus,
      createTime: formatDateTimeInBjt(row.createdAt),
      documentNo: row.documentNo,
      id: String(row.id),
      issuingAgency: row.issuingAgency,
      matchedPolicyFileId: row.matchedPolicyFileId
        ? String(row.matchedPolicyFileId)
        : null,
      officialConfidence: row.officialConfidence,
      officialUrl: row.officialUrl,
      officialVerified: row.officialVerified,
      policyCategory: this.normalizePolicyCategory(row.policyCategory),
      policyCategoryName: this.getPolicyCategoryLabel(row.policyCategory),
      projectId: String(row.projectId),
      projectName: row.projectName,
      publishDate: row.publishDate ? formatDateTimeInBjt(row.publishDate).slice(0, 10) : null,
      regionId: row.regionId ? String(row.regionId) : null,
      regionName: row.regionName,
      runId: String(row.runId),
      status: row.status,
      summary: row.summary,
      title: row.title,
      updateTime: formatDateTimeInBjt(row.updatedAt),
    };
  }

  private toNotificationItem(row: PolicyCollectNotificationEntity) {
    return {
      content: row.content,
      createTime: formatDateTimeInBjt(row.createdAt),
      id: String(row.id),
      jobId: row.jobId ? String(row.jobId) : null,
      readAt: row.readAt ? formatDateTimeInBjt(row.readAt) : null,
      runId: row.runId ? String(row.runId) : null,
      runItemId: row.runItemId ? String(row.runItemId) : null,
      status: row.status,
      targetUserId: row.targetUserId ? String(row.targetUserId) : null,
      title: row.title,
      type: row.type,
      updateTime: formatDateTimeInBjt(row.updatedAt),
    };
  }
}
