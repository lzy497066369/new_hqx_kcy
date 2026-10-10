<script lang="ts" setup>
import type { OnActionClickParams, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AiApi } from '#/api';

import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { Page, useVbenDrawer } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getAiTaskList } from '#/api';

import { useColumns, useGridFormSchema } from './data';
import Detail from './modules/detail.vue';

const route = useRoute();
const routeTaskId = computed(() => {
  const value = route.query.taskId;
  return Array.isArray(value) ? value[0] : value;
});

const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});

const [Grid] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getAiTaskList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            taskId: formValues.taskId || routeTaskId.value || undefined,
          });
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<AiApi.AiTask>,
});

function onActionClick(event: OnActionClickParams<AiApi.AiTask>) {
  if (event.code === 'detail') {
    detailDrawerApi.setData(event.row).open();
  }
}
</script>

<template>
  <Page
    auto-content-height
    description="记录 AI 每次真实请求、真实返回、输入快照和结构化结果，仅系统管理员可查看。"
    title="AI 请求记录"
  >
    <DetailDrawer />
    <Grid />
  </Page>
</template>
