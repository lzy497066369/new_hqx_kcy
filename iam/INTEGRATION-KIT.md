# IAM System Integration Kit

> 中文实施入口：[接入实施指南](./docs/IAM-接入实施指南.md) | [接口参考](./docs/IAM-接口参考.md) | [上线验收清单](./docs/IAM-上线验收清单.md)

本文件用于接入第二个及后续业务系统。IAM 负责身份、应用访问、角色权限、菜单和公司范围；业务系统继续负责自己的业务数据与业务规则。

## Reusable Packages

| Package | Purpose | Entry |
| --- | --- | --- |
| `@kjqb/iam-spa-sdk` | Browser OAuth Authorization Code + PKCE, refresh rotation, logout | `iam/packages/iam-spa-sdk` |
| `@kjqb/iam-node-sdk` | Node JWT/JWKS verification and IAM company context calls | `iam/packages/iam-node-sdk` |

The existing `web-admin` and `web-client` IAM adapters now consume the shared SPA SDK, and the current business backend consumes the shared Node verifier. New systems should import the packages directly instead of copying either adapter.

Before publishing these packages to a private registry, another repository can consume their built output with a file dependency:

```json
{
  "dependencies": {
    "@kjqb/iam-node-sdk": "file:../new_kjqb/iam/packages/iam-node-sdk",
    "@kjqb/iam-spa-sdk": "file:../new_kjqb/iam/packages/iam-spa-sdk"
  }
}
```

Build the package before the consuming project installs it:

```powershell
Set-Location iam/packages/iam-spa-sdk
npm test

Set-Location ../iam-node-sdk
npm test
```

## Application Registration

Create one IAM application and one public OAuth client for each browser application. Redirect URIs must be exact, including scheme, host, port, and path.

Example for a second system:

| Field | Example |
| --- | --- |
| Application code | `second_system` |
| OAuth client ID | `second_system_web` |
| Frontend callback | `https://second.example.com/auth/callback` |
| Default home path | `/workspace` |
| Business portal | `admin` or `client` |
| Company range | `yes` when business data belongs to a company |

Register roles, permissions, and menus under this application only. Do not reuse `iam_admin/super_admin` as a business-system bypass role.

## SPA Integration

Set the frontend environment variables:

```env
VITE_AUTH_MODE=iam
VITE_IAM_ISSUER=https://iam.example.com
VITE_IAM_CLIENT_ID=second_system_web
VITE_IAM_REDIRECT_URI=https://second.example.com/auth/callback
VITE_APP_CODE=second_system
```

Create one SDK instance at application startup. Store the returned access token in the application's existing access store; the SDK keeps only the rotating refresh token in the storage supplied by the caller.

```ts
import { IamSpaClient } from '@kjqb/iam-spa-sdk';

const iam = new IamSpaClient({
  clientId: import.meta.env.VITE_IAM_CLIENT_ID,
  issuer: import.meta.env.VITE_IAM_ISSUER,
  redirectUri: import.meta.env.VITE_IAM_REDIRECT_URI,
  storage: sessionStorage,
});

export async function startLogin(redirect: string) {
  window.location.assign(await iam.createAuthorizationUrl(redirect));
}

export async function finishLogin() {
  return iam.finishAuthorization(window.location.href);
}

export async function refreshAccessToken() {
  return iam.refresh();
}

export async function logout() {
  await iam.logout();
}
```

On callback, validate `state` through `finishLogin`, update the application's access token, then fetch IAM permissions, menus, and companies. On one `401`, call `refreshAccessToken` and retry once. The SDK serializes concurrent refresh calls so a rotating refresh token is not reused.

## Node Backend Integration

Set the backend environment variables:

```env
IAM_ISSUER=https://iam.example.com
IAM_JWKS_URL=https://iam.example.com/.well-known/jwks.json
IAM_APP_CODE=second_system
IAM_CLIENT_ID=second_system_web
IAM_CONTEXT_URL=https://iam.example.com
IAM_CONTEXT_TIMEOUT_MS=5000
```

Create a process-wide verifier and verify every bearer token before routing to the business handler:

```ts
import { IamCompanyContextClient, IamJwtVerifier } from '@kjqb/iam-node-sdk';

const verifier = new IamJwtVerifier({
  appCode: process.env.IAM_APP_CODE!,
  audience: process.env.IAM_CLIENT_ID!,
  issuer: process.env.IAM_ISSUER!,
  jwksUrl: process.env.IAM_JWKS_URL!,
});

const companies = new IamCompanyContextClient({
  appCode: process.env.IAM_APP_CODE!,
  baseUrl: process.env.IAM_CONTEXT_URL ?? process.env.IAM_ISSUER!,
});

const currentUser = await verifier.verify(accessToken);
const scopes = await companies.listCompanies(accessToken);
```

Use `currentUser.permissions` for endpoint permission checks. For a company-owned resource, allow all only when a scope has `dataScope === 'all'`; otherwise require the resource company ID to match one of the `sourceCompanyId` values. `all` applies only to the active application's `companySourceSystem`, which must be configured when systems share IAM but own different company directories. A business backend must fail closed when IAM company context cannot be loaded.

## Integration Checklist

Copy this block into the implementation issue for every new system.

```text
System name:
Application code:
Frontend URL:
Backend URL:
OAuth client ID:
Redirect URI:
Post logout redirect URI:
Default home path:
Portal: admin / client
Requires company range: yes / no
Company source system:
Initial roles:
Initial permissions:
Initial menus:
Owner responsible for IAM registration:
Owner responsible for business migration:
Rollback owner:
```

## Acceptance

1. An unauthenticated visit redirects to IAM and returns through the registered callback.
2. A pre-existing IAM SSO session returns without another password prompt.
3. The business backend rejects a token with a different issuer, audience, or application code.
4. Permissions and IAM menus match the assigned business role.
5. A user cannot access an unassigned company, while `dataScope=all` behaves as documented.
6. The business service obtains only company access scopes from IAM; internal platform departments are not a company data scope.
7. Changing the default company is persisted by IAM and reflected by the business system.
8. Refresh rotation, logout, and an expired refresh token return the user to IAM login.
9. The business system no longer exposes its own user, role, permission, menu, or company-scope administration path.
