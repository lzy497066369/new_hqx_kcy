import type { RouteRecordRaw } from 'vue-router';

const workspaceRoutes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/enterprise/workspace/index.vue'),
    meta: {
      authCode: 'Enterprise:Profile:List',
      hideInMenu: true,
      title: '企业服务进度',
    },
    name: 'EnterpriseWorkspace',
    path: '/enterprise-service-center/:enterpriseId/workspace',
  },
  {
    component: () =>
      import('#/views/enterprise/workspace/evidence-chain/index.vue'),
    meta: {
      authCode: 'Enterprise:Profile:List',
      hideInMenu: true,
      title: '证据链总览',
    },
    name: 'EnterpriseWorkspaceEvidenceChain',
    path: '/enterprise-service-center/:enterpriseId/evidence-chain',
  },
  {
    component: () =>
      import('#/views/enterprise/workspace/archive-records/index.vue'),
    meta: {
      authCode: 'Enterprise:Profile:List',
      hideInMenu: true,
      title: '企业档案资料',
    },
    name: 'EnterpriseWorkspaceArchiveRecords',
    path: '/enterprise-service-center/:enterpriseId/archive-records',
  },
  {
    component: () =>
      import('#/views/enterprise/workspace/declarations/index.vue'),
    meta: {
      authCode: 'Enterprise:Profile:List',
      hideInMenu: true,
      title: '企业申报工作台',
    },
    name: 'EnterpriseWorkspaceDeclarations',
    path: '/enterprise-service-center/:enterpriseId/declarations',
  },
  {
    component: () => import('#/views/enterprise/workspace/todos/index.vue'),
    meta: {
      authCode: 'Enterprise:Profile:List',
      hideInMenu: true,
      title: '审核与协同待办',
    },
    name: 'EnterpriseWorkspaceTodos',
    path: '/enterprise-service-center/:enterpriseId/todos',
  },
  {
    component: () => import('#/views/enterprise/workspace/profile/index.vue'),
    meta: {
      authCode: 'Enterprise:Profile:Edit',
      hideInMenu: true,
      title: '企业档案',
    },
    name: 'EnterpriseWorkspaceProfile',
    path: '/enterprise-service-center/:enterpriseId/profile',
  },
  {
    component: () => import('#/views/enterprise/workspace/finance/index.vue'),
    meta: {
      authCode: 'Enterprise:Profile:List',
      hideInMenu: true,
      title: '财税资料',
    },
    name: 'EnterpriseWorkspaceFinance',
    path: '/enterprise-service-center/:enterpriseId/finance',
  },
  {
    component: () => import('#/views/enterprise/workspace/employees/index.vue'),
    meta: {
      authCode: 'Enterprise:Profile:List',
      hideInMenu: true,
      title: '人员资料',
    },
    name: 'EnterpriseWorkspaceEmployees',
    path: '/enterprise-service-center/:enterpriseId/employees',
  },
  {
    component: () =>
      import('#/views/enterprise/workspace/properties/index.vue'),
    meta: {
      authCode: 'Enterprise:Profile:List',
      hideInMenu: true,
      title: '知识产权',
    },
    name: 'EnterpriseWorkspaceProperties',
    path: '/enterprise-service-center/:enterpriseId/properties',
  },
  {
    component: () => import('#/views/enterprise/workspace/research/index.vue'),
    meta: {
      authCode: 'Enterprise:Profile:List',
      hideInMenu: true,
      title: '研发项目',
    },
    name: 'EnterpriseWorkspaceResearch',
    path: '/enterprise-service-center/:enterpriseId/research',
  },
  {
    component: () =>
      import('#/views/enterprise/workspace/product-services/index.vue'),
    meta: {
      authCode: 'Enterprise:Profile:List',
      hideInMenu: true,
      title: '产品服务',
    },
    name: 'EnterpriseWorkspaceProductServices',
    path: '/enterprise-service-center/:enterpriseId/product-services',
  },
  {
    component: () =>
      import('#/views/enterprise/workspace/transformations/index.vue'),
    meta: {
      authCode: 'Enterprise:Profile:List',
      hideInMenu: true,
      title: '成果转化',
    },
    name: 'EnterpriseWorkspaceTransformations',
    path: '/enterprise-service-center/:enterpriseId/transformations',
  },
];

const routes: RouteRecordRaw[] = [
  {
    meta: { icon: 'mdi:chart-box-outline', order: 150, title: '企业管理' },
    name: 'EnterpriseServiceStatistics',
    path: '/enterprise-service-statistics',
    redirect: '/enterprise-service-statistics/enterprises',
    children: [
      {
        component: () => import('#/views/enterprise/profile/list.vue'),
        meta: {
          authCode: 'Enterprise:Profile:List',
          icon: 'mdi:office-building',
          title: '企业列表',
        },
        name: 'EnterpriseProfileList',
        path: 'enterprises',
      },
      {
        meta: {
          authCode: 'Enterprise:Profile:List',
          icon: 'mdi:folder-multiple-outline',
          title: '企业材料台账',
        },
        name: 'EnterpriseMaterialLedger',
        path: '/enterprise-material-ledger',
        redirect: '/enterprise-material-ledger/company',
        children: [
          {
            component: () =>
              import('#/views/enterprise/workspace/materials/index.vue'),
            meta: {
              authCode: 'Enterprise:Profile:List',
              icon: 'lucide:folder-open',
              title: '企业资料',
            },
            name: 'EnterpriseMaterialSection',
            path: ':section',
          },
        ],
      },
      {
        meta: { icon: 'mdi:file-document-edit-outline', title: '企业申报管理' },
        name: 'EnterpriseDeclarationManagement',
        path: '/enterprise-declaration-management',
        redirect: '/enterprise-declaration-management/declarations',
        children: [
          {
            component: () => import('#/views/enterprise/declarations/list.vue'),
            meta: {
              authCode: 'Enterprise:Profile:List',
              icon: 'mdi:format-list-bulleted',
              title: '申报列表',
            },
            name: 'EnterpriseDeclarationList',
            path: 'declarations',
          },
          {
            component: () =>
              import('#/views/enterprise/declarations/detail.vue'),
            meta: {
              authCode: 'Enterprise:Profile:List',
              hideInMenu: true,
              title: '申报详情',
            },
            name: 'EnterpriseDeclarationDetail',
            path: 'declarations/:enterpriseId/:declarationId',
          },
        ],
      },
    ],
  },
  {
    meta: {
      authCode: 'Crm:Sync:List',
      icon: 'lucide:refresh-cw',
      order: 153,
      title: 'CRM同步',
    },
    name: 'CrmSync',
    path: '/crm-sync',
    redirect: '/crm-sync/contracts',
    children: [
      {
        component: () => import('#/views/crm-sync/contract-records/index.vue'),
        meta: {
          authCode: 'Crm:Sync:List',
          icon: 'lucide:file-text',
          title: '合同同步记录',
        },
        name: 'CrmContractSyncRecord',
        path: 'contracts',
      },
      {
        component: () =>
          import('#/views/crm-sync/execution-order-records/index.vue'),
        meta: {
          authCode: 'Crm:Sync:List',
          icon: 'lucide:clipboard-list',
          title: '执行单同步记录',
        },
        name: 'CrmExecutionOrderSyncRecord',
        path: 'execution-orders',
      },
      {
        component: () =>
          import('#/views/crm-sync/integration-security/index.vue'),
        meta: {
          authCode: 'Crm:Integration:Manage',
          icon: 'lucide:shield-check',
          title: '安全集成',
        },
        name: 'CrmIntegrationSecurity',
        path: 'security',
      },
    ],
  },
  ...workspaceRoutes,
];

export default routes;
