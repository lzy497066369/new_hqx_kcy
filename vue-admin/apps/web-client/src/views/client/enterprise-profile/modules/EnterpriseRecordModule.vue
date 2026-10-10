<script setup lang="ts">
import ClientJourneyTrail from '#/views/client/components/ClientJourneyTrail.vue';
import type { EnterpriseRecordTab } from '../components/table-types';

import { computed, reactive, shallowRef, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  InputSearch,
  message,
  Modal,
  Select,
  Skeleton,
} from 'antdv-next';

import EnterpriseRecordTable from './EnterpriseRecordTable.vue';

defineOptions({ name: 'ClientEnterpriseRecordModule' });

interface Props {
  companyName: string;
  description: string;
  errorMessage?: string;
  hasCompany: boolean;
  loading: boolean;
  moduleKey: string;
  tabs: EnterpriseRecordTab[];
  title: string;
}

const props = defineProps<Props>();
const activeKey = defineModel<string>('activeKey', { required: true });
const emit = defineEmits<{
  createRecord: [tabKey: string, record: Record<string, unknown>];
  deleteRecord: [tabKey: string, record: Record<string, unknown>];
  updateRecord: [tabKey: string, record: Record<string, unknown>];
}>();

const createOpen = shallowRef(false);
const editingRecord = shallowRef<Record<string, unknown> | null>(null);
const keyword = shallowRef('');
const filters = reactive<Record<string, unknown>>({});
const formState = reactive<Record<string, unknown>>({});

const activeTab = computed(() => {
  return props.tabs.find((tab) => tab.key === activeKey.value) ?? props.tabs[0];
});

const filterColumns = computed(() => {
  return (
    activeTab.value?.columns.filter(
      (column) => column.options?.length && column.editorType !== 'multiSelect',
    ) ?? []
  );
});

const formGroups = computed(() => {
  const columns =
    activeTab.value?.columns.filter((column) => !column.readonly) ?? [];
  const groups = new Map<string, typeof columns>();
  for (const column of columns) {
    const group = column.formGroup ?? '基础信息';
    groups.set(group, [...(groups.get(group) ?? []), column]);
  }
  return [...groups.entries()].map(([title, groupColumns]) => ({
    columns: groupColumns,
    title,
  }));
});

const filteredRecords = computed(() => {
  const tab = activeTab.value;
  if (!tab) {
    return [];
  }

  const searchText = keyword.value.trim().toLowerCase();

  return tab.records.filter((record) => {
    const matchKeyword = searchText
      ? tab.columns.some((column) => {
          const value = record[column.field];
          return value === null || value === undefined
            ? false
            : String(value).toLowerCase().includes(searchText);
        })
      : true;

    const matchFilters = filterColumns.value.every((column) => {
      const filterValue = filters[column.field];
      return filterValue === undefined ||
        filterValue === null ||
        filterValue === ''
        ? true
        : String(record[column.field]) === String(filterValue);
    });

    return matchKeyword && matchFilters;
  });
});

watch(
  () => activeKey.value,
  () => {
    keyword.value = '';
    Object.keys(filters).forEach((key) => delete filters[key]);
    resetFormState();
  },
);

function getPlaceholder(field: string) {
  if (field.includes('date')) {
    return '例如 2026-01-01';
  }

  if (field.includes('year')) {
    return '例如 2026';
  }

  if (field.includes('path') || field.includes('file')) {
    return '请输入文件地址';
  }

  return '请输入';
}

function getFieldPlaceholder(field: string, placeholder?: string) {
  return placeholder ?? getPlaceholder(field);
}

function resetFormState() {
  Object.keys(formState).forEach((key) => delete formState[key]);

  activeTab.value?.columns
    .filter((column) => !column.readonly)
    .forEach((column) => {
      formState[column.field] =
        column.editorType === 'multiSelect'
          ? []
          : (column.options?.[0]?.value ?? '');
    });
}

function openCreateModal() {
  editingRecord.value = null;
  resetFormState();
  createOpen.value = true;
}

function openEditModal(record: Record<string, unknown>) {
  editingRecord.value = record;
  resetFormState();
  activeTab.value?.columns
    .filter((column) => !column.readonly)
    .forEach((column) => {
      const value = record[column.field] ?? '';
      formState[column.field] =
        column.editorType === 'multiSelect'
          ? parseMultiSelectValue(value)
          : value;
    });
  createOpen.value = true;
}

function submitCreate() {
  const tab = activeTab.value;
  if (!tab) {
    return;
  }

  const missingField = tab.columns.find(
    (column) =>
      !column.readonly &&
      column.required &&
      !String(formState[column.field] ?? '').trim(),
  );
  if (missingField) {
    message.warning(`请填写${missingField.title}`);
    return;
  }

  const payload = {
    ...normalizeFormState(),
    id: editingRecord.value?.id ?? `${tab.key}-${Date.now()}`,
  };

  if (editingRecord.value) {
    emit('updateRecord', tab.key, payload);
  } else {
    emit('createRecord', tab.key, payload);
  }

  createOpen.value = false;
}

function normalizeFormState() {
  const payload: Record<string, unknown> = {};
  activeTab.value?.columns
    .filter((column) => !column.readonly)
    .forEach((column) => {
      const value = formState[column.field];
      payload[column.field] =
        column.editorType === 'multiSelect' && Array.isArray(value)
          ? value.join(',')
          : value;
    });
  return payload;
}

function parseMultiSelectValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  return String(value ?? '')
    .split(/[,，\s]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function confirmDelete(record: Record<string, unknown>) {
  const tab = activeTab.value;
  if (!tab) {
    return;
  }

  Modal.confirm({
    content: `确认删除这条${tab.title}记录吗？删除后不可恢复。`,
    okText: '删除',
    okType: 'danger',
    title: `删除${tab.title}`,
    onOk() {
      if (!record.id) {
        message.warning('当前记录缺少 ID，无法删除');
        return;
      }
      emit('deleteRecord', tab.key, record);
    },
  });
}
</script>

<template>
  <Page auto-content-height>
    <ClientJourneyTrail />
    <div class="enterprise-record-module">
      <Alert
        v-if="errorMessage"
        show-icon
        type="warning"
        :message="errorMessage"
      />

      <section class="enterprise-record-module__header">
        <div>
          <div class="enterprise-record-module__eyebrow">
            {{ companyName || '当前企业' }}
          </div>
          <h1 class="enterprise-record-module__title">{{ title }}</h1>
          <p class="enterprise-record-module__description">
            {{ description }}
          </p>
        </div>
      </section>

      <Skeleton v-if="loading && hasCompany" active />

      <Empty
        v-else-if="!hasCompany"
        description="请先选择当前企业"
        class="enterprise-record-module__empty"
      />

      <Card v-else variant="borderless" class="enterprise-record-module__card">
        <div class="enterprise-record-module__tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="enterprise-record-module__tab"
            :class="{
              'enterprise-record-module__tab--active': tab.key === activeKey,
            }"
            type="button"
            @click="activeKey = tab.key"
          >
            <span>{{ tab.title }}</span>
            <small>{{ tab.records.length }}</small>
          </button>
        </div>

        <div v-if="activeTab" class="enterprise-record-module__body">
          <div class="enterprise-record-module__body-header">
            <div>
              <h2 class="enterprise-record-module__section-title">
                {{ activeTab.title }}
              </h2>
              <p
                v-if="activeTab.description"
                class="enterprise-record-module__section-description"
              >
                {{ activeTab.description }}
              </p>
            </div>
            <div class="enterprise-record-module__actions">
              <slot name="actions" :active-tab="activeTab" />
              <Button type="primary" @click="openCreateModal">
                <IconifyIcon icon="lucide:plus" class="size-4" />
                新增{{ activeTab.title }}
              </Button>
            </div>
          </div>

          <div class="enterprise-record-module__toolbar">
            <InputSearch
              v-model:value="keyword"
              allow-clear
              class="enterprise-record-module__search"
              :placeholder="`搜索${activeTab.title}关键字`"
            />
            <Select
              v-for="column in filterColumns"
              :key="column.field"
              v-model:value="filters[column.field]"
              allow-clear
              class="enterprise-record-module__filter"
              :options="column.options"
              :placeholder="`筛选${column.title}`"
            />
            <Button
              @click="
                keyword = '';
                Object.keys(filters).forEach((key) => delete filters[key]);
              "
            >
              清空筛选
            </Button>
          </div>

          <slot name="before-table" :active-tab="activeTab" />

          <EnterpriseRecordTable
            :columns="activeTab.columns"
            :empty-description="activeTab.emptyDescription"
            :module-key="moduleKey"
            :records="filteredRecords"
            :tab-key="activeTab.key"
            @delete-record="confirmDelete"
            @edit-record="openEditModal"
          />
        </div>
      </Card>

      <Modal
        v-model:open="createOpen"
        destroy-on-hidden
        :title="
          activeTab
            ? `${editingRecord ? '编辑' : '新增'}${activeTab.title}`
            : '维护记录'
        "
        width="720px"
        @ok="submitCreate"
      >
        <div v-if="activeTab" class="enterprise-record-module__form">
          <section
            v-for="group in formGroups"
            :key="group.title"
            class="enterprise-record-module__form-section"
          >
            <h3 class="enterprise-record-module__form-section-title">
              {{ group.title }}
            </h3>
            <div class="enterprise-record-module__form-grid">
              <label
                v-for="column in group.columns"
                :key="column.field"
                class="enterprise-record-module__form-item"
                :class="{
                  'enterprise-record-module__form-item--wide':
                    column.formSpan === 2,
                }"
              >
                <span>{{ column.title }}<i v-if="column.required">*</i></span>
                <Select
                  v-if="column.options?.length"
                  v-model:value="formState[column.field]"
                  :mode="
                    column.editorType === 'multiSelect' ? 'multiple' : undefined
                  "
                  :options="column.options"
                  :placeholder="`请选择${column.title}`"
                />
                <DatePicker
                  v-else-if="column.editorType === 'date'"
                  v-model:value="formState[column.field]"
                  class="w-full"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                />
                <Input.TextArea
                  v-else-if="column.editorType === 'textarea'"
                  v-model:value="formState[column.field]"
                  :auto-size="{ minRows: 2, maxRows: 4 }"
                  :placeholder="
                    getFieldPlaceholder(column.field, column.placeholder)
                  "
                />
                <Input
                  v-else
                  v-model:value="formState[column.field]"
                  :placeholder="
                    getFieldPlaceholder(column.field, column.placeholder)
                  "
                />
              </label>
            </div>
          </section>
        </div>
      </Modal>
    </div>
  </Page>
</template>

<style scoped>
.enterprise-record-module {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}

.enterprise-record-module__header {
  padding: 24px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.enterprise-record-module__eyebrow {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.enterprise-record-module__title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.enterprise-record-module__description {
  max-width: 760px;
  margin: 10px 0 0;
  color: hsl(var(--muted-foreground));
}

.enterprise-record-module__empty {
  padding: 56px 0;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.enterprise-record-module__card {
  border: 1px solid hsl(var(--border));
}

.enterprise-record-module__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 18px;
  border-bottom: 1px solid hsl(var(--border));
}

.enterprise-record-module__tab {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  font-size: 14px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: hsl(var(--muted) / 45%);
  border: 1px solid transparent;
  border-radius: 8px;
}

.enterprise-record-module__tab--active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 28%);
}

.enterprise-record-module__tab small {
  min-width: 20px;
  padding: 0 6px;
  font-size: 12px;
  line-height: 20px;
  text-align: center;
  background: hsl(var(--background));
  border-radius: 999px;
}

.enterprise-record-module__body {
  margin-top: 18px;
}

.enterprise-record-module__body-header {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.enterprise-record-module__section-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.enterprise-record-module__section-description {
  margin: 6px 0 0;
  color: hsl(var(--muted-foreground));
}

.enterprise-record-module__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.enterprise-record-module__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.enterprise-record-module__search {
  min-width: 240px;
  max-width: 360px;
}

.enterprise-record-module__filter {
  min-width: 180px;
}

.enterprise-record-module__form {
  display: grid;
  gap: 16px;
}

.enterprise-record-module__form-section {
  display: grid;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid hsl(var(--border));
}

.enterprise-record-module__form-section:first-child {
  padding-top: 0;
  border-top: 0;
}

.enterprise-record-module__form-section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.enterprise-record-module__form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.enterprise-record-module__form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

.enterprise-record-module__form-item--wide {
  grid-column: 1 / -1;
}

.enterprise-record-module__form-item i {
  margin-left: 4px;
  font-style: normal;
  color: hsl(var(--destructive));
}

@media (max-width: 768px) {
  .enterprise-record-module__form-grid {
    grid-template-columns: 1fr;
  }

  .enterprise-record-module__form-item--wide {
    grid-column: auto;
  }
}
</style>
