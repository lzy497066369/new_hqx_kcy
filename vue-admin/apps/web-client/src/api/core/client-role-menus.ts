import type { RouteRecordStringComponent } from '@vben/types';

import type { ClientPersona } from '#/auth/client-persona';

const ENTERPRISE_FLOW_PATHS = new Set([
  '/dashboard/workspace',
  '/client/home',
  '/client/company',
  '/client/company-switch',
  '/client/company/basic',
  '/client/company/contacts',
  '/client/company/materials',
  '/client/company/tax',
  '/client/company/employees',
  '/client/company/property',
  '/client/company/contract',
  '/client/company/document',
  '/client/company/certificates',
  '/client/company/photos',
  '/policy/library',
  '/projects',
  '/projects/list',
  '/projects/my',
  '/projects/detail/:id',
  '/projects/my/detail/:id',
  '/projects/:id',
  '/projects/my/:id',
]);

function normalize(path?: string) {
  return (path ?? '').replace(/\/$/u, '') || '/';
}

/** Keep client menus within the selected business persona. */
export function filterClientMenusByPersona(
  menus: RouteRecordStringComponent[],
  persona: ClientPersona,
): RouteRecordStringComponent[] {
  const allowed = persona === 'enterprise'
    ? new Set([...ENTERPRISE_FLOW_PATHS, '/client/enterprise-receipts'])
    : new Set(['/governance/overview']);
  allowed.add('/dashboard/workspace');

  function filter(nodes: RouteRecordStringComponent[]): RouteRecordStringComponent[] {
    return nodes.flatMap((node) => {
      const children = node.children ? filter(node.children) : [];
      const path = normalize(node.path);
      const keepSelf = allowed.has(path);
      if (!keepSelf && children.length === 0) return [];
      return [{ ...node, children: children.length ? children : undefined }];
    });
  }

  return filter(menus);
}
