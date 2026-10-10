import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import routes from './routes/modules/governance';

describe('overall sidebar routes', () => {
  it('shows only the restored home, without the old enterprise-management entry', () => {
    expect(routes.filter((route) => !route.meta?.hideInMenu).map((route) => [route.path, route.meta?.title])).toEqual([
      ['/governance/overview', '主页首页'],
    ]);
  });

  it.each([
    ['/governance/regions', undefined],
    ['/governance/accounts', 'accounts'],
    ['/governance/all-enterprises', 'enterprises'],
  ])('redirects legacy %s to the home while preserving query data', async (path, section) => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: routes.map((route) => route.redirect
        ? { path: route.path, redirect: route.redirect }
        : { path: route.path, component: { template: '<div />' } }),
    });
    await router.push({ path: path!, query: { keyword: 'demo' } });
    expect(router.currentRoute.value.path).toBe('/governance/overview');
    expect(router.currentRoute.value.query.keyword).toBe('demo');
    expect(router.currentRoute.value.query.section).toBe(section);
  });
});
