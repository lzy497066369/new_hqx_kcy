import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Ip, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';

import { OAuthRevokeDto } from './dto/oauth-revoke.dto';
import { OAuthSessionDto } from './dto/oauth-session.dto';
import { OAuthTokenDto } from './dto/oauth-token.dto';
import { OAuthService } from './oauth.service';
import { LoginThrottleService } from '../auth/login-throttle.service';

@Controller()
export class OAuthController {
  constructor(private readonly oauth: OAuthService, private readonly throttle: LoginThrottleService) {}

  @Post('oauth/session')
  async createSession(@Body() dto: OAuthSessionDto, @Headers('user-agent') userAgent: string | undefined, @Ip() ip: string, @Res({ passthrough: true }) response: Response) {
    const keys = this.throttle.keys('sso', dto.username, ip);
    this.throttle.assertAllowed(keys);
    let session;
    try {
      session = await this.oauth.createSession({ ip, password: dto.password, userAgent, username: dto.username });
    } catch (error) {
      if (error instanceof UnauthorizedException) this.throttle.recordFailure(keys);
      throw error;
    }
    this.throttle.clear(keys);
    response.cookie('iam_sso_session', session.sessionId, {
      httpOnly: true,
      maxAge: Math.max(session.expiresAt.getTime() - Date.now(), 0),
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return { expiresAt: session.expiresAt, user: { realName: session.user.realName, username: session.user.username } };
  }

  @Get('oauth/authorize')
  async authorize(@Query() query: Record<string, string | undefined>, @Req() request: Request, @Res() response: Response) {
    if (query.response_type !== 'code') return response.status(400).json({ error: 'unsupported_response_type' });
    if (!query.client_id || !query.redirect_uri || !query.code_challenge) return response.status(400).json({ error: 'invalid_request' });
    const sessionId = this.getCookie(request.headers.cookie, 'iam_sso_session');
    if (!sessionId) {
      const loginUrl = new URL(process.env.IAM_SSO_LOGIN_URL ?? 'http://localhost:6101/oauth/login');
      loginUrl.searchParams.set('return_to', `/oauth/authorize?${new URLSearchParams(query as Record<string, string>).toString()}`);
      return response.redirect(loginUrl.toString());
    }
    const code = await this.oauth.authorize({
      clientId: query.client_id,
      codeChallenge: query.code_challenge,
      codeChallengeMethod: query.code_challenge_method ?? '',
      redirectUri: query.redirect_uri,
      scope: query.scope,
      sessionId,
    });
    const location = new URL(query.redirect_uri);
    location.searchParams.set('code', code);
    if (query.state) location.searchParams.set('state', query.state);
    if (['enterprise', 'overall'].includes(query.login_type ?? '')) {
      location.searchParams.set('login_type', query.login_type!);
    }
    return response.redirect(location.toString());
  }

  @Post('oauth/token')
  token(@Body() dto: OAuthTokenDto) {
    if (dto.grant_type === 'authorization_code') {
      if (!dto.code || !dto.code_verifier || !dto.redirect_uri) throw new BadRequestException('authorization_code fields are missing');
      return this.oauth.exchangeAuthorizationCode({ clientId: dto.client_id, clientSecret: dto.client_secret, code: dto.code, codeVerifier: dto.code_verifier, redirectUri: dto.redirect_uri });
    }
    if (!dto.refresh_token) throw new BadRequestException('refresh_token is missing');
    return this.oauth.refresh({ clientId: dto.client_id, clientSecret: dto.client_secret, refreshToken: dto.refresh_token });
  }

  @Post('oauth/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Body() dto: OAuthRevokeDto) {
    await this.oauth.revoke({ clientId: dto.client_id, clientSecret: dto.client_secret, token: dto.token });
  }

  @Post('oauth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const sessionId = this.getCookie(request.headers.cookie, 'iam_sso_session');
    if (sessionId) await this.oauth.logoutSession(sessionId);
    response.clearCookie('iam_sso_session', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  @Get('oauth/userinfo')
  userInfo(@Headers('authorization') authorization?: string) {
    const [scheme, accessToken] = authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !accessToken) throw new UnauthorizedException('Bearer access token is required');
    return this.oauth.userInfo(accessToken);
  }

  @Get('.well-known/jwks.json')
  jwks() { return this.oauth.getJwks(); }

  @Get('.well-known/openid-configuration')
  openIdConfiguration() { return this.oauth.getOpenIdConfiguration(); }

  private getCookie(header: string | undefined, name: string): string | undefined {
    const prefix = `${name}=`;
    return header
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length);
  }
}
