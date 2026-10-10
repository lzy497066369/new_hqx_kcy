import type { RouteRecordRaw } from 'vue-router';

const iamRoutes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/iam/overview/index.vue'),
    meta: {
      affixTab: true,
      icon: 'lucide:layout-dashboard',
      order: -1,
      title: '工作台',
    },
    name: 'IamOverview',
    path: '/iam/overview',
  },
  {
    meta: { icon: 'lucide:contact-round', order: 1, title: '身份与组织' },
    name: 'IamDirectory',
    path: '/iam/directory',
    children: [
      {
        component: () => import('#/views/iam/users/index.vue'),
        meta: { icon: 'lucide:users', title: '用户目录' },
        name: 'IamUsers',
        path: '/iam/directory/users',
      },
      {
        component: () => import('#/views/iam/departments/index.vue'),
        meta: { icon: 'lucide:network', title: '部门与组织架构' },
        name: 'IamDepartments',
        path: '/iam/directory/departments',
      },
    ],
  },
  {
    meta: { icon: 'lucide:app-window', order: 2, title: '应用中心' },
    name: 'IamApplications',
    path: '/iam/applications',
    children: [
      {
        component: () => import('#/views/iam/apps/index.vue'),
        meta: { icon: 'lucide:blocks', title: '应用列表' },
        name: 'IamApps',
        path: '/iam/applications',
      },
      {
        component: () => import('#/views/iam/application-workspace/index.vue'),
        meta: { icon: 'lucide:key-round', title: '应用授权工作台' },
        name: 'IamApplicationWorkspace',
        path: '/iam/applications/authorization',
      },
      {
        component: () => import('#/views/iam/application-workspace/index.vue'),
        meta: { hideInMenu: true, title: '应用授权概览' },
        name: 'IamApplicationWorkspaceDetail',
        path: '/iam/applications/:appCode/overview',
      },
      {
        component: () => import('#/views/iam/access/index.vue'),
        meta: { hideInMenu: true, title: '角色与权限' },
        name: 'IamApplicationAccess',
        path: '/iam/applications/:appCode/access',
      },
      {
        component: () => import('#/views/iam/menus/index.vue'),
        meta: { hideInMenu: true, title: '业务菜单' },
        name: 'IamApplicationMenus',
        path: '/iam/applications/:appCode/menus',
      },
      {
        component: () => import('#/views/iam/companies/index.vue'),
        meta: { hideInMenu: true, title: '公司访问授权' },
        name: 'IamApplicationCompanyAccess',
        path: '/iam/applications/:appCode/companies',
      },
    ],
  },
  {
    meta: { icon: 'lucide:shield-alert', order: 3, title: '安全与审计' },
    name: 'IamSecurity',
    path: '/iam/security',
    children: [
      {
        component: () => import('#/views/iam/audit/index.vue'),
        meta: { icon: 'lucide:scroll-text', title: '操作审计' },
        name: 'IamAudit',
        path: '/iam/security/audit',
      },
    ],
  },
];

export default iamRoutes;
