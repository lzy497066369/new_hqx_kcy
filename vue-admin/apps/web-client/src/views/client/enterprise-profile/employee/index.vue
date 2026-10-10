<script setup lang="ts">
import type {
  ClientEnterpriseEmployeeApi,
} from '#/api/client';
import type { EnterpriseRecordTab } from '../components/table-types';

import { computed, onMounted, ref, shallowRef } from 'vue';

import { Button, Statistic } from 'antdv-next';
import { message } from 'antdv-next';

import {
  confirmClientEmployeeImportApi,
  createClientEmployeeApi,
  deleteClientEmployeeApi,
  downloadClientEmployeeExportApi,
  downloadClientEmployeeTemplateApi,
  getClientEmployeeListApi,
  getClientEmployeeStatsApi,
  previewClientEmployeeImportApi,
  updateClientEmployeeApi,
} from '#/api/client';
import { useClientEnterpriseStore } from '#/store';

import EnterpriseRecordModule from '../modules/EnterpriseRecordModule.vue';
import { employeeColumns } from './data';
import EmployeeImportPreviewModal from './EmployeeImportPreviewModal.vue';
import EmployeeImportUploadModal from './EmployeeImportUploadModal.vue';

defineOptions({ name: 'ClientEnterpriseProfileEmployee' });

const store = useClientEnterpriseStore();
const activeKey = shallowRef('employees');
const loading = shallowRef(false);
const importing = shallowRef(false);
const exporting = shallowRef(false);
const confirmingImport = shallowRef(false);
const errorMessage = shallowRef('');
const importUploadOpen = shallowRef(false);
const importPreviewOpen = shallowRef(false);
const importPreview =
  shallowRef<ClientEnterpriseEmployeeApi.EmployeeImportPreviewResult | null>(null);
const employeeRows = ref<ClientEnterpriseEmployeeApi.Employee[]>([]);
const employeeStats = ref<ClientEnterpriseEmployeeApi.EmployeeStats>({
  activeCount: 0,
  attachmentCount: 0,
  education: {},
  researchCount: 0,
  researchRatio: 0,
  title: {},
  total: 0,
});

const hasCompany = computed(() => Boolean(store.currentCompany));
const moduleError = computed(() => errorMessage.value || store.errorMessage);
const tabs = computed<EnterpriseRecordTab[]>(() => [
  {
    columns: employeeColumns,
    description: '维护员工类型、学历职称、科研属性和人员附件。',
    emptyDescription: '暂无员工资料',
    key: 'employees',
    records: employeeRows.value.map((row) => ({ ...row })),
    title: '员工资料',
  },
]);

onMounted(async () => {
  if (!store.initialized) {
    await store.refreshContext().catch(() => {});
  }
  await loadRecords();
});

async function loadRecords() {
  if (!store.currentCompany) {
    employeeRows.value = [];
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await getClientEmployeeListApi();
    employeeRows.value = result.items;
    employeeStats.value = await getClientEmployeeStatsApi();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : '员工资料加载失败';
  } finally {
    loading.value = false;
  }
}

async function handleDownloadTemplate() {
  try {
    const blob = await downloadClientEmployeeTemplateApi();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '员工花名册模板.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '模板下载失败');
  }
}

async function handleExportEmployees() {
  if (!store.currentCompany) {
    message.warning('请先选择当前企业');
    return;
  }

  exporting.value = true;
  try {
    const blob = await downloadClientEmployeeExportApi();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${store.currentCompanyName || '当前企业'}-员工花名册.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '员工花名册导出失败');
  } finally {
    exporting.value = false;
  }
}

function handleOpenImport() {
  if (!store.currentCompany) {
    message.warning('请先选择当前企业');
    return;
  }
  importUploadOpen.value = true;
}

async function handleUploadSubmit(file: File) {
  importing.value = true;
  try {
    importPreview.value = await previewClientEmployeeImportApi(file);
    importUploadOpen.value = false;
    importPreviewOpen.value = true;
    message.success('员工花名册已解析，请确认后导入');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '员工解析失败');
  } finally {
    importing.value = false;
  }
}

async function handleConfirmImport(skippedKeys: string[]) {
  const preview = importPreview.value;
  if (!preview) {
    return;
  }

  confirmingImport.value = true;
  try {
    const result = await confirmClientEmployeeImportApi(
      preview.materialId,
      skippedKeys,
    );
    await loadRecords();
    importPreviewOpen.value = false;
    importPreview.value = null;
    const summary = result.summary;
    const employeeCount = Number(summary.employeeCount ?? 0);
    const createCount = Number(summary.createCount ?? 0);
    const updateCount = Number(summary.updateCount ?? 0);
    message.success(
      `员工导入完成：写入 ${employeeCount} 条，新增 ${createCount} 条，更新 ${updateCount} 条。`,
    );
  } catch (error) {
    message.error(error instanceof Error ? error.message : '员工导入确认失败');
  } finally {
    confirmingImport.value = false;
  }
}

async function handleCreateRecord(_tabKey: string, record: Record<string, unknown>) {
  const saved = await createClientEmployeeApi(
    record as unknown as ClientEnterpriseEmployeeApi.Employee,
  );
  employeeRows.value = [
    saved,
    ...employeeRows.value,
  ];
  employeeStats.value = await getClientEmployeeStatsApi();
  message.success('员工资料已新增');
}

async function handleUpdateRecord(_tabKey: string, record: Record<string, unknown>) {
  if (!record.id) {
    return;
  }

  const saved = await updateClientEmployeeApi(
    record.id as number | string,
    record as unknown as ClientEnterpriseEmployeeApi.Employee,
  );
  employeeRows.value = employeeRows.value.map((item) =>
    String(item.id) === String(saved.id) ? saved : item,
  );
  employeeStats.value = await getClientEmployeeStatsApi();
  message.success('员工资料已更新');
}

async function handleDeleteRecord(_tabKey: string, record: Record<string, unknown>) {
  if (!record.id) {
    return;
  }

  await deleteClientEmployeeApi(record.id as number | string);
  employeeRows.value = employeeRows.value.filter(
    (item) => String(item.id) !== String(record.id),
  );
  employeeStats.value = await getClientEmployeeStatsApi();
  message.success('员工资料已删除');
}
</script>

<template>
  <EnterpriseRecordModule
    v-model:active-key="activeKey"
    :company-name="store.currentCompanyName"
    description="集中维护员工、科研人员、外籍人员、留学归国人员等人员信息。"
    :error-message="moduleError"
    :has-company="hasCompany"
    :loading="loading || store.loading"
    module-key="employee"
    :tabs="tabs"
    title="员工资料"
    @create-record="handleCreateRecord"
    @delete-record="handleDeleteRecord"
    @update-record="handleUpdateRecord"
  >
    <template #actions>
      <Button :disabled="importing" @click="handleDownloadTemplate">
        下载员工模板
      </Button>
      <Button :loading="exporting" @click="handleExportEmployees">
        导出员工花名册
      </Button>
      <Button :loading="importing" @click="handleOpenImport">
        导入员工花名册
      </Button>
    </template>

    <template #before-table>
      <div class="employee-stat-grid">
        <div class="employee-stat-card">
          <Statistic title="职工总数" :value="employeeStats.total" />
          <span>在职 {{ employeeStats.activeCount }} 人</span>
        </div>
        <div class="employee-stat-card employee-stat-card--accent">
          <Statistic
            suffix="%"
            title="科技人员占比"
            :value="employeeStats.researchRatio"
          />
          <span>科技人员 {{ employeeStats.researchCount }} 人</span>
        </div>
        <div class="employee-stat-card">
          <Statistic title="有附件记录" :value="employeeStats.attachmentCount" />
          <span>劳动合同、社保、学历、职称等</span>
        </div>
      </div>
    </template>
  </EnterpriseRecordModule>

  <EmployeeImportUploadModal
    v-model:open="importUploadOpen"
    :loading="importing"
    @submit="handleUploadSubmit"
  />

  <EmployeeImportPreviewModal
    v-model:open="importPreviewOpen"
    :confirm-loading="confirmingImport"
    :preview="importPreview"
    @confirm="handleConfirmImport"
  />
</template>

<style scoped>
.employee-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.employee-stat-card {
  padding: 16px;
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
}

.employee-stat-card span {
  display: block;
  margin-top: 8px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.employee-stat-card--accent {
  background:
    radial-gradient(circle at top right, hsl(var(--primary) / 18%), transparent 42%),
    hsl(var(--card));
  border-color: hsl(var(--primary) / 30%);
}

@media (max-width: 768px) {
  .employee-stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
