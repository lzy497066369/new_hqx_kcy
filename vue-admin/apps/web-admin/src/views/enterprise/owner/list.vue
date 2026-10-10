<script setup lang="ts">
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { EnterpriseOwnerItem } from '#/api';

import { Page, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteEnterpriseOwnerApi,
  getEnterpriseOwnerDetailApi,
  getEnterpriseOwnersApi,
  resetEnterpriseOwnerPasswordApi,
  updateEnterpriseOwnerApi,
} from '#/api';
import { $t } from '#/locales';
import {
  confirmAction,
  showActionFailure,
  showActionSuccess,
} from '../../system/shared/action-feedback';

import { useColumns, useGridFormSchema } from './data';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getEnterpriseOwnersApi({
            ...formValues,
            page: page.currentPage,
            pageSize: page.pageSize,
          });
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<EnterpriseOwnerItem>,
});

function openCreate() {
  formModalApi.setData({}).open();
}

async function openEdit(row: EnterpriseOwnerItem) {
  try {
    const detail = await getEnterpriseOwnerDetailApi(row.id);
    formModalApi.setData(detail).open();
  } catch (error) {
    showActionFailure(error);
  }
}

async function openDetail(row: EnterpriseOwnerItem) {
  try {
    const detail = await getEnterpriseOwnerDetailApi(row.id);
    detailDrawerApi.setData(detail).open();
  } catch (error) {
    showActionFailure(error);
  }
}

async function onDelete(row: EnterpriseOwnerItem) {
  try {
    await confirmAction($t('ui.actionMessage.deleteConfirm', [row.name]), '删除确认');
    await deleteEnterpriseOwnerApi(row.id);
    showActionSuccess($t('ui.actionMessage.deleteSuccess', [row.name]));
    gridApi.query();
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') {
      return;
    }
    showActionFailure(error);
  }
}

async function onResetPassword(row: EnterpriseOwnerItem) {
  try {
    await confirmAction(`确认重置“${row.name}”的密码为 123456 吗？`, '重置密码');
    await resetEnterpriseOwnerPasswordApi(row.id);
    showActionSuccess('密码已重置为 123456');
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') {
      return;
    }
    showActionFailure(error);
  }
}

async function onStatusChange(newStatus: number, row: EnterpriseOwnerItem) {
  try {
    await confirmAction(
      $t('ui.actionMessage.updateConfirm', [
        row.name,
        newStatus === 1 ? $t('common.enabled') : $t('common.disabled'),
      ]),
      $t('ui.actionMessage.updateTitle'),
    );
    await updateEnterpriseOwnerApi(row.id, {
      email: row.email,
      enterpriseId: row.enterpriseId,
      name: row.name,
      phone: row.phone,
      remark: row.remark,
      status: newStatus as 0 | 1,
      username: row.username,
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
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="gridApi.query()" />
    <DetailDrawer />
    <Grid table-title="企业负责人">
      <template #toolbar-tools>
        <Button type="primary" @click="openCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', ['企业负责人']) }}
        </Button>
      </template>
      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            { text: $t('common.detail'), icon: 'lucide:eye', onClick: () => openDetail(row) },
            { text: $t('common.edit'), icon: 'lucide:edit', onClick: () => openEdit(row) },
          ]"
          :dropdown-actions="[
            { text: '重置密码', icon: 'lucide:key-round', onClick: () => onResetPassword(row) },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              danger: true,
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                confirm: () => onDelete(row),
              },
            },
          ]"
          align="center"
        />
      </template>
    </Grid>
  </Page>
</template>
