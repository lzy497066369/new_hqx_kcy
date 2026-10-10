<script setup lang="ts">
import type { EnterpriseWorkspaceArchiveRecords } from '#/api';

import { computed, reactive, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';
import { Button, Card, InputSearch, Select, Spin, Tabs, TabPane } from 'antdv-next';

import {
  createEnterpriseWorkspaceArchiveRecordApi,
  deleteEnterpriseWorkspaceArchiveRecordApi,
  getEnterpriseWorkspaceArchiveRecordsApi,
  previewEnterpriseWorkspaceAttachmentApi,
  updateEnterpriseWorkspaceArchiveRecordApi,
} from '#/api';
import { confirmAction, showActionFailure, showActionSuccess } from '../../../system/shared/action-feedback';
import { useEnterpriseContextStore } from '#/store';

import ArchiveRecordEditor from './components/ArchiveRecordEditor.vue';
import ArchiveRecordTable from './components/ArchiveRecordTable.vue';
import ContractPdfRecognizeModal from './components/ContractPdfRecognizeModal.vue';
import GaoxinDocumentPackageModal from './components/GaoxinDocumentPackageModal.vue';
import InvoicePdfRecognizeModal from './components/InvoicePdfRecognizeModal.vue';
import {
  archiveRecordConfigs,
  getArchiveLedgerTabs,
  type ArchiveLedgerSection,
  type ArchiveRecordType,
} from './archive-record-config';
import { summarizeAccountLedger } from './account-ledger-summary';

defineOptions({ name: 'EnterpriseWorkspaceArchiveRecords' });

const props = defineProps<{
  section?: ArchiveLedgerSection;
}>();
const route = useRoute();
const enterpriseContextStore = useEnterpriseContextStore();
const activeKey = shallowRef<ArchiveRecordType>('contracts');
const contractRecognitionOpen = shallowRef(false);
const invoiceRecognitionOpen = shallowRef(false);
const editorOpen = shallowRef(false);
const gaoxinPackageOpen = shallowRef(false);
const editingRecord = shallowRef<null | Record<string, unknown>>(null);
const loading = shallowRef(false);
const saving = shallowRef(false);
const records = shallowRef<EnterpriseWorkspaceArchiveRecords>();
const keyword = shallowRef('');
const filters = reactive<Record<string, undefined | number>>({});

const isLedgerView = computed(() => route.name === 'EnterpriseMaterialSection');
const enterpriseId = computed(() => enterpriseContextStore.currentEnterpriseId ?? '');
const activeSection = computed(() => props.section ?? String(route.params.section ?? ''));
const visibleKeys = computed(() => getArchiveLedgerTabs(activeSection.value));
const activeConfig = computed(() => {
  const config = archiveRecordConfigs[activeKey.value];
  if (activeKey.value !== 'invoices') return config;
  return {
    ...config,
    fields: config.fields.map((field) =>
      field.key === 'htId'
        ? {
            ...field,
            options: (records.value?.contracts ?? []).map((contract) => ({
              label: `${contract.htName ?? '未命名合同'}${contract.htNum ? ` (${contract.htNum})` : ''}`,
              value: contract.id,
            })),
          }
        : field,
    ),
  };
});
const currentRows = computed<Record<string, unknown>[]>(() =>
  (records.value?.[activeKey.value] ?? []) as unknown as Array<Record<string, unknown>>,
);
const selectableFields = computed(() => activeConfig.value.fields.filter((field) => field.options?.length));
const accountSummary = computed(() => summarizeAccountLedger(currentRows.value));
const filteredRows = computed(() => {
  const searchText = keyword.value.trim().toLowerCase();
  return currentRows.value.filter((record) => {
    const matchKeyword = !searchText || activeConfig.value.fields.some((field) =>
      field.showInTable !== false &&
      String(record[field.key] ?? '').toLowerCase().includes(searchText),
    );
    const matchFilters = selectableFields.value.every((field) => {
      const filterValue = filters[field.key];
      return filterValue === undefined || String(record[field.key] ?? '') === String(filterValue);
    });
    return matchKeyword && matchFilters;
  });
});
const title = computed(() =>
  visibleKeys.value.length === 1 ? activeConfig.value.title : '合同和发票',
);

watch(
  [activeSection, () => enterpriseContextStore.getMaterialLedgerTab(activeSection.value)],
  () => {
    const requestedTab = enterpriseContextStore.getMaterialLedgerTab(activeSection.value) ?? '';
    activeKey.value = visibleKeys.value.includes(requestedTab as ArchiveRecordType)
      ? (requestedTab as ArchiveRecordType)
      : (visibleKeys.value[0] ?? 'contracts');
    clearFilters();
  },
  { immediate: true },
);

watch(enterpriseId, () => void loadRecords(), { immediate: true });
watch(activeKey, (tab) => {
  clearFilters();
  void syncLedgerTab(tab);
});

async function loadRecords() {
  if (!enterpriseId.value) {
    records.value = undefined;
    return;
  }
  loading.value = true;
  try {
    records.value = await getEnterpriseWorkspaceArchiveRecordsApi(enterpriseId.value);
  } catch (error) {
    showActionFailure(error);
  } finally {
    loading.value = false;
  }
}

function clearFilters() {
  keyword.value = '';
  Object.keys(filters).forEach((key) => delete filters[key]);
}

async function syncLedgerTab(tab: ArchiveRecordType) {
  if (isLedgerView.value) enterpriseContextStore.setMaterialLedgerTab(activeSection.value, tab);
}

function openCreateEditor() {
  editingRecord.value = null;
  editorOpen.value = true;
}

function openEditEditor(record: Record<string, unknown>) {
  editingRecord.value = record;
  editorOpen.value = true;
}

async function saveRecord(payload: Record<string, unknown>) {
  saving.value = true;
  try {
    if (editingRecord.value?.id) {
      await updateEnterpriseWorkspaceArchiveRecordApi(
        enterpriseId.value,
        activeKey.value,
        String(editingRecord.value.id),
        payload,
      );
      showActionSuccess(`${activeConfig.value.title}已更新`);
    } else {
      await createEnterpriseWorkspaceArchiveRecordApi(enterpriseId.value, activeKey.value, payload);
      showActionSuccess(`${activeConfig.value.title}已新增`);
    }
    editorOpen.value = false;
    await loadRecords();
  } catch (error) {
    showActionFailure(error);
  } finally {
    saving.value = false;
  }
}

async function removeRecord(record: Record<string, unknown>) {
  const name = String(record[activeConfig.value.primary] ?? '该记录');
  try {
    await confirmAction(`确认删除“${name}”吗？`, `删除${activeConfig.value.title}`);
    await deleteEnterpriseWorkspaceArchiveRecordApi(
      enterpriseId.value,
      activeKey.value,
      String(record.id),
    );
    showActionSuccess(`${activeConfig.value.title}已删除`);
    await loadRecords();
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') return;
    showActionFailure(error);
  }
}

async function previewAttachment(record: Record<string, unknown>) {
  const attachment = activeConfig.value.attachment;
  if (!attachment) return;
  const filePath = String(record[attachment.field] ?? '').trim();
  if (!filePath) return;
  try {
    const blob = await previewEnterpriseWorkspaceAttachmentApi(
      enterpriseId.value,
      attachment.type,
      String(record.id),
      filePath,
    );
    const previewUrl = URL.createObjectURL(blob);
    window.open(previewUrl, '_blank', 'noopener');
    window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
  } catch (error) {
    showActionFailure(error);
  }
}

async function downloadAttachment(record: Record<string, unknown>) {
  const attachment = activeConfig.value.attachment;
  if (!attachment) return;
  const filePath = String(record[attachment.field] ?? '').trim();
  if (!filePath) return;
  try {
    const blob = await previewEnterpriseWorkspaceAttachmentApi(
      enterpriseId.value,
      attachment.type,
      String(record.id),
      filePath,
    );
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filePath.split('/').pop() || '附件';
    link.href = downloadUrl;
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
  } catch (error) {
    showActionFailure(error);
  }
}

</script>

<template>
  <Page auto-content-height>
    <Spin :spinning="loading">
      <div class="archive-records-page">
        <Card :title="title">
          <template #extra>
            <div class="archive-records-page__header-actions">
              <Button v-if="activeKey === 'documents'" @click="gaoxinPackageOpen = true"><IconifyIcon icon="lucide:sparkles" class="size-4" />AI 生成制度文件包</Button>
              <Button v-if="activeKey === 'contracts'" @click="contractRecognitionOpen = true"><IconifyIcon icon="lucide:sparkles" class="size-4" />AI 识别合同 PDF</Button>
              <Button v-if="activeKey === 'invoices'" @click="invoiceRecognitionOpen = true"><IconifyIcon icon="lucide:receipt-text" class="size-4" />AI 识别发票 PDF</Button>
              <Button v-if="activeConfig.attachment" @click="openCreateEditor"><IconifyIcon icon="lucide:file-up" class="size-4" />上传{{ activeConfig.title }}文件</Button>
              <Button type="primary" @click="openCreateEditor"><Plus class="size-4" />新增{{ activeConfig.title }}</Button>
            </div>
          </template>

          <Tabs v-if="visibleKeys.length > 1" v-model:active-key="activeKey" class="archive-records-page__tabs">
            <TabPane v-for="key in visibleKeys" :key="key" :tab="archiveRecordConfigs[key].title" />
          </Tabs>

          <section v-if="activeKey === 'accounts'" class="archive-records-page__account-summary">
            <div><span>账号总数</span><strong>{{ accountSummary.total }}</strong></div>
            <div><span>启用中</span><strong class="archive-records-page__account-summary--enabled">{{ accountSummary.enabled }}</strong></div>
            <div><span>停用中</span><strong class="archive-records-page__account-summary--disabled">{{ accountSummary.disabled }}</strong></div>
          </section>

          <section class="archive-records-page__toolbar">
            <InputSearch v-model:value="keyword" allow-clear class="archive-records-page__search" :placeholder="`搜索${activeConfig.title}关键字`" />
            <Select
              v-for="field in selectableFields"
              :key="field.key"
              v-model:value="filters[field.key]"
              allow-clear
              class="archive-records-page__filter"
              :options="field.options"
              :placeholder="`筛选${field.label}`"
            />
            <Button @click="clearFilters">清空筛选</Button>
          </section>

          <ArchiveRecordTable
            :config="activeConfig"
            :records="filteredRows"
            @delete-record="removeRecord"
            @download-attachment="downloadAttachment"
            @edit-record="openEditEditor"
            @preview-attachment="previewAttachment"
          />
        </Card>
      </div>
    </Spin>

    <ArchiveRecordEditor
      v-model:open="editorOpen"
      :config="activeConfig"
      :enterprise-id="enterpriseId"
      :record="editingRecord"
      :saving="saving"
      @save="saveRecord"
    />
    <ContractPdfRecognizeModal
      v-model:open="contractRecognitionOpen"
      :enterprise-id="enterpriseId"
      @approved="loadRecords"
    />
    <InvoicePdfRecognizeModal
      v-model:open="invoiceRecognitionOpen"
      :contracts="records?.contracts ?? []"
      :enterprise-id="enterpriseId"
      @approved="loadRecords"
    />
    <GaoxinDocumentPackageModal
      v-model:open="gaoxinPackageOpen"
      :enterprise-id="enterpriseId"
      @adopted="loadRecords"
    />
  </Page>
</template>

<style scoped>
.archive-records-page { display: grid; gap: 16px; }
.archive-records-page__tabs { margin-bottom: 18px; }
.archive-records-page__header-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.archive-records-page__toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
.archive-records-page__search { width: min(360px, 100%); }
.archive-records-page__filter { min-width: 150px; }
.archive-records-page__account-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.archive-records-page__account-summary > div { display: grid; gap: 6px; padding: 14px; background: hsl(var(--muted) / 35%); border: 1px solid hsl(var(--border)); }
.archive-records-page__account-summary span { color: hsl(var(--muted-foreground)); font-size: 13px; }
.archive-records-page__account-summary strong { font-size: 24px; line-height: 1.1; }
.archive-records-page__account-summary--enabled { color: #047857; }
.archive-records-page__account-summary--disabled { color: #6b7280; }
@media (max-width: 720px) { .archive-records-page__search, .archive-records-page__filter { width: 100%; } .archive-records-page__account-summary { grid-template-columns: 1fr; } }
</style>
