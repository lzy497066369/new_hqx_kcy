export interface RedisRuntimeConfig {
  connectTimeoutMs: number;
  enabled: boolean;
  keyPrefix: string;
  url?: string;
}

const ENABLED_VALUES = new Set(['1', 'on', 'true', 'yes']);

export function resolveRedisRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): RedisRuntimeConfig {
  const enabled = ENABLED_VALUES.has(
    environment.REDIS_ENABLED?.trim().toLowerCase() ?? '',
  );
  const connectTimeoutMs = positiveInteger(
    environment.REDIS_CONNECT_TIMEOUT_MS,
    1_500,
  );

  return {
    connectTimeoutMs,
    enabled,
    keyPrefix: environment.REDIS_KEY_PREFIX?.trim() || 'kjqb:auth:',
    url: enabled ? resolveRedisUrl(environment) : undefined,
  };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveRedisUrl(environment: NodeJS.ProcessEnv): string | undefined {
  const configuredUrl = environment.REDIS_URL?.trim();
  if (configuredUrl) return configuredUrl;

  const host = environment.REDIS_HOST?.trim();
  if (!host) return undefined;

  const url = new URL('redis://localhost');
  url.hostname = host;
  url.port = String(positiveInteger(environment.REDIS_PORT, 6379));
  if (environment.REDIS_PASSWORD) {
    url.password = environment.REDIS_PASSWORD;
  }
  if (environment.REDIS_DATABASE) {
    url.pathname = `/${positiveInteger(environment.REDIS_DATABASE, 0)}`;
  }
  return url.toString();
}
