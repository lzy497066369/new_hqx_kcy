<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemDeptApi } from '#/api/system/dept';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteDept, getDeptList } from '#/api/system/dept';
import { $t } from '#/locales';
import {
  showActionFailure,
  showActionLoading,
  showActionSuccess,
} from '../shared/action-feedback';

import { useColumns } from './data';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [DetailModal, detailModalApi] = useVbenModal({
  connectedComponent: Detail,
  destroyOnClose: true,
});

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
          return await getDeptList();
        },
      },
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
  } as VxeTableGridOptions<SystemDeptApi.SystemDept>,
});

function onEdit(row: SystemDeptApi.SystemDept) {
  formModalApi.setData(row).open();
}

function onDetail(row: SystemDeptApi.SystemDept) {
  detailModalApi.setData(row).open();
}

function onAppend(row: SystemDeptApi.SystemDept) {
  formModalApi.setData({ parentId: row.id }).open();
}

function onCreate() {
  formModalApi.setData({}).open();
}

function onDelete(row: SystemDeptApi.SystemDept) {
  showActionLoading($t('ui.actionMessage.deleting', [row.name]));
  deleteDept(row.id)
    .then(() => {
      showActionSuccess($t('ui.actionMessage.deleteSuccess', [row.name]));
      refreshGrid();
    })
    .catch((error) => {
      showActionFailure(error);
    });
}

function onActionClick({
  code,
  row,
}: OnActionClickParams<SystemDeptApi.SystemDept>) {
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

function refreshGrid() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="refreshGrid" />
    <DetailModal />
    <Grid :table-title="$t('system.dept.list')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.dept.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
