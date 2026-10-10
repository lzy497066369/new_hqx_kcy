import { describe, expect, it } from 'vitest';
import { normalizeClientMenuPaths } from './client-menu-paths';
describe('canonical client service home', () => {
  it('preserves object and function redirects unchanged', () => {
    const redirectObject = {
      name: 'ClientCompanyProfile',
      query: { tab: 'basic' },
    };
    const redirectFunction = () => '/policy';
    const result = normalizeClientMenuPaths([
      {
        name: 'ObjectRedirect',
        component: 'BasicLayout',
        path: '/object',
        redirect: redirectObject,
      },
      {
        name: 'FunctionRedirect',
        component: 'BasicLayout',
        path: '/function',
        redirect: redirectFunction,
      },
    ]);
    expect(result[0]?.redirect).toBe(redirectObject);
    expect(result[1]?.redirect).toBe(redirectFunction);
  });
  it('normalizes both old URLs without changing permission metadata', () => {
    const menus = [
      {
        name: 'ClientHome',
        component: 'dashboard/workspace/index',
        path: '/home',
        meta: { title: '工作台', authority: ['client'], hideInMenu: true },
      },
    ];
    const result = normalizeClientMenuPaths(menus);
    expect(result[0]?.path).toBe('/dashboard/workspace');
    expect(result[0]?.meta).toEqual({
      title: '企业服务进度',
      authority: ['client'],
      hideInMenu: true,
    });
    expect(menus[0]?.path).toBe('/home');
    expect(
      normalizeClientMenuPaths([
        {
          name: 'ClientHome',
          component: 'dashboard/workspace/index',
          path: '/client/home',
        },
      ])[0]?.path,
    ).toBe('/dashboard/workspace');
  });
  it('normalizes nested paths and redirects, leaving other entries unchanged', () => {
    const result = normalizeClientMenuPaths([
      {
        name: 'Root',
        component: 'BasicLayout',
        path: '/client',
        redirect: '/home',
        children: [
          {
            name: 'ClientHome',
            component: 'dashboard/workspace/index',
            path: '/home',
          },
          {
            name: 'Other',
            component: 'client/policy-library/index',
            path: '/policy',
            meta: { title: '政策' },
          },
        ],
      },
    ]);
    expect(result[0]?.redirect).toBe('/dashboard/workspace');
    expect(result[0]?.children?.[0]?.path).toBe('/dashboard/workspace');
    expect(result[0]?.children?.[1]?.meta?.title).toBe('政策');
  });
});
