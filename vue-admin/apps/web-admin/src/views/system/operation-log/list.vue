<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemOperationLogApi } from '#/api';

import { Page, useVbenDrawer } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getOperationLogList } from '#/api';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Detail from './modules/detail.vue';

const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});

const [Grid] = useVbenVxeGrid({
  formOptions: {
    fieldMappingTime: [['createTime', ['startTime', 'endTime']]],
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
          return await getOperationLogList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
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
  } as VxeTableGridOptions<SystemOperationLogApi.SystemOperationLog>,
});

function onActionClick(
  event: OnActionClickParams<SystemOperationLogApi.SystemOperationLog>,
) {
  if (event.code === 'detail') {
    detailDrawerApi.setData(event.row).open();
  }
}
</script>

<template>
  <Page auto-content-height :description="$t('system.operationLog.description')" :title="$t('system.operationLog.title')">
    <DetailDrawer />
    <Grid />
  </Page>
</template>
