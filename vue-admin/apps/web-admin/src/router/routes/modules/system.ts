import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'ion:settings-outline',
      order: 9997,
      title: $t('system.title'),
    },
    name: 'System',
    path: '/system',
    children: [
      {
        path: '/system/user',
        name: 'SystemUser',
        meta: {
          icon: 'mdi:user',
          title: $t('system.user.title'),
        },
        component: () => import('#/views/system/user/list.vue'),
      },
      {
        path: '/system/role',
        name: 'SystemRole',
        meta: {
          icon: 'mdi:account-group',
          title: $t('system.role.title'),
        },
        component: () => import('#/views/system/role/list.vue'),
      },
      {
        path: '/system/menu',
        name: 'SystemMenu',
        meta: {
          icon: 'mdi:menu',
          title: $t('system.menu.title'),
        },
        component: () => import('#/views/system/menu/list.vue'),
      },
      {
        path: '/system/dept',
        name: 'SystemDept',
        meta: {
          icon: 'charm:organisation',
          title: $t('system.dept.title'),
        },
        component: () => import('#/views/system/dept/list.vue'),
      },
      {
        path: '/system/operation-log',
        name: 'SystemOperationLog',
        meta: {
          icon: 'ion:list-outline',
          title: $t('system.operationLog.title'),
        },
        component: () => import('#/views/system/operation-log/list.vue'),
      },
      {
        path: '/system/ai-record',
        name: 'SystemAiRecord',
        meta: {
          authCode: 'AI:Record:List',
          icon: 'lucide:bot',
          title: 'AI 请求记录',
        },
        component: () => import('#/views/system/ai-record/list.vue'),
      },
    ],
  },
];

export default routes;
