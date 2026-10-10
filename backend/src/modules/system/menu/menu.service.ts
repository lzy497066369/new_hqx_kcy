import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { PortalType } from '../../../common/types/portal-type';
import { MenuEntity } from '../../../infrastructure/database/entities/menu.entity';
import { PermissionEntity } from '../../../infrastructure/database/entities/permission.entity';
import { RolePermissionEntity } from '../../../infrastructure/database/entities/role-permission.entity';
import { formatDateTimeInBjt } from '../../../common/utils/date.util';
import { MenuInput } from './dto';
import {
  buildTree,
  normalizePortalType,
  resolveManagedPortalType,
  toNullableString,
  toNumber,
  toStringId,
} from '../shared/system.utils';

type MenuItem = {
  authCode?: string | null;
  children?: MenuItem[];
  component?: string | null;
  createTime: string;
  id: string;
  meta: {
    icon?: string | null;
    title: string;
  };
  name: string;
  orderNum: number;
  parentId: string | null;
  path: string;
  portalType: PortalType;
  redirect?: string | null;
  status: number;
  type: 'catalog' | 'menu' | 'button';
  updateTime: string;
};

@Injectable()
export class SystemMenuService {
  constructor(
    @InjectRepository(MenuEntity)
    private readonly menuRepo: Repository<MenuEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepo: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissionRepo: Repository<RolePermissionEntity>,
  ) {}

  async list(portalType: PortalType, appCode: string): Promise<MenuItem[]> {
    const rows = await this.menuRepo.find({
      order: {
        orderNum: 'ASC',
        id: 'ASC',
      },
      where: { appCode, portalType },
    });

    return buildTree(
      rows.map((row) => this.toItem(row)),
      (left, right) => left.orderNum - right.orderNum || left.id.localeCompare(right.id),
    );
  }

  async isNameExists(
    name: string,
    portalType: PortalType,
    appCode: string,
    id?: string,
  ): Promise<boolean> {
    if (!name.trim()) {
      return false;
    }

    const qb = this.menuRepo
      .createQueryBuilder('menu')
      .where('menu.name = :name', { name: name.trim() })
      .andWhere('menu.portalType = :portalType', { portalType });
    qb.andWhere('menu.appCode = :appCode', { appCode });

    if (id) {
      qb.andWhere('menu.id <> :id', { id: toStringId(id) });
    }

    return (await qb.getCount()) > 0;
  }

  async isPathExists(
    path: string,
    portalType: PortalType,
    appCode: string,
    id?: string,
  ): Promise<boolean> {
    if (!path.trim()) {
      return false;
    }

    const qb = this.menuRepo
      .createQueryBuilder('menu')
      .where('menu.path = :path', { path: path.trim() })
      .andWhere('menu.portalType = :portalType', { portalType });
    qb.andWhere('menu.appCode = :appCode', { appCode });

    if (id) {
      qb.andWhere('menu.id <> :id', { id: toStringId(id) });
    }

    return (await qb.getCount()) > 0;
  }

  async create(
    input: MenuInput,
    currentPortal: PortalType,
    appCode: string,
  ): Promise<MenuItem> {
    const portalType = this.resolveInputPortal(input, currentPortal);
    await this.assertValidInput(input, portalType, appCode);
    const entity = this.menuRepo.create(
      await this.normalizeInput(input, portalType, appCode),
    );
    const saved = await this.menuRepo.save(entity);
    await this.syncPermissionByMenu(saved);
    return this.toItem(saved);
  }

  async update(
    id: string,
    input: MenuInput,
    currentPortal: PortalType,
    appCode: string,
  ): Promise<MenuItem> {
    const portalType = this.resolveInputPortal(input, currentPortal);
    const entity = await this.menuRepo.findOne({
      where: { appCode, id: toStringId(id), portalType },
    });
    if (!entity) {
      throw new NotFoundException('菜单不存在');
    }

    const previousAuthCode = entity.authCode;
    await this.assertValidInput(input, portalType, appCode, entity);
    Object.assign(entity, await this.normalizeInput(input, portalType, appCode, entity));
    const saved = await this.menuRepo.save(entity);
    await this.syncPermissionByMenu(saved, previousAuthCode);
    return this.toItem(saved);
  }

  async remove(id: string, portalType: PortalType, appCode: string): Promise<void> {
    const entity = await this.menuRepo.findOne({
      where: { appCode, id: toStringId(id), portalType },
    });
    if (!entity) {
      throw new NotFoundException('菜单不存在');
    }

    const childCount = await this.menuRepo.count({
      where: { appCode, parentId: entity.id, portalType },
    });
    if (childCount > 0) {
      throw new BadRequestException('请先删除子菜单');
    }

    await this.menuRepo.delete({ id: entity.id });
    await this.removePermissionByAuthCode(
      entity.authCode,
      entity.portalType,
      entity.appCode,
    );
  }

  private async normalizeInput(
    input: MenuInput,
    portalType: PortalType,
    appCode: string,
    current?: MenuEntity,
  ): Promise<Partial<MenuEntity>> {
    const menuType =
      input.type === undefined
        ? current?.menuType ?? 'menu'
        : String(input.type);
    const title = input.meta?.title?.trim() ?? current?.title;
    const name = input.name?.trim() ?? current?.name;
    const path = this.resolvePath(input, menuType, current);

    if (!title || !name || (menuType !== 'button' && !path)) {
      this.assertRequired(input, current);
    }

    const parentId = await this.resolveParentId(
      input.parentId,
      portalType,
      appCode,
      current,
    );

    return {
      authCode:
        input.authCode === undefined
          ? current?.authCode ?? null
          : toNullableString(input.authCode),
      component:
        input.component === undefined
          ? current?.component ?? null
          : toNullableString(input.component),
      icon:
        input.meta?.icon === undefined
          ? current?.icon ?? null
          : toNullableString(input.meta.icon),
      menuType,
      appCode,
      name,
      orderNum:
        input.orderNum === undefined
          ? current?.orderNum ?? 0
          : toNumber(input.orderNum, current?.orderNum ?? 0),
      parentId,
      path,
      portalType,
      redirectPath:
        input.redirect === undefined
          ? current?.redirectPath ?? null
          : toNullableString(input.redirect),
      status:
        input.status === undefined
          ? current?.status ?? 1
          : toNumber(input.status, current?.status ?? 1),
      title,
    };
  }

  private assertRequired(input: MenuInput, current?: MenuEntity): void {
    const name = input.name?.trim() ?? current?.name;
    const title = input.meta?.title?.trim() ?? current?.title;
    const menuType =
      input.type === undefined
        ? current?.menuType ?? 'menu'
        : String(input.type);
    const path = this.resolvePath(input, menuType, current);
    if (!name || !title || (menuType !== 'button' && !path)) {
      throw new BadRequestException('菜单名称、标题不能为空，目录和菜单还需要配置路径');
    }
  }

  private async assertValidInput(
    input: MenuInput,
    portalType: PortalType,
    appCode: string,
    current?: MenuEntity,
  ): Promise<void> {
    const menuType =
      input.type === undefined
        ? current?.menuType ?? 'menu'
        : String(input.type);
    const name = input.name?.trim() ?? current?.name;
    const path = this.resolvePath(input, menuType, current);
    const authCode =
      input.authCode === undefined
        ? current?.authCode ?? null
        : toNullableString(input.authCode);

    this.assertRequired(input, current);

    if (!['catalog', 'menu', 'button'].includes(menuType)) {
      throw new BadRequestException('菜单类型不合法');
    }

    await this.ensureNameAvailable(name!, portalType, appCode, current?.id);
    if (path) {
      await this.ensurePathAvailable(path, portalType, appCode, current?.id);
    }
    if (authCode) {
      await this.ensureAuthCodeAvailable(authCode, portalType, appCode, current?.id);
    }
    await this.resolveParentId(input.parentId, portalType, appCode, current);
  }

  private resolvePath(
    input: MenuInput,
    menuType: string,
    current?: MenuEntity,
  ): string {
    const rawPath = input.path?.trim() ?? current?.path ?? '';
    if (rawPath) {
      return rawPath;
    }

    if (menuType !== 'button') {
      return rawPath;
    }

    const name = input.name?.trim() ?? current?.name ?? 'button';
    const parentId = input.parentId ?? current?.parentId ?? 'root';
    return `/__button__/${String(parentId)}/${name}`;
  }

  private async resolveParentId(
    parentId: string | null | undefined,
    portalType: PortalType,
    appCode: string,
    current?: MenuEntity,
  ): Promise<string | null> {
    if (parentId === undefined) {
      return current?.parentId ?? null;
    }

    const normalizedParentId = toNullableString(parentId);
    if (!normalizedParentId) {
      return null;
    }

    if (current && normalizedParentId === String(current.id)) {
      throw new BadRequestException('上级菜单不能选择自己');
    }

    const parent = await this.menuRepo.findOne({
      where: { appCode, id: toStringId(normalizedParentId), portalType },
    });
    if (!parent) {
      throw new BadRequestException('上级菜单不存在');
    }

    if (current) {
      await this.assertNotDescendantParent(
        String(current.id),
        normalizedParentId,
        portalType,
        appCode,
      );
    }

    return normalizedParentId;
  }

  private async assertNotDescendantParent(
    currentId: string,
    parentId: string,
    portalType: PortalType,
    appCode: string,
  ): Promise<void> {
    const rows = await this.menuRepo.find({
      order: {
        id: 'ASC',
      },
      where: { appCode, portalType },
    });

    const parentMap = new Map(
      rows.map((row) => [String(row.id), row.parentId ? String(row.parentId) : null]),
    );

    let cursor: string | null = parentId;
    while (cursor) {
      if (cursor === currentId) {
        throw new BadRequestException('上级菜单不能选择当前菜单或其子菜单');
      }
      cursor = parentMap.get(cursor) ?? null;
    }
  }

  private async ensureNameAvailable(
    name: string,
    portalType: PortalType,
    appCode: string,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.menuRepo
      .createQueryBuilder('menu')
      .where('menu.name = :name', { name })
      .andWhere('menu.portalType = :portalType', { portalType });
    qb.andWhere('menu.appCode = :appCode', { appCode });

    if (excludeId) {
      qb.andWhere('menu.id <> :id', { id: toStringId(excludeId) });
    }

    if ((await qb.getCount()) > 0) {
      throw new BadRequestException('菜单名称已存在');
    }
  }

  private async ensurePathAvailable(
    path: string,
    portalType: PortalType,
    appCode: string,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.menuRepo
      .createQueryBuilder('menu')
      .where('menu.path = :path', { path })
      .andWhere('menu.portalType = :portalType', { portalType });
    qb.andWhere('menu.appCode = :appCode', { appCode });

    if (excludeId) {
      qb.andWhere('menu.id <> :id', { id: toStringId(excludeId) });
    }

    if ((await qb.getCount()) > 0) {
      throw new BadRequestException('菜单路径已存在');
    }
  }

  private async ensureAuthCodeAvailable(
    authCode: string,
    portalType: PortalType,
    appCode: string,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.menuRepo
      .createQueryBuilder('menu')
      .where('menu.authCode = :authCode', { authCode })
      .andWhere('menu.portalType = :portalType', { portalType });
    qb.andWhere('menu.appCode = :appCode', { appCode });

    if (excludeId) {
      qb.andWhere('menu.id <> :id', { id: toStringId(excludeId) });
    }

    if ((await qb.getCount()) > 0) {
      throw new BadRequestException('权限标识已存在');
    }
  }

  private async syncPermissionByMenu(
    menu: MenuEntity,
    previousAuthCode?: string | null,
  ): Promise<void> {
    const oldAuthCode = previousAuthCode ?? menu.authCode;
    const newAuthCode = menu.authCode ? String(menu.authCode) : null;

    if (oldAuthCode && oldAuthCode !== newAuthCode) {
      await this.migratePermissionCode(oldAuthCode, newAuthCode, menu);
      if (!newAuthCode) {
        return;
      }
    }

    if (!newAuthCode) {
      return;
    }

    const permission = await this.permissionRepo.findOne({
      where: {
        appCode: menu.appCode,
        code: newAuthCode,
        portalType: menu.portalType,
      },
    });

    await this.permissionRepo.save(
      this.permissionRepo.create({
        ...(permission ? { id: permission.id } : {}),
        code: newAuthCode,
        appCode: menu.appCode,
        name: menu.title,
        portalType: menu.portalType,
        status: menu.status,
        type: menu.menuType,
      }),
    );
  }

  private async migratePermissionCode(
    oldAuthCode: string,
    newAuthCode: string | null,
    menu: MenuEntity,
  ): Promise<void> {
    const siblingCount = await this.menuRepo.count({
      where: {
        appCode: menu.appCode,
        authCode: oldAuthCode,
        portalType: menu.portalType,
      },
    });
    if (siblingCount > 0) {
      if (newAuthCode) {
        await this.syncPermissionByMenu(
          this.menuRepo.create({
            ...menu,
            authCode: newAuthCode,
          }),
        );
      }
      return;
    }

    const oldPermission = await this.permissionRepo.findOne({
      where: {
        appCode: menu.appCode,
        code: oldAuthCode,
        portalType: menu.portalType,
      },
    });
    if (!oldPermission) {
      return;
    }

    if (!newAuthCode) {
      await this.rolePermissionRepo.delete({ permissionId: oldPermission.id });
      await this.permissionRepo.delete({ id: oldPermission.id });
      return;
    }

    const newPermission = await this.permissionRepo.findOne({
      where: {
        appCode: menu.appCode,
        code: newAuthCode,
        portalType: menu.portalType,
      },
    });

    if (!newPermission) {
      oldPermission.code = newAuthCode;
      oldPermission.name = menu.title;
      oldPermission.portalType = menu.portalType;
      oldPermission.status = menu.status;
      oldPermission.type = menu.menuType;
      await this.permissionRepo.save(oldPermission);
      return;
    }

    const oldRelations = await this.rolePermissionRepo.find({
      where: { permissionId: oldPermission.id },
    });
    const newRelations = await this.rolePermissionRepo.find({
      where: { permissionId: newPermission.id },
    });
    const newRoleIds = new Set(newRelations.map((item) => String(item.roleId)));

    for (const relation of oldRelations) {
      if (newRoleIds.has(String(relation.roleId))) {
        await this.rolePermissionRepo.delete({ id: relation.id });
        continue;
      }

      relation.permissionId = newPermission.id;
      await this.rolePermissionRepo.save(relation);
    }

    newPermission.name = menu.title;
    newPermission.portalType = menu.portalType;
    newPermission.status = menu.status;
    newPermission.type = menu.menuType;
    await this.permissionRepo.save(newPermission);
    await this.permissionRepo.delete({ id: oldPermission.id });
  }

  private async removePermissionByAuthCode(
    authCode: string | null | undefined,
    portalType: PortalType,
    appCode: string,
  ): Promise<void> {
    if (!authCode) {
      return;
    }

    const siblingCount = await this.menuRepo.count({
      where: { appCode, authCode, portalType },
    });
    if (siblingCount > 0) {
      return;
    }

    const permission = await this.permissionRepo.findOne({
      where: { appCode, code: authCode, portalType },
    });
    if (!permission) {
      return;
    }

    await this.rolePermissionRepo.delete({ permissionId: permission.id });
    await this.permissionRepo.delete({ id: permission.id });
  }

  private toItem(row: MenuEntity): MenuItem {
    return {
      authCode: row.authCode,
      component: row.component,
      createTime: formatDateTimeInBjt(row.createdAt),
      id: String(row.id),
      meta: {
        icon: row.icon,
        title: row.title,
      },
      name: row.name,
      orderNum: row.orderNum,
      parentId: row.parentId ? String(row.parentId) : null,
      path: row.path,
      portalType: row.portalType,
      redirect: row.redirectPath,
      status: row.status,
      type: (row.menuType as MenuItem['type']) ?? 'menu',
      updateTime: formatDateTimeInBjt(row.updatedAt),
    };
  }

  private resolveInputPortal(
    input: MenuInput,
    currentPortal: PortalType,
  ): PortalType {
    const requestedPortal = normalizePortalType(input.portalType, currentPortal);
    const portalType = resolveManagedPortalType(input.portalType, currentPortal);
    if (currentPortal !== 'admin' && requestedPortal !== currentPortal) {
      throw new BadRequestException('只能维护当前端的菜单');
    }
    return portalType;
  }
}
