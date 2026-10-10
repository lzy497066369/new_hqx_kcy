import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RoleEntity } from '../../../infrastructure/database/entities/role.entity';
import { UserRoleEntity } from '../../../infrastructure/database/entities/user-role.entity';
import { UserEntity } from '../../../infrastructure/database/entities/user.entity';
import { hashPassword } from '../../../common/utils/password.util';
import { toNullableString, toNumber, toStringId } from '../../system/shared/system.utils';

export interface EnterpriseAccountInput {
  allowDuplicateEmail?: boolean;
  allowDuplicatePhone?: boolean;
  email?: null | string;
  name?: string;
  password?: string;
  phone?: null | string;
  remark?: null | string;
  status?: number | string;
  username?: string;
}

type AccountRepoOverrides = {
  roleRepo?: Repository<RoleEntity>;
  userRepo?: Repository<UserEntity>;
  userRoleRepo?: Repository<UserRoleEntity>;
};

const ROLE_NAMES: Record<string, string> = {
  enterprise_owner: '企业负责人',
  enterprise_user: '企业用户',
};

@Injectable()
export class EnterpriseAccountService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepo: Repository<UserRoleEntity>,
  ) {}

  async createAccount(
    input: EnterpriseAccountInput,
    roleCode: string,
    repoOverrides?: AccountRepoOverrides,
  ): Promise<UserEntity> {
    const userRepo = repoOverrides?.userRepo ?? this.userRepo;
    const name = this.normalizeRequiredText(input.name, '账号姓名不能为空');
    const username = this.normalizeRequiredText(input.username, '账号不能为空');
    const phone = toNullableString(input.phone);
    const email = toNullableString(input.email);

    await this.ensureAccountAvailable(
      {
        allowDuplicateEmail: input.allowDuplicateEmail,
        allowDuplicatePhone: input.allowDuplicatePhone,
        email,
        phone,
        username,
      },
      repoOverrides,
    );

    const user = await userRepo.save(
      userRepo.create({
        email,
        homePath: '/home',
        password: await hashPassword(input.password?.trim() || '123456'),
        phone,
        portalType: 'client',
        realName: name,
        remark: toNullableString(input.remark),
        status: this.normalizeStatus(input.status, 1),
        username,
      }),
    );

    await this.ensureRole(user.id, roleCode, repoOverrides);
    return user;
  }

  async updateAccount(
    user: UserEntity,
    input: EnterpriseAccountInput,
    roleCode: string,
  ): Promise<UserEntity> {
    if (input.name !== undefined) {
      user.realName = this.normalizeRequiredText(input.name, '账号姓名不能为空');
    }
    if (input.username !== undefined) {
      user.username = this.normalizeRequiredText(input.username, '账号不能为空');
    }
    if (input.phone !== undefined) {
      user.phone = toNullableString(input.phone);
    }
    if (input.email !== undefined) {
      user.email = toNullableString(input.email);
    }
    if (input.password?.trim()) {
      user.password = await hashPassword(input.password.trim());
    }
    if (input.remark !== undefined) {
      user.remark = toNullableString(input.remark);
    }
    if (input.status !== undefined) {
      user.status = this.normalizeStatus(input.status, user.status);
    }

    await this.ensureAccountAvailable({
      allowDuplicateEmail: input.allowDuplicateEmail,
      allowDuplicatePhone: input.allowDuplicatePhone,
      email: user.email,
      excludeId: user.id,
      phone: user.phone,
      username: user.username,
    });

    const saved = await this.userRepo.save(user);
    await this.ensureRole(saved.id, roleCode);
    return saved;
  }

  async resetPassword(user: UserEntity, password = '123456'): Promise<void> {
    user.password = await hashPassword(password);
    await this.userRepo.save(user);
  }

  async removeAccount(user: UserEntity): Promise<void> {
    await this.userRepo.delete({ id: user.id });
  }

  private async ensureRole(
    userId: string,
    roleCode: string,
    repoOverrides?: AccountRepoOverrides,
  ): Promise<void> {
    const roleRepo = repoOverrides?.roleRepo ?? this.roleRepo;
    const userRoleRepo = repoOverrides?.userRoleRepo ?? this.userRoleRepo;

    let role = await roleRepo.findOne({
      where: {
        code: roleCode,
        portalType: 'client',
      },
    });
    if (!role) {
      role = await roleRepo.save(
        roleRepo.create({
          code: roleCode,
          name: ROLE_NAMES[roleCode] ?? roleCode,
          portalType: 'client',
          remark: null,
          status: 1,
        }),
      );
    }

    const exists = await userRoleRepo.findOne({
      where: {
        roleId: role.id,
        userId: toStringId(userId),
      },
    });
    if (exists) {
      return;
    }

    await userRoleRepo.save(
      userRoleRepo.create({
        roleId: role.id,
        userId: toStringId(userId),
      }),
    );
  }

  private async ensureAccountAvailable(
    params: {
      allowDuplicateEmail?: boolean;
      allowDuplicatePhone?: boolean;
      email?: null | string;
      excludeId?: string;
      phone?: null | string;
      username: string;
    },
    repoOverrides?: AccountRepoOverrides,
  ): Promise<void> {
    const userRepo = repoOverrides?.userRepo ?? this.userRepo;
    const excludeId = String(params.excludeId ?? '');
    const usernameUser = await userRepo.findOne({
      where: { username: params.username },
    });
    if (usernameUser && String(usernameUser.id) !== excludeId) {
      throw new BadRequestException('账号已存在');
    }

    if (params.phone && !params.allowDuplicatePhone) {
      const phoneUser = await userRepo.findOne({
        where: { phone: params.phone },
      });
      if (phoneUser && String(phoneUser.id) !== excludeId) {
        throw new BadRequestException('手机号已存在');
      }
    }

    if (params.email && !params.allowDuplicateEmail) {
      const emailUser = await userRepo.findOne({
        where: { email: params.email },
      });
      if (emailUser && String(emailUser.id) !== excludeId) {
        throw new BadRequestException('邮箱已存在');
      }
    }
  }

  private normalizeRequiredText(value: string | undefined, message: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(message);
    }

    return normalized;
  }

  private normalizeStatus(value: number | string | undefined, fallback: number): number {
    const status = toNumber(value, fallback);
    if (status !== 0 && status !== 1) {
      throw new BadRequestException('账号状态不合法');
    }

    return status;
  }
}
