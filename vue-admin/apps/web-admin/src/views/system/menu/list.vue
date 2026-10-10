<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { PortalType } from '#/api/system/portal-type';

import { ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import { Button } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteMenu, getMenuList, SystemMenuApi } from '#/api/system/menu';
import { $t } from '#/locales';
import {
  showActionFailure,
  showActionLoading,
  showActionSuccess,
} from '../shared/action-feedback';
import PortalTypeSwitch from '../shared/PortalTypeSwitch.vue';
import { DEFAULT_PORTAL_TYPE } from '../shared/portal-type';

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

const activePortalType = ref<PortalType>(DEFAULT_PORTAL_TYPE);

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
          return await getMenuList({ portalType: activePortalType.value });
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

function onPortalTypeChange() {
  onRefresh();
}

function onEdit(row: SystemMenuApi.SystemMenu) {
  formDrawerApi.setData({ ...row, portalType: activePortalType.value }).open();
}

function onDetail(row: SystemMenuApi.SystemMenu) {
  detailDrawerApi.setData(row).open();
}

function onCreate() {
  formDrawerApi.setData({ portalType: activePortalType.value }).open();
}

function onAppend(row: SystemMenuApi.SystemMenu) {
  formDrawerApi
    .setData({ parentId: row.id, portalType: activePortalType.value })
    .open();
}

function onDelete(row: SystemMenuApi.SystemMenu) {
  showActionLoading($t('ui.actionMessage.deleting', [row.name]));
  deleteMenu(row.id, activePortalType.value)
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
    <FormDrawer :portal-type="activePortalType" @success="onRefresh" />
    <DetailDrawer />
    <PortalTypeSwitch v-model="activePortalType" @update:model-value="onPortalTypeChange" />
    <Grid>
      <template #toolbar-tools>
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
          <span>{{ row.meta?.title }}</span>
        </div>
      </template>
    </Grid>
  </Page>
</template>
