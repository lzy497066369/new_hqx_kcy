export interface AuthJwtConfig {
  issuer: string;
  keyId: string;
  privateKey?: string;
  publicKey?: string;
}

export function resolveAuthJwtConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AuthJwtConfig {
  return {
    issuer: environment.AUTH_JWT_ISSUER?.trim() || 'kjqb-auth',
    keyId: environment.AUTH_JWT_KEY_ID?.trim() || 'kjqb-auth-2026-01',
    privateKey: normalizeKey(environment.AUTH_JWT_PRIVATE_KEY),
    publicKey: normalizeKey(environment.AUTH_JWT_PUBLIC_KEY),
  };
}

function normalizeKey(value?: string): string | undefined {
  const key = value?.trim();
  return key ? key.replace(/\\n/g, '\n') : undefined;
}
