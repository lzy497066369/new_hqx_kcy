import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import type { PortalType } from '../../../common/types/portal-type';
import { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { formatDateTimeInBjt } from '../../../common/utils/date.util';
import { hashPassword } from '../../../common/utils/password.util';
import { DeptEntity } from '../../../infrastructure/database/entities/dept.entity';
import { EnterpriseEntity } from '../../../infrastructure/database/entities/enterprise.entity';
import { EnterpriseOwnerEntity } from '../../../infrastructure/database/entities/enterprise-owner.entity';
import { EnterpriseTeacherEntity } from '../../../infrastructure/database/entities/enterprise-teacher.entity';
import { EnterpriseUserEntity } from '../../../infrastructure/database/entities/enterprise-user.entity';
import { RoleEntity } from '../../../infrastructure/database/entities/role.entity';
import { UserRoleEntity } from '../../../infrastructure/database/entities/user-role.entity';
import { UserEntity } from '../../../infrastructure/database/entities/user.entity';
import {
  normalizeArray,
  normalizePortalType,
  resolveManagedPortalType,
  toNullableString,
  toNumber,
  toStringId,
} from '../shared/system.utils';
import { UserInput } from './dto';

const DEFAULT_HOME_PATH = '/Dashboard/Workspace';
const DEFAULT_CLIENT_HOME_PATH = '/home';

type UserItem = {
  createTime: string;
  deptId: string | null;
  deptName: string | null;
  enterpriseId?: string | null;
  enterpriseIds?: string[];
  enterpriseName?: string | null;
  homePath?: string | null;
  id: string;
  name: string;
  portalType: PortalType;
  roleIds: string[];
  roleNames: string[];
  remark: string | null;
  status: number;
  updateTime: string;
  username?: string;
};

@Injectable()
export class SystemUserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(DeptEntity)
    private readonly deptRepo: Repository<DeptEntity>,
    @InjectRepository(EnterpriseEntity)
    private readonly enterpriseRepo: Repository<EnterpriseEntity>,
    @InjectRepository(EnterpriseOwnerEntity)
    private readonly enterpriseOwnerRepo: Repository<EnterpriseOwnerEntity>,
    @InjectRepository(EnterpriseTeacherEntity)
    private readonly enterpriseTeacherRepo: Repository<EnterpriseTeacherEntity>,
    @InjectRepository(EnterpriseUserEntity)
    private readonly enterpriseUserRepo: Repository<EnterpriseUserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepo: Repository<UserRoleEntity>,
  ) {}

  async list(
    query: Record<string, string | string[] | undefined>,
    portalType: PortalType,
    currentUser?: CurrentUser,
  ): Promise<{ items: UserItem[]; total: number }> {
    const rows = await this.userRepo.find({
      relations: {
        userRoles: {
          role: true,
        },
      },
      order: {
        id: 'ASC',
      },
      where: { portalType },
    });

    let items = rows.map((row) => this.toItem(row));
    if (portalType === 'client') {
      items = await this.attachEnterpriseInfo(items);
    }
    items = await this.applyProjectTeacherScope(items, portalType, currentUser);
    const name = this.getQueryValue(query.name)?.toLowerCase();
    const id = this.getQueryValue(query.id);
    const deptId = this.getQueryValue(query.deptId);
    const enterpriseId = this.getQueryValue(query.enterpriseId);
    const status = this.getQueryValue(query.status);
    const remark = this.getQueryValue(query.remark)?.toLowerCase();
    const startTime = this.getBoundaryTime(this.getQueryValue(query.startTime));
    const endTime = this.getBoundaryTime(this.getQueryValue(query.endTime), true);

    if (name) {
      items = items.filter((item) => item.name.toLowerCase().includes(name));
    }
    if (id) {
      items = items.filter((item) => item.id === id);
    }
    if (deptId) {
      items = items.filter((item) => item.deptId === deptId);
    }
    if (enterpriseId) {
      items = items.filter((item) => item.enterpriseId === enterpriseId);
    }
    if (status !== undefined) {
      items = items.filter((item) => String(item.status) === status);
    }
    if (remark) {
      items = items.filter((item) =>
        (item.remark ?? '').toLowerCase().includes(remark),
      );
    }
    if (startTime) {
      items = items.filter((item) => item.createTime >= startTime);
    }
    if (endTime) {
      items = items.filter((item) => item.createTime <= endTime);
    }

    const page = Math.max(Number(this.getQueryValue(query.page) ?? 1), 1);
    const pageSizeValue = this.getQueryValue(query.pageSize);
    const pageSize = Math.max(Number((pageSizeValue ?? items.length) || 10), 1);
    const start = (page - 1) * pageSize;

    return {
      items: items.slice(start, start + pageSize),
      total: items.length,
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

  private async applyProjectTeacherScope(
    items: UserItem[],
    portalType: PortalType,
    currentUser?: CurrentUser,
  ): Promise<UserItem[]> {
    if (!this.isProjectTeacherScoped(currentUser)) {
      return items;
    }

    if (portalType === 'admin') {
      return items.filter((item) => item.id === String(currentUser.id));
    }

    const enterpriseIds = await this.getTeacherEnterpriseIds(currentUser.id);
    return items.filter((item) =>
      (item.enterpriseIds ?? (item.enterpriseId ? [item.enterpriseId] : [])).some(
        (enterpriseId) => enterpriseIds.has(enterpriseId),
      ),
    );
  }

  private async getTeacherEnterpriseIds(userId: number): Promise<Set<string>> {
    const rows = await this.enterpriseTeacherRepo.find({
      where: {
        status: 1,
        teacherUserId: toStringId(userId),
      },
    });
    return new Set(rows.map((item) => String(item.enterpriseId)));
  }

  async create(input: UserInput, currentPortal: PortalType): Promise<UserItem> {
    const portalType = this.resolveInputPortal(input, currentPortal);
    const name = input.name?.trim();
    if (!name) {
      throw new BadRequestException('用户名称不能为空');
    }

    const dept = await this.resolveDept(input.deptId);
    const username = input.username?.trim() || name;
    await this.ensureUsernameAvailable(username);

    const entity = this.userRepo.create({
      deptId: dept?.id ?? null,
      deptName: dept?.name ?? null,
      homePath:
        toNullableString(input.homePath) ??
        (portalType === 'client'
          ? DEFAULT_CLIENT_HOME_PATH
          : DEFAULT_HOME_PATH),
      password: await hashPassword(input.password?.trim() || '123456'),
      portalType,
      realName: name,
      remark: toNullableString(input.remark),
      status: toNumber(input.status, 1),
      username,
    });
    const saved = await this.userRepo.save(entity);
    let roles: RoleEntity[] = [];
    if (input.roleIds !== undefined) {
      roles = await this.syncRoles(saved.id, input.roleIds, portalType);
    }
    await this.syncClientEnterpriseBinding(saved.id, roles, input, portalType);
    return this.toItem(await this.reloadUser(saved.id));
  }

  async update(
    id: string,
    input: UserInput,
    currentPortal: PortalType,
  ): Promise<UserItem> {
    const portalType = this.resolveInputPortal(input, currentPortal);
    const entity = await this.userRepo.findOne({
      where: { id: toStringId(id), portalType },
    });
    if (!entity) {
      throw new NotFoundException('用户不存在');
    }

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new BadRequestException('用户名称不能为空');
      }

      entity.realName = name;
      if (!input.username?.trim()) {
        entity.username = entity.username || name;
      }
    }
    if (input.username !== undefined) {
      const username = input.username.trim();
      if (!username) {
        throw new BadRequestException('用户名不能为空');
      }
      entity.username = username;
    }
    if (input.password !== undefined && input.password.trim()) {
      entity.password = await hashPassword(input.password.trim());
    }
    if (input.homePath !== undefined) {
      entity.homePath = toNullableString(input.homePath);
    }
    if (input.remark !== undefined) {
      entity.remark = toNullableString(input.remark);
    }
    if (input.status !== undefined) {
      entity.status = toNumber(input.status, entity.status);
    }
    if (input.deptId !== undefined) {
      const dept = await this.resolveDept(input.deptId);
      entity.deptId = dept?.id ?? null;
      entity.deptName = dept?.name ?? null;
    }

    await this.ensureUsernameAvailable(entity.username, entity.id);
    const saved = await this.userRepo.save(entity);
    let roles: RoleEntity[] | undefined;
    if (input.roleIds !== undefined) {
      roles = await this.syncRoles(saved.id, input.roleIds, saved.portalType);
    }
    await this.syncClientEnterpriseBinding(saved.id, roles, input, saved.portalType);
    return this.toItem(await this.reloadUser(saved.id));
  }

  async remove(id: string, portalType: PortalType): Promise<void> {
    const entity = await this.userRepo.findOne({
      where: { id: toStringId(id), portalType },
    });
    if (!entity) {
      throw new NotFoundException('用户不存在');
    }

    await this.userRoleRepo.delete({ userId: entity.id });
    if (entity.portalType === 'client') {
      await this.clearClientEnterpriseBindings(entity.id);
    }
    await this.userRepo.delete({ id: entity.id });
  }

  private async resolveDept(deptId?: string | null): Promise<DeptEntity | null> {
    if (!deptId) {
      return null;
    }

    const dept = await this.deptRepo.findOne({
      where: { id: toStringId(deptId) },
    });
    if (!dept) {
      throw new BadRequestException('关联部门不存在');
    }

    return dept;
  }

  private async reloadUser(id: string): Promise<UserEntity> {
    const row = await this.userRepo.findOne({
      relations: {
        userRoles: {
          role: true,
        },
      },
      where: { id: toStringId(id) },
    });

    if (!row) {
      throw new NotFoundException('用户不存在');
    }

    return row;
  }

  private async attachEnterpriseInfo(items: UserItem[]): Promise<UserItem[]> {
    const userIds = items.map((item) => toStringId(item.id));
    if (userIds.length === 0) {
      return items;
    }

    const [ownerBindings, teacherBindings, userBindings] = await Promise.all([
      this.enterpriseOwnerRepo.find({
        relations: { enterprise: true },
        where: { userId: In(userIds) },
      }),
      this.enterpriseTeacherRepo.find({
        relations: { enterprise: true },
        where: { teacherUserId: In(userIds) },
      }),
      this.enterpriseUserRepo.find({
        relations: { enterprise: true },
        where: { userId: In(userIds) },
      }),
    ]);

    const enterpriseMap = new Map<
      string,
      { enterpriseId: string; enterpriseIds: string[]; enterpriseName: string }
    >();
    const appendEnterprise = (
      userId: string,
      enterprise?: EnterpriseEntity,
    ) => {
      if (!enterprise) {
        return;
      }
      const key = toStringId(userId);
      const enterpriseId = toStringId(enterprise.id);
      const existed = enterpriseMap.get(key);
      if (!existed) {
        enterpriseMap.set(key, {
          enterpriseId,
          enterpriseIds: [enterpriseId],
          enterpriseName: enterprise.name,
        });
        return;
      }
      if (!existed.enterpriseIds.includes(enterpriseId)) {
        existed.enterpriseIds.push(enterpriseId);
        existed.enterpriseName = `${existed.enterpriseName}, ${enterprise.name}`;
      }
    };

    ownerBindings.forEach((item) => appendEnterprise(item.userId, item.enterprise));
    userBindings.forEach((item) => appendEnterprise(item.userId, item.enterprise));
    teacherBindings.forEach((item) =>
      appendEnterprise(item.teacherUserId, item.enterprise),
    );

    return items.map((item) => {
      const enterprise = enterpriseMap.get(item.id);
      return enterprise
        ? {
            ...item,
            enterpriseId: enterprise.enterpriseId,
            enterpriseIds: enterprise.enterpriseIds,
            enterpriseName: enterprise.enterpriseName,
          }
        : item;
    });
  }

  private async syncRoles(
    userId: string,
    roleIds: string[] | string,
    portalType: PortalType,
  ): Promise<RoleEntity[]> {
    const ids = [
      ...new Set(normalizeArray(roleIds).map((item) => toStringId(item))),
    ];
    await this.userRoleRepo.delete({ userId: toStringId(userId) });

    if (ids.length === 0) {
      return [];
    }

    const roles = await this.roleRepo.find({
      where: {
        id: In(ids),
        portalType,
      },
    });

    if (roles.length !== ids.length) {
      throw new BadRequestException('关联角色不存在或不属于当前端');
    }

    await this.userRoleRepo.save(
      roles.map((role) =>
        this.userRoleRepo.create({
          roleId: role.id,
          userId: toStringId(userId),
        }),
      ),
    );
    return roles;
  }

  private async syncClientEnterpriseBinding(
    userId: string,
    roles: RoleEntity[] | undefined,
    input: UserInput,
    portalType: PortalType,
  ): Promise<void> {
    if (portalType !== 'client') {
      return;
    }

    const resolvedRoles =
      roles ?? (await this.getCurrentRoles(userId, portalType));
    const roleCodes = new Set(resolvedRoles.map((role) => role.code));
    const shouldBindOwner = roleCodes.has('enterprise_owner');
    const shouldBindTeacher = roleCodes.has('project_teacher');
    const shouldBindUser = roleCodes.has('enterprise_user');
    const shouldBindEnterprise =
      shouldBindOwner || shouldBindTeacher || shouldBindUser;

    if (!shouldBindEnterprise) {
      await this.clearClientEnterpriseBindings(userId);
      return;
    }

    const enterpriseId =
      toNullableString(input.enterpriseId) ??
      (await this.getCurrentEnterpriseId(userId));
    if (!enterpriseId) {
      throw new BadRequestException('客户端用户必须关联企业');
    }

    await this.requireEnterprise(enterpriseId);
    await Promise.all([
      shouldBindOwner
        ? this.upsertOwnerBinding(userId, enterpriseId, input)
        : this.enterpriseOwnerRepo.delete({ userId: toStringId(userId) }),
      shouldBindTeacher
        ? this.upsertTeacherBinding(userId, enterpriseId, input)
        : this.enterpriseTeacherRepo.delete({ teacherUserId: toStringId(userId) }),
      shouldBindUser
        ? this.upsertEnterpriseUserBinding(userId, enterpriseId, input)
        : this.enterpriseUserRepo.delete({ userId: toStringId(userId) }),
    ]);
  }

  private async getCurrentRoles(
    userId: string,
    portalType: PortalType,
  ): Promise<RoleEntity[]> {
    const rows = await this.userRoleRepo.find({
      relations: { role: true },
      where: { userId: toStringId(userId) },
    });
    return rows
      .map((item) => item.role)
      .filter(
        (item): item is RoleEntity =>
          Boolean(item) && item.portalType === portalType,
      );
  }

  private async getCurrentEnterpriseId(userId: string): Promise<null | string> {
    const [ownerBinding, userBinding, teacherBinding] = await Promise.all([
      this.enterpriseOwnerRepo.findOne({ where: { userId: toStringId(userId) } }),
      this.enterpriseUserRepo.findOne({ where: { userId: toStringId(userId) } }),
      this.enterpriseTeacherRepo.findOne({
        where: { teacherUserId: toStringId(userId) },
      }),
    ]);

    return (
      ownerBinding?.enterpriseId ??
      userBinding?.enterpriseId ??
      teacherBinding?.enterpriseId ??
      null
    );
  }

  private async clearClientEnterpriseBindings(userId: string): Promise<void> {
    await Promise.all([
      this.enterpriseOwnerRepo.delete({ userId: toStringId(userId) }),
      this.enterpriseTeacherRepo.delete({ teacherUserId: toStringId(userId) }),
      this.enterpriseUserRepo.delete({ userId: toStringId(userId) }),
    ]);
  }

  private async requireEnterprise(id: string): Promise<EnterpriseEntity> {
    const enterprise = await this.enterpriseRepo.findOne({
      where: { id: toStringId(id) },
    });
    if (!enterprise) {
      throw new BadRequestException('关联企业不存在');
    }
    return enterprise;
  }

  private async ensureOwnerEnterpriseAvailable(
    enterpriseId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.enterpriseOwnerRepo.findOne({
      where: { enterpriseId: toStringId(enterpriseId) },
    });
    if (existing && String(existing.userId) !== String(userId)) {
      throw new BadRequestException('该企业已绑定负责人');
    }
  }

  private async ensureTeacherEnterpriseAvailable(
    enterpriseId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.enterpriseTeacherRepo.findOne({
      where: { enterpriseId: toStringId(enterpriseId) },
    });
    if (existing && String(existing.teacherUserId) !== String(userId)) {
      throw new BadRequestException('该企业已绑定项目老师');
    }
  }

  private async upsertOwnerBinding(
    userId: string,
    enterpriseId: string,
    input: UserInput,
  ): Promise<void> {
    await this.ensureOwnerEnterpriseAvailable(enterpriseId, userId);
    const binding = await this.enterpriseOwnerRepo.findOne({
      where: { userId: toStringId(userId) },
    });
    await this.enterpriseOwnerRepo.save(
      this.enterpriseOwnerRepo.create({
        ...binding,
        enterpriseId: toStringId(enterpriseId),
        remark: toNullableString(input.remark) ?? binding?.remark ?? null,
        status: toNumber(input.status, binding?.status ?? 1),
        userId: toStringId(userId),
      }),
    );
  }

  private async upsertTeacherBinding(
    userId: string,
    enterpriseId: string,
    input: UserInput,
  ): Promise<void> {
    await this.ensureTeacherEnterpriseAvailable(enterpriseId, userId);
    const binding = await this.enterpriseTeacherRepo.findOne({
      where: { teacherUserId: toStringId(userId) },
    });
    await this.enterpriseTeacherRepo.save(
      this.enterpriseTeacherRepo.create({
        ...binding,
        enterpriseId: toStringId(enterpriseId),
        remark: toNullableString(input.remark) ?? binding?.remark ?? null,
        status: toNumber(input.status, binding?.status ?? 1),
        teacherUserId: toStringId(userId),
      }),
    );
  }

  private async upsertEnterpriseUserBinding(
    userId: string,
    enterpriseId: string,
    input: UserInput,
  ): Promise<void> {
    const binding = await this.enterpriseUserRepo.findOne({
      where: { userId: toStringId(userId) },
    });
    await this.enterpriseUserRepo.save(
      this.enterpriseUserRepo.create({
        ...binding,
        enterpriseId: toStringId(enterpriseId),
        isDefault: binding?.isDefault ?? 0,
        remark: toNullableString(input.remark) ?? binding?.remark ?? null,
        status: toNumber(input.status, binding?.status ?? 1),
        userId: toStringId(userId),
      }),
    );
  }

  private async ensureUsernameAvailable(
    username: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.userRepo.findOne({
      where: { username },
    });
    if (existing && String(existing.id) !== String(excludeId ?? '')) {
      throw new BadRequestException('用户名已存在');
    }
  }

  private getQueryValue(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  private getBoundaryTime(value?: string, endOfDay = false): null | string {
    if (!value) {
      return null;
    }

    return value.includes(' ')
      ? value
      : `${value} ${endOfDay ? '23:59:59' : '00:00:00'}`;
  }

  private toItem(row: UserEntity): UserItem {
    const roles =
      row.userRoles
        ?.map((item) => item.role)
        .filter(
          (item): item is RoleEntity =>
            Boolean(item) && item.portalType === row.portalType,
        ) ?? [];
    return {
      createTime: formatDateTimeInBjt(row.createdAt),
      deptId: row.deptId,
      deptName: row.deptName,
      homePath: row.homePath,
      id: String(row.id),
      name: row.realName,
      portalType: row.portalType,
      roleIds: roles.map((item) => String(item.id)),
      roleNames: roles.map((item) => item.name),
      remark: row.remark,
      status: row.status,
      updateTime: formatDateTimeInBjt(row.updatedAt),
      username: row.username,
    };
  }

  private resolveInputPortal(
    input: UserInput,
    currentPortal: PortalType,
  ): PortalType {
    const requestedPortal = normalizePortalType(input.portalType, currentPortal);
    const portalType = resolveManagedPortalType(input.portalType, currentPortal);
    if (currentPortal !== 'admin' && requestedPortal !== currentPortal) {
      throw new BadRequestException('只能维护当前端的用户');
    }
    return portalType;
  }
}
