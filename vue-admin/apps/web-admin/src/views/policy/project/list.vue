<script setup lang="ts">
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PolicyProjectItem } from '#/api';

import { Page, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  disablePolicyProjectApi,
  enablePolicyProjectApi,
  getPolicyProjectDetailApi,
  getPolicyProjectsApi,
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

defineOptions({ name: 'PolicyProjectList' });

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
          return await getPolicyProjectsApi({
            ...formValues,
            page: page.currentPage,
            pageSize: page.pageSize,
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
  } as VxeTableGridOptions<PolicyProjectItem>,
});

function openCreate() {
  formModalApi.setData({}).open();
}

async function openEdit(row: PolicyProjectItem) {
  try {
    const detail = await getPolicyProjectDetailApi(row.id);
    formModalApi.setData(detail).open();
  } catch (error) {
    showActionFailure(error);
  }
}

async function openDetail(row: PolicyProjectItem) {
  try {
    const detail = await getPolicyProjectDetailApi(row.id);
    detailDrawerApi.setData(detail).open();
  } catch (error) {
    showActionFailure(error);
  }
}

async function onStatusChange(newStatus: number, row: PolicyProjectItem) {
  const actionLabel =
    newStatus === 1 ? $t('common.enabled') : $t('common.disabled');

  try {
    await confirmAction(
      $t('ui.actionMessage.updateConfirm', [row.name, actionLabel]),
      $t('ui.actionMessage.updateTitle'),
    );
    await (newStatus === 1
      ? enablePolicyProjectApi(row.id)
      : disablePolicyProjectApi(row.id));
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
    <Grid table-title="统一政策项目">
      <template #toolbar-tools>
        <Button type="primary" @click="openCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', ['统一政策项目']) }}
        </Button>
      </template>
      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.detail'),
              icon: 'lucide:eye',
              onClick: () => openDetail(row),
            },
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              onClick: () => openEdit(row),
            },
          ]"
          align="center"
        />
      </template>
    </Grid>
  </Page>
</template>
