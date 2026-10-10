import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type JsonWebKey,
  randomBytes,
  sign,
  timingSafeEqual,
  verify,
} from 'node:crypto';
import { In, Repository } from 'typeorm';

import { hashPassword, verifyPassword } from '../../common/password.util';
import { IamAppEntity } from '../iam-admin/entities/iam-app.entity';
import { IamOAuthClientEntity } from '../iam-admin/entities/iam-oauth-client.entity';
import { IamUserAppEntity } from '../iam-admin/entities/iam-user-app.entity';
import { IamUserEntity } from '../iam-admin/entities/iam-user.entity';
import { IamUserRoleEntity } from '../iam-admin/entities/iam-user-role.entity';
import { IamRoleEntity } from '../iam-admin/entities/iam-role.entity';
import { IamRolePermissionEntity } from '../iam-admin/entities/iam-role-permission.entity';
import { IamPermissionEntity } from '../iam-admin/entities/iam-permission.entity';
import { IamDatabaseService } from '../iam-admin/iam-database.service';
import { IamAuditService } from '../audit/iam-audit.service';
import { IamOAuthAuthorizationCodeEntity } from './entities/iam-oauth-authorization-code.entity';
import { IamRefreshTokenEntity } from './entities/iam-refresh-token.entity';
import { IamSsoSessionEntity } from './entities/iam-sso-session.entity';
import type { IamJwtClaims, OAuthTokenResponse } from './oauth.types';

const base64Url = (value: Buffer | string) => Buffer.from(value).toString('base64url');
const now = () => new Date();
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
type PublishedJwk = JsonWebKey & { alg: 'RS256'; kid: string; use: 'sig' };

@Injectable()
export class OAuthService {
  private readonly issuer = process.env.IAM_ISSUER ?? `http://localhost:${process.env.PORT ?? 3101}`;
  private readonly keyId = process.env.IAM_JWT_KEY_ID ?? 'iam-rs256-1';
  private readonly privateKey: ReturnType<typeof createPrivateKey>;
  private readonly publicKey: ReturnType<typeof createPublicKey>;
  private readonly additionalPublicJwks: PublishedJwk[];

  constructor(
    private readonly database: IamDatabaseService,
    private readonly audit: IamAuditService,
  ) {
    const encodedPrivateKey = process.env.IAM_JWT_PRIVATE_KEY_BASE64;
    if (encodedPrivateKey) {
      this.privateKey = createPrivateKey(Buffer.from(encodedPrivateKey, 'base64').toString('utf8'));
      this.publicKey = createPublicKey(this.privateKey);
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('IAM_JWT_PRIVATE_KEY_BASE64 is required in production');
      }
      const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
      this.privateKey = keys.privateKey;
      this.publicKey = keys.publicKey;
    }
    this.additionalPublicJwks = this.parseAdditionalPublicJwks();
  }

  async createSession(input: { ip?: string; password: string; userAgent?: string; username: string }) {
    const username = input.username.trim();
    const user = await (await this.userRepo()).findOne({ where: { username, status: 1 } });
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        await this.audit.record({ action: 'oauth.session.created', ipAddress: input.ip, outcome: 'failure', username });
        throw new UnauthorizedException('Username or password is incorrect');
      }
    const id = randomBytes(32).toString('base64url');
    const entity = (await this.sessionRepo()).create({
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      id,
      loginIp: input.ip ?? null,
      revokedAt: null,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
      userId: user.id,
    });
    await (await this.sessionRepo()).save(entity);
      user.lastLoginAt = now();
      if (!user.passwordHash.startsWith('scrypt$')) user.passwordHash = await hashPassword(input.password);
      await (await this.userRepo()).save(user);
    await this.audit.record({ action: 'oauth.session.created', actorUserId: String(user.id), ipAddress: input.ip, outcome: 'success', username: user.username });
    return { expiresAt: entity.expiresAt, sessionId: id, user };
  }

  async authorize(input: {
    clientId: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    redirectUri: string;
    scope?: string;
    sessionId: string;
  }): Promise<string> {
    const [client, session] = await Promise.all([
      this.requireEnabledClient(input.clientId),
      this.requireSession(input.sessionId),
    ]);
    if (!client.grantTypes.includes('authorization_code')) throw new BadRequestException('Client does not allow authorization_code');
    if (!client.redirectUris.includes(input.redirectUri)) throw new BadRequestException('Redirect URI is not registered');
    if (input.codeChallengeMethod !== 'S256' || !input.codeChallenge) throw new BadRequestException('PKCE S256 code_challenge is required');
    const userApp = await (await this.userAppRepo()).findOne({ where: { appCode: client.appCode, status: 1, userId: session.userId } });
    if (!userApp) throw new UnauthorizedException('User is not authorized for this application');
    const plainCode = randomBytes(48).toString('base64url');
    await (await this.codeRepo()).save((await this.codeRepo()).create({
      appCode: client.appCode,
      clientId: client.clientId,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      codeHash: sha256(plainCode),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      redirectUri: input.redirectUri,
      scope: input.scope ?? null,
      sessionId: session.id,
      usedAt: null,
      userId: session.userId,
    }));
    await this.audit.record({ action: 'oauth.authorization_code.issued', actorUserId: String(session.userId), appCode: client.appCode, clientId: client.clientId, outcome: 'success' });
    return plainCode;
  }

  async exchangeAuthorizationCode(input: { clientId: string; clientSecret?: string; code: string; codeVerifier: string; redirectUri: string }): Promise<OAuthTokenResponse> {
    let client: IamOAuthClientEntity | undefined;
    let code: IamOAuthAuthorizationCodeEntity | null = null;
    try {
      client = await this.requireEnabledClient(input.clientId);
      await this.verifyClientSecret(client, input.clientSecret);
      code = await (await this.codeRepo()).findOne({ where: { clientId: input.clientId, codeHash: sha256(input.code) } });
      if (!code || code.usedAt || code.expiresAt <= now() || code.redirectUri !== input.redirectUri) throw new BadRequestException('Authorization code is invalid or expired');
      if (!this.matchesPkce(input.codeVerifier, code.codeChallenge)) throw new BadRequestException('PKCE verifier is invalid');
      const userApp = await (await this.userAppRepo()).findOne({ where: { appCode: code.appCode, status: 1, userId: code.userId } });
      if (!userApp) throw new UnauthorizedException('User is not authorized for this application');
      code.usedAt = now();
      await (await this.codeRepo()).save(code);
      const tokens = await this.issueTokens(client, code.userId, code.appCode, code.sessionId);
      await this.recordTokenExchangeAudit('oauth.authorization_code.exchanged', 'success', input.clientId, client.appCode, code.userId);
      return tokens;
    } catch (error) {
      await this.recordTokenExchangeAudit('oauth.authorization_code.exchanged', 'failure', input.clientId, client?.appCode ?? code?.appCode, code?.userId);
      throw error;
    }
  }

  async refresh(input: { clientId: string; clientSecret?: string; refreshToken: string }): Promise<OAuthTokenResponse> {
    let client: IamOAuthClientEntity | undefined;
    let refresh: IamRefreshTokenEntity | null = null;
    try {
      client = await this.requireEnabledClient(input.clientId);
      await this.verifyClientSecret(client, input.clientSecret);
      if (!client.grantTypes.includes('refresh_token')) throw new BadRequestException('Client does not allow refresh_token');
      const repo = await this.refreshRepo();
      refresh = await repo.findOne({ where: { clientId: input.clientId, tokenHash: sha256(input.refreshToken) } });
      if (!refresh || refresh.expiresAt <= now()) throw new BadRequestException('Refresh token is invalid or expired');
      if (refresh.revokedAt) {
        await repo.update({ sessionId: refresh.sessionId }, { revokedAt: now() });
        throw new BadRequestException('Refresh token reuse detected');
      }
      const session = await this.requireSession(refresh.sessionId);
      if (session.userId !== refresh.userId) throw new BadRequestException('Refresh token session is invalid');
      refresh.revokedAt = now();
      await repo.save(refresh);
      const tokens = await this.issueTokens(client, refresh.userId, refresh.appCode, refresh.sessionId, refresh.id);
      await this.recordTokenExchangeAudit('oauth.refresh_token.rotated', 'success', input.clientId, refresh.appCode, refresh.userId);
      return tokens;
    } catch (error) {
      await this.recordTokenExchangeAudit('oauth.refresh_token.rotated', 'failure', input.clientId, client?.appCode ?? refresh?.appCode, refresh?.userId);
      throw error;
    }
  }

  async revoke(input: { clientId: string; clientSecret?: string; token: string }): Promise<void> {
    await this.verifyClientSecret(await this.requireEnabledClient(input.clientId), input.clientSecret);
    const refresh = await (await this.refreshRepo()).findOne({ where: { clientId: input.clientId, tokenHash: sha256(input.token) } });
    if (refresh && !refresh.revokedAt) { refresh.revokedAt = now(); await (await this.refreshRepo()).save(refresh); }
  }

  async logoutSession(sessionId: string): Promise<void> {
    const session = await (await this.sessionRepo()).findOne({ where: { id: sessionId } });
    if (!session || session.revokedAt) return;
    session.revokedAt = now();
    const refreshRepo = await this.refreshRepo();
    const refreshTokens = await refreshRepo.find({ where: { sessionId } });
    for (const refreshToken of refreshTokens) {
      if (!refreshToken.revokedAt) refreshToken.revokedAt = now();
    }
    await Promise.all([
      (await this.sessionRepo()).save(session),
      refreshTokens.length ? refreshRepo.save(refreshTokens) : Promise.resolve(),
    ]);
    await this.audit.record({ action: 'oauth.session.logout', actorUserId: String(session.userId), outcome: 'success' });
  }

  async userInfo(accessToken: string) {
    const claims = this.getAccessTokenClaims(accessToken);
    const user = await (await this.userRepo()).findOne({ where: { id: claims.sub, status: 1 } });
    if (!user) throw new UnauthorizedException('User is unavailable');
    return { name: user.realName, preferred_username: user.username, sub: user.id };
  }

  getJwks() {
    const jwk = this.publicKey.export({ format: 'jwk' }) as JsonWebKey;
    return { keys: [{ ...jwk, alg: 'RS256', kid: this.keyId, use: 'sig' }, ...this.additionalPublicJwks] };
  }

  getOpenIdConfiguration() {
    return {
      authorization_endpoint: `${this.issuer}/oauth/authorize`,
      grant_types_supported: ['authorization_code', 'refresh_token'],
      issuer: this.issuer,
      jwks_uri: `${this.issuer}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      token_endpoint: `${this.issuer}/oauth/token`,
      userinfo_endpoint: `${this.issuer}/oauth/userinfo`,
    };
  }

  getAccessTokenClaims(token: string): IamJwtClaims {
    return this.verifyAccessToken(token);
  }

  private async issueTokens(client: IamOAuthClientEntity, userId: string, appCode: string, sessionId: string, rotatedFromId?: string): Promise<OAuthTokenResponse> {
    const user = await (await this.userRepo()).findOne({ where: { id: userId, status: 1 } });
    if (!user) throw new UnauthorizedException('User is unavailable');
    const timestamp = Math.floor(Date.now() / 1000);
    const access = await this.resolveApplicationAccess(userId, appCode);
    const accessClaims: IamJwtClaims = { app_code: appCode, aud: client.clientId, exp: timestamp + client.accessTokenTtl, home_path: access.homePath ?? undefined, iat: timestamp, iss: this.issuer, name: user.realName, permissions: access.permissions, preferred_username: user.username, roles: access.roles, sid: sessionId, source_user_id: user.sourceUserId ?? undefined, sub: user.id };
    const accessToken = this.signJwt(accessClaims);
    const refreshToken = randomBytes(48).toString('base64url');
    await (await this.refreshRepo()).save((await this.refreshRepo()).create({
      appCode,
      clientId: client.clientId,
      expiresAt: new Date(Date.now() + client.refreshTokenTtl * 1000),
      revokedAt: null,
      rotatedFromId: rotatedFromId ?? null,
      sessionId,
      tokenHash: sha256(refreshToken),
      userId,
    }));
    return { access_token: accessToken, expires_in: client.accessTokenTtl, id_token: this.signJwt({ ...accessClaims, aud: client.clientId }), refresh_token: refreshToken, token_type: 'Bearer' };
  }

  private signJwt(claims: IamJwtClaims): string {
    const header = base64Url(JSON.stringify({ alg: 'RS256', kid: this.keyId, typ: 'JWT' }));
    const payload = base64Url(JSON.stringify(claims));
    const data = `${header}.${payload}`;
    return `${data}.${sign('RSA-SHA256', Buffer.from(data), this.privateKey).toString('base64url')}`;
  }

  private verifyAccessToken(token: string): IamJwtClaims {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) throw new UnauthorizedException('Access token is invalid');
    const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as { alg?: string; kid?: string };
    if (parsedHeader.alg !== 'RS256' || parsedHeader.kid !== this.keyId || !verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), this.publicKey, Buffer.from(signature, 'base64url'))) throw new UnauthorizedException('Access token is invalid');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as IamJwtClaims;
    if (claims.iss !== this.issuer || !claims.sub || !claims.aud || claims.exp <= Math.floor(Date.now() / 1000)) throw new UnauthorizedException('Access token is expired');
    return claims;
  }

  private matchesPkce(verifier: string, challenge: string): boolean {
    const actual = createHash('sha256').update(verifier).digest('base64url');
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(challenge);
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  }

  private async resolveApplicationAccess(userId: string, appCode: string): Promise<{ homePath: null | string; permissions: string[]; roles: string[] }> {
    const dataSource = await this.database.getDataSource();
    const [userApp, userRoles] = await Promise.all([
      dataSource.getRepository(IamUserAppEntity).findOne({ where: { appCode, status: 1, userId } }),
      dataSource.getRepository(IamUserRoleEntity).find({ where: { appCode, userId } }),
    ]);
    if (!userApp) throw new UnauthorizedException('User is not authorized for this application');
    const roleIds = userRoles.map((item) => item.roleId);
    if (!roleIds.length) return { homePath: userApp.homePath, permissions: [], roles: [] };
    const roles = await dataSource.getRepository(IamRoleEntity).findByIds(roleIds);
    const activeRoles = roles.filter((role) => role.appCode === appCode && role.status === 1);
    const activeRoleIds = activeRoles.map((role) => role.id);
    if (!activeRoleIds.length) return { homePath: userApp.homePath, permissions: [], roles: [] };
    const rolePermissions = await dataSource.getRepository(IamRolePermissionEntity).find({ where: { roleId: In(activeRoleIds) } });
    const permissionIds = [...new Set(rolePermissions.map((item) => item.permissionId))];
    const permissions = permissionIds.length === 0 ? [] : await dataSource.getRepository(IamPermissionEntity).findByIds(permissionIds);
    return { homePath: userApp.homePath, permissions: permissions.filter((permission) => permission.appCode === appCode && permission.status === 1).map((permission) => permission.permissionCode).sort(), roles: activeRoles.map((role) => role.roleCode).sort() };
  }

  private async requireEnabledClient(clientId: string) {
    const client = await (await this.clientRepo()).findOne({ where: { clientId, status: 1 } });
    if (!client) throw new BadRequestException('OAuth client is unavailable');
    const app = await (await this.database.getDataSource()).getRepository(IamAppEntity).findOne({
      where: { appCode: client.appCode, status: 1 },
    });
    if (!app) throw new BadRequestException('OAuth application is unavailable');
    return client;
  }

  private async verifyClientSecret(client: IamOAuthClientEntity, suppliedSecret?: string): Promise<void> {
    if (client.clientType === 'public') return;
    if (!client.clientSecretHash || !suppliedSecret || !(await verifyPassword(suppliedSecret, client.clientSecretHash))) {
      throw new UnauthorizedException('OAuth client authentication failed');
    }
  }

  private parseAdditionalPublicJwks(): PublishedJwk[] {
    const raw = process.env.IAM_JWT_ADDITIONAL_PUBLIC_JWKS_JSON?.trim();
    if (!raw) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('IAM_JWT_ADDITIONAL_PUBLIC_JWKS_JSON must be valid JSON');
    }
    if (!Array.isArray(parsed)) throw new Error('IAM_JWT_ADDITIONAL_PUBLIC_JWKS_JSON must be a JSON array');
    const keys = parsed.map((item): PublishedJwk => {
      if (!item || typeof item !== 'object') throw new Error('IAM additional public JWK is invalid');
      const jwk = item as Partial<PublishedJwk>;
      if (jwk.kty !== 'RSA' || typeof jwk.e !== 'string' || typeof jwk.n !== 'string' || typeof jwk.kid !== 'string' || !jwk.kid.trim()) {
        throw new Error('IAM additional public JWK must contain RSA kty, kid, n, and e');
      }
      return { ...jwk, alg: 'RS256', kid: jwk.kid.trim(), use: 'sig' } as PublishedJwk;
    });
    if (keys.some((key) => key.kid === this.keyId) || new Set(keys.map((key) => key.kid)).size !== keys.length) {
      throw new Error('IAM JWKS key IDs must be unique');
    }
    return keys;
  }

  private async recordTokenExchangeAudit(action: string, outcome: 'failure' | 'success', clientId: string, appCode?: string, userId?: string): Promise<void> {
    await this.audit.record({
      action,
      actorUserId: userId,
      appCode,
      clientId,
      outcome,
    });
  }

  private async requireSession(sessionId: string) {
    const session = await (await this.sessionRepo()).findOne({ where: { id: sessionId } });
    if (!session || session.revokedAt || session.expiresAt <= now()) throw new UnauthorizedException('SSO session is invalid or expired');
    return session;
  }

  private async userRepo(): Promise<Repository<IamUserEntity>> { return (await this.database.getDataSource()).getRepository(IamUserEntity); }
  private async userAppRepo(): Promise<Repository<IamUserAppEntity>> { return (await this.database.getDataSource()).getRepository(IamUserAppEntity); }
  private async clientRepo(): Promise<Repository<IamOAuthClientEntity>> { return (await this.database.getDataSource()).getRepository(IamOAuthClientEntity); }
  private async codeRepo(): Promise<Repository<IamOAuthAuthorizationCodeEntity>> { return (await this.database.getDataSource()).getRepository(IamOAuthAuthorizationCodeEntity); }
  private async refreshRepo(): Promise<Repository<IamRefreshTokenEntity>> { return (await this.database.getDataSource()).getRepository(IamRefreshTokenEntity); }
  private async sessionRepo(): Promise<Repository<IamSsoSessionEntity>> { return (await this.database.getDataSource()).getRepository(IamSsoSessionEntity); }
}
