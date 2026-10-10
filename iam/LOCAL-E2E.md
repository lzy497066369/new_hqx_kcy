# IAM Local E2E

The normal business backend on port `3000` may remain in local-auth migration mode.
Use a separate business backend process for IAM JWT acceptance testing so local work is not interrupted.

Terminal 1:

```powershell
Set-Location backend
npm run start:iam-client-e2e
```

This starts an isolated client-portal backend on `http://127.0.0.1:3112` with:

- `IAM_AUTH_MODE=jwt`
- application `kjqb_client`
- audience `kjqb_client_web`
- issuer and JWKS at `http://localhost:3101`
- company source system `hqx_kjqb`

Terminal 2:

```powershell
Set-Location iam/iam_backend
npm run verify:business-sso-e2e
```

The verifier creates and removes a temporary IAM user, checks OAuth Authorization Code + PKCE, validates the JWT through the isolated business backend, checks the IAM company context, refresh-token rotation, and unified logout.

For a single-command local verification, run this from the workspace backend directory instead. It starts and stops its own isolated backend and refuses to run when port `3112` is already occupied:

```powershell
Set-Location backend
npm run verify:iam-client-e2e
```

## Browser redirect check

To verify the client frontend redirects to IAM instead of showing a local-password flow:

```powershell
Set-Location vue-admin
$env:VITE_AUTH_MODE = 'iam'
pnpm --filter @vben/web-client dev --host 127.0.0.1
```

Open `http://localhost:5998`, select login, and confirm the browser reaches the IAM login page with `client_id=kjqb_client_web`, the registered callback URL, and `code_challenge_method=S256`. The browser host must exactly match the registered callback host because PKCE state is stored in origin-scoped session storage.

To use another source system, start the isolated backend with:

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/start-iam-client-e2e.ps1 -CompanySourceSystem your_source_system
```
