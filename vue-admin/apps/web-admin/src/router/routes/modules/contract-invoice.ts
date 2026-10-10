import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/contract-invoice/index.vue'),
    meta: {
      icon: 'lucide:files',
      order: 160,
      title: '合同发票',
    },
    name: 'ContractInvoice',
    path: '/contract-invoice',
  },
];

export default routes;
