import { IamSpaClient, type IamAccessClaims } from '../../../../../iam/packages/iam-spa-sdk/src/index';

export type { IamAccessClaims } from '../../../../../iam/packages/iam-spa-sdk/src/index';

let iamClient: IamSpaClient | undefined;

export function isIamAuthEnabled(): boolean {
  return import.meta.env.VITE_AUTH_MODE === 'iam';
}

export async function startIamAuthorization(redirect?: string): Promise<void> {
  window.location.assign(await getIamClient().createAuthorizationUrl(redirect));
}

export async function finishIamAuthorization(): Promise<{ accessToken: string; claims: IamAccessClaims; redirect: string }> {
  return getIamClient().finishAuthorization(window.location.href);
}

export async function refreshIamAuthorization(): Promise<string> {
  return getIamClient().refresh();
}

export async function logoutIamSession(): Promise<void> {
  await getIamClient().logout();
}

function clientId(): string { return import.meta.env.VITE_IAM_CLIENT_ID; }
function issuer(): string { return String(import.meta.env.VITE_IAM_ISSUER).replace(/\/$/, ''); }
function resolveCallbackUri(): string { return import.meta.env.VITE_IAM_REDIRECT_URI || `${window.location.origin}/auth/callback`; }
function getIamClient(): IamSpaClient {
  return iamClient ??= new IamSpaClient({ clientId: clientId(), issuer: issuer(), redirectUri: resolveCallbackUri(), storage: sessionStorage });
}
