import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { REQUIRED_PORTALS_KEY } from '../decorators/require-portal.decorator';
import type { CurrentUser } from '../interfaces/current-user.interface';

@Injectable()
export class PortalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const controller = context.getClass();
    const requiredPortals =
      (Reflect.getMetadata(REQUIRED_PORTALS_KEY, handler) as string[] | undefined) ??
      (Reflect.getMetadata(
        REQUIRED_PORTALS_KEY,
        controller,
      ) as string[] | undefined);

    if (!requiredPortals?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      currentUser?: CurrentUser;
    }>();
    const portal = request.currentUser?.portal;
    if (!portal || !requiredPortals.includes(portal)) {
      throw new ForbiddenException('Current account cannot access this portal');
    }

    return true;
  }
}
