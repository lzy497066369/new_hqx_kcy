import type { RouteRecordRaw } from 'vue-router';
import { getActiveClientPersona, getPersonaHomePath } from '#/auth/client-persona';

// Preserve old bookmarks without exposing a separate workspace page.
const routes: RouteRecordRaw[] = [{
  name: 'Dashboard', path: '/dashboard/workspace',
  redirect: () => getPersonaHomePath(getActiveClientPersona()),
  meta: { hideInMenu: true, title: '总览' },
}];
export default routes;
