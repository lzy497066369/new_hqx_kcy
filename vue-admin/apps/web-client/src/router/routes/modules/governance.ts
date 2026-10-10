import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/client/governance/overview.vue'),
    meta: { icon: 'ant-design:home-filled', order: 1, title: '主页首页' },
    name: 'ClientGovernanceOverview',
    path: '/governance/overview',
  },
  {
    meta: { hideInMenu: true, title: '主页首页' },
    name: 'ClientGovernanceRegions',
    path: '/governance/regions',
    redirect: (to) => ({ path: '/governance/overview', query: to.query }),
  },
  {
    meta: { hideInMenu: true, title: '账号管理' },
    name: 'ClientGovernanceAccounts',
    path: '/governance/accounts',
    redirect: (to) => ({ path: '/governance/overview', query: { ...to.query, section: 'accounts' } }),
  },
  {
    meta: { hideInMenu: true, title: '企业档案' },
    name: 'ClientGovernanceEnterprises',
    path: '/governance/all-enterprises',
    redirect: (to) => ({ path: '/governance/overview', query: { ...to.query, section: 'enterprises' } }),
  },
];

export default routes;
