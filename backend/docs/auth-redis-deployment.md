# Auth Redis Deployment

Stage 1 keeps the current memory session store active. Redis is installed and monitored now so the session store can be switched without changing infrastructure.

## Start Redis

```powershell
$env:REDIS_PASSWORD = 'replace-with-a-long-random-password'
docker compose -f deploy/redis/docker-compose.yml up -d
```

The manifest binds Redis only to `127.0.0.1`. When the backend runs in a separate container network, remove the host port binding and use the Redis service hostname instead.

## Backend Configuration

```env
REDIS_ENABLED=true
REDIS_URL=redis://:replace-with-a-long-random-password@127.0.0.1:6379/0
REDIS_KEY_PREFIX=kjqb:auth:
REDIS_CONNECT_TIMEOUT_MS=1500
AUTH_SESSION_STORE=memory
```

`REDIS_ENABLED` and `AUTH_SESSION_STORE` default to `false` and `memory`, so current login behavior is unchanged. After Redis connectivity is verified, switch both settings together:

```env
REDIS_ENABLED=true
AUTH_SESSION_STORE=redis
```

The backend rejects `AUTH_SESSION_STORE=redis` when Redis is disabled. Redis-backed sessions use separate access and refresh indexes, expire server-side, and consume a refresh token once during rotation. Switching stores invalidates existing in-memory sessions after the process restarts, so deploy it as a planned login transition. Check the configured connection with `GET /health/redis` before enabling the shared store.

## JWT mode

Generate an RS256 key pair and configure both PEM values on the authentication backend. Keep the private key only on the authentication backend; other systems need the public key from `GET /auth/jwks.json`.

```env
AUTH_TOKEN_MODE=dual
AUTH_SESSION_STORE=redis
AUTH_JWT_ISSUER=kjqb-auth
AUTH_JWT_KEY_ID=kjqb-auth-2026-01
AUTH_JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----
AUTH_JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----
```

`dual` accepts old random access tokens while issuing RS256 tokens for new Redis sessions. `jwt` rejects old token formats. Both modes require Redis and both keys at application startup.
