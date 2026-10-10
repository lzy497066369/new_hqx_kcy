import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { formatDateTimeInBjt } from '../../../common/utils/date.util';
import { EnterpriseEntity } from '../../../infrastructure/database/entities/enterprise.entity';
import { EnterpriseOwnerEntity } from '../../../infrastructure/database/entities/enterprise-owner.entity';
import { UserEntity } from '../../../infrastructure/database/entities/user.entity';
import { toNumber, toStringId } from '../../system/shared/system.utils';
import { EnterpriseAccountService } from '../shared/enterprise-account.service';
import { EnterpriseOwnerInput } from './dto';

type EnterpriseOwnerItem = {
  createTime: string;
  email: null | string;
  enterpriseId: string;
  enterpriseName: string;
  id: string;
  name: string;
  phone: null | string;
  remark: null | string;
  status: number;
  updateTime: string;
  userId: string;
  username: string;
};

@Injectable()
export class EnterpriseOwnerService {
  constructor(
    @InjectRepository(EnterpriseOwnerEntity)
    private readonly ownerRepo: Repository<EnterpriseOwnerEntity>,
    @InjectRepository(EnterpriseEntity)
    private readonly enterpriseRepo: Repository<EnterpriseEntity>,
    private readonly accountService: EnterpriseAccountService,
  ) {}

  async list(query: Record<string, string | string[] | undefined>): Promise<{ items: EnterpriseOwnerItem[]; total: number }> {
    const rows = await this.ownerRepo.find({
      order: { id: 'DESC' },
      relations: {
        enterprise: true,
        user: true,
      },
    });

    let items = rows.map((row) => this.toItem(row));
    const enterpriseId = this.getQueryValue(query.enterpriseId);
    const name = this.getQueryValue(query.name)?.trim().toLowerCase();
    const username = this.getQueryValue(query.username)?.trim().toLowerCase();
    const status = this.getQueryValue(query.status);

    if (enterpriseId) {
      items = items.filter((item) => item.enterpriseId === enterpriseId);
    }
    if (name) {
      items = items.filter((item) => item.name.toLowerCase().includes(name));
    }
    if (username) {
      items = items.filter((item) => item.username.toLowerCase().includes(username));
    }
    if (status !== undefined) {
      items = items.filter((item) => String(item.status) === status);
    }

    const page = Math.max(Number(this.getQueryValue(query.page) ?? 1), 1);
    const pageSizeValue = this.getQueryValue(query.pageSize);
    const pageSize = Math.max(Number((pageSizeValue ?? items.length) || 10), 1);
    const start = (page - 1) * pageSize;

    return { items: items.slice(start, start + pageSize), total: items.length };
  }

  async detail(id: string): Promise<EnterpriseOwnerItem> {
    return this.toItem(await this.requireOwner(id));
  }

  async create(input: EnterpriseOwnerInput): Promise<EnterpriseOwnerItem> {
    const enterprise = await this.requireEnterprise(input.enterpriseId);
    await this.ensureEnterpriseAvailable(enterprise.id);

    const user = await this.accountService.createAccount(
      input,
      'enterprise_owner',
    );

    const owner = await this.ownerRepo.save(
      this.ownerRepo.create({
        enterpriseId: enterprise.id,
        remark: input.remark ?? null,
        status: toNumber(input.status, 1),
        userId: user.id,
      }),
    );

    return this.detail(owner.id);
  }

  async update(id: string, input: EnterpriseOwnerInput): Promise<EnterpriseOwnerItem> {
    const owner = await this.requireOwner(id);

    if (input.enterpriseId !== undefined) {
      const enterprise = await this.requireEnterprise(input.enterpriseId);
      if (enterprise.id !== owner.enterpriseId) {
        await this.ensureEnterpriseAvailable(enterprise.id, owner.id);
        owner.enterpriseId = enterprise.id;
      }
    }
    if (input.status !== undefined) {
      owner.status = this.normalizeStatus(input.status, owner.status);
    }
    if (input.remark !== undefined) {
      owner.remark = input.remark ?? null;
    }

    await this.accountService.updateAccount(
      owner.user,
      input,
      'enterprise_owner',
    );
    await this.ownerRepo.save(owner);
    return this.detail(owner.id);
  }

  async resetPassword(id: string): Promise<void> {
    const owner = await this.requireOwner(id);
    await this.accountService.resetPassword(owner.user);
  }

  async remove(id: string): Promise<void> {
    const owner = await this.requireOwner(id);
    await this.ownerRepo.delete({ id: owner.id });
  }

  private async requireEnterprise(id?: string): Promise<EnterpriseEntity> {
    if (!id) {
      throw new BadRequestException('所属企业不能为空');
    }

    const enterprise = await this.enterpriseRepo.findOne({
      where: { id: toStringId(id) },
    });
    if (!enterprise) {
      throw new BadRequestException('所属企业不存在');
    }

    return enterprise;
  }

  private async requireOwner(id: string): Promise<EnterpriseOwnerEntity> {
    const owner = await this.ownerRepo.findOne({
      relations: {
        enterprise: true,
        user: true,
      },
      where: { id: toStringId(id) },
    });
    if (!owner) {
      throw new NotFoundException('企业负责人不存在');
    }

    return owner;
  }

  private async ensureEnterpriseAvailable(
    enterpriseId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.ownerRepo.findOne({ where: { enterpriseId } });
    if (existing && String(existing.id) !== String(excludeId ?? '')) {
      throw new BadRequestException('该企业已绑定负责人');
    }
  }

  private getQueryValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private normalizeStatus(value: number | string | undefined, fallback: number): number {
    const status = toNumber(value, fallback);
    if (status !== 0 && status !== 1) {
      throw new BadRequestException('绑定状态不合法');
    }
    return status;
  }

  private toItem(row: EnterpriseOwnerEntity): EnterpriseOwnerItem {
    const user = row.user as UserEntity;
    return {
      createTime: formatDateTimeInBjt(row.createdAt),
      email: user.email,
      enterpriseId: String(row.enterpriseId),
      enterpriseName: row.enterprise?.name ?? '-',
      id: String(row.id),
      name: user.realName,
      phone: user.phone,
      remark: row.remark,
      status: row.status,
      updateTime: formatDateTimeInBjt(row.updatedAt),
      userId: String(row.userId),
      username: user.username,
    };
  }
}
