import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { OperationLog } from '../../common/decorators/operation-log.decorator';
import { AllowCrossAppToken } from '../../common/decorators/allow-cross-app-token.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { readCookie } from '../../common/utils/cookie.util';
import type { AuthPortal } from './auth.types';
import { DEFAULT_AUTH_PORTAL } from './auth.types';
import { AuthService } from './auth.service';
import { AuthJwtService } from './auth-jwt.service';
import { resolveAuthRuntimeConfig } from './auth-runtime.config';
import { LoginDto } from './dto/login.dto';
import { LoginThrottleService } from './login-throttle.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginThrottleService: LoginThrottleService,
    private readonly authJwtService: AuthJwtService,
  ) {}

  @Post('login')
  @OperationLog({ module: '认证', action: '登录' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request & { currentUser?: CurrentUser },
    @Res({ passthrough: true }) response: Response,
  ) {
    const throttleKeys = this.getLoginThrottleKeys(dto, request);
    this.loginThrottleService.assertAllowed(throttleKeys);
    let session;
    try {
      session = await this.authService.login(dto);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.loginThrottleService.recordFailure(throttleKeys);
      }
      throw error;
    }
    this.loginThrottleService.clear(throttleKeys);
    request.currentUser = session.user;
    response.cookie(
      this.getRefreshCookieName(session.user.portal, session.user.appCode),
      session.refreshToken,
      {
        httpOnly: true,
        sameSite: 'lax',
        path: '/auth/refresh',
      },
    );

    return {
      accessToken: session.accessToken,
    };
  }

  @Get('jwks.json')
  jwks() {
    return this.authJwtService.getJwks();
  }

  @Get('codes')
  @AllowCrossAppToken()
  @UseGuards(AccessTokenGuard)
  async codes(@Req() request: Request & { currentUser?: CurrentUser }) {
    return this.authService.getAccessCodesByUserId(
      request.currentUser!.id,
      request.currentUser!.portal,
      request.currentUser!.appCode,
    );
  }

  @Get('userinfo')
  @AllowCrossAppToken()
  @UseGuards(AccessTokenGuard)
  userinfo(@Req() request: Request & { currentUser?: CurrentUser }) {
    return request.currentUser;
  }

  @Post('refresh')
  @OperationLog({ module: '认证', action: '刷新令牌' })
  async refresh(
    @Req() request: Request & { currentUser?: CurrentUser },
    @Headers('cookie') cookieHeader?: string,
    @Headers('x-portal') portalHeader?: string,
    @Headers('x-app-code') appCodeHeader?: string,
    @Res({ passthrough: true }) response?: Response,
  ) {
    const cookieName = this.getRefreshCookieName(
      this.normalizePortal(portalHeader),
      appCodeHeader,
    );
    const refreshToken = readCookie(cookieHeader, cookieName);
    const session = await this.authService.refresh(refreshToken);
    request.currentUser = session.user;

    response?.cookie(cookieName, session.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/auth/refresh',
    });

    return {
      accessToken: session.accessToken,
    };
  }

  @Post('logout')
  @OperationLog({ module: '认证', action: '退出登录' })
  async logout(
    @Req() request: Request & { currentUser?: CurrentUser },
    @Headers('cookie') cookieHeader?: string,
    @Headers('x-portal') portalHeader?: string,
    @Headers('x-app-code') appCodeHeader?: string,
    @Res({ passthrough: true }) response?: Response,
  ) {
    const accessToken = request.headers.authorization
      ? this.extractBearerToken(request.headers.authorization)
      : null;
    const cookieName = this.getRefreshCookieName(
      this.normalizePortal(portalHeader),
      appCodeHeader,
    );
    const refreshToken = readCookie(cookieHeader, cookieName);

    await this.authService.logout(accessToken, refreshToken);
    response?.clearCookie(cookieName, {
      httpOnly: true,
      path: '/auth/refresh',
    });

    return null;
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

  private getRefreshCookieName(
    portal: AuthPortal = DEFAULT_AUTH_PORTAL,
    appCode?: string,
  ): string {
    const resolvedAppCode = this.normalizeAppCode(appCode);
    if (resolvedAppCode !== resolveAuthRuntimeConfig().appCode) {
      return `auth_${resolvedAppCode}_${portal}_refresh_token`;
    }

    if (portal === 'client') {
      return (
        process.env.CLIENT_SESSION_COOKIE_NAME ??
        'new_kjqb_client_refresh_token'
      );
    }

    return (
      process.env.ADMIN_SESSION_COOKIE_NAME ??
      process.env.SESSION_COOKIE_NAME ??
      'new_kjqb_admin_refresh_token'
    );
  }

  private normalizePortal(portal?: string): AuthPortal {
    return portal === 'client' ? 'client' : DEFAULT_AUTH_PORTAL;
  }

  private normalizeAppCode(appCode?: string): string {
    const value = appCode?.trim().toLowerCase();
    return value && /^[a-z][a-z0-9_-]{1,63}$/.test(value)
      ? value
      : resolveAuthRuntimeConfig().appCode;
  }

  private getLoginThrottleKeys(dto: LoginDto, request: Request): string[] {
    const portal = dto.portal ?? DEFAULT_AUTH_PORTAL;
    const appCode = this.normalizeAppCode(dto.appCode);
    const account = dto.username.trim().toLowerCase();
    const forwardedFor = request.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0];
    const ip = forwardedIp?.trim() || request.ip || request.socket.remoteAddress || 'unknown';
    return [
      `account:${appCode}:${portal}:${account}`,
      `ip:${appCode}:${portal}:${ip}`,
    ];
  }
}
