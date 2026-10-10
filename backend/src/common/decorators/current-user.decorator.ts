import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { CurrentUser } from '../interfaces/current-user.interface';

export const CurrentUserInfo = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUser => {
    const request = context.switchToHttp().getRequest<{
      currentUser?: CurrentUser;
    }>();
    return request.currentUser as CurrentUser;
  },
);
