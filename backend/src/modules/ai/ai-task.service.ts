import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { formatDateTimeInBjt } from '../../common/utils/date.util';
import { AiAuditLogEntity } from '../../infrastructure/database/entities/ai-audit-log.entity';
import { AiResultEntity } from '../../infrastructure/database/entities/ai-result.entity';
import { AiTaskEntity } from '../../infrastructure/database/entities/ai-task.entity';
import { toStringId } from '../system/shared/system.utils';
import type { AiStatsSummary, AiTaskItem, AiTaskResultItem } from './ai.types';
import { AiAuditLogService } from './ai-audit-log.service';

@Injectable()
export class AiTaskService {
  constructor(
    @InjectRepository(AiTaskEntity)
    private readonly taskRepo: Repository<AiTaskEntity>,
    @InjectRepository(AiResultEntity)
    private readonly resultRepo: Repository<AiResultEntity>,
    @InjectRepository(AiAuditLogEntity)
    private readonly auditRepo: Repository<AiAuditLogEntity>,
    private readonly auditLogService: AiAuditLogService,
  ) {}

  createTask(input: {
    bizId: string;
    bizType: string;
    createdBy?: null | number | string;
    scene: string;
  }): AiTaskEntity {
    return this.taskRepo.create({
      bizId: input.bizId,
      bizType: input.bizType,
      createdBy: input.createdBy === undefined ? null : String(input.createdBy),
      scene: input.scene,
      status: 'pending',
    });
  }

  async saveTask(task: AiTaskEntity): Promise<AiTaskEntity> {
    return this.taskRepo.save(task);
  }

  async getTaskOrThrow(id: string): Promise<AiTaskEntity> {
    const task = await this.taskRepo.findOne({ where: { id: toStringId(id) } });
    if (!task) {
      throw new NotFoundException('AI task not found');
    }
    return task;
  }

  async list(query: Record<string, string | string[] | undefined>): Promise<{
    items: AiTaskItem[];
    total: number;
  }> {
    const page = Math.max(Number(this.getQueryValue(query.page) ?? 1), 1);
    const pageSize = Math.max(Number(this.getQueryValue(query.pageSize) ?? 10), 1);
    const where: FindOptionsWhere<AiTaskEntity> = {};
    const scene = this.getQueryValue(query.scene);
    const bizType = this.getQueryValue(query.bizType);
    const bizId = this.getQueryValue(query.bizId);
    const status = this.getQueryValue(query.status);
    const createdBy = this.getQueryValue(query.createdBy);
    const taskId = this.getQueryValue(query.taskId) ?? this.getQueryValue(query.id);

    if (taskId) {
      where.id = toStringId(taskId);
    }
    if (scene) {
      where.scene = scene;
    }
    if (bizType) {
      where.bizType = bizType;
    }
    if (bizId) {
      where.bizId = bizId;
    }
    if (status) {
      where.status = status;
    }
    if (createdBy) {
      where.createdBy = createdBy;
    }

    const [rows, total] = await this.taskRepo.findAndCount({
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
    });

    return {
      items: await Promise.all(rows.map((row) => this.toItem(row))),
      total,
    };
  }

  async getStatsSummary(): Promise<AiStatsSummary> {
    const [tasks, audits] = await Promise.all([
      this.taskRepo.find(),
      this.auditRepo.find(),
    ]);
    const tokenByTask = new Map<string, number>();
    const durationByTask = new Map<string, number[]>();
    const durationValues: number[] = [];

    audits.forEach((audit) => {
      tokenByTask.set(
        String(audit.taskId),
        (tokenByTask.get(String(audit.taskId)) ?? 0) +
          this.resolveTotalTokens(audit.tokenUsage),
      );
      if (typeof audit.durationMs === 'number') {
        durationValues.push(audit.durationMs);
        const taskDurations = durationByTask.get(String(audit.taskId)) ?? [];
        taskDurations.push(audit.durationMs);
        durationByTask.set(String(audit.taskId), taskDurations);
      }
    });

    const sceneMap = new Map<
      string,
      {
        failedCount: number;
        requestCount: number;
        scene: string;
        successCount: number;
        totalTokens: number;
      }
    >();

    tasks.forEach((task) => {
      const sceneItem =
        sceneMap.get(task.scene) ??
        {
          failedCount: 0,
          requestCount: 0,
          scene: task.scene,
          successCount: 0,
          totalTokens: 0,
        };

      sceneItem.requestCount += 1;
      sceneItem.totalTokens += tokenByTask.get(String(task.id)) ?? 0;
      if (task.status === 'success') {
        sceneItem.successCount += 1;
      }
      if (task.status === 'failed') {
        sceneItem.failedCount += 1;
      }
      sceneMap.set(task.scene, sceneItem);
    });

    const successCount = tasks.filter((task) => task.status === 'success').length;
    const failedCount = tasks.filter((task) => task.status === 'failed').length;
    const totalTokens = [...tokenByTask.values()].reduce(
      (total, value) => total + value,
      0,
    );

    return {
      avgDurationMs:
        durationValues.length === 0
          ? 0
          : Math.round(
              durationValues.reduce((total, value) => total + value, 0) /
                durationValues.length,
            ),
      dailyStats: this.buildDailyStats(tasks, tokenByTask, durationByTask),
      failedCount,
      requestCount: tasks.length,
      sceneStats: [...sceneMap.values()].sort(
        (left, right) => right.requestCount - left.requestCount,
      ),
      successCount,
      totalTokens,
    };
  }

  async toItem(task: AiTaskEntity, includeAuditLogs = false): Promise<AiTaskItem> {
    const result = task.resultId
      ? await this.resultRepo.findOne({ where: { id: task.resultId } })
      : null;

    const item: AiTaskItem = {
      bizId: task.bizId,
      bizType: task.bizType,
      createTime: formatDateTimeInBjt(task.createdAt),
      errorMessage: task.errorMessage,
      finishedAt: task.finishedAt ? formatDateTimeInBjt(task.finishedAt) : null,
      id: String(task.id),
      inputSnapshot: this.parseJson(task.inputSnapshot),
      result: result ? this.toResultItem(result) : null,
      resultId: task.resultId ? String(task.resultId) : null,
      scene: task.scene,
      status: task.status,
      updateTime: formatDateTimeInBjt(task.updatedAt),
    };

    if (includeAuditLogs) {
      item.auditLogs = await this.auditLogService.findByTaskId(String(task.id));
    }

    return item;
  }

  private toResultItem(result: AiResultEntity): AiTaskResultItem {
    return {
      confidence: result.confidence,
      confirmedAt: result.confirmedAt
        ? formatDateTimeInBjt(result.confirmedAt)
        : null,
      confirmedBy: result.confirmedBy,
      id: String(result.id),
      scene: result.scene,
      status: result.status,
      structuredResult: this.parseJson(result.structuredResult),
      summary: result.summary,
    };
  }

  private parseJson(value: null | string): null | unknown {
    if (!value) {
      return null;
    }
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }

  private getQueryValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private resolveTotalTokens(tokenUsage: null | string): number {
    const parsed = this.parseJson(tokenUsage);
    if (!parsed || typeof parsed !== 'object') {
      return 0;
    }
    const usage = parsed as Record<string, unknown>;
    const value = usage.total_tokens ?? usage.totalTokens;
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private buildDailyStats(
    tasks: AiTaskEntity[],
    tokenByTask: Map<string, number>,
    durationByTask: Map<string, number[]>,
  ): AiStatsSummary['dailyStats'] {
    const days = Array.from({ length: 14 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index - 13);
      return formatDateTimeInBjt(date).slice(0, 10);
    });
    const dailyMap = new Map(
      days.map((label) => [
        label,
        {
          avgDurationMs: 0,
          durationValues: [] as number[],
          failedCount: 0,
          label,
          requestCount: 0,
          successCount: 0,
          totalTokens: 0,
        },
      ]),
    );

    tasks.forEach((task) => {
      const label = formatDateTimeInBjt(task.createdAt).slice(0, 10);
      const item = dailyMap.get(label);
      if (!item) {
        return;
      }
      item.requestCount += 1;
      item.totalTokens += tokenByTask.get(String(task.id)) ?? 0;
      if (task.status === 'success') {
        item.successCount += 1;
      }
      if (task.status === 'failed') {
        item.failedCount += 1;
      }
      item.durationValues.push(...(durationByTask.get(String(task.id)) ?? []));
    });

    return [...dailyMap.values()].map(({ durationValues, ...item }) => ({
      ...item,
      avgDurationMs:
        durationValues.length === 0
          ? 0
          : Math.round(
              durationValues.reduce((total, value) => total + value, 0) /
                durationValues.length,
            ),
    }));
  }
}
