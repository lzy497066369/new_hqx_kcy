import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { OperationLogEntity } from '../../../infrastructure/database/entities/operation-log.entity';
import { formatDateTimeInBjt } from '../../../common/utils/date.util';

type OperationLogItem = {
  action: string;
  bizId: string | null;
  cost: number;
  createTime: string;
  errorMessage: string | null;
  id: string;
  ip: string | null;
  method: string | null;
  module: string;
  paramsText: string | null;
  realName: string | null;
  requestPath: string | null;
  resultText: string | null;
  success: number;
  updateTime: string;
  userId: string | null;
  userName: string | null;
};

type OperationLogQuery = {
  action?: string;
  endTime?: string | null;
  module?: string;
  page?: string;
  pageSize?: string;
  success?: number;
  startTime?: string | null;
  userName?: string;
};

@Injectable()
export class SystemOperationLogService {
  constructor(
    @InjectRepository(OperationLogEntity)
    private readonly operationLogRepo: Repository<OperationLogEntity>,
  ) {}

  async list(
    query: Record<string, string | string[] | undefined>,
    currentUser?: CurrentUser,
  ): Promise<{ items: OperationLogItem[]; total: number }> {
    const parsed = this.parseQuery(query);
    const qb = this.operationLogRepo
      .createQueryBuilder('log')
      .orderBy('log.id', 'DESC');

    if (this.isProjectTeacherScoped(currentUser)) {
      qb.andWhere('log.user_id = :currentUserId', {
        currentUserId: String(currentUser.id),
      });
    }

    if (parsed.module) {
      qb.andWhere('LOWER(log.module) LIKE :module', {
        module: `%${parsed.module}%`,
      });
    }
    if (parsed.action) {
      qb.andWhere('LOWER(log.action) LIKE :action', {
        action: `%${parsed.action}%`,
      });
    }
    if (parsed.userName) {
      qb.andWhere(
        new Brackets((subQb) => {
          subQb
            .where('LOWER(log.user_name) LIKE :userName', {
              userName: `%${parsed.userName}%`,
            })
            .orWhere('LOWER(log.real_name) LIKE :userName', {
              userName: `%${parsed.userName}%`,
            });
        }),
      );
    }
    if (parsed.success !== undefined) {
      qb.andWhere('log.success = :success', { success: parsed.success });
    }
    if (parsed.startTime) {
      qb.andWhere('log.created_at >= :startTime', {
        startTime: parsed.startTime,
      });
    }
    if (parsed.endTime) {
      qb.andWhere('log.created_at <= :endTime', {
        endTime: parsed.endTime,
      });
    }

    const page = Math.max(Number(parsed.page ?? 1), 1);
    const pageSize = Math.max(Number(parsed.pageSize ?? 10), 1);
    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items: rows.map((row) => this.toItem(row)),
      total,
    };
  }

  private isProjectTeacherScoped(user?: CurrentUser): user is CurrentUser {
    return Boolean(
      user &&
        user.portal === 'admin' &&
        user.roles.includes('project_teacher') &&
        !user.roles.includes('admin'),
    );
  }

  private toItem(row: OperationLogEntity): OperationLogItem {
    return {
      action: row.action,
      bizId: row.bizId,
      cost: row.cost,
      createTime: formatDateTimeInBjt(row.createdAt),
      errorMessage: row.errorMessage,
      id: String(row.id),
      ip: row.ip,
      method: row.method,
      module: row.module,
      paramsText: row.paramsText,
      realName: row.realName,
      requestPath: row.requestPath,
      resultText: row.resultText,
      success: row.success,
      updateTime: formatDateTimeInBjt(row.updatedAt),
      userId: row.userId,
      userName: row.userName,
    };
  }

  private getQueryValue(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  private parseQuery(query: Record<string, string | string[] | undefined>): OperationLogQuery {
    return {
      action: this.normalizeQueryText(this.getQueryValue(query.action)),
      endTime: this.getBoundaryTime(this.getQueryValue(query.endTime), true),
      module: this.normalizeQueryText(this.getQueryValue(query.module)),
      page: this.getQueryValue(query.page),
      pageSize: this.getQueryValue(query.pageSize),
      success: this.parseSuccess(this.getQueryValue(query.success)),
      startTime: this.getBoundaryTime(this.getQueryValue(query.startTime)),
      userName: this.normalizeQueryText(this.getQueryValue(query.userName)),
    };
  }

  private parseSuccess(value?: string): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === '1' || value.toLowerCase() === 'true') {
      return 1;
    }

    if (value === '0' || value.toLowerCase() === 'false') {
      return 0;
    }

    return undefined;
  }

  private normalizeQueryText(value?: string): string | undefined {
    const text = value?.trim().toLowerCase();
    return text ? text : undefined;
  }

  private getBoundaryTime(value?: string, endOfDay = false): null | string {
    if (!value) {
      return null;
    }

    return value.includes(' ')
      ? value
      : `${value} ${endOfDay ? '23:59:59' : '00:00:00'}`;
  }
}
