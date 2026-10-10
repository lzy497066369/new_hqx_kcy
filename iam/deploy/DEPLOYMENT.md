# IAM Production Deployment

This directory deploys the standalone IAM backend and administration frontend. It assumes that MySQL is operated separately and that HTTPS is terminated by the platform gateway, load balancer, or an outer Nginx instance.

## Prerequisites

1. Use a dedicated MySQL schema and a least-privileged service account for IAM.
2. Configure a stable external HTTPS URL, such as `https://iam.example.com`.
3. Generate one stable RSA private key and keep its base64 value in the deployment secret store. Do not rotate this key during an ordinary restart.
4. Register each business frontend callback URL exactly in the IAM OAuth client configuration.

## Build And Start

```powershell
Set-Location iam/iam_backend
npm run build

Set-Location ..\iam_frontend
npm run typecheck
npm run build

Set-Location ..\deploy
Copy-Item .env.production.example .env.production
```

Fill `.env.production` from the secret store. At minimum, configure `IAM_ISSUER`, `IAM_CORS_ORIGIN`, `IAM_JWT_PRIVATE_KEY_BASE64`, and `IAM_DB_*`.

Apply database changes explicitly before starting the new version:

```powershell
docker compose --env-file .env.production run --rm iam-backend node scripts/migrate-iam-schema.cjs
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
```

The frontend listens on `IAM_HTTP_PORT` (default `8081`) and proxies the administration API (`/api/*`) plus the public IAM protocol routes (`/oauth/*`, `/.well-known/*`, `/iam/*`, and `/health`) to the backend container. Configure the outer HTTPS gateway to send the public IAM hostname to this port and preserve `Host` plus `X-Forwarded-*` headers.

## Post-Deployment Checks

```powershell
Invoke-WebRequest https://iam.example.com/health
Invoke-WebRequest https://iam.example.com/.well-known/jwks.json
```

Then verify an IAM administrator login, one OAuth authorization-code PKCE login from each business application, token refresh, logout, and a company-scope protected business API call.

## JWT Key Rotation

Keep the active private key in `IAM_JWT_PRIVATE_KEY_BASE64` and its identifier in `IAM_JWT_KEY_ID`. The optional `IAM_JWT_ADDITIONAL_PUBLIC_JWKS_JSON` setting contains only retired public JWKs; IAM publishes them together with the active key so business services can continue to verify access tokens issued before the rotation.

1. Generate a new RSA key pair and choose a new key ID.
2. Put the previous active public JWK in `IAM_JWT_ADDITIONAL_PUBLIC_JWKS_JSON`.
3. Deploy the new private key and key ID, then verify `/.well-known/jwks.json` contains both key IDs.
4. Wait for the maximum access-token TTL plus every business service's JWKS cache TTL.
5. Remove the retired public JWK and deploy once more.

Never place a private key in `IAM_JWT_ADDITIONAL_PUBLIC_JWKS_JSON`, and never reuse a key ID.

## Rollback

Keep the previous image tag until post-deployment checks pass. To roll back application code, redeploy the previous image tag while preserving the IAM database and RSA key. Database migrations are additive and must be reviewed before any schema rollback; do not delete IAM tables as part of an application rollback.
