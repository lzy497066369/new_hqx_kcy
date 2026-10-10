<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemMenuApi } from '#/api/system/menu';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import { Button, Select } from 'antdv-next';
import { shallowRef } from 'vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteMenu, getMenuList } from '#/api/system/menu';
import { $t } from '#/locales';
import {
  showActionFailure,
  showActionLoading,
  showActionSuccess,
} from '../shared/action-feedback';

import { useColumns } from './data';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});

const portalType = shallowRef<SystemMenuApi.SystemMenu['portalType']>('admin');
const portalOptions = [
  { label: '管理端', value: 'admin' },
  { label: '客户端', value: 'client' },
];

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async () => {
          return await getMenuList({ portalType: portalType.value });
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      zoom: true,
    },
    treeConfig: {
      parentField: 'parentId',
      rowField: 'id',
      transform: false,
    },
  } as VxeTableGridOptions<SystemMenuApi.SystemMenu>,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<SystemMenuApi.SystemMenu>) {
  switch (code) {
    case 'append': {
      onAppend(row);
      break;
    }
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
    case 'detail': {
      onDetail(row);
      break;
    }
  }
}

function onRefresh() {
  gridApi.query();
}

function onPortalChange() {
  gridApi.query();
}

function onEdit(row: SystemMenuApi.SystemMenu) {
  formDrawerApi.setData(row).open();
}

function onDetail(row: SystemMenuApi.SystemMenu) {
  detailDrawerApi.setData(row).open();
}

function onCreate() {
  formDrawerApi.setData({ portalType: portalType.value }).open();
}

function onAppend(row: SystemMenuApi.SystemMenu) {
  formDrawerApi
    .setData({ parentId: row.id, portalType: portalType.value })
    .open();
}

function onDelete(row: SystemMenuApi.SystemMenu) {
  showActionLoading($t('ui.actionMessage.deleting', [row.name]));
  deleteMenu(row.id, row.portalType ?? portalType.value)
    .then(() => {
      showActionSuccess($t('ui.actionMessage.deleteSuccess', [row.name]));
      onRefresh();
    })
    .catch((error) => {
      showActionFailure(error);
    });
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <DetailDrawer />
    <Grid>
      <template #toolbar-tools>
        <Select
          v-model:value="portalType"
          class="w-32"
          :options="portalOptions"
          @change="onPortalChange"
        />
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.menu.name')]) }}
        </Button>
      </template>
      <template #title="{ row }">
        <div class="flex w-full items-center gap-2">
          <IconifyIcon
            v-if="row.meta?.icon"
            :icon="row.meta.icon"
            class="size-5 shrink-0"
          />
          <span>{{ $t(row.meta?.title ?? '') }}</span>
        </div>
      </template>
    </Grid>
  </Page>
</template>
