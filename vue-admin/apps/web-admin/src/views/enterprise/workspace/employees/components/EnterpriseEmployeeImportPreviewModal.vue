<script setup lang="ts">
import type {
  EnterpriseWorkspaceEmployeeImportAction,
  EnterpriseWorkspaceEmployeeImportPreview,
  EnterpriseWorkspaceEmployeeImportPreviewRow,
} from '#/api';

import { computed, shallowRef, watch } from 'vue';

import { Alert, Button, Modal, Statistic, Tag } from 'antdv-next';

interface Props {
  loading: boolean;
  preview?: EnterpriseWorkspaceEmployeeImportPreview;
}

const props = defineProps<Props>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{
  confirm: [skippedKeys: string[]];
}>();

const skippedKeys = shallowRef<Set<string>>(new Set());

const rows = computed(() =>
  (props.preview?.rows ?? []).map((row) => ({
    ...row,
    displayAction: skippedKeys.value.has(row.key) ? 'skip' : row.action,
  })),
);

const summary = computed(() => ({
  createCount: rows.value.filter((row) => row.displayAction === 'create')
    .length,
  errorCount: rows.value.filter((row) => !row.importable).length,
  importableCount: rows.value.filter(
    (row) => row.importable && row.displayAction !== 'skip',
  ).length,
  readCount: rows.value.length,
  skippedCount: rows.value.filter((row) => row.displayAction === 'skip')
    .length,
  updateCount: rows.value.filter((row) => row.displayAction === 'update')
    .length,
  warningCount: rows.value.filter(
    (row) => row.importable && row.errors.length > 0,
  ).length,
}));

watch(
  () => props.preview?.materialId,
  () => {
    skippedKeys.value = new Set();
  },
);

function toggleSkip(row: EnterpriseWorkspaceEmployeeImportPreviewRow) {
  const next = new Set(skippedKeys.value);
  if (next.has(row.key)) next.delete(row.key);
  else next.add(row.key);
  skippedKeys.value = next;
}

function actionColor(action: EnterpriseWorkspaceEmployeeImportAction) {
  return {
    create: 'green',
    error: 'red',
    skip: 'default',
    update: 'blue',
  }[action];
}

function actionLabel(action: EnterpriseWorkspaceEmployeeImportAction) {
  return {
    create: '新增',
    error: '错误',
    skip: '跳过',
    update: '更新',
  }[action];
}

function recognitionModeLabel(
  mode: EnterpriseWorkspaceEmployeeImportPreview['source']['recognitionMode'],
) {
  return {
    excel: 'Excel 表格读取',
    pdf_text: 'PDF 文本识别',
    unknown: '未知',
    vision: '大模型视觉识别',
  }[mode];
}

function fileTypeLabel(
  fileType: EnterpriseWorkspaceEmployeeImportPreview['source']['fileType'],
) {
  return { excel: 'Excel', pdf: 'PDF', unknown: '未知' }[fileType];
}

function formatYesNo(value: null | number | undefined) {
  return value === 1 ? '是' : value === 0 ? '否' : '-';
}

function formatGender(value: null | number | undefined) {
  return value === 1 ? '男' : value === 2 ? '女' : '-';
}

function formatAgeRange(value: null | number | undefined) {
  return (
    {
      1: '30岁以下',
      2: '31-40岁',
      3: '41-50岁',
      4: '50岁及以上',
    }[Number(value)] ?? '-'
  );
}
</script>

<template>
  <Modal v-model:open="open" title="员工名册导入预览" width="1180px">
    <div v-if="preview" class="employee-import-preview">
      <Alert
        message="确认前可跳过单行；错误行不会写入，警告行仍可导入。已存在员工将按身份证号或姓名、部门、职位进行更新。"
        show-icon
        type="info"
      />

      <dl class="employee-import-preview__source">
        <div class="employee-import-preview__source-item">
          <dt>来源文件</dt>
          <dd>{{ preview.source.fileName }}</dd>
        </div>
        <div class="employee-import-preview__source-item">
          <dt>文件类型</dt>
          <dd>{{ fileTypeLabel(preview.source.fileType) }}</dd>
        </div>
        <div class="employee-import-preview__source-item">
          <dt>识别方式</dt>
          <dd>{{ recognitionModeLabel(preview.source.recognitionMode) }}</dd>
        </div>
        <div class="employee-import-preview__source-item">
          <dt>参保单位</dt>
          <dd>{{ preview.source.companyName || '-' }}</dd>
        </div>
        <div class="employee-import-preview__source-item">
          <dt>统一社会信用代码</dt>
          <dd>{{ preview.source.creditCode || '-' }}</dd>
        </div>
        <div class="employee-import-preview__source-item">
          <dt>查询期间</dt>
          <dd>{{ preview.source.queryPeriod || '-' }}</dd>
        </div>
      </dl>

      <div class="employee-import-preview__stats">
        <Statistic title="读取" :value="summary.readCount" />
        <Statistic title="新增" :value="summary.createCount" />
        <Statistic title="更新" :value="summary.updateCount" />
        <Statistic title="可导入" :value="summary.importableCount" />
        <Statistic
          class="employee-import-preview__warning-stat"
          title="警告"
          :value="summary.warningCount"
        />
        <Statistic
          class="employee-import-preview__error-stat"
          title="错误"
          :value="summary.errorCount"
        />
        <Statistic title="跳过" :value="summary.skippedCount" />
      </div>

      <div class="employee-import-preview__table-wrap">
        <table class="employee-import-preview__table">
          <thead>
            <tr>
              <th>行</th>
              <th>结果</th>
              <th>姓名</th>
              <th>身份证号</th>
              <th>性别 / 年龄段</th>
              <th>部门 / 职位</th>
              <th>科技 / 在职</th>
              <th>警告 / 错误</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.key">
              <td>{{ row.rowNumber }}</td>
              <td>
                <Tag :color="actionColor(row.displayAction)">
                  {{ actionLabel(row.displayAction) }}
                </Tag>
              </td>
              <td>{{ row.data.yg_name || '-' }}</td>
              <td>{{ row.data.id_card || '-' }}</td>
              <td>
                {{ formatGender(row.data.yg_sex) }} /
                {{ formatAgeRange(row.data.yg_nl) }}
              </td>
              <td>
                {{ row.data.department || '-' }} /
                {{ row.data.position || '-' }}
              </td>
              <td>
                {{ formatYesNo(row.data.is_kjyf) }} /
                {{ formatYesNo(row.data.is_active) }}
              </td>
              <td>
                <div
                  v-if="row.errors.length"
                  :class="[
                    'employee-import-preview__messages',
                    row.importable
                      ? 'employee-import-preview__messages--warning'
                      : 'employee-import-preview__messages--error',
                  ]"
                >
                  <span
                    v-for="error in row.errors"
                    :key="`${row.key}-${error.fieldName}-${error.message}`"
                  >
                    {{ error.fieldName ? `${error.fieldName}：` : ''
                    }}{{ error.message }}
                  </span>
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
                <span v-else class="employee-import-preview__muted">
                  不可导入
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <template #footer>
      <Button :disabled="loading" @click="open = false">取消</Button>
      <Button
        :disabled="summary.importableCount === 0"
        :loading="loading"
        type="primary"
        @click="emit('confirm', [...skippedKeys])"
      >
        确认导入 {{ summary.importableCount }} 条
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.employee-import-preview {
  display: grid;
  gap: 16px;
}

.employee-import-preview__source {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 20px;
  margin: 0;
  padding: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.employee-import-preview__source-item {
  min-width: 0;
}

.employee-import-preview__source-item dt {
  margin-bottom: 4px;
  color: #6b7280;
  font-size: 12px;
}

.employee-import-preview__source-item dd {
  margin: 0;
  overflow: hidden;
  color: #111827;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.employee-import-preview__stats {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.employee-import-preview__warning-stat :deep(.ant-statistic-content) {
  color: #d97706;
}

.employee-import-preview__error-stat :deep(.ant-statistic-content) {
  color: #dc2626;
}

.employee-import-preview__table-wrap {
  max-height: 480px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.employee-import-preview__table {
  width: 100%;
  min-width: 1120px;
  border-collapse: collapse;
}

.employee-import-preview__table th,
.employee-import-preview__table td {
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid #e5e7eb;
}

.employee-import-preview__table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f9fafb;
}

.employee-import-preview__messages {
  display: grid;
  gap: 4px;
}

.employee-import-preview__messages--warning {
  color: #d97706;
}

.employee-import-preview__messages--error {
  color: #dc2626;
}

.employee-import-preview__muted {
  color: #9ca3af;
}

@media (max-width: 720px) {
  .employee-import-preview__source,
  .employee-import-preview__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
