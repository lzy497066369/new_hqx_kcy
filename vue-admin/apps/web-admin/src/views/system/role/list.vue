<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemRoleApi } from '#/api';
import type { PortalType } from '#/api/system/portal-type';

import { ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteRole, getRoleList, updateRole } from '#/api';
import { $t } from '#/locales';
import {
  confirmAction,
  showActionFailure,
  showActionLoading,
  showActionSuccess,
} from '../shared/action-feedback';
import PortalTypeSwitch from '../shared/PortalTypeSwitch.vue';
import { DEFAULT_PORTAL_TYPE } from '../shared/portal-type';

import { useColumns, useGridFormSchema } from './data';
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
  formOptions: {
    fieldMappingTime: [['createTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick, onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getRoleList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            portalType: activePortalType.value,
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
  } as VxeTableGridOptions<SystemRoleApi.SystemRole>,
});

function onActionClick(e: OnActionClickParams<SystemRoleApi.SystemRole>) {
  switch (e.code) {
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
    case 'detail': {
      onDetail(e.row);
      break;
    }
  }
}

function confirm(content: string, title: string) {
  return confirmAction(content, title);
}

async function onStatusChange(
  newStatus: number,
  row: SystemRoleApi.SystemRole,
) {
  const statusLabel: Record<number, string> = {
    0: $t('common.disabled'),
    1: $t('common.enabled'),
  };

  try {
    await confirm(
      $t('ui.actionMessage.updateConfirm', [
        row.name,
        statusLabel[newStatus] ?? '',
      ]),
      $t('ui.actionMessage.updateTitle'),
    );
    await updateRole(row.id, {
      portalType: row.portalType ?? activePortalType.value,
      status: newStatus,
    });
    showActionSuccess($t('common.updateSuccess'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') {
      return false;
    }
    showActionFailure(error);
    return false;
  }
}

function onEdit(row: SystemRoleApi.SystemRole) {
  formDrawerApi.setData({ ...row, portalType: activePortalType.value }).open();
}

function onDetail(row: SystemRoleApi.SystemRole) {
  detailDrawerApi.setData({ ...row, portalType: activePortalType.value }).open();
}

function onDelete(row: SystemRoleApi.SystemRole) {
  showActionLoading($t('ui.actionMessage.deleting', [row.name]));
  deleteRole(row.id, activePortalType.value)
    .then(() => {
      showActionSuccess($t('ui.actionMessage.deleteSuccess', [row.name]));
      onRefresh();
    })
    .catch((error) => {
      showActionFailure(error);
    });
}

function onRefresh() {
  gridApi.query();
}

function onPortalTypeChange() {
  onRefresh();
}

function onCreate() {
  formDrawerApi.setData({ portalType: activePortalType.value }).open();
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer :portal-type="activePortalType" @success="onRefresh" />
    <DetailDrawer :portal-type="activePortalType" />
    <PortalTypeSwitch v-model="activePortalType" @update:model-value="onPortalTypeChange" />
    <Grid :table-title="$t('system.role.list')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.role.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
