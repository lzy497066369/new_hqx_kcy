import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { EnterpriseFinanceRecordEntity } from '../../../infrastructure/database/entities/enterprise-finance-record.entity';
import { AiDraftEntity } from '../../../infrastructure/database/entities/ai-draft.entity';
import { AiTaskEntity } from '../../../infrastructure/database/entities/ai-task.entity';
import { AiService } from '../../ai/ai.service';

/**
 * 客户端财务数据管理服务
 * 负责处理企业财务数据、AI解析等功能
 */
@Injectable()
export class ClientFinanceService {
  constructor(
    @InjectRepository(EnterpriseFinanceRecordEntity)
    private readonly financeRecordRepo: Repository<EnterpriseFinanceRecordEntity>,
    @InjectRepository(AiDraftEntity)
    private readonly aiDraftRepo: Repository<AiDraftEntity>,
    @InjectRepository(AiTaskEntity)
    private readonly aiTaskRepo: Repository<AiTaskEntity>,
    private readonly aiService: AiService,
  ) {}

  /**
   * 获取企业财务记录列表
   */
  async listFinanceRecords(enterpriseId: string, filters?: any) {
    const queryBuilder = this.financeRecordRepo
      .createQueryBuilder('record')
      .where('record.enterpriseId = :enterpriseId', { enterpriseId })
      .andWhere('record.status = :status', { status: 1 })
      .orderBy('record.year', 'DESC');

    if (filters?.year) {
      queryBuilder.andWhere('record.year = :year', { year: filters.year });
    }

    if (filters?.recordType) {
      queryBuilder.andWhere('record.recordType = :recordType', {
        recordType: filters.recordType,
      });
    }

    return queryBuilder.getMany();
  }

  /**
   * 创建财务记录
   */
  async createFinanceRecord(enterpriseId: string, data: DeepPartial<EnterpriseFinanceRecordEntity>) {
    const record = this.financeRecordRepo.create({
      ...data,
      enterpriseId,
    });

    return this.financeRecordRepo.save(record);
  }

  /**
   * 批量创建财务记录
   */
  async batchCreateFinanceRecords(enterpriseId: string, records: DeepPartial<EnterpriseFinanceRecordEntity>[]) {
    const entities = records.map(data =>
      this.financeRecordRepo.create({
        ...data,
        enterpriseId,
      }),
    );

    return this.financeRecordRepo.save(entities);
  }

  /**
   * 更新财务记录
   */
  async updateFinanceRecord(recordId: string, enterpriseId: string, data: any) {
    await this.financeRecordRepo.update(
      { id: recordId, enterpriseId },
      data,
    );

    return this.financeRecordRepo.findOne({
      where: { id: recordId, enterpriseId },
    });
  }

  /**
   * 删除财务记录
   */
  async deleteFinanceRecord(recordId: string, enterpriseId: string) {
    await this.financeRecordRepo.update(
      { id: recordId, enterpriseId },
      { status: 0 },
    );
  }

  /**
   * 恢复已删除的财务记录
   */
  async restoreFinanceRecord(recordId: string, enterpriseId: string) {
    await this.financeRecordRepo.update(
      { id: recordId, enterpriseId },
      { status: 1 },
    );

    return this.financeRecordRepo.findOne({
      where: { id: recordId, enterpriseId },
    });
  }

  /**
   * 上传财务报表进行AI解析
   */
  async uploadFinanceFilesForAiParse(
    enterpriseId: string,
    files: any[],
    userId: number,
  ) {
    // 创建AI任务
    const task = this.aiTaskRepo.create({
      scene: 'finance_parse',
      bizType: 'enterprise',
      bizId: enterpriseId,
      status: 'pending',
      createdBy: String(userId),
    });

    const savedTask = await this.aiTaskRepo.save(task);

    // 创建AI草稿
    const drafts = files.map(file =>
      this.aiDraftRepo.create({
        taskId: savedTask.id,
        enterpriseId,
        draftType: 'finance_parse',
        status: 'reviewing',
        sourceIds: file.id || '',
        draftPayload: JSON.stringify({ filePath: file.path }),
      })
    );

    await this.aiDraftRepo.save(drafts);

    return { taskId: savedTask.id };
  }

  /**
   * 获取AI解析草稿列表
   */
  async listAiParseDrafts(enterpriseId: string) {
    return this.aiDraftRepo.find({
      where: {
        enterpriseId,
        draftType: 'finance_parse',
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 更新AI解析草稿
   */
  async updateAiParseDraft(draftId: string, enterpriseId: string, data: any) {
    await this.aiDraftRepo.update(
      { id: draftId, enterpriseId },
      { draftPayload: JSON.stringify(data) },
    );

    return this.aiDraftRepo.findOne({
      where: { id: draftId, enterpriseId },
    });
  }

  /**
   * 批准AI解析草稿（保存为正式财务记录）
   */
  async approveAiParseDrafts(enterpriseId: string, draftIds: string[]) {
    const drafts = await this.aiDraftRepo.findBy({
      id: draftIds as any,
      enterpriseId,
    });

    // 将草稿转换为正式记录
    const records = drafts
      .filter(draft => draft.draftPayload)
      .map(draft => {
        const data = JSON.parse(draft.draftPayload || '{}');
        return {
          enterpriseId,
          ...data,
        };
      });

    if (records.length > 0) {
      await this.batchCreateFinanceRecords(enterpriseId, records);
    }

    // 标记草稿为已批准
    await this.aiDraftRepo.update(
      { id: draftIds as any, enterpriseId },
      { status: 'approved', reviewedAt: new Date() },
    );
  }

  /**
   * 拒绝AI解析草稿
   */
  async rejectAiParseDrafts(enterpriseId: string, draftIds: string[]) {
    await this.aiDraftRepo.update(
      { id: draftIds as any, enterpriseId },
      { status: 'rejected', reviewedAt: new Date() },
    );
  }

  /**
   * 重试AI解析
   */
  async retryAiParseDrafts(enterpriseId: string, draftIds: string[]) {
    await this.aiDraftRepo.update(
      { id: draftIds as any, enterpriseId },
      { status: 'reviewing' },
    );
  }

  /**
   * 删除AI解析草稿
   */
  async deleteAiParseDraft(draftId: string, enterpriseId: string) {
    await this.aiDraftRepo.delete({ id: draftId, enterpriseId });
  }
}
