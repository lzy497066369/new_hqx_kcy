import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import {
  REQUIRED_PERMISSIONS_KEY,
  REQUIRED_ROLES_KEY,
} from '../decorators/require-access.decorator';
import type { CurrentUser } from '../interfaces/current-user.interface';

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

@Injectable()
export class PermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const controller = context.getClass();
    const requiredPermissions = Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      handler,
    ) as string[] | undefined ?? Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      controller,
    ) as string[] | undefined;
    const requiredRoles = Reflect.getMetadata(
      REQUIRED_ROLES_KEY,
      handler,
    ) as string[] | undefined ?? Reflect.getMetadata(
      REQUIRED_ROLES_KEY,
      controller,
    ) as string[] | undefined;

    if (!requiredPermissions?.length && !requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      currentUser?: CurrentUser;
    }>();
    const user = request.currentUser;
    if (!user) {
      throw new ForbiddenException('当前账号无访问权限');
    }

    if (user.roles.some((role) => ADMIN_ROLES.has(role))) {
      return true;
    }

    if (
      requiredRoles?.length &&
      !requiredRoles.some((role) => user.roles.includes(role))
    ) {
      throw new ForbiddenException('当前账号无角色访问权限');
    }

    if (
      requiredPermissions?.length &&
      !requiredPermissions.every((permission) =>
        user.permissions?.includes(permission),
      )
    ) {
      throw new ForbiddenException('当前账号缺少操作权限');
    }

    return true;
  }
}
