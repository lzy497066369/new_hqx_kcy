import { Injectable } from '@nestjs/common';
import { Between, FindOptionsWhere, LessThanOrEqual, Like, MoreThanOrEqual } from 'typeorm';

import { IamDatabaseService } from '../iam-admin/iam-database.service';
import { IamAuditQueryDto } from './dto/iam-audit-query.dto';
import { IamAuditEventEntity } from './entities/iam-audit-event.entity';

const SENSITIVE_KEY = /password|secret|token|authorization|cookie|code_verifier/i;

export interface IamAuditInput {
  action: string;
  actorUserId?: string;
  appCode?: string;
  clientId?: string;
  details?: Record<string, unknown>;
  eventType?: string;
  ipAddress?: string;
  outcome: 'failure' | 'success';
  username?: string;
}

@Injectable()
export class IamAuditService {
  constructor(private readonly database: IamDatabaseService) {}

  async record(input: IamAuditInput): Promise<void> {
    try {
      const repo = (await this.database.getDataSource()).getRepository(IamAuditEventEntity);
      await repo.save(repo.create({
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        appCode: input.appCode ?? null,
        clientId: input.clientId ?? null,
        details: this.sanitize(input.details),
        eventType: input.eventType ?? 'security',
        ipAddress: input.ipAddress ?? null,
        outcome: input.outcome,
        username: input.username ?? null,
      }));
    } catch {
      // Audit persistence must never prevent an identity or logout operation.
    }
  }

  async list(query: IamAuditQueryDto = {}): Promise<{ items: IamAuditEventEntity[]; limit: number; page: number; total: number }> {
    const limit = query.limit ?? 20;
    const page = query.page ?? 1;
    const where: FindOptionsWhere<IamAuditEventEntity> = {};
    const action = query.action?.trim();
    const username = query.username?.trim();
    if (action) where.action = action;
    if (query.outcome) where.outcome = query.outcome;
    if (username) where.username = Like(`%${username}%`);
    if (query.startAt && query.endAt) where.createdAt = Between(new Date(query.startAt), new Date(query.endAt));
    else if (query.startAt) where.createdAt = MoreThanOrEqual(new Date(query.startAt));
    else if (query.endAt) where.createdAt = LessThanOrEqual(new Date(query.endAt));
    const repo = (await this.database.getDataSource()).getRepository(IamAuditEventEntity);
    const [items, total] = await repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      where,
    });
    return { items, limit, page, total };
  }

  private sanitize(details: Record<string, unknown> | undefined): null | Record<string, unknown> {
    if (!details) return null;
    const safe = Object.fromEntries(Object.entries(details).filter(([key]) => !SENSITIVE_KEY.test(key)));
    return Object.keys(safe).length ? safe : null;
  }
}
