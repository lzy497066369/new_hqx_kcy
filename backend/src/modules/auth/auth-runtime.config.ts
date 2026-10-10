export const DEFAULT_AUTH_APP_CODE = 'kjqb';

export type AuthTokenMode = 'dual' | 'jwt' | 'legacy';
export type AuthSessionStore = 'memory' | 'redis';

export interface AuthRuntimeConfig {
  appCode: string;
  sessionStore: AuthSessionStore;
  ssoEnabled: boolean;
  tokenMode: AuthTokenMode;
  clientOnly: boolean;
}

const ENABLED_VALUES = new Set(['1', 'on', 'true', 'yes']);
const TOKEN_MODES = new Set<AuthTokenMode>(['dual', 'jwt', 'legacy']);
const SESSION_STORES = new Set<AuthSessionStore>(['memory', 'redis']);

export function resolveAuthRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AuthRuntimeConfig {
  const configuredMode = environment.AUTH_TOKEN_MODE?.trim().toLowerCase();
  const configuredSessionStore = environment.AUTH_SESSION_STORE?.trim().toLowerCase();

  return {
    appCode: environment.AUTH_APP_CODE?.trim() || DEFAULT_AUTH_APP_CODE,
    sessionStore: SESSION_STORES.has(configuredSessionStore as AuthSessionStore)
      ? (configuredSessionStore as AuthSessionStore)
      : 'memory',
    ssoEnabled: ENABLED_VALUES.has(
      environment.AUTH_SSO_ENABLED?.trim().toLowerCase() ?? '',
    ),
    tokenMode: TOKEN_MODES.has(configuredMode as AuthTokenMode)
      ? (configuredMode as AuthTokenMode)
      : 'legacy',
    // 方案 C：系统只保留客户端入口，管理端登录默认关闭。
    clientOnly: !['0', 'off', 'false', 'no'].includes(
      environment.AUTH_CLIENT_ONLY?.trim().toLowerCase() ?? 'true',
    ),
  };
}
