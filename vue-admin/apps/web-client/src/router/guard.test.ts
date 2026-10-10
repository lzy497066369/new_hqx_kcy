import type { RouteRecordRaw, Router } from 'vue-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import { setActiveClientPersona } from '../auth/client-persona';
import { createRouterGuard } from './guard';
import { coreRoutes, fallbackNotFoundRoute } from './routes/core';

const { accessStore, userStore } = vi.hoisted(() => ({
  accessStore: {
    accessToken: '',
    isAccessChecked: false,
    setAccessMenus: vi.fn(),
    setAccessRoutes: vi.fn(),
    setIsAccessChecked(value: boolean) {
      this.isAccessChecked = value;
    },
  },
  userStore: {
    userInfo: { homePath: '/home', roles: ['enterprise_owner'] },
  },
}));

vi.mock('@vben/constants', () => ({ LOGIN_PATH: '/auth/login' }));
vi.mock('@vben/preferences', () => ({
  preferences: {
    app: { defaultHomePath: '/client/company' },
    transition: { progress: false },
  },
}));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => accessStore,
  useUserStore: () => userStore,
}));
vi.mock('@vben/utils', () => ({ startProgress: vi.fn(), stopProgress: vi.fn() }));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/store', () => ({ useAuthStore: () => ({}) }));
vi.mock('#/router/routes', () => ({
  accessRoutes: [],
  coreRouteNames: ['Root', 'Authentication', 'Login', 'IamCallback'],
}));
vi.mock('./access', () => ({
  generateAccess: vi.fn(async ({ router }: { router: Router }) => {
    router.addRoute('Root', {
      component: {},
      name: 'ClientEnterpriseReceipts',
      path: '/client/enterprise-receipts',
    });
    router.addRoute('Root', {
      component: {},
      name: 'ClientHighTechApplication',
      path: '/client/enterprise-receipts/:companyId/high-tech',
    });
    return { accessibleMenus: [], accessibleRoutes: [] };
  }),
}));

// Keep the actual core redirects, replacing only page components for this test.
function stubComponents(routes: RouteRecordRaw[]): RouteRecordRaw[] {
  return routes.map((route) => ({
    ...route,
    component: {},
    children: route.children ? stubComponents(route.children) : undefined,
  }) as RouteRecordRaw);
}

function setupRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: stubComponents([...coreRoutes, fallbackNotFoundRoute]),
  });
  createRouterGuard(router);
  return router;
}

const enterpriseHome = '/client/enterprise-receipts';

describe('enterprise login navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessStore.accessToken = '';
    accessStore.isAccessChecked = false;
    setActiveClientPersona('enterprise');
  });

  it.each(['/', '/home', '/client/company', enterpriseHome])(
    'lands on the enterprise home without reloading when redirect is %s',
    async (redirect) => {
      const router = setupRouter();
      await router.push({
        path: '/auth/login',
        query: { redirect: encodeURIComponent(redirect) },
      });
      accessStore.accessToken = 'test-token';
      await router.push(enterpriseHome);

      expect(router.currentRoute.value.name).toBe('ClientEnterpriseReceipts');
      expect(router.currentRoute.value.fullPath).toBe(enterpriseHome);
      expect(accessStore.isAccessChecked).toBe(true);
    },
  );

  it('resolves a root redirect when opening login with an existing session', async () => {
    const router = setupRouter();
    accessStore.accessToken = 'test-token';
    await router.push('/auth/login?redirect=%252F');

    expect(router.currentRoute.value.name).toBe('ClientEnterpriseReceipts');
  });

  it.each(['/', '/client/company', enterpriseHome])(
    'opens the enterprise home after refreshing %s',
    async (path) => {
      const router = setupRouter();
      accessStore.accessToken = 'test-token';
      await router.push(path);

      expect(router.currentRoute.value.name).toBe('ClientEnterpriseReceipts');
      expect(router.currentRoute.value.fullPath).toBe(enterpriseHome);
    },
  );

  it('preserves a valid deep link with its query and hash after login', async () => {
    const router = setupRouter();
    const redirect = `${enterpriseHome}/42/high-tech?section=basic#details`;
    await router.push({
      path: '/auth/login',
      query: { redirect: encodeURIComponent(redirect) },
    });
    accessStore.accessToken = 'test-token';
    await router.push(enterpriseHome);

    expect(router.currentRoute.value.name).toBe('ClientHighTechApplication');
    expect(router.currentRoute.value.fullPath).toBe(redirect);
  });

  it('keeps an unknown page as 404', async () => {
    const router = setupRouter();
    accessStore.accessToken = 'test-token';
    await router.push('/unknown-page');

    expect(router.currentRoute.value.name).toBe('FallbackNotFound');
  });
});
