import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authCode: 'AI:Module',
      icon: 'lucide:bot',
      order: 180,
      title: 'AI 模块',
    },
    name: 'AiModule',
    path: '/ai',
    children: [
      {
        component: () => import('#/views/ai/chat-test/index.vue'),
        meta: {
          authCode: 'AI:ChatTest',
          icon: 'lucide:message-square-text',
          title: 'AI 对话测试',
        },
        name: 'AiChatTest',
        path: '/ai/chat-test',
      },
    ],
  },
];

export default routes;
