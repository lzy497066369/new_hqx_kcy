import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import type { IamCurrentUser } from './auth.types';

export interface AuthenticatedRequest extends Request {
  iamUser?: IamCurrentUser;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, accessToken] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !accessToken) {
      throw new UnauthorizedException('缺少访问令牌');
    }

    request.iamUser = await this.authService.getCurrentUser(accessToken);
    return true;
  }
}
