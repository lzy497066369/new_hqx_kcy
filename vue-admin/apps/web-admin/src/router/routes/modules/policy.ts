import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:settings-2',
      order: 190,
      title: '申报配置',
    },
    name: 'DeclarationConfiguration',
    path: '/declaration-configuration',
    children: [
      {
        meta: {
          icon: 'lucide:map',
          title: '区域基础',
        },
        name: 'DeclarationBaseCenter',
        path: '/declaration-base',
        children: [
          {
            component: () => import('#/views/policy/region/list.vue'),
            meta: { icon: 'lucide:map', title: '区域管理' },
            name: 'PolicyRegionList',
            path: '/policy/regions',
          },
        ],
      },
      {
        meta: {
          icon: 'lucide:folder-tree',
          title: '统一政策项目',
        },
        name: 'PolicyProjectCenter',
        path: '/policy-project-center',
        children: [
          {
            component: () => import('#/views/policy/project/list.vue'),
            meta: {
              icon: 'lucide:folders',
              title: '项目库',
            },
            name: 'PolicyProjectList',
            path: '/policy/projects',
          },
          {
            component: () => import('#/views/policy/project/declaration-scheme-list.vue'),
            meta: {
              authCode: 'Policy:Project:MaterialRequirement',
              icon: 'lucide:workflow',
              title: '地区申报方案',
            },
            name: 'PolicyDeclarationSchemeList',
            path: '/policy/declaration-schemes',
          },
        ],
      },
      {
        meta: {
          icon: 'lucide:sliders-horizontal',
          title: '申报规则中心',
        },
        name: 'DeclarationRuleCenter',
        path: '/declaration-rules',
        children: [
          {
            component: () => import('#/views/policy/preset/enterprise-metric-catalog.vue'),
            meta: {
              authCode: 'Policy:DeclarationPreset:List',
              icon: 'lucide:building-2',
              title: '企业指标字段目录',
            },
            name: 'PolicyEnterpriseMetricCatalog',
            path: '/policy/enterprise-metric-catalog',
          },
          {
            component: () => import('#/views/policy/preset/qualification-list.vue'),
            meta: {
              authCode: 'Policy:DeclarationPreset:List',
              icon: 'lucide:badge-check',
              title: '资格条件预设',
            },
            name: 'PolicyQualificationPresetList',
            path: '/policy/qualification-presets',
          },
          {
            component: () => import('#/views/policy/preset/material-list.vue'),
            meta: {
              authCode: 'Policy:DeclarationPreset:List',
              icon: 'lucide:files',
              title: '材料清单预设',
            },
            name: 'PolicyMaterialPresetList',
            path: '/policy/material-presets',
          },
          {
            component: () => import('#/views/policy/preset/score-list.vue'),
            meta: {
              authCode: 'Policy:DeclarationPreset:List',
              icon: 'lucide:chart-no-axes-column-increasing',
              title: '评分模型预设',
            },
            name: 'PolicyScorePresetList',
            path: '/policy/score-presets',
          },
          {
            component: () => import('#/views/policy/preset/flow-list.vue'),
            meta: {
              authCode: 'Policy:DeclarationPreset:List',
              icon: 'lucide:git-branch',
              title: '流程模板预设',
            },
            name: 'PolicyFlowPresetList',
            path: '/policy/flow-presets',
          },
        ],
      },
    ],
  },
  {
    meta: {
      icon: 'lucide:shield-check',
      order: 200,
      title: '政策管理',
    },
    name: 'PolicyManagement',
    path: '/policy',
    children: [
      {
        component: () => import('#/views/policy/file/list.vue'),
        meta: { icon: 'lucide:file-text', title: '区域政策文件' },
        name: 'PolicyFileList',
        path: '/policy/files',
      },
      {
        component: () => import('#/views/policy/collect/job-list.vue'),
        meta: {
          authCode: 'Policy:CollectJob:List',
          icon: 'lucide:radar',
          title: '政策采集任务',
        },
        name: 'PolicyCollectJobList',
        path: '/policy/collect-jobs',
      },
      {
        component: () => import('#/views/policy/collect/run-list.vue'),
        meta: {
          authCode: 'Policy:CollectRun:List',
          icon: 'lucide:history',
          title: '同步中心',
        },
        name: 'PolicyCollectRunList',
        path: '/policy/collect-runs',
      },
      {
        component: () => import('#/views/policy/collect/notification-center.vue'),
        meta: {
          authCode: 'Policy:CollectWorkbench:View',
          icon: 'lucide:bell',
          title: '通知中心',
        },
        name: 'PolicyCollectNotificationList',
        path: '/policy/collect-notifications',
      },
      {
        component: () => import('#/views/policy/collect/notification-center.vue'),
        meta: {
          authCode: 'Policy:CollectWorkbench:View',
          hideInMenu: true,
          title: '通知详情',
        },
        name: 'PolicyCollectNotificationDetail',
        path: '/policy/collect-notifications/:id',
      },
      {
        component: () => import('#/views/policy/collect/review-list.vue'),
        meta: {
          authCode: 'Policy:CollectReview:List',
          icon: 'lucide:clipboard-check',
          title: '政策待审查',
        },
        name: 'PolicyCollectReviewList',
        path: '/policy/collect-review',
      },
    ],
  },
];

export default routes;
