import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ALLOW_CROSS_APP_TOKEN_KEY } from '../decorators/allow-cross-app-token.decorator';
import { SessionStore } from '../../modules/auth/session-store.port';
import { AuthJwtService } from '../../modules/auth/auth-jwt.service';
import { resolveAuthRuntimeConfig } from '../../modules/auth/auth-runtime.config';
import { UserRepository } from '../../infrastructure/database/repositories/user.repository';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    @Inject(SessionStore) private readonly sessionStore: SessionStore,
    private readonly jwtService: AuthJwtService,
    private readonly reflector: Reflector,
    private readonly userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      currentUser?: unknown;
      headers: Record<string, string | undefined>;
      method?: string;
      originalUrl?: string;
      query?: Record<string, string | string[] | undefined>;
      url?: string;
    }>();
    const headerToken = this.extractBearerToken(request.headers.authorization);
    const queryToken = this.extractQueryToken(request.query?.access_token);
    if (!headerToken && queryToken && !this.canUseQueryToken(request)) {
      throw new ForbiddenException('Query access tokens are not allowed for this route');
    }
    const accessToken = headerToken ?? queryToken;

    if (!accessToken) {
      throw new UnauthorizedException('缺少访问令牌');
    }

    const tokenMode = resolveAuthRuntimeConfig().tokenMode;
    const looksLikeJwt = accessToken.split('.').length === 3;
    const allowCrossAppToken =
      this.reflector?.getAllAndOverride<boolean>(ALLOW_CROSS_APP_TOKEN_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;
    if (tokenMode === 'jwt' && !looksLikeJwt) {
      throw new UnauthorizedException('访问令牌格式无效');
    }
    if (tokenMode !== 'legacy' && looksLikeJwt) {
      this.jwtService.verifyAccessToken(
        accessToken,
        allowCrossAppToken ? null : resolveAuthRuntimeConfig().appCode,
      );
    }

    const session = await this.sessionStore.findByAccessToken(accessToken);
    if (!session) {
      throw new UnauthorizedException('访问令牌无效或已过期');
    }
    if (
      !allowCrossAppToken &&
      session.user.appCode &&
      session.user.appCode !== resolveAuthRuntimeConfig().appCode
    ) {
      throw new UnauthorizedException('访问令牌不属于当前系统');
    }

    if (session.user.portal === 'client' && session.user.roles?.includes('region_leader')) {
      throw new UnauthorizedException('该负责人角色已停用，请联系总负责人');
    }
    if (session.user.portal === 'client' && session.user.roles?.some((role) => ['project_teacher', 'enterprise_owner'].includes(role))) {
      const current = await this.userRepository.findById(String(session.user.id));
      if (!current || current.status !== 1) {
        throw new UnauthorizedException('账号已停用，请重新登录');
      }
    }

    request.currentUser = session.user;
    return true;
  }

  private canUseQueryToken(request: {
    method?: string;
    originalUrl?: string;
    url?: string;
  }): boolean {
    if ((request.method ?? '').toUpperCase() !== 'GET') {
      return false;
    }

    const path = (request.originalUrl ?? request.url ?? '').split('?')[0];
    return [
      /^\/upload\/stream\//,
      /^\/client\/enterprise\/materials\/[^/]+\/preview$/,
      /^\/client\/enterprise-records\/[^/]+\/[^/]+\/[^/]+\/file$/,
      /^\/client\/enterprise-media\/(?:certificate|photo)\/[^/]+\/file$/,
      /^\/policy\/collect-runs\/[^/]+\/progress-stream$/,
    ].some((pattern) => pattern.test(path));
  }

  private extractBearerToken(authorization?: string): string | null {
    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  private extractQueryToken(value?: string | string[]): string | null {
    const token = Array.isArray(value) ? value[0] : value;
    return token?.trim() || null;
  }
}
