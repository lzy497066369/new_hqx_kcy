import { createPublicKey, verify, type JsonWebKey } from 'node:crypto';

export interface IamJwtClaims {
  app_code: string;
  aud: string | string[];
  exp: number;
  iat?: number;
  iss: string;
  name?: string;
  nbf?: number;
  permissions?: string[];
  preferred_username?: string;
  roles?: string[];
  source_user_id?: string;
  sub: string;
}

export interface IamCurrentUser {
  appCode: string;
  id: string;
  permissions: string[];
  realName: string;
  roles: string[];
  sourceUserId?: string;
  username: string;
}

export interface IamJwtVerifierOptions {
  appCode: string;
  audience: string;
  cacheTtlMs?: number;
  fetch?: typeof fetch;
  issuer: string;
  jwksUrl: string;
  requestTimeoutMs?: number;
}

export interface IamCompanyScope {
  companyName: string;
  creditCode?: null | string;
  dataScope: 'all' | 'assigned';
  id: string;
  isDefault: boolean;
  relationType: string;
  sourceCompanyId?: null | string;
  sourceSystem?: null | string;
}

export class IamTokenValidationError extends Error {}

type IamJwk = JsonWebKey & { kid?: string };

export class IamJwtVerifier {
  private cachedJwks: { expiresAt: number; keys: IamJwk[] } | undefined;
  private readonly appCode: string;
  private readonly audience: string;
  private readonly cacheTtlMs: number;
  private readonly fetcher: typeof fetch;
  private readonly issuer: string;
  private readonly jwksUrl: string;
  private readonly requestTimeoutMs: number;

  constructor(options: IamJwtVerifierOptions) {
    if (!options.appCode.trim() || !options.audience.trim() || !options.issuer.trim() || !options.jwksUrl.trim()) {
      throw new Error('IAM appCode, audience, issuer, and jwksUrl are required');
    }
    this.appCode = options.appCode;
    this.audience = options.audience;
    this.cacheTtlMs = options.cacheTtlMs ?? 300_000;
    this.fetcher = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.issuer = options.issuer;
    this.jwksUrl = options.jwksUrl;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 5000;
  }

  async verify(accessToken: string): Promise<IamCurrentUser> {
    const [encodedHeader, encodedPayload, encodedSignature, ...remaining] = accessToken.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature || remaining.length) {
      throw new IamTokenValidationError('IAM access token is invalid');
    }
    const header = decodeJson<{ alg?: string; kid?: string }>(encodedHeader);
    const claims = decodeJson<IamJwtClaims>(encodedPayload);
    if (header.alg !== 'RS256' || !header.kid) {
      throw new IamTokenValidationError('IAM access token algorithm is invalid');
    }
    this.validateClaims(claims);
    const key = (await this.getJwks()).find((item) => item.kid === header.kid);
    if (!key) {
      throw new IamTokenValidationError('IAM access token signature is invalid');
    }
    try {
      if (!verify('RSA-SHA256', Buffer.from(`${encodedHeader}.${encodedPayload}`), createPublicKey({ format: 'jwk', key: key as JsonWebKey }), Buffer.from(encodedSignature, 'base64url'))) {
        throw new IamTokenValidationError('IAM access token signature is invalid');
      }
    } catch (error) {
      if (error instanceof IamTokenValidationError) throw error;
      throw new IamTokenValidationError('IAM access token signature is invalid');
    }
    return {
      appCode: claims.app_code,
      id: claims.source_user_id ?? claims.sub,
      permissions: claims.permissions ?? [],
      realName: claims.name ?? claims.preferred_username ?? '',
      roles: claims.roles ?? [],
      sourceUserId: claims.source_user_id,
      username: claims.preferred_username ?? '',
    };
  }

  private async getJwks(): Promise<IamJwk[]> {
    if (this.cachedJwks && this.cachedJwks.expiresAt > Date.now()) return this.cachedJwks.keys;
    let response: Response;
    try {
      response = await fetchWithTimeout(this.fetcher, this.jwksUrl, undefined, this.requestTimeoutMs);
    } catch {
      throw new IamTokenValidationError('IAM JWKS is unavailable');
    }
    if (!response.ok) throw new IamTokenValidationError('IAM JWKS is unavailable');
    let body: { keys?: IamJwk[] };
    try {
      body = await response.json() as { keys?: IamJwk[] };
    } catch {
      throw new IamTokenValidationError('IAM JWKS is invalid');
    }
    if (!body.keys?.length) throw new IamTokenValidationError('IAM JWKS is invalid');
    this.cachedJwks = { expiresAt: Date.now() + this.cacheTtlMs, keys: body.keys };
    return body.keys;
  }

  private validateClaims(claims: IamJwtClaims): void {
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const timestamp = Math.floor(Date.now() / 1000);
    if (!claims.sub || !claims.exp || claims.exp <= timestamp || (claims.nbf && claims.nbf > timestamp) || claims.iss !== this.issuer || !audiences.includes(this.audience) || claims.app_code !== this.appCode) {
      throw new IamTokenValidationError('IAM access token claims are invalid or expired');
    }
  }
}

export class IamCompanyContextClient {
  private readonly appCode: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly requestTimeoutMs: number;

  constructor(options: { appCode: string; baseUrl: string; fetch?: typeof fetch; requestTimeoutMs?: number }) {
    if (!options.appCode.trim() || !options.baseUrl.trim()) throw new Error('IAM appCode and baseUrl are required');
    this.appCode = options.appCode;
    this.baseUrl = options.baseUrl.replace(/\/$/u, '');
    this.fetcher = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.requestTimeoutMs = options.requestTimeoutMs ?? 5000;
  }

  async listCompanies(accessToken: string): Promise<IamCompanyScope[]> {
    const response = await fetchWithTimeout(this.fetcher, `${this.baseUrl}/iam/me/apps/${encodeURIComponent(this.appCode)}/companies`, {
      headers: { authorization: `Bearer ${accessToken}` },
    }, this.requestTimeoutMs);
    if (!response.ok) throw new Error('IAM company context is unavailable');
    const body = await response.json();
    if (!Array.isArray(body)) throw new Error('IAM company context is invalid');
    return body as IamCompanyScope[];
  }

  async setDefaultCompany(accessToken: string, iamCompanyId: string): Promise<IamCompanyScope[]> {
    const response = await fetchWithTimeout(this.fetcher, `${this.baseUrl}/iam/me/apps/${encodeURIComponent(this.appCode)}/companies/${encodeURIComponent(iamCompanyId)}/default`, {
      headers: { authorization: `Bearer ${accessToken}` },
      method: 'PUT',
    }, this.requestTimeoutMs);
    if (!response.ok) throw new Error('IAM default company update failed');
    const body = await response.json();
    if (!Array.isArray(body)) throw new Error('IAM company context is invalid');
    return body as IamCompanyScope[];
  }

}

function decodeJson<T>(segment: string): T {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T;
  } catch {
    throw new IamTokenValidationError('IAM access token is invalid');
  }
}

async function fetchWithTimeout(fetcher: typeof fetch, input: string, init: RequestInit | undefined, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
