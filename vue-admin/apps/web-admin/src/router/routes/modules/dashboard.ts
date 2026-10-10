import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:layout-dashboard',
      order: -1,
      title: $t('page.dashboard.title'),
    },
    name: 'Dashboard',
    path: '/Dashboard',
    children: [
      {
        name: 'Analytics',
        path: '/Dashboard/Analytics',
        component: () => import('#/views/dashboard/analytics/index.vue'),
        meta: {
          affixTab: true,
          icon: 'lucide:area-chart',
          title: $t('page.dashboard.analytics'),
        },
      },
      {
        name: 'Workspace',
        path: '/Dashboard/Workspace',
        component: () => import('#/views/dashboard/workspace/index.vue'),
        meta: {
          icon: 'carbon:workspace',
          hideInBreadcrumb: true,
          title: $t('page.dashboard.workspace'),
        },
      },
      {
        name: 'AiAnalysis',
        path: '/Dashboard/AiAnalysis',
        component: () => import('#/views/dashboard/ai-analysis/index.vue'),
        meta: {
          authCode: 'AI:Stats:View',
          icon: 'lucide:bot',
          title: $t('page.dashboard.aiAnalysis'),
        },
      },
    ],
  },
];

export default routes;
