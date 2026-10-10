import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EnterpriseOwnerEntity } from '../../../infrastructure/database/entities/enterprise-owner.entity';
import { EnterpriseTeacherEntity } from '../../../infrastructure/database/entities/enterprise-teacher.entity';
import { EnterpriseUserEntity } from '../../../infrastructure/database/entities/enterprise-user.entity';
import { EnterpriseProfileService } from '../profile/profile.service';

@Injectable()
export class EnterpriseClientService {
  constructor(
    @InjectRepository(EnterpriseOwnerEntity)
    private readonly ownerRepo: Repository<EnterpriseOwnerEntity>,
    @InjectRepository(EnterpriseUserEntity)
    private readonly userRepo: Repository<EnterpriseUserEntity>,
    @InjectRepository(EnterpriseTeacherEntity)
    private readonly teacherRepo: Repository<EnterpriseTeacherEntity>,
    private readonly profileService: EnterpriseProfileService,
  ) {}

  async getCurrentEnterprise(userId: number): Promise<unknown> {
    const normalizedUserId = String(userId);
    const ownerBinding = await this.ownerRepo.findOne({
      where: {
        status: 1,
        userId: normalizedUserId,
      },
    });
    if (ownerBinding) {
      return this.profileService.detail(ownerBinding.enterpriseId);
    }

    const userBinding = await this.userRepo.findOne({
      order: {
        isDefault: 'DESC',
        id: 'ASC',
      },
      where: {
        status: 1,
        userId: normalizedUserId,
      },
    });
    if (userBinding) {
      return this.profileService.detail(userBinding.enterpriseId);
    }

    const teacherBinding = await this.teacherRepo.findOne({
      order: {
        id: 'ASC',
      },
      where: {
        status: 1,
        teacherUserId: normalizedUserId,
      },
    });
    if (teacherBinding) {
      return this.profileService.detail(teacherBinding.enterpriseId);
    }

    throw new NotFoundException('当前账号未绑定企业');
  }
}
