import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { formatDateTimeInBjt } from '../../common/utils/date.util';
import { AiAuditLogEntity } from '../../infrastructure/database/entities/ai-audit-log.entity';
import type { AiAuditLogItem } from './ai.types';

@Injectable()
export class AiAuditLogService {
  constructor(
    @InjectRepository(AiAuditLogEntity)
    private readonly auditRepo: Repository<AiAuditLogEntity>,
  ) {}

  async record(input: {
    durationMs?: null | number;
    errorMessage?: null | string;
    model?: string;
    prompt: string;
    rawResponse: null | string;
    taskId: string;
    tokenUsage: null | unknown;
  }): Promise<void> {
    await this.auditRepo.save(
      this.auditRepo.create({
        cost: null,
        durationMs: input.durationMs ?? null,
        errorMessage: input.errorMessage ?? null,
        model: input.model || process.env.AI_MODEL || process.env.AI_MODELS?.split(',')[0] || 'gpt-6-astra',
        prompt: input.prompt,
        provider: process.env.AI_PROVIDER || 'psydo',
        rawResponse: input.rawResponse,
        taskId: input.taskId,
        tokenUsage: input.tokenUsage ? JSON.stringify(input.tokenUsage) : null,
      }),
    );
  }

  async list(query: Record<string, string | string[] | undefined>): Promise<{
    items: AiAuditLogItem[];
    total: number;
  }> {
    const page = Math.max(Number(this.getQueryValue(query.page) ?? 1), 1);
    const pageSize = Math.max(Number(this.getQueryValue(query.pageSize) ?? 10), 1);
    const where: FindOptionsWhere<AiAuditLogEntity> = {};
    const provider = this.getQueryValue(query.provider);
    const model = this.getQueryValue(query.model);
    const taskId = this.getQueryValue(query.taskId);

    if (provider) {
      where.provider = provider;
    }
    if (model) {
      where.model = model;
    }
    if (taskId) {
      where.taskId = taskId;
    }

    const [rows, total] = await this.auditRepo.findAndCount({
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
    });

    return {
      items: rows.map((row) => this.toItem(row)),
      total,
    };
  }

  async findByTaskId(taskId: string): Promise<AiAuditLogItem[]> {
    const rows = await this.auditRepo.find({
      order: { id: 'DESC' },
      where: { taskId },
    });
    return rows.map((row) => this.toItem(row));
  }

  private toItem(row: AiAuditLogEntity): AiAuditLogItem {
    return {
      cost: row.cost,
      createTime: formatDateTimeInBjt(row.createdAt),
      durationMs: row.durationMs,
      errorMessage: row.errorMessage,
      id: String(row.id),
      model: row.model,
      prompt: row.prompt,
      provider: row.provider,
      rawResponse: row.rawResponse,
      taskId: String(row.taskId),
      tokenUsage: this.parseJson(row.tokenUsage),
      updateTime: formatDateTimeInBjt(row.updatedAt),
    };
  }

  private getQueryValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
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
}
