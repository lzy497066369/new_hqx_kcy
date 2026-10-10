import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { EnterprisePropertyRecordEntity } from '../../../infrastructure/database/entities/enterprise-property-record.entity';
import { AiDraftEntity } from '../../../infrastructure/database/entities/ai-draft.entity';
import { AiTaskEntity } from '../../../infrastructure/database/entities/ai-task.entity';
import { AiService } from '../../ai/ai.service';

/**
 * 客户端知识产权管理服务
 * 负责处理企业知识产权（专利、商标、软著等）管理和AI识别功能
 */
@Injectable()
export class ClientPropertyService {
  constructor(
    @InjectRepository(EnterprisePropertyRecordEntity)
    private readonly propertyRepo: Repository<EnterprisePropertyRecordEntity>,
    @InjectRepository(AiDraftEntity)
    private readonly aiDraftRepo: Repository<AiDraftEntity>,
    @InjectRepository(AiTaskEntity)
    private readonly aiTaskRepo: Repository<AiTaskEntity>,
    private readonly aiService: AiService,
  ) {}

  /**
   * 获取企业知识产权列表
   */
  async listProperties(enterpriseId: string, filters?: any) {
    const queryBuilder = this.propertyRepo
      .createQueryBuilder('property')
      .where('property.enterpriseId = :enterpriseId', { enterpriseId })
      .orderBy('property.createdAt', 'DESC');

    if (filters?.propertyType) {
      queryBuilder.andWhere('property.propertyType = :propertyType', {
        propertyType: filters.propertyType,
      });
    }

    if (filters?.status) {
      queryBuilder.andWhere('property.status = :status', {
        status: filters.status,
      });
    }

    return queryBuilder.getMany();
  }

  /**
   * 创建知识产权记录
   */
  async createProperty(enterpriseId: string, data: DeepPartial<EnterprisePropertyRecordEntity>) {
    const property = this.propertyRepo.create({
      ...data,
      enterpriseId,
    });

    return this.propertyRepo.save(property);
  }

  /**
   * 批量创建知识产权记录
   */
  async batchCreateProperties(enterpriseId: string, properties: DeepPartial<EnterprisePropertyRecordEntity>[]) {
    const entities = properties.map(data =>
      this.propertyRepo.create({
        ...data,
        enterpriseId,
      }),
    );

    return this.propertyRepo.save(entities);
  }

  /**
   * 更新知识产权记录
   */
  async updateProperty(propertyId: string, enterpriseId: string, data: any) {
    await this.propertyRepo.update(
      { id: propertyId, enterpriseId },
      data,
    );

    return this.propertyRepo.findOne({
      where: { id: propertyId, enterpriseId },
    });
  }

  /**
   * 删除知识产权记录
   */
  async deleteProperty(propertyId: string, enterpriseId: string) {
    await this.propertyRepo.delete({ id: propertyId, enterpriseId });
  }

  /**
   * 清空所有知识产权记录
   */
  async clearAllProperties(enterpriseId: string) {
    await this.propertyRepo.delete({ enterpriseId });
  }

  /**
   * 上传知识产权证书进行AI识别
   */
  async uploadForIpRecognition(
    enterpriseId: string,
    files: any[],
    userId: number,
  ) {
    // 创建AI任务
    const task = this.aiTaskRepo.create({
      scene: 'ip_recognition',
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
        draftType: 'ip_recognition',
        status: 'reviewing',
        sourceIds: file.id || '',
        draftPayload: JSON.stringify({ filePath: file.path }),
      })
    );

    await this.aiDraftRepo.save(drafts);

    return { taskId: savedTask.id };
  }

  /**
   * 获取AI识别草稿列表
   */
  async listIpRecognitionDrafts(enterpriseId: string) {
    return this.aiDraftRepo.find({
      where: {
        enterpriseId,
        draftType: 'ip_recognition',
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 更新AI识别草稿
   */
  async updateIpRecognitionDraft(
    draftId: string,
    enterpriseId: string,
    data: any,
  ) {
    await this.aiDraftRepo.update(
      { id: draftId, enterpriseId },
      { draftPayload: JSON.stringify(data) },
    );

    return this.aiDraftRepo.findOne({
      where: { id: draftId, enterpriseId },
    });
  }

  /**
   * 批准AI识别草稿（保存为正式知识产权记录）
   */
  async approveIpRecognitionDrafts(
    enterpriseId: string,
    draftIds: string[],
  ) {
    const drafts = await this.aiDraftRepo.findBy({
      id: draftIds as any,
      enterpriseId,
    });

    // 将草稿转换为正式记录
    const properties = drafts
      .filter(draft => draft.draftPayload)
      .map(draft => {
        const data = JSON.parse(draft.draftPayload || '{}');
        return {
          enterpriseId,
          ...data,
        };
      });

    if (properties.length > 0) {
      await this.batchCreateProperties(enterpriseId, properties);
    }

    // 标记草稿为已批准
    await this.aiDraftRepo.update(
      { id: draftIds as any, enterpriseId },
      { status: 'approved', reviewedAt: new Date() },
    );
  }

  /**
   * 拒绝AI识别草稿
   */
  async rejectIpRecognitionDrafts(
    enterpriseId: string,
    draftIds: string[],
  ) {
    await this.aiDraftRepo.update(
      { id: draftIds as any, enterpriseId },
      { status: 'rejected', reviewedAt: new Date() },
    );
  }

  /**
   * 重试AI识别
   */
  async retryIpRecognitionDrafts(
    enterpriseId: string,
    draftIds: string[],
  ) {
    await this.aiDraftRepo.update(
      { id: draftIds as any, enterpriseId },
      { status: 'reviewing' },
    );
  }

  /**
   * 删除AI识别草稿
   */
  async deleteIpRecognitionDraft(draftId: string, enterpriseId: string) {
    await this.aiDraftRepo.delete({ id: draftId, enterpriseId });
  }

  /**
   * 获取知识产权统计
   */
  async getPropertyStats(enterpriseId: string) {
    const properties = await this.propertyRepo.find({
      where: { enterpriseId },
    });

    const stats = {
      total: properties.length,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
    };

    properties.forEach(property => {
      // 按类型统计
      const type = property.recordType || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // 按状态统计
      const status = String(property.softWorkStatus || 'unknown');
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    });

    return stats;
  }

  /**
   * 生成知识产权转化记录（AI辅助）
   */
  async generateTransformationRecords(
    enterpriseId: string,
    propertyIds: string[],
    userId: number,
  ) {
    // 创建AI任务
    const task = this.aiTaskRepo.create({
      scene: 'transformation_generation',
      bizType: 'enterprise',
      bizId: enterpriseId,
      status: 'pending',
      createdBy: String(userId),
      inputSnapshot: JSON.stringify({ propertyIds }),
    });

    const savedTask = await this.aiTaskRepo.save(task);

    return { taskId: savedTask.id };
  }

  /**
   * 自动匹配研发项目（AI辅助）
   */
  async autoMatchResearchProjects(
    enterpriseId: string,
    userId: number,
  ) {
    // 创建AI任务
    const task = this.aiTaskRepo.create({
      scene: 'research_auto_match',
      bizType: 'enterprise',
      bizId: enterpriseId,
      status: 'pending',
      createdBy: String(userId),
    });

    const savedTask = await this.aiTaskRepo.save(task);

    return { taskId: savedTask.id };
  }
}
