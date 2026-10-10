import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientDeclarationEntity } from '../../../infrastructure/database/entities/client-declaration.entity';
import { DeclarationSchemeEntity } from '../../../infrastructure/database/entities/declaration-scheme.entity';
import { DeclarationPresetEntity } from '../../../infrastructure/database/entities/declaration-preset.entity';
import { DeclarationMaterialCheckEntity } from '../../../infrastructure/database/entities/declaration-material-check.entity';
import { DeclarationMaterialCheckItemEntity } from '../../../infrastructure/database/entities/declaration-material-check-item.entity';
import { PolicyProjectEntity } from '../../../infrastructure/database/entities/policy-project.entity';

/**
 * 客户端申报管理服务
 * 负责处理企业申报相关的业务逻辑
 */
@Injectable()
export class ClientDeclarationService {
  constructor(
    @InjectRepository(ClientDeclarationEntity)
    private readonly declarationRepo: Repository<ClientDeclarationEntity>,
    @InjectRepository(DeclarationSchemeEntity)
    private readonly schemeRepo: Repository<DeclarationSchemeEntity>,
    @InjectRepository(DeclarationPresetEntity)
    private readonly presetRepo: Repository<DeclarationPresetEntity>,
    @InjectRepository(DeclarationMaterialCheckEntity)
    private readonly materialCheckRepo: Repository<DeclarationMaterialCheckEntity>,
    @InjectRepository(DeclarationMaterialCheckItemEntity)
    private readonly materialCheckItemRepo: Repository<DeclarationMaterialCheckItemEntity>,
    @InjectRepository(PolicyProjectEntity)
    private readonly policyProjectRepo: Repository<PolicyProjectEntity>,
  ) {}

  /**
   * 获取用户的申报列表
   */
  async listDeclarations(userId: number, enterpriseId: string) {
    return this.declarationRepo.find({
      where: { enterpriseId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 获取申报详情
   */
  async getDeclaration(declarationId: string, enterpriseId: string) {
    return this.declarationRepo.findOne({
      where: { id: declarationId, enterpriseId },
    });
  }

  /**
   * 创建申报
   */
  async createDeclaration(userId: number, enterpriseId: string, data: any) {
    const declaration = this.declarationRepo.create({
      ...data,
      enterpriseId,
      createdBy: userId,
    });

    return this.declarationRepo.save(declaration);
  }

  /**
   * 更新申报
   */
  async updateDeclaration(
    declarationId: string,
    enterpriseId: string,
    userId: number,
    data: any,
  ) {
    await this.declarationRepo.update(
      { id: declarationId, enterpriseId },
      {
        ...data,
        updatedBy: userId,
      },
    );

    return this.getDeclaration(declarationId, enterpriseId);
  }

  /**
   * 提交申报
   */
  async submitDeclaration(
    declarationId: string,
    enterpriseId: string,
    userId: number,
  ) {
    await this.declarationRepo.update(
      { id: declarationId, enterpriseId },
      {
        status: 'submitted',
        submitTime: new Date(),
      },
    );

    return this.getDeclaration(declarationId, enterpriseId);
  }

  /**
   * 删除申报
   */
  async deleteDeclaration(declarationId: string, enterpriseId: string) {
    await this.declarationRepo.delete({ id: declarationId, enterpriseId });
  }

  /**
   * 获取候选项目列表
   */
  async getCandidateProjects(enterpriseId: string) {
    // TODO: 根据企业信息筛选匹配的政策项目
    return this.policyProjectRepo.find({
      where: { enabled: 1 },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 获取申报方案
   */
  async getDeclarationScheme(schemeId: string) {
    return this.schemeRepo.findOne({
      where: { id: schemeId },
      relations: ['materialRequirement', 'materialRequirement.items'],
    });
  }
}
