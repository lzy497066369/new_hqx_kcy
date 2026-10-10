import { Injectable } from '@nestjs/common';

import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { DEFAULT_PORTAL_TYPE } from '../../common/types/portal-type';
import { MenuEntity } from '../../infrastructure/database/entities/menu.entity';
import { MenuRepository } from '../../infrastructure/database/repositories/menu.repository';
import { AuthService } from '../auth/auth.service';
import { MenuNode } from './menu-node.interface';

type MenuTreeNode = MenuNode & {
  parentId: string | null;
};

@Injectable()
export class MenuService {
  constructor(
    private readonly authService: AuthService,
    private readonly menuRepository: MenuRepository,
  ) {}

  async getMenus(user: CurrentUser): Promise<MenuNode[]> {
    const portal = user.portal ?? DEFAULT_PORTAL_TYPE;
    const appCode = user.appCode;
    const rows = await this.menuRepository.findAll(portal, appCode);
    const tree = this.buildTree(rows);
    const permissions = await this.authService.getAccessCodesByUserId(
      user.id,
      portal,
      appCode,
    );
    return this.filterTreeByPermissions(tree, permissions);
  }

  private buildTree(rows: MenuEntity[]): MenuNode[] {
    const nodeMap = new Map<string, MenuTreeNode>();

    rows.forEach((row) => {
      nodeMap.set(String(row.id), {
        authCode: row.authCode ?? undefined,
        children: [],
        component: row.component ?? undefined,
        id: String(row.id),
        meta: {
          hideInMenu: this.isHiddenDetailRoute(row),
          icon: row.icon ?? undefined,
          order: row.orderNum,
          title: row.title,
        },
        name: row.name,
        parentId: row.parentId,
        path: row.path,
        redirect: row.redirectPath ?? undefined,
        status: row.status,
        type: (row.menuType as MenuNode['type']) ?? 'menu',
      });
    });

    const roots: MenuTreeNode[] = [];

    nodeMap.forEach((node) => {
      if (!node.parentId) {
        roots.push(node);
        return;
      }

      const parent = nodeMap.get(String(node.parentId));
      if (!parent) {
        roots.push(node);
        return;
      }

      parent.children = parent.children ?? [];
      parent.children.push(node);
    });

    const sortAndNormalize = (list: MenuTreeNode[]): MenuNode[] =>
      list
        .slice()
        .sort(
          (left, right) =>
            (left.meta.order ?? 0) - (right.meta.order ?? 0) ||
            left.id.localeCompare(right.id),
        )
        .map(({ parentId, children, ...node }) => ({
          ...node,
          ...(children && children.length > 0
            ? { children: sortAndNormalize(children as MenuTreeNode[]) }
            : {}),
        }));

    return sortAndNormalize(roots);
  }

  private filterTreeByPermissions(
    list: MenuNode[],
    permissions: string[],
  ): MenuNode[] {
    const allowedCodes = new Set(permissions);

    const walk = (node: MenuNode): MenuNode | null => {
      if (node.status !== 1 || node.type === 'button') {
        return null;
      }

      const children = node.children
        ?.map(walk)
        .filter((item): item is MenuNode => Boolean(item));

      const isAllowed =
        !node.authCode ||
        allowedCodes.has(node.authCode) ||
        (node.type === 'catalog' && Boolean(children?.length));

      if (!isAllowed && (!children || children.length === 0)) {
        return null;
      }

      return {
        ...node,
        ...(children && children.length > 0 ? { children } : {}),
      };
    };

    return list
      .map(walk)
      .filter((item): item is MenuNode => Boolean(item));
  }

  private isHiddenDetailRoute(row: MenuEntity): boolean | undefined {
    return row.name === 'EnterpriseMaterialSection' ||
      row.path.includes(':enterpriseId') ||
      (row.portalType === 'client' &&
        (row.name.endsWith('Detail') || row.path.includes('/detail/')))
      ? true
      : undefined;
  }
}
