import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { formatDateTimeInBjt } from '../../../common/utils/date.util';
import { EnterpriseEntity } from '../../../infrastructure/database/entities/enterprise.entity';
import { EnterpriseTeacherEntity } from '../../../infrastructure/database/entities/enterprise-teacher.entity';
import { EnterpriseUserEntity } from '../../../infrastructure/database/entities/enterprise-user.entity';
import { UserEntity } from '../../../infrastructure/database/entities/user.entity';
import { toNumber, toStringId } from '../../system/shared/system.utils';
import { EnterpriseAccountService } from '../shared/enterprise-account.service';
import { EnterpriseUserInput } from './dto';

type EnterpriseUserItem = {
  createTime: string;
  email: null | string;
  enterpriseId: string;
  enterpriseName: string;
  id: string;
  isDefault: number;
  name: string;
  phone: null | string;
  remark: null | string;
  status: number;
  updateTime: string;
  userId: string;
  username: string;
};

@Injectable()
export class EnterpriseUserService {
  constructor(
    @InjectRepository(EnterpriseUserEntity)
    private readonly enterpriseUserRepo: Repository<EnterpriseUserEntity>,
    @InjectRepository(EnterpriseEntity)
    private readonly enterpriseRepo: Repository<EnterpriseEntity>,
    @InjectRepository(EnterpriseTeacherEntity)
    private readonly enterpriseTeacherRepo: Repository<EnterpriseTeacherEntity>,
    private readonly accountService: EnterpriseAccountService,
  ) {}

  async list(
    query: Record<string, string | string[] | undefined>,
    currentUser?: CurrentUser,
  ): Promise<{ items: EnterpriseUserItem[]; total: number }> {
    const rows = await this.enterpriseUserRepo.find({
      order: { id: 'DESC' },
      relations: {
        enterprise: true,
        user: true,
      },
    });

    let items = rows.map((row) => this.toItem(row));
    const scopedEnterpriseIds = await this.getScopedEnterpriseIds(currentUser);
    if (scopedEnterpriseIds) {
      items = items.filter((item) => scopedEnterpriseIds.has(item.enterpriseId));
    }
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

  async detail(id: string, currentUser?: CurrentUser): Promise<EnterpriseUserItem> {
    const binding = await this.requireEnterpriseUser(id);
    await this.assertEnterpriseVisible(binding.enterpriseId, currentUser);
    return this.toItem(binding);
  }

  async create(
    input: EnterpriseUserInput,
    currentUser?: CurrentUser,
  ): Promise<EnterpriseUserItem> {
    const enterprise = await this.requireEnterprise(input.enterpriseId);
    await this.assertEnterpriseVisible(enterprise.id, currentUser);
    const isDefault = this.normalizeFlag(input.isDefault, 0);
    const user = await this.accountService.createAccount(
      input,
      'enterprise_user',
    );

    try {
      if (isDefault === 1) {
        await this.clearDefaultUsers(enterprise.id);
      }

      const binding = await this.enterpriseUserRepo.save(
        this.enterpriseUserRepo.create({
          enterpriseId: enterprise.id,
          isDefault,
          remark: input.remark ?? null,
          status: this.normalizeStatus(input.status, 1),
          userId: user.id,
        }),
      );

      return this.detail(binding.id, currentUser);
    } catch (error) {
      await this.accountService.removeAccount(user);
      throw error;
    }
  }

  async update(
    id: string,
    input: EnterpriseUserInput,
    currentUser?: CurrentUser,
  ): Promise<EnterpriseUserItem> {
    const binding = await this.requireEnterpriseUser(id);
    await this.assertEnterpriseVisible(binding.enterpriseId, currentUser);

    if (input.enterpriseId !== undefined) {
      const enterprise = await this.requireEnterprise(input.enterpriseId);
      await this.assertEnterpriseVisible(enterprise.id, currentUser);
      binding.enterpriseId = enterprise.id;
    }
    if (input.status !== undefined) {
      binding.status = this.normalizeStatus(input.status, binding.status);
    }
    if (input.isDefault !== undefined) {
      binding.isDefault = this.normalizeFlag(input.isDefault, binding.isDefault);
    }
    if (input.remark !== undefined) {
      binding.remark = input.remark ?? null;
    }

    await this.accountService.updateAccount(
      binding.user,
      input,
      'enterprise_user',
    );
    if (binding.isDefault === 1) {
      await this.clearDefaultUsers(binding.enterpriseId, binding.id);
    }
    await this.enterpriseUserRepo.save(binding);
    return this.detail(binding.id, currentUser);
  }

  async resetPassword(id: string, currentUser?: CurrentUser): Promise<void> {
    const binding = await this.requireEnterpriseUser(id);
    await this.assertEnterpriseVisible(binding.enterpriseId, currentUser);
    await this.accountService.resetPassword(binding.user);
  }

  async remove(id: string, currentUser?: CurrentUser): Promise<void> {
    const binding = await this.requireEnterpriseUser(id);
    await this.assertEnterpriseVisible(binding.enterpriseId, currentUser);
    await this.enterpriseUserRepo.delete({ id: binding.id });
    await this.accountService.removeAccount(binding.user);
  }

  private isProjectTeacherScoped(user?: CurrentUser): user is CurrentUser {
    return Boolean(
      user &&
        user.portal === 'admin' &&
        user.roles.includes('project_teacher') &&
        !user.roles.includes('admin'),
    );
  }

  private async getScopedEnterpriseIds(
    user?: CurrentUser,
  ): Promise<Set<string> | null> {
    if (!this.isProjectTeacherScoped(user)) {
      return null;
    }

    const bindings = await this.enterpriseTeacherRepo.find({
      where: {
        status: 1,
        teacherUserId: toStringId(user.id),
      },
    });

    return new Set(bindings.map((item) => String(item.enterpriseId)));
  }

  private async assertEnterpriseVisible(
    enterpriseId: string,
    user?: CurrentUser,
  ): Promise<void> {
    const scopedEnterpriseIds = await this.getScopedEnterpriseIds(user);
    if (scopedEnterpriseIds && !scopedEnterpriseIds.has(String(enterpriseId))) {
      throw new ForbiddenException('只能访问自己负责的企业');
    }
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

  private async requireEnterpriseUser(id: string): Promise<EnterpriseUserEntity> {
    const binding = await this.enterpriseUserRepo.findOne({
      relations: {
        enterprise: true,
        user: true,
      },
      where: { id: toStringId(id) },
    });
    if (!binding) {
      throw new NotFoundException('企业用户不存在');
    }

    return binding;
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

  private normalizeFlag(value: number | string | undefined, fallback: number): number {
    const flag = toNumber(value, fallback);
    if (flag !== 0 && flag !== 1) {
      throw new BadRequestException('默认标记不合法');
    }
    return flag;
  }

  private async clearDefaultUsers(
    enterpriseId: string,
    excludeId?: string,
  ): Promise<void> {
    const rows = await this.enterpriseUserRepo.find({
      where: {
        enterpriseId,
        isDefault: 1,
      },
    });

    const updates = rows
      .filter((row) => String(row.id) !== String(excludeId ?? ''))
      .map((row) =>
        this.enterpriseUserRepo.update(
          { id: row.id },
          {
            isDefault: 0,
          },
        ),
      );

    await Promise.all(updates);
  }

  private toItem(row: EnterpriseUserEntity): EnterpriseUserItem {
    const user = row.user as UserEntity;
    return {
      createTime: formatDateTimeInBjt(row.createdAt),
      email: user.email,
      enterpriseId: String(row.enterpriseId),
      enterpriseName: row.enterprise?.name ?? '-',
      id: String(row.id),
      isDefault: row.isDefault,
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
