<script setup lang="ts">
import type {
  ClientEnterpriseFinanceApi,
  ClientMaterialApi,
} from '#/api/client';
import type { EnterpriseRecordTab } from '../components/table-types';

import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Button, Modal } from 'antdv-next';
import { message } from 'antdv-next';

import {
  createClientFinancialDataApi,
  createClientTaxAuditApi,
  deleteClientFinancialDataApi,
  deleteClientTaxAuditApi,
  downloadClientMaterialTemplateApi,
  getClientMaterialErrorsApi,
  getClientFinancialDataListApi,
  getClientTaxAuditListApi,
  updateClientFinancialDataApi,
  updateClientTaxAuditApi,
  uploadClientMaterialApi,
} from '#/api/client';
import { useClientEnterpriseStore } from '#/store';

import EnterpriseRecordModule from '../modules/EnterpriseRecordModule.vue';
import FinanceAiParseModal from './components/FinanceAiParseModal.vue';
import { financialDataColumns, taxAuditColumns } from './data';

defineOptions({ name: 'ClientEnterpriseProfileFinance' });

const store = useClientEnterpriseStore();
const route = useRoute();
const activeKey = shallowRef('financial');
const loading = shallowRef(false);
const importing = shallowRef(false);
const errorMessage = shallowRef('');
const fileInputRef = shallowRef<HTMLInputElement | null>(null);
const importErrors = ref<ClientMaterialApi.ClientMaterialError[]>([]);
const importResultOpen = shallowRef(false);
const importResultTitle = shallowRef('导入结果');
const importResultDescription = shallowRef('');
const financeAiParseOpen = shallowRef(false);
const financialRows = ref<ClientEnterpriseFinanceApi.FinancialData[]>([]);
const taxAuditRows = ref<ClientEnterpriseFinanceApi.TaxAudit[]>([]);

const hasCompany = computed(() => Boolean(store.currentCompany));
const moduleError = computed(() => errorMessage.value || store.errorMessage);
const tabs = computed<EnterpriseRecordTab[]>(() => [
  {
    columns: financialDataColumns,
    description: '维护年度销售收入、总资产、研发费用、负债、利润等财务数据。',
    emptyDescription: '暂无财务数据',
    key: 'financial',
    records: financialRows.value.map((row) => ({ ...row })),
    title: '财务数据',
  },
  {
    columns: taxAuditColumns,
    description: '维护纳税申报、审计报告及其他财税附件。',
    emptyDescription: '暂无纳税审计资料',
    key: 'taxAudit',
    records: taxAuditRows.value.map((row) => ({ ...row })),
    title: '纳税审计',
  },
]);

watch(
  () => route.query.tab,
  (tab) => {
    const tabKey = Array.isArray(tab) ? tab[0] : tab;
    if (typeof tabKey !== 'string') {
      return;
    }
    if (tabs.value.some((item) => item.key === tabKey)) {
      activeKey.value = tabKey;
    }
  },
  { immediate: true },
);

onMounted(async () => {
  if (!store.initialized) {
    await store.refreshContext().catch(() => {});
  }
  await loadRecords();
});

async function loadRecords() {
  if (!store.currentCompany) {
    financialRows.value = [];
    taxAuditRows.value = [];
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  try {
    const [financialResult, taxAuditResult] = await Promise.all([
      getClientFinancialDataListApi(),
      getClientTaxAuditListApi(),
    ]);
    financialRows.value = financialResult.items;
    taxAuditRows.value = taxAuditResult.items;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : '财税资料加载失败';
  } finally {
    loading.value = false;
  }
}

async function handleDownloadTemplate() {
  try {
    const blob = await downloadClientMaterialTemplateApi('finance-info');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '财务信息模板.csv';
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '模板下载失败');
  }
}

function handleOpenImport() {
  if (!store.currentCompany) {
    message.warning('请先选择当前企业');
    return;
  }
  fileInputRef.value?.click();
}

function handleOpenFinanceAiParse() {
  if (!store.currentCompany) {
    message.warning('请先选择当前企业');
    return;
  }
  financeAiParseOpen.value = true;
}

async function handleFinanceAiApproved() {
  await loadRecords();
  activeKey.value = 'financial';
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) {
    return;
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    message.warning('当前版本请上传 CSV 文件');
    return;
  }

  importing.value = true;
  try {
    const result = await uploadClientMaterialApi('finance-info', file);
    await loadRecords();
    const summary = result.importSummary;
    const successCount =
      Number(summary?.financialCount ?? 0) + Number(summary?.taxAuditCount ?? 0);
    importResultTitle.value =
      result.status === 'valid'
        ? '财税数据导入成功'
        : result.status === 'partial'
          ? '财税数据部分导入成功'
          : '财税数据导入失败';
    importResultDescription.value = `已写入 ${successCount} 条记录，其中财务数据 ${Number(
      summary?.financialCount ?? 0,
    )} 条，纳税审计 ${Number(summary?.taxAuditCount ?? 0)} 条。`;
    importErrors.value = result.errorCount
      ? await getClientMaterialErrorsApi(result.id)
      : [];
    importResultOpen.value = true;
    if (result.status === 'valid') {
      message.success('财税数据已导入');
    } else if (result.status === 'partial') {
      message.warning('部分数据已导入，请查看错误行');
    } else {
      message.error('导入失败，请查看错误行');
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '财税导入失败');
  } finally {
    importing.value = false;
  }
}

async function handleCreateRecord(tabKey: string, record: Record<string, unknown>) {
  if (tabKey === 'financial') {
    const saved = await createClientFinancialDataApi(
      record as unknown as ClientEnterpriseFinanceApi.FinancialData,
    );
    financialRows.value = [
      saved,
      ...financialRows.value,
    ];
    message.success('财务数据已新增');
    return;
  }

  if (tabKey === 'taxAudit') {
    const saved = await createClientTaxAuditApi(
      record as unknown as ClientEnterpriseFinanceApi.TaxAudit,
    );
    taxAuditRows.value = [
      saved,
      ...taxAuditRows.value,
    ];
    message.success('纳税审计资料已新增');
  }
}

async function handleUpdateRecord(tabKey: string, record: Record<string, unknown>) {
  if (!record.id) {
    return;
  }

  if (tabKey === 'financial') {
    const saved = await updateClientFinancialDataApi(
      record.id as number | string,
      record as unknown as ClientEnterpriseFinanceApi.FinancialData,
    );
    financialRows.value = financialRows.value.map((item) =>
      String(item.id) === String(saved.id) ? saved : item,
    );
    message.success('财务数据已更新');
    return;
  }

  if (tabKey === 'taxAudit') {
    const saved = await updateClientTaxAuditApi(
      record.id as number | string,
      record as unknown as ClientEnterpriseFinanceApi.TaxAudit,
    );
    taxAuditRows.value = taxAuditRows.value.map((item) =>
      String(item.id) === String(saved.id) ? saved : item,
    );
    message.success('纳税审计资料已更新');
  }
}

async function handleDeleteRecord(tabKey: string, record: Record<string, unknown>) {
  if (!record.id) {
    return;
  }

  if (tabKey === 'financial') {
    await deleteClientFinancialDataApi(record.id as number | string);
    financialRows.value = financialRows.value.filter(
      (item) => String(item.id) !== String(record.id),
    );
    message.success('财务数据已删除');
    return;
  }

  if (tabKey === 'taxAudit') {
    await deleteClientTaxAuditApi(record.id as number | string);
    taxAuditRows.value = taxAuditRows.value.filter(
      (item) => String(item.id) !== String(record.id),
    );
    message.success('纳税审计资料已删除');
  }
}
</script>

<template>
  <EnterpriseRecordModule
    v-model:active-key="activeKey"
    :company-name="store.currentCompanyName"
    description="集中维护企业财务数据、纳税申报和审计报告资料。"
    :error-message="moduleError"
    :has-company="hasCompany"
    :loading="loading || store.loading"
    module-key="finance"
    :tabs="tabs"
    title="财税资料"
    @create-record="handleCreateRecord"
    @delete-record="handleDeleteRecord"
    @update-record="handleUpdateRecord"
  >
    <template #actions>
      <Button :disabled="importing" @click="handleDownloadTemplate">
        下载财税模板
      </Button>
      <Button :loading="importing" @click="handleOpenImport">
        导入财税数据
      </Button>
      <Button type="primary" @click="handleOpenFinanceAiParse">
        上传报表/审计 AI 解析
      </Button>
    </template>
  </EnterpriseRecordModule>

  <input
    ref="fileInputRef"
    accept=".csv"
    class="finance-import-input"
    type="file"
    @change="handleFileChange"
  />

  <Modal
    v-model:open="importResultOpen"
    :footer="null"
    :title="importResultTitle"
    width="720px"
  >
    <div class="finance-import-result">
      <p>{{ importResultDescription }}</p>
      <div v-if="importErrors.length" class="finance-import-result__errors">
        <h4>需要处理的错误行</h4>
        <ul>
          <li v-for="error in importErrors" :key="error.id">
            第 {{ error.rowNumber ?? '-' }} 行
            <span v-if="error.fieldName">，{{ error.fieldName }}</span>
            ：{{ error.message }}
            <span v-if="error.suggestion">。建议：{{ error.suggestion }}</span>
          </li>
        </ul>
      </div>
    </div>
  </Modal>

  <FinanceAiParseModal
    v-model:open="financeAiParseOpen"
    @approved="handleFinanceAiApproved"
  />
</template>

<style scoped>
.finance-import-input {
  display: none;
}

.finance-import-result {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.finance-import-result__errors {
  padding: 12px;
  background: hsl(var(--muted) / 45%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.finance-import-result__errors h4 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.finance-import-result__errors ul {
  padding-left: 18px;
  margin: 0;
}

.finance-import-result__errors li + li {
  margin-top: 6px;
}
</style>
