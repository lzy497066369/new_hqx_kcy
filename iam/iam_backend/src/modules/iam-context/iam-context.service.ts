import { Injectable, UnauthorizedException } from '@nestjs/common';
import { In } from 'typeorm';

import { IamCompanyEntity } from '../iam-admin/entities/iam-company.entity';
import { IamAppEntity } from '../iam-admin/entities/iam-app.entity';
import { IamMenuEntity } from '../iam-admin/entities/iam-menu.entity';
import { IamPermissionEntity } from '../iam-admin/entities/iam-permission.entity';
import { IamRolePermissionEntity } from '../iam-admin/entities/iam-role-permission.entity';
import { IamUserCompanyScopeEntity } from '../iam-admin/entities/iam-user-company-scope.entity';
import { IamUserAppContextEntity } from '../iam-admin/entities/iam-user-app-context.entity';
import { IamUserEntity } from '../iam-admin/entities/iam-user.entity';
import { IamUserRoleEntity } from '../iam-admin/entities/iam-user-role.entity';
import { IamDatabaseService } from '../iam-admin/iam-database.service';
import { OAuthService } from '../oauth/oauth.service';

type IamMenuNode = {
  authCode?: string;
  children: IamMenuNode[];
  component?: string;
  id: string;
  meta: Record<string, unknown>;
  name: string;
  path: string;
  redirect?: string;
  status: number;
  type: 'catalog' | 'menu';
};

@Injectable()
export class IamContextService {
  constructor(private readonly database: IamDatabaseService, private readonly oauth: OAuthService) {}

  async getMe(accessToken: string) {
    const claims = this.oauth.getAccessTokenClaims(accessToken);
    const user = await (await this.database.getDataSource()).getRepository(IamUserEntity).findOne({ where: { id: claims.sub, status: 1 } });
    if (!user) throw new UnauthorizedException('User is unavailable');
    return { avatar: user.avatarPath, email: user.email, id: user.id, phone: user.phone, realName: user.realName, username: user.username };
  }

  async getPermissions(accessToken: string, appCode: string): Promise<string[]> {
    const claims = this.requireApp(accessToken, appCode);
    const dataSource = await this.database.getDataSource();
    const userRoles = await dataSource.getRepository(IamUserRoleEntity).find({ where: { appCode, userId: claims.sub } });
    const roleIds = userRoles.map((item) => item.roleId);
    if (!roleIds.length) return [];
    const relations = await dataSource.getRepository(IamRolePermissionEntity).find({ where: { roleId: In(roleIds) } });
    const permissionIds = [...new Set(relations.map((item) => item.permissionId))];
    if (!permissionIds.length) return [];
    const permissions = await dataSource.getRepository(IamPermissionEntity).find({ where: { id: In(permissionIds), appCode, status: 1 } });
    return permissions.map((item) => item.permissionCode).sort();
  }

  async getMenus(accessToken: string, appCode: string) {
    const permissions = new Set(await this.getPermissions(accessToken, appCode));
    const rows = await (await this.database.getDataSource()).getRepository(IamMenuEntity).find({ where: { appCode, status: 1 }, order: { sortOrder: 'ASC', id: 'ASC' } });
    const navigableRows = rows.filter((row) => row.menuType !== 'button');
    const rowsById = new Map(navigableRows.map((row) => [row.id, row]));
    const availableIds = new Set(navigableRows.filter((row) => !row.authCode || permissions.has(row.authCode)).map((row) => row.id));
    for (const menuId of availableIds) {
      const visited = new Set<string>();
      let parentId = rowsById.get(menuId)?.parentId;
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        const parent = rowsById.get(parentId);
        if (!parent) break;
        availableIds.add(parent.id);
        parentId = parent.parentId;
      }
    }
    const available = navigableRows.filter((row) => availableIds.has(row.id));
    const items = new Map<string, IamMenuNode>(available.map((row) => [row.id, {
      authCode: row.authCode ?? undefined,
      children: [],
      component: row.component ?? undefined,
      id: String(row.id),
      meta: { ...(row.metaJson ?? {}), order: row.sortOrder, title: String((row.metaJson ?? {}).title ?? row.menuName) },
      name: String((row.metaJson ?? {}).name ?? row.menuName),
      path: row.path ?? '',
      redirect: row.redirect ?? undefined,
      status: row.status,
      type: row.menuType as 'catalog' | 'menu',
    }]));
    const roots: IamMenuNode[] = [];
    for (const row of available) {
      const item = items.get(row.id)!;
      const parent = row.parentId ? items.get(row.parentId) : undefined;
      if (parent) parent.children.push(item);
      else roots.push(item);
    }
    return roots.map((item) => this.normalizeMenuNode(item));
  }

  private normalizeMenuNode({ children, ...item }: IamMenuNode): Record<string, unknown> {
    return {
      ...item,
      ...(children.length ? { children: children.map((child) => this.normalizeMenuNode(child)) } : {}),
    };
  }

  async getCompanies(accessToken: string, appCode: string) {
    const claims = this.requireApp(accessToken, appCode);
    const dataSource = await this.database.getDataSource();
    const scopes = await dataSource.getRepository(IamUserCompanyScopeEntity).find({ where: { appCode, status: 1, userId: claims.sub } });
    if (!scopes.length) return [];
    const hasAllScope = scopes.some((scope) => scope.dataScope === 'all');
    const companySourceSystem = await this.getCompanySourceSystem(appCode);
    const companies = await dataSource.getRepository(IamCompanyEntity).find({
      where: hasAllScope
        ? { ...(companySourceSystem ? { sourceSystem: companySourceSystem } : {}), status: 1 }
        : { id: In([...new Set(scopes.map((scope) => scope.companyId))]), status: 1 },
      order: { id: 'ASC' },
    });
    const context = await dataSource.getRepository(IamUserAppContextEntity).findOne({ where: { appCode, userId: claims.sub } });
    const defaultCompanyId = companies.some((company) => company.id === context?.defaultCompanyId)
      ? context?.defaultCompanyId
      : this.resolveLegacyDefaultCompanyId(scopes, companies);
    const scopeByCompanyId = new Map(scopes.map((scope) => [scope.companyId, scope]));
    const allScope = scopes.find((scope) => scope.dataScope === 'all');
    return companies.map((company) => {
      const scope = scopeByCompanyId.get(company.id) ?? allScope!;
      return {
        companyName: company.companyName,
        creditCode: company.creditCode,
        dataScope: hasAllScope ? 'all' : scope.dataScope,
        id: company.id,
        isDefault: company.id === defaultCompanyId,
        relationType: scope.relationType,
        shortName: company.shortName,
        sourceCompanyId: company.sourceCompanyId,
        sourceSystem: company.sourceSystem,
      };
    });
  }

  async setDefaultCompany(accessToken: string, appCode: string, companyId: string) {
    const claims = this.requireApp(accessToken, appCode);
    const dataSource = await this.database.getDataSource();
    const scopeRepo = dataSource.getRepository(IamUserCompanyScopeEntity);
    const scopes = await scopeRepo.find({ where: { appCode, status: 1, userId: claims.sub } });
    const hasAllScope = scopes.some((scope) => scope.dataScope === 'all');
    const companySourceSystem = await this.getCompanySourceSystem(appCode);
    const target = await dataSource.getRepository(IamCompanyEntity).findOne({ where: { id: companyId, ...(companySourceSystem ? { sourceSystem: companySourceSystem } : {}), status: 1 } });
    if (!target || (!hasAllScope && !scopes.some((scope) => scope.companyId === companyId))) {
      throw new UnauthorizedException('User is not authorized for this company');
    }
    const contextRepo = dataSource.getRepository(IamUserAppContextEntity);
    const context = await contextRepo.findOne({ where: { appCode, userId: claims.sub } });
    await contextRepo.save(contextRepo.create({ ...context, appCode, defaultCompanyId: companyId, userId: claims.sub }));
    const changed = scopes.filter((scope) => scope.isDefault !== (scope.companyId === companyId ? 1 : 0));
    for (const scope of changed) scope.isDefault = scope.companyId === companyId ? 1 : 0;
    if (changed.length) await scopeRepo.save(changed);
    return this.getCompanies(accessToken, appCode);
  }

  private requireApp(accessToken: string, appCode: string) {
    const claims = this.oauth.getAccessTokenClaims(accessToken);
    if (claims.app_code !== appCode) throw new UnauthorizedException('Token is not issued for this application');
    return claims;
  }

  private resolveLegacyDefaultCompanyId(scopes: IamUserCompanyScopeEntity[], companies: IamCompanyEntity[]): null | string {
    const legacy = scopes.find((scope) => scope.isDefault === 1 && companies.some((company) => company.id === scope.companyId));
    return legacy?.companyId ?? companies[0]?.id ?? null;
  }

  private async getCompanySourceSystem(appCode: string): Promise<null | string> {
    const app = await (await this.database.getDataSource()).getRepository(IamAppEntity).findOne({ where: { appCode, status: 1 } });
    return app?.companySourceSystem ?? null;
  }
}
