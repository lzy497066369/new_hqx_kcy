import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import type { PortalType } from '../../../common/types/portal-type';
import { MenuEntity } from '../../../infrastructure/database/entities/menu.entity';
import { PermissionEntity } from '../../../infrastructure/database/entities/permission.entity';
import { RolePermissionEntity } from '../../../infrastructure/database/entities/role-permission.entity';
import { RoleEntity } from '../../../infrastructure/database/entities/role.entity';
import { UserRoleEntity } from '../../../infrastructure/database/entities/user-role.entity';
import { formatDateTimeInBjt } from '../../../common/utils/date.util';
import { RoleInput } from './dto';
import {
  normalizePortalType,
  normalizeArray,
  resolveManagedPortalType,
  toNumber,
  toNullableString,
  toStringId,
} from '../shared/system.utils';

type RoleItem = {
  createTime: string;
  id: string;
  name: string;
  permissions?: string[];
  portalType: PortalType;
  remark: string | null;
  status: number;
  updateTime: string;
};

@Injectable()
export class SystemRoleService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(MenuEntity)
    private readonly menuRepo: Repository<MenuEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepo: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissionRepo: Repository<RolePermissionEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepo: Repository<UserRoleEntity>,
  ) {}

  async list(
    query: Record<string, string | string[] | undefined>,
    portalType: PortalType,
    appCode: string,
  ): Promise<{ items: RoleItem[]; total: number }> {
    const rows = await this.roleRepo.find({
      relations: {
        rolePermissions: {
          permission: true,
        },
      },
      order: {
        id: 'ASC',
      },
      where: { appCode, portalType },
    });

    let items = await Promise.all(rows.map((row) => this.toItem(row)));
    const name = this.getQueryValue(query.name)?.toLowerCase();
    const id = this.getQueryValue(query.id);
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
    if (status !== undefined) {
      items = items.filter((item) => String(item.status) === status);
    }
    if (remark) {
      items = items.filter((item) => (item.remark ?? '').toLowerCase().includes(remark));
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

  async create(
    input: RoleInput,
    currentPortal: PortalType,
    appCode: string,
  ): Promise<RoleItem> {
    const portalType = this.resolveInputPortal(input, currentPortal);
    const name = input.name?.trim();
    if (!name) {
      throw new BadRequestException('角色名称不能为空');
    }

    const code = this.normalizeCode(name);
    await this.ensureRoleCodeAvailable(code, portalType, appCode);

    const entity = this.roleRepo.create({
      code,
      appCode,
      name,
      portalType,
      remark: toNullableString(input.remark),
      status: toNumber(input.status, 1),
    });
    const saved = await this.roleRepo.save(entity);
    await this.syncPermissions(
      saved.id,
      normalizeArray(input.permissions),
      portalType,
      appCode,
    );
    return this.toItem(await this.reloadRole(saved.id, appCode));
  }

  async update(
    id: string,
    input: RoleInput,
    currentPortal: PortalType,
    appCode: string,
  ): Promise<RoleItem> {
    const portalType = this.resolveInputPortal(input, currentPortal);
    const entity = await this.roleRepo.findOne({
      where: { appCode, id: toStringId(id), portalType },
    });
    if (!entity) {
      throw new NotFoundException('角色不存在');
    }

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new BadRequestException('角色名称不能为空');
      }
      entity.name = name;
    }
    if (input.remark !== undefined) {
      entity.remark = toNullableString(input.remark);
    }
    if (input.status !== undefined) {
      entity.status = toNumber(input.status, entity.status);
    }

    const saved = await this.roleRepo.save(entity);
    if (input.permissions !== undefined) {
      await this.syncPermissions(
        saved.id,
        normalizeArray(input.permissions),
        saved.portalType,
        appCode,
      );
    }
    return this.toItem(await this.reloadRole(saved.id, appCode));
  }

  async remove(id: string, portalType: PortalType, appCode: string): Promise<void> {
    const entity = await this.roleRepo.findOne({
      where: { appCode, id: toStringId(id), portalType },
    });
    if (!entity) {
      throw new NotFoundException('角色不存在');
    }

    await this.rolePermissionRepo.delete({ roleId: entity.id });
    await this.userRoleRepo.delete({ roleId: entity.id });
    await this.roleRepo.delete({ id: entity.id });
  }

  private async reloadRole(id: string, appCode: string): Promise<RoleEntity> {
    const row = await this.roleRepo.findOne({
      relations: {
        rolePermissions: {
          permission: true,
        },
      },
      where: { appCode, id: toStringId(id) },
    });
    if (!row) {
      throw new NotFoundException('角色不存在');
    }
    return row;
  }

  private async syncPermissions(
    roleId: string,
    menuIds: string[],
    portalType: PortalType,
    appCode: string,
  ): Promise<void> {
    const uniqueMenuIds = [...new Set(menuIds.map((item) => toStringId(item)))];
    const selectedMenus = menuIds.length
      ? await this.menuRepo.find({
          where: {
            id: In(uniqueMenuIds),
            appCode,
            portalType,
          },
        })
      : [];
    if (selectedMenus.length !== uniqueMenuIds.length) {
      throw new BadRequestException('关联菜单不存在');
    }

    const codes = [...new Set(selectedMenus.map((item) => item.authCode).filter(Boolean) as string[])];

    await this.rolePermissionRepo.delete({ roleId: toStringId(roleId) });
    if (codes.length === 0) {
      return;
    }

    const existingPermissions = await this.permissionRepo.find({
      where: {
        code: In(codes),
        appCode,
        portalType,
      },
    });
    const permissionMap = new Map(existingPermissions.map((item) => [item.code, item]));
    const savedPermissions: PermissionEntity[] = [];

    for (const menu of selectedMenus) {
      if (!menu.authCode) {
        continue;
      }

      const existed = permissionMap.get(menu.authCode);
      if (existed) {
        existed.name = menu.title;
        existed.status = menu.status;
        existed.type = menu.menuType;
        savedPermissions.push(existed);
        continue;
      }

      const permission = await this.permissionRepo.save(
        this.permissionRepo.create({
          code: menu.authCode,
          appCode,
          name: menu.title,
          portalType,
          type: menu.menuType,
          status: menu.status,
        }),
      );
      permissionMap.set(permission.code, permission);
      savedPermissions.push(permission);
    }

    const changedPermissions = [...permissionMap.values()].filter((permission) =>
      codes.includes(permission.code),
    );
    if (changedPermissions.length > 0) {
      await this.permissionRepo.save(changedPermissions);
    }

    const uniquePermissions = new Map(savedPermissions.map((item) => [item.code, item]));
    await this.rolePermissionRepo.save(
      [...uniquePermissions.values()].map((permission) =>
        this.rolePermissionRepo.create({
          permissionId: permission.id,
          roleId: toStringId(roleId),
        }),
      ),
    );
  }

  private async toItem(row: RoleEntity): Promise<RoleItem> {
    const permissionCodes =
      row.rolePermissions
        ?.map((item) => item.permission?.code)
        .filter((item): item is string => Boolean(item)) ?? [];
    const menus = permissionCodes.length
      ? await this.menuRepo.find({
          where: {
            authCode: In(permissionCodes),
            appCode: row.appCode,
            portalType: row.portalType,
          },
        })
      : [];

    return {
      createTime: formatDateTimeInBjt(row.createdAt),
      id: String(row.id),
      name: row.name,
      permissions: menus.map((item) => String(item.id)),
      portalType: row.portalType,
      remark: row.remark ?? null,
      status: row.status,
      updateTime: formatDateTimeInBjt(row.updatedAt),
    };
  }

  private normalizeCode(name: string, fallback?: string): string {
    const code = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return code || fallback || `role_${Date.now()}`;
  }

  private async ensureRoleCodeAvailable(
    code: string,
    portalType: PortalType,
    appCode: string,
  ): Promise<void> {
    const existing = await this.roleRepo.findOne({
      where: { appCode, code, portalType },
    });
    if (existing) {
      throw new BadRequestException('角色编码已存在');
    }
  }

  private resolveInputPortal(
    input: RoleInput,
    currentPortal: PortalType,
  ): PortalType {
    const requestedPortal = normalizePortalType(input.portalType, currentPortal);
    const portalType = resolveManagedPortalType(input.portalType, currentPortal);
    if (currentPortal !== 'admin' && requestedPortal !== currentPortal) {
      throw new BadRequestException('只能维护当前端的角色');
    }
    return portalType;
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
}
