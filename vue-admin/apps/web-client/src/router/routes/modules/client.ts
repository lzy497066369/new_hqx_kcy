import type { RouteRecordRaw } from 'vue-router';

/**
 * 客户端按负责人角色提供最小化菜单。
 * 可见路由全部是一级菜单；页面内部跳转使用 hideInMenu 的辅助路由。
 */
const routes: RouteRecordRaw[] = [
  // 客户端主页入口
  {
    component: () => import('#/views/client/enterprise-receipts/index.vue'),
    meta: { icon: 'ant-design:home-filled', order: 1, title: '主页首页' },
    name: 'ClientEnterpriseReceipts',
    path: '/client/enterprise-receipts',
  },

  {
    component: () => import('#/views/client/high-tech-application/index.vue'),
    meta: { hideInMenu: true, title: '高新技术企业申报' },
    name: 'ClientHighTechApplication',
    path: '/client/enterprise-receipts/:companyId/high-tech',
  },

  {
    component: () => import('#/views/client/high-tech-self-assessment/index.vue'),
    meta: { hideInMenu: true, title: '企业自评' },
    name: 'ClientHighTechSelfAssessment',
    path: '/client/enterprise-receipts/:companyId/self-assessment',
  },

  // 历史企业资料、政策和申报页面仅为兼容内部跳转保留，按角色权限屏蔽
  {
    component: () => import('#/views/client/enterprise-profile/company.vue'),
    meta: { icon: 'lucide:building-2', order: 10, title: '总览' },
    name: 'ClientCompany',
    path: '/client/company',
  },
  {
    component: () => import('#/views/client/enterprise-profile/company-basic.vue'),
    meta: { icon: 'lucide:clipboard-pen-line', order: 11, title: '企业资料补齐' },
    name: 'ClientCompanyBasic',
    path: '/client/company/basic',
  },
  {
    component: () => import('#/views/client/projects/my.vue'),
    meta: { icon: 'lucide:file-plus-2', order: 12, title: '创建申报' },
    name: 'ClientDeclaration',
    path: '/projects/my',
  },
  {
    component: () => import('#/views/client/workflow-stage.vue'),
    meta: { icon: 'lucide:files', order: 13, title: '材料准备' },
    name: 'ClientMaterials',
    path: '/projects/materials',
    props: { stage: 'materials' },
  },
  {
    component: () => import('#/views/client/workflow-stage.vue'),
    meta: { icon: 'lucide:file-output', order: 14, title: '材料导出' },
    name: 'ClientExport',
    path: '/projects/export',
    props: { stage: 'export' },
  },
  {
    component: () => import('#/views/client/workflow-stage.vue'),
    meta: { icon: 'lucide:archive', order: 15, title: '申报结果归档' },
    name: 'ClientArchive',
    path: '/projects/archive',
    props: { stage: 'archive' },
  },

  // 以下路由不占用左侧菜单，仅为资料详情、申报详情等内部跳转保留。
  {
    component: () => import('#/views/client/tasks/index.vue'),
    meta: { hideInMenu: true, title: '待办事项' },
    name: 'ClientTasks',
    path: '/tasks',
  },
  {
    component: () => import('#/views/client/company-switch/index.vue'),
    meta: { hideInMenu: true, title: '企业切换' },
    name: 'ClientCompanySwitch',
    path: '/client/company-switch',
  },
  {
    component: () => import('#/views/client/profile/index.vue'),
    meta: { hideInMenu: true, title: '个人资料' },
    name: 'ClientProfile',
    path: '/client/profile',
  },
  {
    component: () => import('#/views/client/enterprise-profile/company-contacts.vue'),
    meta: { hideInMenu: true, title: '联系人维护' },
    name: 'ClientCompanyContacts',
    path: '/client/company/contacts',
  },
  {
    component: () => import('#/views/client/enterprise-profile/company-materials.vue'),
    meta: { hideInMenu: true, title: '材料模板中心' },
    name: 'ClientCompanyMaterials',
    path: '/client/company/materials',
  },
  {
    component: () => import('#/views/client/enterprise-profile/finance/index.vue'),
    meta: { hideInMenu: true, title: '财税资料' },
    name: 'ClientCompanyTax',
    path: '/client/company/tax',
  },
  {
    component: () => import('#/views/client/enterprise-profile/employee/index.vue'),
    meta: { hideInMenu: true, title: '员工资料' },
    name: 'ClientCompanyEmployees',
    path: '/client/company/employees',
  },
  {
    component: () => import('#/views/client/enterprise-profile/property/index.vue'),
    meta: { hideInMenu: true, title: '研发与知识产权' },
    name: 'ClientCompanyProperty',
    path: '/client/company/property',
  },
  {
    component: () => import('#/views/client/enterprise-profile/contract/index.vue'),
    meta: { hideInMenu: true, title: '合同和发票' },
    name: 'ClientCompanyContract',
    path: '/client/company/contract',
  },
  {
    component: () => import('#/views/client/enterprise-profile/document/index.vue'),
    meta: { hideInMenu: true, title: '制度文件' },
    name: 'ClientCompanyDocument',
    path: '/client/company/document',
  },
  {
    component: () => import('#/views/client/enterprise-profile/company-account.vue'),
    meta: { hideInMenu: true, title: '企业账号' },
    name: 'ClientCompanyAccount',
    path: '/client/company/account',
  },
  {
    component: () => import('#/views/client/enterprise-user/index.vue'),
    meta: { hideInMenu: true, title: '账号资料' },
    name: 'ClientEnterpriseUser',
    path: '/client/enterprise-user',
  },
  {
    component: () => import('#/views/client/policy-library/index.vue'),
    meta: { hideInMenu: true, title: '政策匹配' },
    name: 'ClientPolicyLibrary',
    path: '/policy/library',
  },
  {
    component: () => import('#/views/client/projects/list.vue'),
    meta: { hideInMenu: true, title: '项目列表' },
    name: 'ClientProjectList',
    path: '/projects/list',
  },
  {
    component: () => import('#/views/client/projects/detail.vue'),
    meta: { hideInMenu: true, title: '项目详情' },
    name: 'ClientProjectDetail',
    path: '/projects/detail/:id',
  },
  {
    component: () => import('#/views/client/tasks/index.vue'),
    meta: { hideInMenu: true, title: '申报待办' },
    name: 'ClientProjectTodos',
    path: '/projects/todos',
  },
  {
    component: () => import('#/views/client/projects/my-detail.vue'),
    meta: { hideInMenu: true, title: '申报详情' },
    name: 'ClientMyProjectDetail',
    path: '/projects/my/detail/:id',
  },
];

export default routes;
