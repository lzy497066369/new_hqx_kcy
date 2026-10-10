<script setup lang="ts">
import type { EnterpriseProfileExcelImportResult } from '#/api';

import { ref, watch } from 'vue';

import { Alert, Button, Modal, Table, Tag } from 'antdv-next';

import { importEnterpriseProfileExcelApi } from '#/api';
import {
  showActionFailure,
  showActionSuccess,
} from '../../../system/shared/action-feedback';

const props = defineProps<{ open: boolean }>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  success: [];
}>();

const file = ref<File>();
const loading = ref(false);
const error = ref('');
const result = ref<EnterpriseProfileExcelImportResult>();

const columns = [
  { title: 'Excel行号', dataIndex: 'rowNumber', key: 'rowNumber', width: 100 },
  { title: '企业名称', dataIndex: 'enterpriseName', key: 'enterpriseName', width: 240 },
  { title: '处理状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '问题说明', dataIndex: 'issues', key: 'issues' },
];

const statusLabels = {
  duplicate: '重复跳过',
  error: '导入失败',
  success: '导入成功',
};

const statusColors = {
  duplicate: 'warning',
  error: 'error',
  success: 'success',
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      file.value = undefined;
      loading.value = false;
      error.value = '';
      result.value = undefined;
    }
  },
);

function close() {
  if (!loading.value) emit('update:open', false);
}

function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const selected = input.files?.[0];
  input.value = '';
  if (!selected) return;
  if (!/\.xlsx$/iu.test(selected.name)) {
    error.value = '请选择 .xlsx 格式的企业档案 Excel 文件';
    file.value = undefined;
    return;
  }
  error.value = '';
  result.value = undefined;
  file.value = selected;
}

async function handleImport() {
  if (!file.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    result.value = await importEnterpriseProfileExcelApi(file.value);
    emit('success');
    showActionSuccess(
      `Excel 导入完成：成功 ${result.value.success} 条，重复 ${result.value.duplicate} 条，失败 ${result.value.failed} 条`,
    );
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Excel 导入失败，请重试';
    showActionFailure(cause);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Modal
    :open="props.open"
    :footer="null"
    :closable="!loading"
    :mask-closable="!loading"
    :keyboard="!loading"
    title="Excel 批量导入企业档案"
    width="960px"
    @cancel="close"
  >
    <div class="excel-import-modal">
      <Alert
        type="info"
        show-icon
        message="请使用企业档案字段模板填写数据。一行一家企业；企业名称、统一社会信用代码、联系人、联系电话、联系邮箱为必填项。"
      />
      <Alert v-if="error" type="error" show-icon :message="error" />

      <div class="excel-import-modal__actions">
        <label class="excel-import-modal__file">
          <span>选择 Excel 文件</span>
          <input
            type="file"
            accept=".xlsx"
            :disabled="loading"
            @change="chooseFile"
          />
        </label>
        <span v-if="file" class="excel-import-modal__filename">
          {{ file.name }}
        </span>
        <Button
          type="primary"
          :disabled="!file || loading"
          :loading="loading"
          @click="handleImport"
        >
          开始导入
        </Button>
      </div>

      <template v-if="result">
        <Alert
          :type="result.failed || result.duplicate ? 'warning' : 'success'"
          show-icon
          :message="`导入完成：成功 ${result.success} 条，重复跳过 ${result.duplicate} 条，失败 ${result.failed} 条。`"
        />
        <Table
          :columns="columns"
          :data-source="result.rows"
          :pagination="{ pageSize: 10 }"
          :scroll="{ x: 760, y: 360 }"
          row-key="rowNumber"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <Tag
              v-if="column.key === 'status'"
              :color="statusColors[record.status as keyof typeof statusColors]"
            >
              {{ statusLabels[record.status as keyof typeof statusLabels] }}
            </Tag>
            <span v-else-if="column.key === 'issues'">
              {{ record.issues.join('；') || '—' }}
            </span>
          </template>
        </Table>
      </template>

      <div class="excel-import-modal__footer">
        <Button :disabled="loading" @click="close">
          {{ result ? '完成' : '取消' }}
        </Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.excel-import-modal {
  display: grid;
  gap: 16px;
}

.excel-import-modal__actions,
.excel-import-modal__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.excel-import-modal__footer {
  justify-content: flex-end;
}

.excel-import-modal__file {
  display: grid;
  gap: 8px;
  font-weight: 500;
}

.excel-import-modal__file input {
  max-width: 100%;
  font-weight: 400;
}

.excel-import-modal__filename {
  color: #475467;
}
</style>
