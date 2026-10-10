<script setup lang="ts">
import type { ClientEnterpriseEmployeeApi } from '#/api/client';

import { computed, shallowRef, watch } from 'vue';

import { Alert, Button, Modal, Statistic, Tag } from 'antdv-next';

defineOptions({ name: 'ClientEmployeeImportPreviewModal' });

const props = defineProps<{
  confirmLoading: boolean;
  open: boolean;
  preview: ClientEnterpriseEmployeeApi.EmployeeImportPreviewResult | null;
}>();

const emit = defineEmits<{
  confirm: [skippedKeys: string[]];
  'update:open': [value: boolean];
}>();

const skippedKeys = shallowRef<Set<string>>(new Set());

const visibleRows = computed(() =>
  (props.preview?.rows ?? []).map((row) => ({
    ...row,
    displayAction: skippedKeys.value.has(row.key) ? 'skip' : row.action,
  })),
);

const summary = computed(() => {
  const rows = visibleRows.value;
  return {
    createCount: rows.filter((row) => row.displayAction === 'create').length,
    errorCount: rows.filter((row) => row.errors.length > 0).length,
    importableCount: rows.filter(
      (row) => row.importable && row.displayAction !== 'skip',
    ).length,
    readCount: rows.length,
    skippedCount: rows.filter((row) => row.displayAction === 'skip').length,
    updateCount: rows.filter((row) => row.displayAction === 'update').length,
  };
});

const canConfirm = computed(() => summary.value.importableCount > 0);

watch(
  () => props.preview?.materialId,
  () => {
    skippedKeys.value = new Set();
  },
);

function closeModal() {
  emit('update:open', false);
}

function toggleSkip(row: ClientEnterpriseEmployeeApi.EmployeeImportPreviewRow) {
  const next = new Set(skippedKeys.value);
  if (next.has(row.key)) {
    next.delete(row.key);
  } else {
    next.add(row.key);
  }
  skippedKeys.value = next;
}

function confirmImport() {
  emit('confirm', [...skippedKeys.value]);
}

function getActionLabel(action: string) {
  const labels: Record<string, string> = {
    create: '新增',
    error: '错误',
    skip: '跳过',
    update: '更新',
  };
  return labels[action] ?? action;
}

function getActionColor(action: string) {
  const colors: Record<string, string> = {
    create: 'green',
    error: 'red',
    skip: 'default',
    update: 'blue',
  };
  return colors[action] ?? 'default';
}

function formatYesNo(value: unknown) {
  if (Number(value) === 1) {
    return '是';
  }
  if (Number(value) === 0) {
    return '否';
  }
  return '-';
}
</script>

<template>
  <Modal
    :open="open"
    title="员工花名册解析预览"
    width="1080px"
    @cancel="closeModal"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="preview" class="employee-import-preview">
      <Alert
        show-icon
        type="info"
        message="请确认本次解析结果。系统只会写入未跳过且无严重错误的员工记录，已存在人员会自动更新。"
      />

      <div class="employee-import-preview__stats">
        <Statistic title="读取行数" :value="summary.readCount" />
        <Statistic title="新增" :value="summary.createCount" />
        <Statistic title="更新" :value="summary.updateCount" />
        <Statistic title="可导入" :value="summary.importableCount" />
        <Statistic title="错误/提示" :value="summary.errorCount" />
        <Statistic title="跳过" :value="summary.skippedCount" />
      </div>

      <div class="employee-import-preview__table-wrap">
        <table class="employee-import-preview__table">
          <thead>
            <tr>
              <th>行号</th>
              <th>处理</th>
              <th>姓名</th>
              <th>身份证号</th>
              <th>部门</th>
              <th>岗位</th>
              <th>科技人员</th>
              <th>在职</th>
              <th>问题提示</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in visibleRows" :key="row.key">
              <td>{{ row.rowNumber }}</td>
              <td>
                <Tag :color="getActionColor(row.displayAction)">
                  {{ getActionLabel(row.displayAction) }}
                </Tag>
              </td>
              <td>{{ row.data.yg_name || '-' }}</td>
              <td>{{ row.data.id_card || '-' }}</td>
              <td>{{ row.data.department || '-' }}</td>
              <td>{{ row.data.position || '-' }}</td>
              <td>{{ formatYesNo(row.data.is_kjyf) }}</td>
              <td>{{ formatYesNo(row.data.is_active) }}</td>
              <td>
                <div v-if="row.errors.length" class="employee-import-preview__errors">
                  <div v-for="error in row.errors" :key="`${row.key}-${error.message}`">
                    {{ error.fieldName ? `${error.fieldName}：` : '' }}{{ error.message }}
                    <span v-if="error.suggestion">，{{ error.suggestion }}</span>
                  </div>
                </div>
                <span v-else>-</span>
              </td>
              <td>
                <Button
                  v-if="row.importable"
                  size="small"
                  @click="toggleSkip(row)"
                >
                  {{ row.displayAction === 'skip' ? '恢复' : '跳过' }}
                </Button>
                <span v-else class="employee-import-preview__muted">不可导入</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <template #footer>
      <Button @click="closeModal">取消</Button>
      <Button
        :disabled="!canConfirm"
        :loading="confirmLoading"
        type="primary"
        @click="confirmImport"
      >
        确认导入
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.employee-import-preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.employee-import-preview__stats {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  padding: 12px;
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.employee-import-preview__table-wrap {
  max-height: 520px;
  overflow: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.employee-import-preview__table {
  width: 100%;
  min-width: 980px;
  font-size: 13px;
  border-collapse: collapse;
}

.employee-import-preview__table th,
.employee-import-preview__table td {
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid hsl(var(--border));
}

.employee-import-preview__table th {
  position: sticky;
  top: 0;
  z-index: 1;
  font-weight: 600;
  background: hsl(var(--background));
}

.employee-import-preview__errors {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 320px;
  color: hsl(var(--destructive));
}

.employee-import-preview__muted {
  color: hsl(var(--muted-foreground));
}

@media (max-width: 900px) {
  .employee-import-preview__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
