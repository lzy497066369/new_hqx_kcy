<script setup lang="ts">
import type { ClientEnterpriseDocumentApi } from '#/api/client';
import type { EnterpriseRecordTab } from '../components/table-types';

import { computed, onMounted, ref, shallowRef } from 'vue';

import { Button as AButton, message } from 'antdv-next';

import {
  createClientRuleDocumentApi,
  deleteClientRuleDocumentApi,
  getClientRuleDocumentListApi,
  updateClientRuleDocumentApi,
} from '#/api/client';
import { useClientEnterpriseStore } from '#/store';

import GaoxinDocumentGenerateModal from './components/GaoxinDocumentGenerateModal.vue';
import EnterpriseRecordModule from '../modules/EnterpriseRecordModule.vue';
import { ruleDocumentColumns } from './data';

defineOptions({ name: 'ClientEnterpriseProfileDocument' });

const store = useClientEnterpriseStore();
const activeKey = shallowRef('documents');
const loading = shallowRef(false);
const errorMessage = shallowRef('');
const generateOpen = shallowRef(false);
const documentRows = ref<ClientEnterpriseDocumentApi.RuleDocument[]>([]);

const hasCompany = computed(() => Boolean(store.currentCompany));
const moduleError = computed(() => errorMessage.value || store.errorMessage);
const tabs = computed<EnterpriseRecordTab[]>(() => [
  {
    columns: ruleDocumentColumns,
    description: '维护管理制度、研发组织机构、成果转化相关制度文件。',
    emptyDescription: '暂无制度文件',
    key: 'documents',
    records: documentRows.value.map((row) => ({ ...row })),
    title: '制度文件',
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
    documentRows.value = [];
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await getClientRuleDocumentListApi();
    documentRows.value = result.items;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : '制度文件加载失败';
  } finally {
    loading.value = false;
  }
}

async function handleCreateRecord(_tabKey: string, record: Record<string, unknown>) {
  const saved = await createClientRuleDocumentApi(
    record as unknown as ClientEnterpriseDocumentApi.RuleDocument,
  );
  documentRows.value = [
    saved,
    ...documentRows.value,
  ];
  message.success('制度文件已新增');
}

async function handleUpdateRecord(_tabKey: string, record: Record<string, unknown>) {
  if (!record.id) {
    return;
  }

  const saved = await updateClientRuleDocumentApi(
    record.id as number | string,
    record as unknown as ClientEnterpriseDocumentApi.RuleDocument,
  );
  documentRows.value = documentRows.value.map((item) =>
    String(item.id) === String(saved.id) ? saved : item,
  );
  message.success('制度文件已更新');
}

async function handleDeleteRecord(_tabKey: string, record: Record<string, unknown>) {
  if (!record.id) {
    return;
  }

  await deleteClientRuleDocumentApi(record.id as number | string);
  documentRows.value = documentRows.value.filter(
    (item) => String(item.id) !== String(record.id),
  );
  message.success('制度文件已删除');
}

function handleAdopted(items: ClientEnterpriseDocumentApi.RuleDocument[]) {
  if (items.length === 0) {
    return;
  }
  const existingIds = new Set(documentRows.value.map((item) => String(item.id)));
  documentRows.value = [
    ...items.filter((item) => !existingIds.has(String(item.id))),
    ...documentRows.value,
  ];
}
</script>

<template>
  <EnterpriseRecordModule
    v-model:active-key="activeKey"
    :company-name="store.currentCompanyName"
    description="集中维护企业制度文件、版本、生效日期和附件。"
    :error-message="moduleError"
    :has-company="hasCompany"
    :loading="loading || store.loading"
    module-key="document"
    :tabs="tabs"
    title="制度文件"
    @create-record="handleCreateRecord"
    @delete-record="handleDeleteRecord"
    @update-record="handleUpdateRecord"
  >
    <template #actions>
      <AButton @click="generateOpen = true">
        AI 生成制度文件包
      </AButton>
    </template>
  </EnterpriseRecordModule>

  <GaoxinDocumentGenerateModal
    v-model:open="generateOpen"
    @adopted="handleAdopted"
  />
</template>
