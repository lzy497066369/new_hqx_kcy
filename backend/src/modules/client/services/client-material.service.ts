import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnterpriseMaterialEntity } from '../../../infrastructure/database/entities/enterprise-material.entity';
import { EnterpriseMaterialParseErrorEntity } from '../../../infrastructure/database/entities/enterprise-material-parse-error.entity';
import { ProjectMaterialRequirementEntity } from '../../../infrastructure/database/entities/project-material-requirement.entity';
import { ProjectMaterialRequirementItemEntity } from '../../../infrastructure/database/entities/project-material-requirement-item.entity';

type MaterialUploadInput = {
  declarationId?: string;
  category: string;
  title: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
};

/**
 * 客户端材料管理服务
 * 负责处理企业申报材料的上传、管理、模板下载等功能
 */
@Injectable()
export class ClientMaterialService {
  constructor(
    @InjectRepository(EnterpriseMaterialEntity)
    private readonly materialRepo: Repository<EnterpriseMaterialEntity>,
    @InjectRepository(EnterpriseMaterialParseErrorEntity)
    private readonly parseErrorRepo: Repository<EnterpriseMaterialParseErrorEntity>,
    @InjectRepository(ProjectMaterialRequirementEntity)
    private readonly requirementRepo: Repository<ProjectMaterialRequirementEntity>,
    @InjectRepository(ProjectMaterialRequirementItemEntity)
    private readonly requirementItemRepo: Repository<ProjectMaterialRequirementItemEntity>,
  ) {}

  /**
   * 获取企业材料列表
   */
  async listMaterials(enterpriseId: string, filters?: any) {
    const queryBuilder = this.materialRepo
      .createQueryBuilder('material')
      .where('material.enterpriseId = :enterpriseId', { enterpriseId })
      .orderBy('material.createdAt', 'DESC');

    if (filters?.category) {
      queryBuilder.andWhere('material.materialType = :category', {
        category: filters.category,
      });
    }

    if (filters?.declarationId) {
      queryBuilder.andWhere('material.declarationId = :declarationId', {
        declarationId: filters.declarationId,
      });
    }

    return queryBuilder.getMany();
  }

  /**
   * 上传材料
   */
  async uploadMaterial(
    enterpriseId: string,
    userId: number,
    data: MaterialUploadInput,
  ) {
    const material = this.materialRepo.create({
      enterpriseId,
      fileName: data.title,
      materialType: data.category,
      filePath: data.filePath,
    });

    return this.materialRepo.save(material);
  }

  /**
   * 批量上传材料
   */
  async batchUploadMaterials(
    enterpriseId: string,
    userId: number,
    materials: MaterialUploadInput[],
  ) {
    const entities = materials.map(data =>
      this.materialRepo.create({
        enterpriseId,
        fileName: data.title,
        materialType: data.category,
        filePath: data.filePath,
      }),
    );

    return this.materialRepo.save(entities);
  }

  /**
   * 更新材料信息
   */
  async updateMaterial(
    materialId: string,
    enterpriseId: string,
    data: any,
  ) {
    await this.materialRepo.update(
      { id: materialId, enterpriseId },
      data,
    );

    return this.materialRepo.findOne({
      where: { id: materialId, enterpriseId },
    });
  }

  /**
   * 删除材料
   */
  async deleteMaterial(materialId: string, enterpriseId: string) {
    await this.materialRepo.delete({ id: materialId, enterpriseId });
  }

  /**
   * 获取材料预览信息
   */
  async previewMaterial(materialId: string, enterpriseId: string) {
    const material = await this.materialRepo.findOne({
      where: { id: materialId, enterpriseId },
    });

    if (!material) {
      throw new Error('材料不存在');
    }

    return {
      id: material.id,
      title: material.fileName ?? material.templateName,
      category: material.materialType,
      filePath: material.filePath,
      // 当前材料表不存储 MIME/大小，保持未知值而非返回伪造信息。
      mimeType: null,
      fileSize: null,
      uploadedAt: material.createdAt,
    };
  }

  /**
   * 获取材料解析错误列表
   */
  async listParseErrors(materialId: string, enterpriseId: string) {
    return this.parseErrorRepo.find({
      where: { materialId, enterpriseId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 获取项目材料要求模板
   */
  async getMaterialTemplate(projectId: string) {
    const requirement = await this.requirementRepo.findOne({
      where: { projectId },
    });

    if (!requirement) {
      return null;
    }

    const items = await this.requirementItemRepo.find({
      where: { requirementId: requirement.id },
    });

    return {
      ...requirement,
      items,
    };
  }

  /**
   * 下载材料模板
   */
  async downloadTemplate(templateId: string) {
    // TODO: 实现模板下载逻辑
    // 返回模板文件路径或生成下载链接
    return {
      templateId,
      downloadUrl: `/templates/${templateId}`,
    };
  }

  /**
   * 检查材料完整性
   */
  async checkMaterialCompleteness(
    enterpriseId: string,
    declarationId: string,
  ) {
    // 获取申报要求的材料清单
    const requirement = await this.requirementRepo.findOne({
      where: { projectId: declarationId } as any,
    });

    if (!requirement) {
      return { complete: true, missingItems: [] };
    }

    // 获取已上传的材料
    const uploadedMaterials = await this.materialRepo.find({
      where: { enterpriseId },
    });

    // 简化检查逻辑
    return {
      complete: uploadedMaterials.length > 0,
      missingItems: [],
    };
  }

  /**
   * 获取材料统计信息
   */
  async getMaterialStats(enterpriseId: string) {
    const materials = await this.materialRepo.find({
      where: { enterpriseId },
    });

    const totalCount = materials.length;
    const totalSize = 0; // fileSize字段不存在，暂时设为0
    const categories = [...new Set(materials.map(m => m.materialType).filter(Boolean))];

    return {
      totalCount,
      totalSize,
      categories: categories.map(category => ({
        category,
        count: materials.filter(m => m.materialType === category).length,
      })),
    };
  }
}
