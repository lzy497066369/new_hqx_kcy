<script setup lang="ts">
import type {
  EnterpriseOption,
  EnterpriseTableColumn,
} from '../components/table-types';

import { computed } from 'vue';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import { Empty, Tag } from 'antdv-next';

defineOptions({ name: 'ClientEnterpriseRecordTable' });

interface Props {
  columns: EnterpriseTableColumn[];
  emptyDescription: string;
  moduleKey: string;
  records: Record<string, unknown>[];
  tabKey: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  deleteRecord: [record: Record<string, unknown>];
  editRecord: [record: Record<string, unknown>];
}>();
const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const accessStore = useAccessStore();

const tableMinWidth = computed(() => {
  return props.columns.reduce((total, column) => {
    return total + (column.width ?? column.minWidth ?? 140);
  }, 0);
});

function getCellValue(
  record: Record<string, unknown>,
  column: EnterpriseTableColumn,
) {
  if (column.editorType === 'multiSelect' && column.field.endsWith('_ids')) {
    const labelField = column.field.replace(/_ids$/u, '_labels');
    if (record[labelField]) {
      return record[labelField];
    }
  }
  if (column.field === 'soft_work_name' && record.ip_code) {
    const name = record.soft_work_name ?? record.soft_work_num ?? record.id ?? '';
    return `${record.ip_code}-${name}`;
  }
  if (column.field === 'transformation_name' && record.transformation_code) {
    const name = String(record.transformation_name ?? '')
      .replace(/^成果\d+\s*[-—_:：]\s*/u, '')
      .trim() || '-';
    return `${record.transformation_code}-${name}`;
  }
  return record[column.field];
}

function getOption(column: EnterpriseTableColumn, value: unknown) {
  return column.options?.find((option) => String(option.value) === String(value));
}

function formatCell(value: unknown, column: EnterpriseTableColumn) {
  if (column.editorType === 'multiSelect') {
    const values = parseMultiValue(value);
    if (values.length === 0) {
      return '-';
    }

    return values
      .map((item) => getOption(column, item)?.label ?? item)
      .join('、');
  }

  const option = getOption(column, value);
  if (option) {
    return option.label;
  }

  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
}

function buildFileHref(record: Record<string, unknown>, value: unknown) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return '';
  }

  if (/^(https?:)?\/\//i.test(rawValue)) {
    return rawValue;
  }

  const recordId = String(record.id ?? '').trim();
  if (!recordId) {
    return '';
  }

  const url = new URL(
    buildBackendHref(
      `/client/enterprise-records/${encodeURIComponent(props.moduleKey)}/${encodeURIComponent(props.tabKey)}/${encodeURIComponent(recordId)}/file`,
    ),
    window.location.origin,
  );
  url.searchParams.set('path', rawValue);
  if (accessStore.accessToken) {
    url.searchParams.set('access_token', accessStore.accessToken);
  }
  return url.toString();
}

function buildBackendHref(path: string) {
  if (/^(https?:)?\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedApiUrl = apiURL.replace(/\/+$/u, '');
  if (!normalizedApiUrl || normalizedPath.startsWith(`${normalizedApiUrl}/`)) {
    return normalizedPath;
  }

  if (/^(https?:)?\/\//i.test(normalizedApiUrl)) {
    return new URL(normalizedPath, normalizedApiUrl).toString();
  }

  return `${normalizedApiUrl}${normalizedPath}`;
}

function getRecordKey(record: Record<string, unknown>, index: number) {
  return String(record.id ?? index);
}

function getTagColor(option?: EnterpriseOption) {
  return option?.color ?? 'default';
}

function parseMultiValue(value: unknown) {
  return String(value ?? '')
    .split(/[,，\s]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}
</script>

<template>
  <div class="enterprise-record-table">
    <Empty
      v-if="records.length === 0"
      :description="emptyDescription"
      class="enterprise-record-table__empty"
    />

    <div v-else class="enterprise-record-table__scroll">
      <table
        class="enterprise-record-table__table"
        :style="{ minWidth: `${tableMinWidth}px` }"
      >
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.field"
              :style="{
                minWidth: `${column.minWidth ?? column.width ?? 140}px`,
                width: column.width ? `${column.width}px` : undefined,
              }"
            >
              {{ column.title }}
            </th>
            <th class="enterprise-record-table__action">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(record, index) in records"
            :key="getRecordKey(record, index)"
          >
            <td v-for="column in columns" :key="column.field">
              <a
                v-if="column.customType === 'file' && getCellValue(record, column)"
                :href="buildFileHref(record, getCellValue(record, column))"
                rel="noreferrer"
                target="_blank"
              >
                查看文件
              </a>
              <Tag
                v-else-if="column.customType === 'tag'"
                :color="getTagColor(getOption(column, getCellValue(record, column)))"
              >
                {{ formatCell(getCellValue(record, column), column) }}
              </Tag>
              <span v-else>
                {{ formatCell(getCellValue(record, column), column) }}
              </span>
            </td>
            <td class="enterprise-record-table__action">
              <button
                class="enterprise-record-table__link"
                type="button"
                @click="emit('editRecord', record)"
              >
                编辑
              </button>
              <button
                class="enterprise-record-table__link enterprise-record-table__link--danger"
                type="button"
                @click="emit('deleteRecord', record)"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.enterprise-record-table {
  width: 100%;
}

.enterprise-record-table__empty {
  padding: 48px 0;
}

.enterprise-record-table__scroll {
  width: 100%;
  overflow-x: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.enterprise-record-table__table {
  width: 100%;
  border-collapse: collapse;
  background: hsl(var(--card));
}

.enterprise-record-table__table th,
.enterprise-record-table__table td {
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.5;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid hsl(var(--border));
}

.enterprise-record-table__table th {
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 45%);
}

.enterprise-record-table__table tbody tr:last-child td {
  border-bottom: 0;
}

.enterprise-record-table__action {
  width: 120px;
  min-width: 120px;
  white-space: nowrap;
}

.enterprise-record-table__link {
  padding: 0;
  margin-right: 12px;
  color: hsl(var(--primary));
  cursor: pointer;
  background: transparent;
  border: 0;
}

.enterprise-record-table__link--danger {
  color: hsl(var(--destructive));
}
</style>
