<script setup lang="ts">
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { EnterpriseProfileItem } from '#/api';

import { Page, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { onMounted, ref, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';

import { Button } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  downloadEnterpriseProfileExcelApi,
  downloadEnterpriseProfileExcelTemplateApi,
  getEnterpriseProfileDetailApi,
  getEnterpriseProfilesApi,
} from '#/api';
import { useEnterpriseContextStore } from '#/store';
import { showActionFailure } from '../../system/shared/action-feedback';

import EnterpriseWorkspaceOverview from './components/EnterpriseWorkspaceOverview.vue';
import { useColumns, useGridFormSchema } from './data';
import AccountManager from './modules/account-manager.vue';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';
import ExcelImportModal from './modules/excel-import-modal.vue';
import ImportWizard from './modules/import-wizard.vue';

defineOptions({ name: 'EnterpriseProfileList' });

const router = useRouter();
const enterpriseContextStore = useEnterpriseContextStore();
const workspaceOverviewRef =
  useTemplateRef<InstanceType<typeof EnterpriseWorkspaceOverview>>(
    'workspaceOverview',
  );
const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});
const [AccountManagerDrawer, accountManagerDrawerApi] = useVbenDrawer({
  connectedComponent: AccountManager,
  destroyOnClose: true,
});
const [ImportWizardDrawer, importWizardDrawerApi] = useVbenDrawer({
  connectedComponent: ImportWizard,
  destroyOnClose: true,
});

const excelImportOpen = ref(false);

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getEnterpriseProfilesApi({
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
  } as VxeTableGridOptions<EnterpriseProfileItem>,
});

function openCreate() {
  importWizardDrawerApi.open();
}

function openExcelImport() {
  excelImportOpen.value = true;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadExcelTemplate() {
  try {
    downloadBlob(
      await downloadEnterpriseProfileExcelTemplateApi(),
      '企业档案导入模板.xlsx',
    );
  } catch (error) {
    showActionFailure(error);
  }
}

async function exportEnterpriseProfiles() {
  try {
    downloadBlob(await downloadEnterpriseProfileExcelApi(), '企业档案.xlsx');
  } catch (error) {
    showActionFailure(error);
  }
}

function handleExcelImportSuccess() {
  void gridApi.query();
  void workspaceOverviewRef.value?.refresh();
}

function handleCreateSuccess(enterpriseId: string) {
  enterpriseContextStore.setCurrentEnterprise(enterpriseId);
  gridApi.query();
  void workspaceOverviewRef.value?.refresh();
}

async function openEdit(row: EnterpriseProfileItem) {
  try {
    formModalApi.setData(await getEnterpriseProfileDetailApi(row.id)).open();
  } catch (error) {
    showActionFailure(error);
  }
}

async function openDetail(row: EnterpriseProfileItem) {
  try {
    detailDrawerApi.setData(await getEnterpriseProfileDetailApi(row.id)).open();
  } catch (error) {
    showActionFailure(error);
  }
}

async function openDeclarations(row: EnterpriseProfileItem) {
  enterpriseContextStore.setCurrentEnterprise({ id: row.id, name: row.name });
  await router.push({
    name: 'EnterpriseDeclarationList',
    query: { enterpriseId: row.id },
  });
}

async function openServiceJourney(row: EnterpriseProfileItem) {
  enterpriseContextStore.setCurrentEnterprise({ id: row.id, name: row.name });
  await router.push({
    name: 'EnterpriseWorkspace',
    params: { enterpriseId: row.id },
  });
}

async function openMaterialLedger(row: EnterpriseProfileItem) {
  enterpriseContextStore.setCurrentEnterprise({ id: row.id, name: row.name });
  await router.push({
    path: '/enterprise-material-ledger/company',
    query: { enterpriseId: row.id },
  });
}

async function openDeclarationOverview(filters: {
  deadlineWithinDays?: number;
  missingMaterials?: boolean;
  status?: string;
}) {
  await router.push({
    name: 'EnterpriseDeclarationList',
    query: {
      deadlineWithinDays: filters.deadlineWithinDays,
      missingMaterials: filters.missingMaterials ? '1' : undefined,
      status: filters.status,
    },
  });
}

async function openProfileOverview(nextFilters: { incomplete: '1' }) {
  await gridApi.formApi.setValues(nextFilters);
  await gridApi.query();
}

function openAccountManager(row: EnterpriseProfileItem) {
  accountManagerDrawerApi.setData(row).open();
}

onMounted(() => {
  void workspaceOverviewRef.value?.refresh();
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="gridApi.query()" />
    <DetailDrawer />
    <AccountManagerDrawer />
    <ImportWizardDrawer @success="handleCreateSuccess" />
    <ExcelImportModal v-model:open="excelImportOpen" @success="handleExcelImportSuccess" />
    <div class="enterprise-profile-page">
      <EnterpriseWorkspaceOverview
        ref="workspaceOverview"
        @open-declarations="openDeclarationOverview"
        @open-profiles="openProfileOverview"
      />
      <Grid table-title="企业列表">
        <template #toolbar-tools>
          <Button @click="downloadExcelTemplate">下载导入模板</Button>
          <Button @click="exportEnterpriseProfiles">导出企业信息</Button>
          <Button @click="openExcelImport">Excel 导入</Button>
          <Button type="primary" @click="openCreate">
            <Plus class="size-4" />
            添加企业
          </Button>
        </template>
        <template #action="{ row }">
          <VbenTableAction
            :actions="[
              {
                text: '服务进度',
                icon: 'lucide:route',
                onClick: () => openServiceJourney(row),
              },
              {
                text: '材料台账',
                icon: 'lucide:folder-open',
                onClick: () => openMaterialLedger(row),
              },
              {
                text: '申报管理',
                icon: 'lucide:file-text',
                onClick: () => openDeclarations(row),
              },
            ]"
            :dropdown-actions="[
              {
                text: '详情',
                icon: 'lucide:eye',
                onClick: () => openDetail(row),
              },
              {
                text: '编辑',
                icon: 'lucide:edit',
                onClick: () => openEdit(row),
              },
              {
                text: '企业用户',
                icon: 'lucide:users',
                onClick: () => openAccountManager(row),
              },
            ]"
            align="center"
          />
        </template>
      </Grid>
    </div>
  </Page>
</template>

<style scoped>
.enterprise-profile-page {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
}
</style>
