import type { ComponentRecordType, GenerateMenuAndRoutesOptions } from '@vben/types';
import type { RouteRecordRaw } from 'vue-router';

import { generateAccessible } from '@vben/access';

import { BasicLayout, IFrameView } from '#/layouts';
import { getActiveClientPersona } from '#/auth/client-persona';

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');

function getAllowedNames() {
  return getActiveClientPersona() === 'enterprise'
    ? new Set(['Dashboard', 'ClientEnterpriseReceipts', 'ClientHighTechApplication', 'ClientHighTechSelfAssessment'])
    : new Set(['Dashboard', 'ClientGovernanceOverview', 'ClientGovernanceRegions', 'ClientGovernanceAccounts', 'ClientGovernanceEnterprises']);
}

function getClientRoutesForPersona(routes: GenerateMenuAndRoutesOptions['routes']) {
  const allowedNames = getAllowedNames();
  return (routes as RouteRecordRaw[]).flatMap((route) => {
    if (!route.name || !allowedNames.has(String(route.name))) return [];
    return [route];
  });
}

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  const pageMap: ComponentRecordType = import.meta.glob('../views/**/*.vue');
  const layoutMap: ComponentRecordType = { BasicLayout, IFrameView };
  return await generateAccessible('frontend', {
    ...options,
    forbiddenComponent,
    layoutMap,
    pageMap,
    routes: getClientRoutesForPersona(options.routes),
  });
}

export { generateAccess, getAllowedNames };
