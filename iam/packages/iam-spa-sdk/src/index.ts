export interface IamAccessClaims {
  app_code?: string;
  aud?: string | string[];
  exp?: number;
  home_path?: string;
  name?: string;
  permissions?: string[];
  preferred_username?: string;
  roles?: string[];
  sub?: string;
}

export interface IamSpaStorage {
  getItem(key: string): null | string;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface IamSpaClientOptions {
  clientId: string;
  fetch?: typeof fetch;
  issuer: string;
  redirectUri: string;
  storage: IamSpaStorage;
}

export interface IamAuthorizationResult {
  accessToken: string;
  claims: IamAccessClaims;
  redirect: string;
}

interface IamTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
}

export class IamSpaClient {
  private refreshPromise: Promise<string> | undefined;
  private readonly clientId: string;
  private readonly fetcher: typeof fetch;
  private readonly issuer: string;
  private readonly redirectUri: string;
  private readonly storage: IamSpaStorage;
  private readonly storagePrefix: string;

  constructor(options: IamSpaClientOptions) {
    if (!options.clientId.trim() || !options.issuer.trim() || !options.redirectUri.trim()) {
      throw new Error('IAM clientId, issuer, and redirectUri are required');
    }
    this.clientId = options.clientId.trim();
    this.fetcher = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.issuer = options.issuer.replace(/\/$/u, '');
    this.redirectUri = options.redirectUri;
    this.storage = options.storage;
    this.storagePrefix = `iam-sso:${this.clientId}:`;
  }

  async createAuthorizationUrl(redirect = '', loginType?: string): Promise<string> {
    const state = randomValue();
    const verifier = randomValue();
    const url = new URL(`${this.issuer}/oauth/authorize`);
    url.searchParams.set('response_type', 'code');
    if (loginType && ['enterprise', 'region', 'overall'].includes(loginType)) {
      url.searchParams.set('login_type', loginType);
    }
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('scope', 'openid profile permissions');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', await sha256Base64Url(verifier));
    url.searchParams.set('code_challenge_method', 'S256');
    this.storage.setItem(this.key('state'), state);
    this.storage.setItem(this.key('verifier'), verifier);
    this.storage.setItem(this.key('redirect'), redirect);
    return url.toString();
  }

  async finishAuthorization(callbackUrl: string): Promise<IamAuthorizationResult> {
    const callback = new URL(callbackUrl);
    const code = callback.searchParams.get('code');
    const state = callback.searchParams.get('state');
    const expectedState = this.storage.getItem(this.key('state'));
    const verifier = this.storage.getItem(this.key('verifier'));
    if (!code || !state || !verifier || state !== expectedState) {
      throw new Error('IAM authorization response is invalid');
    }
    const payload = await this.requestToken({
      client_id: this.clientId,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
    });
    const redirect = this.storage.getItem(this.key('redirect')) ?? '';
    this.storage.removeItem(this.key('state'));
    this.storage.removeItem(this.key('verifier'));
    this.storage.removeItem(this.key('redirect'));
    const accessToken = this.saveTokenResponse(payload);
    return { accessToken, claims: decodeIamAccessToken(accessToken), redirect };
  }

  async refresh(): Promise<string> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshInternal().finally(() => {
        this.refreshPromise = undefined;
      });
    }
    return this.refreshPromise;
  }

  async logout(): Promise<void> {
    const refreshToken = this.storage.getItem(this.key('refresh-token'));
    try {
      await this.fetcher(`${this.issuer}/oauth/logout`, {
        credentials: 'include',
        method: 'POST',
      });
      if (refreshToken) {
        await this.fetcher(`${this.issuer}/oauth/revoke`, {
          body: JSON.stringify({ client_id: this.clientId, token: refreshToken }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        });
      }
    } finally {
      this.storage.removeItem(this.key('refresh-token'));
    }
  }

  private async refreshInternal(): Promise<string> {
    const refreshToken = this.storage.getItem(this.key('refresh-token'));
    if (!refreshToken) throw new Error('IAM refresh token is unavailable');
    return this.saveTokenResponse(await this.requestToken({
      client_id: this.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }));
  }

  private key(name: string): string {
    return `${this.storagePrefix}${name}`;
  }

  private async requestToken(body: Record<string, string>): Promise<IamTokenResponse> {
    const response = await this.fetcher(`${this.issuer}/oauth/token`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const payload = await parseJson(response);
    if (!response.ok || !payload.access_token || !payload.refresh_token) {
      throw new Error(payload.message ?? 'IAM token request failed');
    }
    return payload;
  }

  private saveTokenResponse(payload: IamTokenResponse): string {
    if (!payload.access_token || !payload.refresh_token) throw new Error('IAM token response is invalid');
    this.storage.setItem(this.key('refresh-token'), payload.refresh_token);
    return payload.access_token;
  }
}

export function decodeIamAccessToken(token: string): IamAccessClaims {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('IAM access token is invalid');
  try {
    return JSON.parse(decodeBase64Url(payload)) as IamAccessClaims;
  } catch {
    throw new Error('IAM access token is invalid');
  }
}

async function parseJson(response: Response): Promise<IamTokenResponse & { message?: string }> {
  try {
    return await response.json() as IamTokenResponse & { message?: string };
  } catch {
    return {};
  }
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return atob(padded);
}

function base64Url(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function randomValue(): string {
  const bytes = new Uint8Array(48);
  globalThis.crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256Base64Url(value: string): Promise<string> {
  return base64Url(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}
