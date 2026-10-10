<script setup lang="ts">
import type { ExcelField, ExcelPreview, ExcelSummary } from '#/api/client/governance';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { Alert, Button, InputNumber, Modal, Select, Table, Tag, message } from 'antdv-next';

import { confirmGovernanceExcelApi, downloadGovernanceIssuesApi, previewGovernanceExcelApi } from '#/api/client/governance';

import { getGovernanceImportErrorMessage, saveGovernanceDownload } from './model';

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ imported: [] }>();
const file = ref<File>();
const preview = ref<ExcelPreview>();
const result = ref<ExcelSummary>();
const busy = ref(false);
const downloading = ref(false);
const changed = ref(false);
const error = ref('');
const sheetName = ref<string>();
const headerRow = ref<number>(1);
const mapping = ref<Partial<Record<ExcelField, number>>>({});
function changeSheetSettings() {
  mapping.value = {};
  changed.value = true;
}
const fields: { key: ExcelField; label: string }[] = [
  { key: 'name', label: '企业名称' },
  { key: 'region', label: '区域' },
  { key: 'salesOwner', label: '销售负责人' },
  { key: 'enterpriseProjects', label: '企业项目' },
  { key: 'preDeclarationYear', label: '预申报年份' },
];
const summary = computed(() => result.value ?? preview.value);
const columns = [
  { title: '原行号', dataIndex: 'rowNumber', width: 80 },
  { title: '企业名称', dataIndex: 'name', width: 200 },
  { title: '区域', dataIndex: 'region', width: 100 },
  { title: '销售负责人', dataIndex: 'salesOwner', width: 120 },
  { title: '企业项目', dataIndex: 'enterpriseProjects', width: 200 },
  { title: '预申报年份', dataIndex: 'preDeclarationYear', width: 110 },
  { title: '状态', dataIndex: 'status', width: 100 },
  { title: '问题说明', dataIndex: 'issues', width: 250 },
];
const statuses = {
  ready: { label: '可导入', color: 'blue' },
  success: { label: '已导入', color: 'green' },
  duplicate: { label: '重复跳过', color: 'orange' },
  error: { label: '校验失败', color: 'red' },
};

watch(open, (value) => {
  if (!value) return;
  file.value = undefined;
  preview.value = undefined;
  result.value = undefined;
  sheetName.value = undefined;
  headerRow.value = 1;
  mapping.value = {};
  changed.value = false;
  error.value = '';
});

async function selectFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const selected = input.files?.[0];
  input.value = '';
  if (!selected) return;
  if (!/\.xlsx$/iu.test(selected.name) || selected.size > 5 * 1024 * 1024) {
    message.error('请选择不超过 5MB 的 .xlsx 文件');
    return;
  }
  file.value = selected;
  preview.value = undefined;
  result.value = undefined;
  await recognize(false);
}

async function recognize(manual = true) {
  if (!file.value || busy.value) return;
  busy.value = true;
  error.value = '';
  // Invalidate the old token before recognizing changed sheet/column settings.
  const options = manual ? { sheetName: sheetName.value, headerRow: headerRow.value, mapping: mapping.value } : {};
  preview.value = undefined;
  result.value = undefined;
  try {
    const data = await previewGovernanceExcelApi(file.value, options);
    preview.value = data;
    sheetName.value = data.sheetName;
    headerRow.value = data.headerRow;
    mapping.value = { ...data.mapping };
    changed.value = false;
  } catch (reason) {
    error.value = getGovernanceImportErrorMessage(reason, '识别失败，请重新上传或重试');
  } finally { busy.value = false; }
}

async function confirm() {
  if (!preview.value || changed.value || result.value || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    result.value = await confirmGovernanceExcelApi(preview.value.token);
    emit('imported');
    message.success(`已导入 ${result.value.success} 家企业`);
  } catch (reason) {
    error.value = getGovernanceImportErrorMessage(reason, '导入失败，请重新预览后重试');
  } finally { busy.value = false; }
}

async function downloadIssues() {
  if (!preview.value) return;
  downloading.value = true;
  try { saveGovernanceDownload(await downloadGovernanceIssuesApi(preview.value.token), '企业建档导入问题明细.xlsx'); }
  catch { /* Request errors are displayed by the shared request client. */ }
  finally { downloading.value = false; }
}
</script>

<template>
  <Modal v-model:open="open" title="导入企业档案" :width="1100" :footer="null" :closable="!busy" :mask-closable="!busy" :keyboard="!busy">
    <div class="import-body">
      <label class="file-picker" :class="{ disabled: busy }">
        <IconifyIcon icon="lucide:upload" class="size-4" />
        <span>{{ file?.name || '选择 Excel 文件' }}</span>
        <input aria-label="选择 Excel 文件" type="file" accept=".xlsx" :disabled="busy" @change="selectFile" />
      </label>
      <Alert v-if="error" type="error" show-icon :message="error" />
      <template v-if="preview">
        <div class="import-settings">
          <label>工作表<Select v-model:value="sheetName" :disabled="busy || !!result" :options="preview.sheets.map((name) => ({ value: name, label: name }))" @change="changeSheetSettings" /></label>
          <label>表头行<InputNumber v-model:value="headerRow" :disabled="busy || !!result" :min="1" :max="30" :precision="0" @change="changeSheetSettings" /></label>
          <label v-for="field in fields" :key="field.key">{{ field.label }}
            <Select v-model:value="mapping[field.key]" allow-clear :disabled="busy || !!result" :options="preview.columns.map((column) => ({ value: column.index, label: `${column.index}. ${column.label}` }))" @change="changed = true" />
          </label>
        </div>
        <Alert v-if="preview.missingFields.length" type="warning" show-icon :message="`缺少字段：${preview.missingFields.join('、')}`" />
        <Alert v-if="changed" type="warning" show-icon message="工作表或字段已变更，请重新预览后再导入" />
      </template>
      <template v-if="summary">
        <div class="import-counts">
          <span>共 {{ summary.total }} 行</span><span>可导入 {{ summary.ready }}</span><span>已导入 {{ summary.success }}</span><span>重复 {{ summary.duplicate }}</span><span>失败 {{ summary.failed }}</span>
        </div>
        <Table :columns="columns" :data-source="summary.rows" row-key="rowNumber" :scroll="{ x: 1160 }" :pagination="{ pageSize: 10, showSizeChanger: true }" size="small">
          <template #bodyCell="{ column, record }">
            <Tag v-if="column.dataIndex === 'status'" :color="statuses[record.status as keyof typeof statuses].color">{{ statuses[record.status as keyof typeof statuses].label }}</Tag>
            <span v-else-if="column.dataIndex === 'issues'">{{ record.issues.join('；') || '-' }}</span>
          </template>
        </Table>
      </template>
      <div class="import-footer">
        <Button :disabled="busy" @click="open = false">{{ result ? '完成' : '取消' }}</Button>
        <Button v-if="file && !result" :loading="busy" @click="recognize()"><IconifyIcon icon="lucide:refresh-cw" class="size-4" />重新预览</Button>
        <Button v-if="preview && !changed && summary && (summary.failed || summary.duplicate)" :loading="downloading" @click="downloadIssues"><IconifyIcon icon="lucide:download" class="size-4" />问题明细</Button>
        <Button v-if="!result" type="primary" :loading="busy" :disabled="!preview || changed || !!preview.missingFields.length || !preview.ready" @click="confirm">确认导入 {{ preview?.ready || 0 }} 家</Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.import-body { display: grid; gap: 16px; min-width: 0; }
.file-picker { display: flex; align-items: center; gap: 8px; padding: 12px; border: 1px dashed hsl(var(--border)); border-radius: 6px; cursor: pointer; overflow-wrap: anywhere; }
.file-picker input { width: 1px; height: 1px; position: absolute; opacity: 0; }
.file-picker:focus-within { outline: 2px solid hsl(var(--primary)); }
.file-picker.disabled { opacity: .5; cursor: default; }
.import-settings { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.import-settings label { display: grid; gap: 6px; min-width: 0; }
.import-settings :deep(.ant-input-number) { width: 100%; }
.import-counts, .import-footer { display: flex; flex-wrap: wrap; gap: 12px; }
.import-footer { justify-content: flex-end; }
</style>
