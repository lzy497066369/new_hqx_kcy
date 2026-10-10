import { getActiveClientPersona, getPersonaHomePath } from './client-persona';

// 登录返回根路径时直接进入当前身份首页，避免再次跳到未注册的旧首页。
const LEGACY_HOMES = new Set(['/', '/home', '/client', '/client/home', '/dashboard/workspace', '/client/company', '/client/enterprise-receipts', '/governance/overview']);
export function resolveClientHomePath(path: null | string | undefined): string {
  let decoded = path || '';
  try { decoded = decodeURIComponent(decoded); } catch { /* Fall back safely on malformed legacy URLs. */ }
  return !decoded || LEGACY_HOMES.has(decoded)
    ? getPersonaHomePath(getActiveClientPersona())
    : decoded;
}
