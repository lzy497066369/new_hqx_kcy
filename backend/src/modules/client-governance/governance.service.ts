import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { In, QueryFailedError, Repository } from 'typeorm';

import { ENTERPRISE_PROJECTS } from '../../common/constants/enterprise-projects';
import type { CurrentUser } from '../../common/interfaces/current-user.interface';
import { hashPassword } from '../../common/utils/password.util';
import { EnterpriseEntity } from '../../infrastructure/database/entities/enterprise.entity';
import { EnterpriseTeacherEntity } from '../../infrastructure/database/entities/enterprise-teacher.entity';
import { EnterpriseOwnerEntity } from '../../infrastructure/database/entities/enterprise-owner.entity';
import { EnterpriseUserEntity } from '../../infrastructure/database/entities/enterprise-user.entity';
import { RegionEntity } from '../../infrastructure/database/entities/region.entity';
import { RoleEntity } from '../../infrastructure/database/entities/role.entity';
import { UserAppEntity } from '../../infrastructure/database/entities/user-app.entity';
import { UserEntity } from '../../infrastructure/database/entities/user.entity';
import { UserRoleEntity } from '../../infrastructure/database/entities/user-role.entity';
import { resolveAuthRuntimeConfig } from '../auth/auth-runtime.config';
import { CreateGovernanceAccountDto, CreateGovernanceEnterpriseDto } from './dto';

const CLIENT_ROLE_NAMES: Record<string, string> = {
  project_teacher: '企业负责人',
};

@Injectable()
export class ClientGovernanceService {
  constructor(
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(UserRoleEntity) private readonly userRoleRepo: Repository<UserRoleEntity>,
    @InjectRepository(RoleEntity) private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(UserAppEntity) private readonly userAppRepo: Repository<UserAppEntity>,
    @InjectRepository(RegionEntity) private readonly regionRepo: Repository<RegionEntity>,
    @InjectRepository(EnterpriseTeacherEntity) private readonly teacherRepo: Repository<EnterpriseTeacherEntity>,
    @InjectRepository(EnterpriseOwnerEntity) private readonly ownerRepo: Repository<EnterpriseOwnerEntity>,
    @InjectRepository(EnterpriseEntity) private readonly enterpriseRepo: Repository<EnterpriseEntity>,
  ) {}

  async overview(user: CurrentUser) {
    if (this.persona(user) !== 'overall') {
      throw new ForbiddenException('只有总负责人可以查看企业管理总览');
    }

    const appCode = resolveAuthRuntimeConfig().appCode;
    const [regions, companies, recipientRoles] = await Promise.all([
      this.regionRepo.find({ order: { sortNum: 'ASC', id: 'ASC' } }),
      // Include historical archives without a region or in a disabled region.
      this.enterpriseRepo.find({ where: { status: 1 }, order: { id: 'DESC' } }),
      this.roleRepo.find({ where: { appCode, portalType: 'client', status: 1 } }),
    ]);
    const enterpriseRoles = recipientRoles.filter((role) => ['project_teacher', 'enterprise_owner'].includes(role.code));
    const links = enterpriseRoles.length
      ? await this.userRoleRepo.find({ where: { roleId: In(enterpriseRoles.map((role) => String(role.id))) }, relations: { user: true } })
      : [];
    const userIds = [...new Set(links.map((link) => String(link.userId)))];
    const [memberships, allLinks, teachers, owners] = await Promise.all([
      userIds.length ? this.userAppRepo.find({ where: { userId: In(userIds), appCode, portalType: 'client', status: 1 } }) : [],
      userIds.length ? this.userRoleRepo.find({ where: { userId: In(userIds) }, relations: { role: true } }) : [],
      this.teacherRepo.find({ where: { status: 1 }, relations: { teacher: true } }),
      this.ownerRepo.find({ where: { status: 1 }, relations: { user: true } }),
    ]);
    const eligibleIds = new Set(memberships.filter((membership) => this.isEnterpriseRecipient(
      allLinks.filter((link) => String(link.userId) === String(membership.userId))
        .map((link) => link.role).filter((role): role is RoleEntity => Boolean(role) && role.appCode === appCode && role.portalType === 'client' && (role.status === 1 || role.code === 'region_leader'))
        .map((role) => role.code),
    )).map((membership) => String(membership.userId)));
    const accountUsers = [...new Map(links.filter((link) => link.user?.portalType === 'client' && link.user.status === 1 && eligibleIds.has(String(link.userId)))
      .map((link) => [String(link.userId), link.user])).values()];
    // Keep the existing multi-enterprise binding model. Owner bindings are read
    // as well, so older single-owner archives never appear unassigned.
    const bindings = [
      ...teachers.filter((binding) => binding.teacher?.status === 1 && eligibleIds.has(String(binding.teacherUserId))).map((binding) => ({ enterpriseId: String(binding.enterpriseId), userId: String(binding.teacherUserId), user: binding.teacher })),
      ...owners.filter((binding) => binding.user?.status === 1 && eligibleIds.has(String(binding.userId))).map((binding) => ({ enterpriseId: String(binding.enterpriseId), userId: String(binding.userId), user: binding.user })),
    ];
    const enterprises = companies.map((company) => {
      const binding = bindings.find((item) => item.enterpriseId === String(company.id));
      const regionId = String(company.regionId ?? '');
      return {
        id: String(company.id), name: company.name, creditCode: company.creditCode ?? '',
        salesOwner: company.salesOwner ?? '', enterpriseProjects: company.enterpriseProjects ?? [],
        preDeclarationYear: company.preDeclarationYear ?? null,
        profileStatus: company.profileStatus, regionId,
        regionName: regions.find((region) => String(region.id) === regionId)?.name ?? '未设置区域',
        projectUserId: binding?.userId ?? '', projectUsername: binding?.user?.username ?? '', projectName: binding?.user?.realName ?? '',
      };
    });
    const accounts = accountUsers.map((account) => ({
      id: String(account.id), name: account.realName ?? '', username: account.username ?? '', status: account.status ?? 0,
      enterpriseCount: new Set(bindings.filter((binding) => binding.userId === String(account.id) && companies.some((company) => String(company.id) === binding.enterpriseId)).map((binding) => binding.enterpriseId)).size,
    }));
    return {
      scope: 'overall' as const,
      regions: regions.map((region) => ({
        id: String(region.id), name: region.name, status: region.status,
        projectAccountCount: new Set(bindings.filter((binding) => companies.some((company) => String(company.id) === binding.enterpriseId && String(company.regionId) === String(region.id))).map((binding) => binding.userId)).size,
        enterpriseCount: enterprises.filter((company) => company.regionId === String(region.id)).length,
      })),
      projectAccounts: accounts,
      enterprises,
    };
  }

  async enterpriseDetail(user: CurrentUser, id: string) {
    const currentOverview = await this.overview(user);
    const summary = currentOverview.enterprises.find((company) => company.id === id);
    if (!summary) throw new NotFoundException('企业档案不存在或不在当前管理范围内');
    const company = await this.enterpriseRepo.findOne({ where: { id } });
    if (!company) throw new NotFoundException('企业档案不存在或不在当前管理范围内');
    return {
      ...summary,
      code: company.code,
      shortName: company.shortName ?? '',
      legalPerson: company.legalPerson ?? '',
      contactName: company.contactName ?? '',
      contactPhone: company.contactPhone ?? '',
      contactEmail: company.contactEmail ?? '',
      industry: company.industry ?? '',
      enterpriseType: company.enterpriseType ?? '',
      province: company.province ?? '',
      city: company.city ?? '',
      district: company.district ?? '',
      address: company.address ?? '',
      remark: company.remark ?? '',
    };
  }

  async createAccount(user: CurrentUser, input: CreateGovernanceAccountDto) {
    if (this.persona(user) !== 'overall') {
      throw new ForbiddenException('只有总负责人可以创建企业负责人账号');
    }

    const appCode = resolveAuthRuntimeConfig().appCode;
    const roleCode = 'project_teacher';
    const username = input.username.trim();
    const name = input.name.trim();
    if (name.length < 2 || name.length > 64 || username.length < 3 || username.length > 64) {
      throw new BadRequestException('负责人姓名需为 2-64 位，登录账号需为 3-64 位');
    }
    if (input.password.length < 8 || input.password.length > 128 || input.password !== input.password.trim()) {
      throw new BadRequestException('初始密码需为 8-128 位，且首尾不能包含空格');
    }

    const password = await hashPassword(input.password);
    try {
      return await this.userRepo.manager.transaction(async (manager) => {
        const users = manager.getRepository(UserEntity);
        const roles = manager.getRepository(RoleEntity);
        if (await users.findOne({ where: { username } })) throw new ConflictException('登录账号已存在');

        let role = await roles.findOne({ where: { appCode, portalType: 'client', code: roleCode } });
        if (!role) {
          await roles.insert({ appCode, portalType: 'client', code: roleCode, name: CLIENT_ROLE_NAMES[roleCode], status: 1, remark: '企业端负责人权限角色' });
          role = await roles.findOne({ where: { appCode, portalType: 'client', code: roleCode } });
        }
        if (!role || role.status !== 1) throw new ConflictException('企业负责人角色未启用，暂时无法创建账号');

        const userEntity = await users.save(users.create({
          username,
          realName: name,
          password,
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          homePath: '/client/enterprise-receipts',
          portalType: 'client',
          status: 1,
          deptId: null,
          deptName: null,
          remark: null,
        }));
        await manager.getRepository(UserRoleEntity).save({ userId: String(userEntity.id), roleId: String(role.id) });
        await manager.getRepository(UserAppEntity).save({
          appCode,
          portalType: 'client',
          userId: String(userEntity.id),
          homePath: '/client/enterprise-receipts',
          isDefault: 1,
          status: 1,
        });

        return {
          id: String(userEntity.id),
          name: userEntity.realName,
          username: userEntity.username,
          role: roleCode,
          initialPassword: input.password,
        };
      });
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ConflictException('登录账号或角色已存在，请刷新后重试');
      }
      throw error;
    }
  }

  async createEnterprise(user: CurrentUser, input: CreateGovernanceEnterpriseDto) {
    if (this.persona(user) !== 'overall') {
      throw new ForbiddenException('只有总负责人可以创建企业档案');
    }
    const name = input.name?.trim();
    const salesOwner = input.salesOwner?.trim();
    const enterpriseProjects = input.enterpriseProjects ?? [];
    if (!Array.isArray(enterpriseProjects) || !enterpriseProjects.length || enterpriseProjects.length > 4
      || new Set(enterpriseProjects).size !== enterpriseProjects.length
      || enterpriseProjects.some((project) => !ENTERPRISE_PROJECTS.some((option) => option === project))) {
      throw new BadRequestException('企业项目必填，请至少选择一个有效项目，不可重复选择');
    }
    if (!name || name.length < 2 || name.length > 128 || !salesOwner || salesOwner.length > 64 || !/^[1-9]\d*$/.test(input.regionId)) {
      throw new BadRequestException('请填写企业名称、区域和销售负责人');
    }
    if (!Number.isInteger(input.preDeclarationYear) || input.preDeclarationYear < 2000 || input.preDeclarationYear > 2100) {
      throw new BadRequestException('预申报年份必填，请填写 2000-2100 年之间的整数年份');
    }
    return this.enterpriseRepo.manager.transaction(async (manager) => {
      const region = await manager.getRepository(RegionEntity).findOne({
        where: { id: input.regionId, status: 1 },
        lock: { mode: 'pessimistic_write' },
      });
      if (!region) throw new ForbiddenException('区域不存在或已停用');
      const enterprises = manager.getRepository(EnterpriseEntity);
      if (await enterprises.findOne({ where: { name } })) throw new ConflictException('同名企业档案已存在，请勿重复建档');
      const saved = await enterprises.save(enterprises.create({
        name,
        regionId: String(region.id),
        salesOwner,
        enterpriseProjects,
        preDeclarationYear: input.preDeclarationYear,
        code: `ENT-${randomUUID()}`,
        creditCode: null,
        profileStatus: 'draft',
        source: 'governance',
        status: 1,
      }));
      return { id: String(saved.id), name: saved.name, regionId: String(region.id), salesOwner, enterpriseProjects: saved.enterpriseProjects ?? [], preDeclarationYear: saved.preDeclarationYear, projectUserId: '' };
    });
  }

  /** Assign archives directly; preserve existing multi-enterprise account bindings. */
  async assignEnterprises(user: CurrentUser, projectUserId: string, enterpriseIds: string[]) {
    if (this.persona(user) !== 'overall') {
      throw new ForbiddenException('只有总负责人可以分发企业档案');
    }
    const uniqueIds = [...new Set(enterpriseIds)].sort();
    if (!/^[1-9]\d*$/.test(projectUserId) || !uniqueIds.length || uniqueIds.length > 100 || uniqueIds.some((id) => !/^[1-9]\d*$/.test(id))) {
      throw new BadRequestException('请选择有效的企业档案和企业负责人');
    }

    await this.enterpriseRepo.manager.transaction(async (manager) => {
      const target = await manager.getRepository(UserEntity).findOne({ where: { id: projectUserId, portalType: 'client', status: 1 }, lock: { mode: 'pessimistic_write' } });
      const appCode = resolveAuthRuntimeConfig().appCode;
      const app = await manager.getRepository(UserAppEntity).findOne({ where: { userId: projectUserId, appCode, portalType: 'client', status: 1 } });
      const userRoles = await manager.getRepository(UserRoleEntity).find({ where: { userId: projectUserId } });
      const roles = userRoles.length
        ? await manager.getRepository(RoleEntity).find({ where: { id: In(userRoles.map((item) => item.roleId)), appCode, portalType: 'client' } })
        : [];
      if (!target || !app || !this.isEnterpriseRecipient(roles.filter((role) => role.status === 1 || role.code === 'region_leader').map((role) => role.code))) {
        throw new ForbiddenException('请选择当前应用中已启用的企业负责人账号');
      }

      const enterprises = manager.getRepository(EnterpriseEntity);
      const teachers = manager.getRepository(EnterpriseTeacherEntity);
      const owners = manager.getRepository(EnterpriseOwnerEntity);
      for (const id of uniqueIds) {
        const enterprise = await enterprises.findOne({ where: { id, status: 1 }, lock: { mode: 'pessimistic_write' } });
        if (!enterprise) throw new ForbiddenException('企业不存在或已停用');
        const binding = await teachers.findOne({ where: { enterpriseId: id } });
        const owner = await owners.findOne({ where: { enterpriseId: id, status: 1 } });
        if ((binding?.status === 1 && String(binding.teacherUserId) !== projectUserId) || (owner && String(owner.userId) !== projectUserId)) {
          throw new ConflictException('该企业已分发给其他负责人，请刷新总览');
        }
        if (owner && !binding) continue;
        await teachers.save(teachers.create({
          ...binding,
          enterpriseId: id,
          teacherUserId: projectUserId,
          status: 1,
          remark: `由总负责人 ${user.username} 分发`,
        }));
      }
    });
    return { assignedEnterpriseIds: uniqueIds, projectUserId };
  }

  async deleteAccount(user: CurrentUser, id: string) {
    if (this.persona(user) !== 'overall') throw new ForbiddenException('只有总负责人可以删除企业负责人账号');
    if (!/^[1-9]\d*$/.test(id)) throw new BadRequestException('企业负责人账号无效');
    await this.userRepo.manager.transaction(async (manager) => {
      const users = manager.getRepository(UserEntity);
      const target = await users.findOne({ where: { id, portalType: 'client', status: 1 }, lock: { mode: 'pessimistic_write' } });
      if (!target) throw new NotFoundException('企业负责人账号不存在或已删除');
      const appCode = resolveAuthRuntimeConfig().appCode;
      const membership = await manager.getRepository(UserAppEntity).findOne({ where: { userId: id, appCode, portalType: 'client', status: 1 } });
      const links = await manager.getRepository(UserRoleEntity).find({ where: { userId: id } });
      const roles = links.length ? await manager.getRepository(RoleEntity).find({ where: { id: In(links.map((link) => link.roleId)), appCode, portalType: 'client' } }) : [];
      if (!membership || !this.isEnterpriseRecipient(roles.filter((role) => role.status === 1 || role.code === 'region_leader').map((role) => role.code))) {
        throw new ForbiddenException('只能删除当前应用的企业负责人账号');
      }
      target.status = 0;
      await users.save(target);
      const apps = manager.getRepository(UserAppEntity);
      for (const app of await apps.find({ where: { userId: id, status: 1 } })) { app.status = 0; await apps.save(app); }
      const teachers = manager.getRepository(EnterpriseTeacherEntity);
      for (const binding of await teachers.find({ where: { teacherUserId: id, status: 1 } })) { binding.status = 0; await teachers.save(binding); }
      const owners = manager.getRepository(EnterpriseOwnerEntity);
      for (const binding of await owners.find({ where: { userId: id, status: 1 } })) { binding.status = 0; await owners.save(binding); }
      const enterpriseUsers = manager.getRepository(EnterpriseUserEntity);
      for (const binding of await enterpriseUsers.find({ where: { userId: id, status: 1 } })) { binding.status = 0; await enterpriseUsers.save(binding); }
    });
    return { id };
  }

  async deleteEnterprise(user: CurrentUser, id: string) {
    if (this.persona(user) !== 'overall') throw new ForbiddenException('只有总负责人可以删除企业档案');
    if (!/^[1-9]\d*$/.test(id)) throw new BadRequestException('企业档案无效');
    await this.enterpriseRepo.manager.transaction(async (manager) => {
      const enterprises = manager.getRepository(EnterpriseEntity);
      const target = await enterprises.findOne({ where: { id, status: 1 }, lock: { mode: 'pessimistic_write' } });
      if (!target) throw new NotFoundException('企业档案不存在或已删除');
      target.status = 0;
      await enterprises.save(target);
      const teachers = manager.getRepository(EnterpriseTeacherEntity);
      for (const binding of await teachers.find({ where: { enterpriseId: id, status: 1 } })) { binding.status = 0; await teachers.save(binding); }
      const owners = manager.getRepository(EnterpriseOwnerEntity);
      for (const binding of await owners.find({ where: { enterpriseId: id, status: 1 } })) { binding.status = 0; await owners.save(binding); }
      const enterpriseUsers = manager.getRepository(EnterpriseUserEntity);
      for (const binding of await enterpriseUsers.find({ where: { enterpriseId: id, status: 1 } })) { binding.status = 0; await enterpriseUsers.save(binding); }
    });
    return { id };
  }

  private isEnterpriseRecipient(roles: string[]): boolean {
    const leaders = [...new Set(roles.filter((role) => ['global_leader', 'region_leader', 'project_teacher', 'enterprise_owner'].includes(role)))];
    return leaders.length === 1 && ['project_teacher', 'enterprise_owner'].includes(leaders[0]);
  }

  private persona(user: CurrentUser): 'enterprise' | 'overall' {
    if (user.portal !== 'client' || (user.appCode && user.appCode !== resolveAuthRuntimeConfig().appCode) || user.roles.includes('region_leader')) {
      throw new ForbiddenException('当前账号无权管理企业');
    }
    if (user.roles.includes('global_leader') && !user.roles.some((role) => ['enterprise_owner', 'project_teacher'].includes(role))) return 'overall';
    if (this.isEnterpriseRecipient(user.roles)) return 'enterprise';
    throw new ForbiddenException('客户端负责人账号必须严格互斥');
  }
}
