import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnterpriseBasicInfoEntity } from '../../../infrastructure/database/entities/enterprise-basic-info.entity';
import { EnterpriseEntity } from '../../../infrastructure/database/entities/enterprise.entity';
import { EnterpriseContactEntity } from '../../../infrastructure/database/entities/enterprise-contact.entity';
import { EnterprisePersonEntity } from '../../../infrastructure/database/entities/enterprise-person.entity';
import { EnterpriseProfileStatEntity } from '../../../infrastructure/database/entities/enterprise-profile-stat.entity';
import { EnterpriseProfileStatItemEntity } from '../../../infrastructure/database/entities/enterprise-profile-stat-item.entity';

/**
 * 客户端企业资料管理服务
 * 负责处理企业基本信息、联系人、股东等资料管理
 */
@Injectable()
export class ClientProfileService {
  constructor(
    @InjectRepository(EnterpriseEntity)
    private readonly enterpriseRepo: Repository<EnterpriseEntity>,
    @InjectRepository(EnterpriseBasicInfoEntity)
    private readonly basicInfoRepo: Repository<EnterpriseBasicInfoEntity>,
    @InjectRepository(EnterpriseContactEntity)
    private readonly contactRepo: Repository<EnterpriseContactEntity>,
    @InjectRepository(EnterprisePersonEntity)
    private readonly personRepo: Repository<EnterprisePersonEntity>,
    @InjectRepository(EnterpriseProfileStatEntity)
    private readonly profileStatRepo: Repository<EnterpriseProfileStatEntity>,
    @InjectRepository(EnterpriseProfileStatItemEntity)
    private readonly profileStatItemRepo: Repository<EnterpriseProfileStatItemEntity>,
  ) {}

  /**
   * 获取企业资料概览
   */
  async getProfile(enterpriseId: string) {
    const enterprise = await this.enterpriseRepo.findOne({
      where: { id: enterpriseId },
      relations: ['basicInfo'],
    });

    if (!enterprise) {
      throw new Error('企业不存在');
    }

    return enterprise;
  }

  /**
   * 更新企业资料
   */
  async updateProfile(enterpriseId: string, data: any) {
    await this.enterpriseRepo.update(enterpriseId, data);
    return this.getProfile(enterpriseId);
  }

  /**
   * 获取企业基本信息
   */
  async getBasicInfo(enterpriseId: string) {
    return this.basicInfoRepo.findOne({
      where: { enterpriseId },
    });
  }

  /**
   * 更新企业基本信息
   */
  async updateBasicInfo(enterpriseId: string, data: any) {
    const existing = await this.basicInfoRepo.findOne({
      where: { enterpriseId },
    });

    if (existing) {
      await this.basicInfoRepo.update(existing.id, data);
    } else {
      await this.basicInfoRepo.save({
        ...data,
        enterpriseId,
      });
    }

    return this.getBasicInfo(enterpriseId);
  }

  /**
   * 获取企业联系人列表
   */
  async listContacts(enterpriseId: string) {
    return this.contactRepo.find({
      where: { enterpriseId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 创建企业联系人
   */
  async createContact(enterpriseId: string, data: any) {
    const contact = this.contactRepo.create({
      ...data,
      enterpriseId,
    });

    return this.contactRepo.save(contact);
  }

  /**
   * 更新企业联系人
   */
  async updateContact(contactId: string, enterpriseId: string, data: any) {
    await this.contactRepo.update(
      { id: contactId, enterpriseId },
      data,
    );

    return this.contactRepo.findOne({
      where: { id: contactId, enterpriseId },
    });
  }

  /**
   * 删除企业联系人
   */
  async deleteContact(contactId: string, enterpriseId: string) {
    await this.contactRepo.delete({ id: contactId, enterpriseId });
  }

  /**
   * 获取企业股东列表
   */
  async listShareholders(enterpriseId: string) {
    return this.personRepo.find({
      where: { enterpriseId, personType: 'shareholder' },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 创建企业股东
   */
  async createShareholder(enterpriseId: string, data: any) {
    const shareholder = this.personRepo.create({
      ...data,
      enterpriseId,
      personType: 'shareholder',
    });

    return this.personRepo.save(shareholder);
  }

  /**
   * 更新企业股东
   */
  async updateShareholder(
    shareholderId: string,
    enterpriseId: string,
    data: any,
  ) {
    await this.personRepo.update(
      { id: shareholderId, enterpriseId },
      data,
    );

    return this.personRepo.findOne({
      where: { id: shareholderId, enterpriseId },
    });
  }

  /**
   * 删除企业股东
   */
  async deleteShareholder(shareholderId: string, enterpriseId: string) {
    await this.personRepo.delete({ id: shareholderId, enterpriseId });
  }

  /**
   * 获取企业资料完整度统计
   */
  async getProfileStats(enterpriseId: string) {
    const stat = await this.profileStatRepo.findOne({
      where: { enterpriseId },
    });

    if (!stat) {
      return null;
    }

    const items = await this.profileStatItemRepo.find({
      where: { statId: stat.id },
    });

    return {
      ...stat,
      items,
    };
  }
}
