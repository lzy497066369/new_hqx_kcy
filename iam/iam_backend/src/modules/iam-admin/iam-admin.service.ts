import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';

import { CompanyDto } from './dto/company.dto';
import { CompanyMemberDto } from './dto/company-member.dto';
import { PlatformDepartmentDto } from './dto/platform-department.dto';
import { UserPlatformDepartmentDto } from './dto/user-platform-department.dto';
import { AppDto } from './dto/app.dto';
import { UserDto } from './dto/user.dto';
import { IamAppEntity } from './entities/iam-app.entity';
import { IamCompanyMemberEntity } from './entities/iam-company-member.entity';
import { IamCompanyEntity } from './entities/iam-company.entity';
import { IamPlatformDepartmentEntity } from './entities/iam-platform-department.entity';
import { IamUserCompanyScopeEntity } from './entities/iam-user-company-scope.entity';
import { IamUserEntity } from './entities/iam-user.entity';
import { IamUserAppEntity } from './entities/iam-user-app.entity';
import { IamUserPlatformDepartmentEntity } from './entities/iam-user-platform-department.entity';
import { IamOAuthClientEntity } from './entities/iam-oauth-client.entity';
import { OAuthClientDto } from './dto/oauth-client.dto';
import { UserAppDto } from './dto/user-app.dto';
import { IdListDto, MenuDto, PermissionDto, RoleDto, RoleListDto } from './dto/access-control.dto';
import { IamRoleEntity } from './entities/iam-role.entity';
import { IamPermissionEntity } from './entities/iam-permission.entity';
import { IamRolePermissionEntity } from './entities/iam-role-permission.entity';
import { IamUserRoleEntity } from './entities/iam-user-role.entity';
import { IamMenuEntity } from './entities/iam-menu.entity';
import { hashPassword } from '../../common/password.util';
import { IamDatabaseService } from './iam-database.service';

type ListResult<T> = { items: T[]; total: number };

@Injectable()
export class IamAdminService {
  constructor(private readonly database: IamDatabaseService) {}

  async listApps(): Promise<ListResult<Record<string, unknown>>> {
    const rows = await (await this.appRepo()).find({ order: { id: 'DESC' } });
    return { items: rows.map((row) => this.toApp(row)), total: rows.length };
  }

  async createApp(dto: AppDto) {
    const repo = await this.appRepo();
    const appCode = dto.appCode.trim();
    await this.ensureAbsent(repo, { appCode }, 'Application code already exists');
    return this.toApp(await repo.save(repo.create({
      appCode,
      appName: dto.appName.trim(),
      appType: dto.appType?.trim() || 'web',
      companySourceSystem: nullable(dto.companySourceSystem),
      homePath: nullable(dto.homePath),
      portalType: dto.portalType?.trim() || 'admin',
      remark: nullable(dto.remark),
      status: dto.status ?? 1,
    })));
  }

  async updateApp(id: string, dto: AppDto) {
    const repo = await this.appRepo();
    const entity = await this.requireById(repo, id, 'Application');
    if (dto.appCode.trim() !== entity.appCode) {
      throw new BadRequestException('Application code cannot be changed');
    }
    Object.assign(entity, {
      appName: dto.appName.trim(), appType: dto.appType?.trim() || entity.appType,
      companySourceSystem: dto.companySourceSystem === undefined ? entity.companySourceSystem : nullable(dto.companySourceSystem),
      homePath: dto.homePath === undefined ? entity.homePath : nullable(dto.homePath),
      portalType: dto.portalType?.trim() || entity.portalType,
      remark: dto.remark === undefined ? entity.remark : nullable(dto.remark), status: dto.status ?? entity.status,
    });
    return this.toApp(await repo.save(entity));
  }

  async listUsers(): Promise<ListResult<Record<string, unknown>>> {
    const rows = await (await this.userRepo()).find({ order: { id: 'DESC' } });
    return { items: rows.map((row) => this.toUser(row)), total: rows.length };
  }

  async createUser(dto: UserDto) {
    if (!dto.password) throw new BadRequestException('Password is required');
    const repo = await this.userRepo();
    const username = dto.username.trim();
    await this.ensureUserUnique(repo, { username });
    return this.toUser(await repo.save(repo.create({
      avatarPath: nullable(dto.avatarPath), email: nullable(dto.email), passwordChangedAt: new Date(),
      passwordHash: await hashPassword(dto.password), phone: nullable(dto.phone), realName: dto.realName.trim(),
      remark: nullable(dto.remark), status: dto.status ?? 1, username,
    })));
  }

  async updateUser(id: string, dto: UserDto) {
    const repo = await this.userRepo();
    const entity = await this.requireById(repo, id, 'User');
    const revokeSessions = Boolean(dto.password) || (entity.status === 1 && dto.status === 0);
    await this.ensureUserUnique(repo, { email: nullable(dto.email), phone: nullable(dto.phone), username: dto.username.trim() }, entity.id);
    Object.assign(entity, {
      avatarPath: dto.avatarPath === undefined ? entity.avatarPath : nullable(dto.avatarPath),
      email: dto.email === undefined ? entity.email : nullable(dto.email), phone: dto.phone === undefined ? entity.phone : nullable(dto.phone),
      realName: dto.realName.trim(), remark: dto.remark === undefined ? entity.remark : nullable(dto.remark),
      status: dto.status ?? entity.status, username: dto.username.trim(),
    });
    if (dto.password) { entity.passwordHash = await hashPassword(dto.password); entity.passwordChangedAt = new Date(); }
    const saved = await repo.save(entity);
    if (revokeSessions) await this.revokeUserSessions(saved.id);
    return this.toUser(saved);
  }

  async grantUserApp(userId: string, appCode: string, dto: UserAppDto) {
    const [userRepo, appRepo, userAppRepo] = await Promise.all([this.userRepo(), this.appRepo(), this.userAppRepo()]);
    await Promise.all([
      this.requireById(userRepo, userId, 'User'),
      this.requireOne(appRepo, { appCode }, 'Application'),
    ]);
    const entity = await userAppRepo.findOne({ where: { appCode, userId } });
    return this.toUserApp(await userAppRepo.save(userAppRepo.create({
      ...entity,
      appCode,
      homePath: dto.homePath === undefined ? entity?.homePath ?? null : nullable(dto.homePath),
      status: dto.status ?? entity?.status ?? 1,
      userId,
    })));
  }

  async listUserApps(userId: string): Promise<ListResult<Record<string, unknown>>> {
    await this.requireById(await this.userRepo(), userId, 'User');
    const rows = await (await this.userAppRepo()).find({ where: { userId }, order: { id: 'DESC' } });
    return { items: rows.map((row) => this.toUserApp(row)), total: rows.length };
  }

  async createOAuthClient(appCode: string, dto: OAuthClientDto) {
    const [appRepo, clientRepo] = await Promise.all([this.appRepo(), this.oauthClientRepo()]);
    await this.requireOne(appRepo, { appCode }, 'Application');
    if (dto.clientType === 'confidential' && !dto.secret?.trim()) {
      throw new BadRequestException('Confidential client secret is required');
    }
    await this.ensureAbsent(clientRepo, { clientId: dto.clientId.trim() }, 'Client ID already exists');
    return this.toOAuthClient(await clientRepo.save(clientRepo.create({
      accessTokenTtl: dto.accessTokenTtl ?? 1800,
      appCode,
      clientId: dto.clientId.trim(),
      clientSecretHash: dto.secret?.trim() ? await hashPassword(dto.secret.trim()) : null,
      clientType: dto.clientType,
      grantTypes: [...new Set(dto.grantTypes)],
      postLogoutRedirectUris: dto.postLogoutRedirectUris ?? null,
      redirectUris: [...new Set(dto.redirectUris)],
      refreshTokenTtl: dto.refreshTokenTtl ?? 2_592_000,
      status: dto.status ?? 1,
    })));
  }

  async listOAuthClients(appCode: string): Promise<ListResult<Record<string, unknown>>> {
    await this.requireOne(await this.appRepo(), { appCode }, 'Application');
    const rows = await (await this.oauthClientRepo()).find({ where: { appCode }, order: { id: 'DESC' } });
    return { items: rows.map((row) => this.toOAuthClient(row)), total: rows.length };
  }

  async updateOAuthClient(appCode: string, clientId: string, dto: OAuthClientDto) {
    const [appRepo, clientRepo] = await Promise.all([this.appRepo(), this.oauthClientRepo()]);
    await this.requireOne(appRepo, { appCode }, 'Application');
    const entity = await this.requireOne(clientRepo, { appCode, id: clientId }, 'OAuth client');
    if (dto.clientId.trim() !== entity.clientId) throw new BadRequestException('OAuth client ID cannot be changed');
    const secret = dto.secret?.trim();
    if (dto.clientType === 'confidential' && !secret && !entity.clientSecretHash) {
      throw new BadRequestException('Confidential client secret is required');
    }
    Object.assign(entity, {
      accessTokenTtl: dto.accessTokenTtl ?? entity.accessTokenTtl,
      clientType: dto.clientType,
      grantTypes: [...new Set(dto.grantTypes)],
      postLogoutRedirectUris: dto.postLogoutRedirectUris ?? null,
      redirectUris: [...new Set(dto.redirectUris)],
      refreshTokenTtl: dto.refreshTokenTtl ?? entity.refreshTokenTtl,
      status: dto.status ?? entity.status,
    });
    if (dto.clientType === 'public') entity.clientSecretHash = null;
    else if (secret) entity.clientSecretHash = await hashPassword(secret);
    return this.toOAuthClient(await clientRepo.save(entity));
  }

  async createRole(appCode: string, dto: RoleDto) {
    const [appRepo, roleRepo] = await Promise.all([this.appRepo(), this.roleRepo()]);
    await this.requireOne(appRepo, { appCode }, 'Application');
    const roleCode = dto.roleCode.trim();
    await this.ensureAbsent(roleRepo, { appCode, roleCode }, 'Role code already exists');
    return this.toRole(await roleRepo.save(roleRepo.create({ appCode, remark: nullable(dto.remark), roleCode, roleName: dto.roleName.trim(), roleType: dto.roleType?.trim() || 'custom', status: dto.status ?? 1 })));
  }

  async listRoles(appCode: string): Promise<ListResult<Record<string, unknown>>> {
    await this.requireOne(await this.appRepo(), { appCode }, 'Application');
    const rows = await (await this.roleRepo()).find({ where: { appCode }, order: { id: 'DESC' } });
    return { items: rows.map((row) => this.toRole(row)), total: rows.length };
  }

  async updateRole(appCode: string, roleId: string, dto: RoleDto) {
    const repo = await this.roleRepo();
    const entity = await this.requireOne(repo, { appCode, id: roleId }, 'Role');
    if (dto.roleCode.trim() !== entity.roleCode) throw new BadRequestException('Role code cannot be changed');
    Object.assign(entity, {
      remark: dto.remark === undefined ? entity.remark : nullable(dto.remark),
      roleName: dto.roleName.trim(),
      roleType: dto.roleType?.trim() || entity.roleType,
      status: dto.status ?? entity.status,
    });
    return this.toRole(await repo.save(entity));
  }

  async createPermission(appCode: string, dto: PermissionDto) {
    const [appRepo, permissionRepo] = await Promise.all([this.appRepo(), this.permissionRepo()]);
    await this.requireOne(appRepo, { appCode }, 'Application');
    const permissionCode = dto.permissionCode.trim();
    await this.ensureAbsent(permissionRepo, { appCode, permissionCode }, 'Permission code already exists');
    return this.toPermission(await permissionRepo.save(permissionRepo.create({ appCode, permissionCode, permissionName: dto.permissionName.trim(), resourceType: dto.resourceType?.trim() || 'api', status: dto.status ?? 1 })));
  }

  async listPermissions(appCode: string): Promise<ListResult<Record<string, unknown>>> {
    await this.requireOne(await this.appRepo(), { appCode }, 'Application');
    const rows = await (await this.permissionRepo()).find({ where: { appCode }, order: { id: 'DESC' } });
    return { items: rows.map((row) => this.toPermission(row)), total: rows.length };
  }

  async updatePermission(appCode: string, permissionId: string, dto: PermissionDto) {
    const repo = await this.permissionRepo();
    const entity = await this.requireOne(repo, { appCode, id: permissionId }, 'Permission');
    if (dto.permissionCode.trim() !== entity.permissionCode) throw new BadRequestException('Permission code cannot be changed');
    Object.assign(entity, {
      permissionName: dto.permissionName.trim(),
      resourceType: dto.resourceType?.trim() || entity.resourceType,
      status: dto.status ?? entity.status,
    });
    return this.toPermission(await repo.save(entity));
  }

  async createMenu(appCode: string, dto: MenuDto) {
    const [appRepo, menuRepo] = await Promise.all([this.appRepo(), this.menuRepo()]);
    await this.requireOne(appRepo, { appCode }, 'Application');
    if (dto.parentId) await this.requireOne(menuRepo, { appCode, id: dto.parentId }, 'Parent menu');
    return this.toMenu(await menuRepo.save(menuRepo.create({
      appCode, authCode: nullable(dto.authCode), component: nullable(dto.component), menuName: dto.menuName.trim(), menuType: dto.menuType?.trim() || 'menu',
      metaJson: dto.meta ?? null, parentId: dto.parentId?.trim() || null, path: nullable(dto.path), redirect: nullable(dto.redirect), sortOrder: dto.sortOrder ?? 0, status: dto.status ?? 1,
    })));
  }

  async listMenus(appCode: string): Promise<ListResult<Record<string, unknown>>> {
    await this.requireOne(await this.appRepo(), { appCode }, 'Application');
    const rows = await (await this.menuRepo()).find({ where: { appCode }, order: { sortOrder: 'ASC', id: 'ASC' } });
    return { items: rows.map((row) => this.toMenu(row)), total: rows.length };
  }

  async updateMenu(appCode: string, menuId: string, dto: MenuDto) {
    const repo = await this.menuRepo();
    const entity = await this.requireOne(repo, { appCode, id: menuId }, 'Menu');
    const parentId = dto.parentId?.trim() || null;
    if (parentId) await this.ensureMenuParentIsValid(repo, appCode, entity.id, parentId);
    Object.assign(entity, {
      authCode: dto.authCode === undefined ? entity.authCode : nullable(dto.authCode),
      component: dto.component === undefined ? entity.component : nullable(dto.component),
      menuName: dto.menuName.trim(),
      menuType: dto.menuType?.trim() || entity.menuType,
      metaJson: dto.meta === undefined ? entity.metaJson : dto.meta,
      parentId,
      path: dto.path === undefined ? entity.path : nullable(dto.path),
      redirect: dto.redirect === undefined ? entity.redirect : nullable(dto.redirect),
      sortOrder: dto.sortOrder ?? entity.sortOrder,
      status: dto.status ?? entity.status,
    });
    return this.toMenu(await repo.save(entity));
  }

  async setRolePermissions(appCode: string, roleId: string, dto: IdListDto) {
    const [roleRepo, permissionRepo, relationRepo] = await Promise.all([this.roleRepo(), this.permissionRepo(), this.rolePermissionRepo()]);
    await this.requireOne(roleRepo, { appCode, id: roleId }, 'Role');
    const permissionIds = [...new Set(dto.permissionIds)];
    const permissions = permissionIds.length === 0 ? [] : await permissionRepo.findByIds(permissionIds);
    if (permissions.length !== permissionIds.length || permissions.some((item) => item.appCode !== appCode)) throw new BadRequestException('Permission does not belong to application');
    await relationRepo.delete({ roleId });
    if (permissionIds.length) await relationRepo.save(permissionIds.map((permissionId) => relationRepo.create({ permissionId, roleId })));
    return { permissionIds };
  }

  async listRolePermissions(appCode: string, roleId: string) {
    const [roleRepo, relationRepo] = await Promise.all([this.roleRepo(), this.rolePermissionRepo()]);
    await this.requireOne(roleRepo, { appCode, id: roleId }, 'Role');
    const rows = await relationRepo.find({ where: { roleId }, order: { id: 'ASC' } });
    return { permissionIds: rows.map((row) => String(row.permissionId)) };
  }

  async setUserRoles(userId: string, appCode: string, dto: RoleListDto) {
    const [userRepo, userAppRepo, roleRepo, relationRepo] = await Promise.all([this.userRepo(), this.userAppRepo(), this.roleRepo(), this.userRoleRepo()]);
    await Promise.all([this.requireById(userRepo, userId, 'User'), this.requireOne(userAppRepo, { appCode, status: 1, userId }, 'User application authorization')]);
    const roleIds = [...new Set(dto.roleIds)];
    const roles = roleIds.length === 0 ? [] : await roleRepo.findByIds(roleIds);
    if (roles.length !== roleIds.length || roles.some((item) => item.appCode !== appCode)) throw new BadRequestException('Role does not belong to application');
    await relationRepo.delete({ appCode, userId });
    if (roleIds.length) await relationRepo.save(roleIds.map((roleId) => relationRepo.create({ appCode, roleId, userId })));
    return { roleIds };
  }

  async listUserRoles(userId: string, appCode: string) {
    const [userRepo, appRepo, relationRepo] = await Promise.all([this.userRepo(), this.appRepo(), this.userRoleRepo()]);
    await Promise.all([
      this.requireById(userRepo, userId, 'User'),
      this.requireOne(appRepo, { appCode }, 'Application'),
    ]);
    const rows = await relationRepo.find({ where: { appCode, userId }, order: { id: 'ASC' } });
    return { roleIds: rows.map((row) => String(row.roleId)) };
  }

  async listCompanies(): Promise<ListResult<Record<string, unknown>>> {
    const rows = await (await this.companyRepo()).find({ order: { id: 'DESC' } });
    return { items: rows.map((row) => this.toCompany(row)), total: rows.length };
  }

  async createCompany(dto: CompanyDto) {
    const repo = await this.companyRepo();
    const creditCode = nullable(dto.creditCode);
    if (creditCode) await this.ensureAbsent(repo, { creditCode }, 'Credit code already exists');
    return this.toCompany(await repo.save(repo.create(this.companyValues(dto))));
  }

  async updateCompany(id: string, dto: CompanyDto) {
    const repo = await this.companyRepo();
    const entity = await this.requireById(repo, id, 'Company');
    const creditCode = nullable(dto.creditCode);
    if (creditCode && creditCode !== entity.creditCode) await this.ensureAbsent(repo, { creditCode }, 'Credit code already exists');
    Object.assign(entity, this.companyValues(dto, entity));
    return this.toCompany(await repo.save(entity));
  }

  async listCompanyMembers(companyId: string, appCode?: string): Promise<ListResult<Record<string, unknown>>> {
    await this.requireById(await this.companyRepo(), companyId, 'Company');
    const [members, users] = await Promise.all([
      (await this.memberRepo()).find({ where: { companyId, ...(appCode?.trim() ? { appCode: appCode.trim() } : {}) } }),
      (await this.userRepo()).find(),
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    return { items: members.map((member) => ({ ...this.toMember(member), ...this.userSummary(usersById.get(member.userId)) })), total: members.length };
  }

  async upsertCompanyMember(companyId: string, dto: CompanyMemberDto) {
    const [companyRepo, appRepo, userRepo, memberRepo, scopeRepo] = await Promise.all([
      this.companyRepo(), this.appRepo(), this.userRepo(), this.memberRepo(), this.scopeRepo(),
    ]);
    await Promise.all([
      this.requireById(companyRepo, companyId, 'Company'), this.requireById(userRepo, dto.userId, 'User'),
      this.requireOne(appRepo, { appCode: dto.appCode.trim() }, 'Application'),
    ]);
    const appCode = dto.appCode.trim();
    const memberType = dto.memberType;
    const member = await memberRepo.findOne({ where: { appCode, companyId, memberType, userId: dto.userId } });
    const status = dto.status ?? member?.status ?? 1;
    const isPrimary = status === 1 && memberType === 'owner' && dto.isPrimary ? 1 : 0;
    const isDefault = status === 1 && dto.isDefault ? 1 : 0;
    if (isPrimary) {
      const owners = await memberRepo.find({ where: { appCode, companyId, memberType: 'owner' } });
      const changedOwners = owners.filter((owner) => owner.id !== member?.id && owner.isPrimary === 1);
      for (const owner of changedOwners) owner.isPrimary = 0;
      if (changedOwners.length) await memberRepo.save(changedOwners);
    }
    if (isDefault) {
      const defaults = await scopeRepo.find({ where: { appCode, status: 1, userId: dto.userId } });
      const changedDefaults = defaults.filter((item) => item.companyId !== companyId && item.isDefault === 1);
      for (const item of changedDefaults) item.isDefault = 0;
      if (changedDefaults.length) await scopeRepo.save(changedDefaults);
    }
    const savedMember = await memberRepo.save(memberRepo.create({
      ...member, appCode, companyId, isPrimary, memberType, status, userId: dto.userId,
    }));
    const scope = await scopeRepo.findOne({ where: { appCode, companyId, relationType: memberType, userId: dto.userId } });
    await scopeRepo.save(scopeRepo.create({
      ...scope, appCode, companyId, dataScope: dto.dataScope ?? scope?.dataScope ?? 'assigned', isDefault,
      relationType: memberType, status, userId: dto.userId,
    }));
    return this.toMember(savedMember);
  }

  async listPlatformDepartments(): Promise<ListResult<Record<string, unknown>>> {
    const departments = await (await this.platformDepartmentRepo()).find({ order: { sortOrder: 'ASC', id: 'ASC' } });
    const [users, memberships] = await Promise.all([
      (await this.userRepo()).find(),
      (await this.userPlatformDepartmentRepo()).find({ where: { status: 1 } }),
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const memberCounts = new Map<string, number>();
    for (const membership of memberships) memberCounts.set(membership.departmentId, (memberCounts.get(membership.departmentId) ?? 0) + 1);
    return {
      items: departments.map((department) => ({
        ...this.toPlatformDepartment(department),
        leaderRealName: department.leaderUserId ? usersById.get(department.leaderUserId)?.realName ?? null : null,
        memberCount: memberCounts.get(department.id) ?? 0,
      })),
      total: departments.length,
    };
  }

  async createPlatformDepartment(dto: PlatformDepartmentDto) {
    const repo = await this.platformDepartmentRepo();
    const values = await this.validatePlatformDepartmentValues(dto);
    await this.ensureAbsent(repo, { deptCode: values.deptCode }, 'Platform department code already exists');
    return this.toPlatformDepartment(await repo.save(repo.create(values)));
  }

  async updatePlatformDepartment(id: string, dto: PlatformDepartmentDto) {
    const repo = await this.platformDepartmentRepo();
    const entity = await this.requireById(repo, id, 'Platform department');
    const values = await this.validatePlatformDepartmentValues(dto, entity);
    if (values.deptCode !== entity.deptCode) await this.ensureAbsent(repo, { deptCode: values.deptCode }, 'Platform department code already exists');
    await this.ensurePlatformDepartmentParentIsValid(repo, entity.id, values.parentId);
    Object.assign(entity, values);
    return this.toPlatformDepartment(await repo.save(entity));
  }

  async listPlatformDepartmentMembers(departmentId: string): Promise<ListResult<Record<string, unknown>>> {
    await this.requireById(await this.platformDepartmentRepo(), departmentId, 'Platform department');
    const [memberships, users] = await Promise.all([
      (await this.userPlatformDepartmentRepo()).find({ where: { departmentId } }),
      (await this.userRepo()).find(),
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    return { items: memberships.map((membership) => ({ ...this.toUserPlatformDepartment(membership), ...this.userSummary(usersById.get(membership.userId)) })), total: memberships.length };
  }

  async upsertPlatformDepartmentMember(departmentId: string, dto: UserPlatformDepartmentDto) {
    const [departmentRepo, userRepo, membershipRepo] = await Promise.all([this.platformDepartmentRepo(), this.userRepo(), this.userPlatformDepartmentRepo()]);
    await Promise.all([this.requireById(departmentRepo, departmentId, 'Platform department'), this.requireById(userRepo, dto.userId, 'User')]);
    const existing = await membershipRepo.findOne({ where: { departmentId, userId: dto.userId } });
    const isPrimary = dto.status === 1 && dto.isPrimary ? 1 : 0;
    if (isPrimary) {
      const current = await membershipRepo.find({ where: { isPrimary: 1, userId: dto.userId } });
      for (const item of current.filter((item) => item.id !== existing?.id)) item.isPrimary = 0;
      if (current.length) await membershipRepo.save(current);
    }
    return this.toUserPlatformDepartment(await membershipRepo.save(membershipRepo.create({
      ...existing,
      departmentId,
      isPrimary,
      status: dto.status,
      userId: dto.userId,
    })));
  }

  private async appRepo() { return (await this.database.getDataSource()).getRepository(IamAppEntity); }
  private async userRepo() { return (await this.database.getDataSource()).getRepository(IamUserEntity); }
  private async companyRepo() { return (await this.database.getDataSource()).getRepository(IamCompanyEntity); }
  private async platformDepartmentRepo() { return (await this.database.getDataSource()).getRepository(IamPlatformDepartmentEntity); }
  private async memberRepo() { return (await this.database.getDataSource()).getRepository(IamCompanyMemberEntity); }
  private async scopeRepo() { return (await this.database.getDataSource()).getRepository(IamUserCompanyScopeEntity); }
  private async userAppRepo() { return (await this.database.getDataSource()).getRepository(IamUserAppEntity); }
  private async userPlatformDepartmentRepo() { return (await this.database.getDataSource()).getRepository(IamUserPlatformDepartmentEntity); }
  private async oauthClientRepo() { return (await this.database.getDataSource()).getRepository(IamOAuthClientEntity); }
  private async roleRepo() { return (await this.database.getDataSource()).getRepository(IamRoleEntity); }
  private async permissionRepo() { return (await this.database.getDataSource()).getRepository(IamPermissionEntity); }
  private async rolePermissionRepo() { return (await this.database.getDataSource()).getRepository(IamRolePermissionEntity); }
  private async userRoleRepo() { return (await this.database.getDataSource()).getRepository(IamUserRoleEntity); }
  private async menuRepo() { return (await this.database.getDataSource()).getRepository(IamMenuEntity); }

  private async revokeUserSessions(userId: string): Promise<void> {
    const dataSource = await this.database.getDataSource();
    await Promise.all([
      dataSource.query('UPDATE iam_sso_session SET revoked_at = NOW(), updated_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]),
      dataSource.query('UPDATE iam_refresh_token SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]),
    ]);
  }

  private async ensureMenuParentIsValid(repo: Repository<IamMenuEntity>, appCode: string, menuId: string, parentId: string): Promise<void> {
    const visited = new Set<string>([menuId]);
    let currentParentId: null | string = parentId;
    while (currentParentId) {
      if (visited.has(currentParentId)) throw new BadRequestException('Menu parent cannot create a cycle');
      visited.add(currentParentId);
      const parent: IamMenuEntity = await this.requireOne(repo, { appCode, id: currentParentId }, 'Parent menu');
      currentParentId = parent.parentId;
    }
  }

  private async ensurePlatformDepartmentParentIsValid(repo: Repository<IamPlatformDepartmentEntity>, departmentId: string, parentId: null | string): Promise<void> {
    const visited = new Set<string>([departmentId]);
    let currentParentId = parentId;
    while (currentParentId) {
      if (visited.has(currentParentId)) throw new BadRequestException('Department parent cannot create a cycle');
      visited.add(currentParentId);
      const parent = await this.requireOne(repo, { id: currentParentId }, 'Parent platform department');
      currentParentId = parent.parentId;
    }
  }

  private async validatePlatformDepartmentValues(
    dto: PlatformDepartmentDto,
    existing?: IamPlatformDepartmentEntity,
  ): Promise<{
    deptCode: string;
    deptName: string;
    leaderUserId: null | string;
    parentId: null | string;
    remark: null | string;
    sortOrder: number;
    status: number;
  }> {
    const deptCode = dto.deptCode.trim();
    const deptName = dto.deptName.trim();
    if (!deptCode || !deptName) throw new BadRequestException('Platform department code and name are required');
    const parentId = nullable(dto.parentId);
    if (parentId) await this.ensurePlatformDepartmentParentIsValid(await this.platformDepartmentRepo(), existing?.id ?? 'new', parentId);
    const leaderUserId = nullable(dto.leaderUserId);
    if (leaderUserId) {
      await this.requireById(await this.userRepo(), leaderUserId, 'Platform department leader');
    }
    return {
      deptCode,
      deptName,
      leaderUserId,
      parentId,
      remark: dto.remark === undefined ? existing?.remark ?? null : nullable(dto.remark),
      sortOrder: dto.sortOrder ?? existing?.sortOrder ?? 0,
      status: dto.status ?? existing?.status ?? 1,
    };
  }

  private async requireById<T extends { id: string }>(repo: Repository<T>, id: string, label: string): Promise<T> {
    const entity = await repo.findOne({ where: { id } as never });
    if (!entity) throw new NotFoundException(`${label} not found`);
    return entity;
  }

  private async requireOne<T extends ObjectLiteral>(repo: Repository<T>, where: object, label: string): Promise<T> {
    const entity = await repo.findOne({ where: where as never });
    if (!entity) throw new BadRequestException(`${label} not found`);
    return entity;
  }

  private async ensureAbsent<T extends ObjectLiteral>(repo: Repository<T>, where: object, message: string) {
    if (await repo.findOne({ where: where as never })) throw new BadRequestException(message);
  }

  private async ensureUserUnique(repo: Repository<IamUserEntity>, values: { email?: null | string; phone?: null | string; username: string }, excludedId?: string) {
    for (const [field, value] of Object.entries(values)) {
      if (!value) continue;
      const existing = await repo.findOne({ where: { [field]: value } });
      if (existing && existing.id !== excludedId) throw new BadRequestException(`${field} already exists`);
    }
  }

  private companyValues(dto: CompanyDto, existing?: IamCompanyEntity): Partial<IamCompanyEntity> {
    const values: Record<string, unknown> = { companyName: dto.companyName.trim(), status: dto.status ?? existing?.status ?? 1 };
    for (const field of ['shortName', 'creditCode', 'legalPerson', 'contactName', 'contactPhone', 'province', 'city', 'district', 'sourceSystem', 'sourceCompanyId'] as const) {
      values[field] = dto[field] === undefined ? existing?.[field] : nullable(dto[field]);
    }
    return values;
  }

  private toApp(row: IamAppEntity) { return { ...row, id: String(row.id) }; }
  private toUser(row: IamUserEntity) { const { passwordHash, ...user } = row; return { ...user, id: String(row.id) }; }
  private toCompany(row: IamCompanyEntity) { return { ...row, id: String(row.id) }; }
  private toPlatformDepartment(row: IamPlatformDepartmentEntity) { return { ...row, id: String(row.id), leaderUserId: row.leaderUserId ? String(row.leaderUserId) : null, parentId: row.parentId ? String(row.parentId) : null }; }
  private toMember(row: IamCompanyMemberEntity) { return { ...row, id: String(row.id), companyId: String(row.companyId), userId: String(row.userId) }; }
  private toUserPlatformDepartment(row: IamUserPlatformDepartmentEntity) { return { ...row, departmentId: String(row.departmentId), id: String(row.id), userId: String(row.userId) }; }
  private toUserApp(row: IamUserAppEntity) { return { ...row, id: String(row.id), userId: String(row.userId) }; }
  private toOAuthClient(row: IamOAuthClientEntity) { const { clientSecretHash, ...client } = row; return { ...client, id: String(row.id) }; }
  private toRole(row: IamRoleEntity) { return { ...row, id: String(row.id) }; }
  private toPermission(row: IamPermissionEntity) { return { ...row, id: String(row.id) }; }
  private toMenu(row: IamMenuEntity) { return { authCode: row.authCode, component: row.component, id: String(row.id), menuName: row.menuName, menuType: row.menuType, meta: row.metaJson ?? {}, parentId: row.parentId, path: row.path, redirect: row.redirect, sortOrder: row.sortOrder, status: row.status }; }
  private userSummary(user?: IamUserEntity) { return user ? { realName: user.realName, username: user.username } : { realName: null, username: null }; }
}

function nullable(value: null | string | undefined): null | string { const trimmed = value?.trim(); return trimmed ? trimmed : null; }
