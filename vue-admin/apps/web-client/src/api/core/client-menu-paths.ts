import type { RouteRecordStringComponent } from '@vben/types';

/** Local and IAM menus must share the same canonical landing path. */
export function normalizeClientMenuPaths(
  menus: RouteRecordStringComponent[],
): RouteRecordStringComponent[] {
  const homePath = (path: string | undefined) =>
    path === '/home' || path === '/client/home' ? '/dashboard/workspace' : path;
  return menus.map((menu) => ({
    ...menu,
    children: menu.children
      ? normalizeClientMenuPaths(menu.children)
      : undefined,
    path: homePath(menu.path)!,
    redirect:
      typeof menu.redirect === 'string'
        ? homePath(menu.redirect)
        : menu.redirect,
    meta: ['ClientHome', 'Dashboard'].includes(String(menu.name))
      ? { ...menu.meta, title: '企业服务进度' }
      : menu.meta,
  }));
}
