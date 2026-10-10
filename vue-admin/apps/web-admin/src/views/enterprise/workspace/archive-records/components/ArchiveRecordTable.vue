<script setup lang="ts">
import type { ArchiveRecordConfig, ArchiveRecordField } from '../archive-record-config';

import { computed } from 'vue';

import { Button, Empty, Tag } from 'antdv-next';

import { getArchiveFieldOption } from '../archive-record-config';

interface Props {
  config: ArchiveRecordConfig;
  records: Array<Record<string, unknown>>;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  deleteRecord: [record: Record<string, unknown>];
  downloadAttachment: [record: Record<string, unknown>];
  editRecord: [record: Record<string, unknown>];
  previewAttachment: [record: Record<string, unknown>];
}>();

const tableMinWidth = computed(() =>
  visibleFields.value.reduce((total, field) => total + (field.width ?? 140), 140),
);
const visibleFields = computed(() =>
  props.config.fields.filter((field) => field.showInTable !== false),
);

function displayValue(record: Record<string, unknown>, field: ArchiveRecordField) {
  const value = record[field.key];
  if (field.kind === 'select') return getArchiveFieldOption(field, value)?.label ?? '-';
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function fieldOption(record: Record<string, unknown>, field: ArchiveRecordField) {
  return getArchiveFieldOption(field, record[field.key]);
}

function canPreview(record: Record<string, unknown>) {
  const attachment = props.config.attachment;
  return Boolean(attachment && record[attachment.field]);
}
</script>

<template>
  <Empty v-if="records.length === 0" :description="`暂无${config.title}资料`" class="archive-record-table__empty" />

  <div v-else class="archive-record-table__scroll">
    <table class="archive-record-table__table" :style="{ minWidth: `${tableMinWidth}px` }">
      <thead>
        <tr>
          <th v-for="field in visibleFields" :key="field.key" :style="{ width: `${field.width ?? 140}px` }">
            {{ field.label }}
          </th>
          <th class="archive-record-table__action">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="record in records" :key="String(record.id)">
          <td v-for="field in visibleFields" :key="field.key">
            <Tag v-if="field.kind === 'select'" :color="fieldOption(record, field)?.color ?? 'default'">
              {{ displayValue(record, field) }}
            </Tag>
            <Button
              v-else-if="field.kind === 'file' && record[field.key]"
              size="small"
              type="link"
              @click="emit('previewAttachment', record)"
            >
              预览附件
            </Button>
            <span v-else class="archive-record-table__cell">{{ displayValue(record, field) }}</span>
          </td>
          <td class="archive-record-table__action">
            <Button v-if="canPreview(record)" size="small" type="link" @click="emit('downloadAttachment', record)">
              下载
            </Button>
            <Button size="small" type="link" @click="emit('editRecord', record)">编辑</Button>
            <Button danger size="small" type="link" @click="emit('deleteRecord', record)">删除</Button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.archive-record-table__empty { padding: 52px 0; }
.archive-record-table__scroll { overflow-x: auto; border: 1px solid hsl(var(--border)); border-radius: 8px; }
.archive-record-table__table { width: 100%; border-collapse: collapse; background: hsl(var(--card)); }
.archive-record-table__table th, .archive-record-table__table td { padding: 12px 14px; font-size: 14px; line-height: 1.5; text-align: left; vertical-align: top; border-bottom: 1px solid hsl(var(--border)); }
.archive-record-table__table th { font-weight: 600; color: hsl(var(--muted-foreground)); white-space: nowrap; background: hsl(var(--muted) / 45%); }
.archive-record-table__table tbody tr:last-child td { border-bottom: 0; }
.archive-record-table__cell { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.archive-record-table__action { width: 170px; min-width: 170px; white-space: nowrap; }
</style>
