<script setup lang="ts">
import type {
  EnterpriseWorkspaceContract,
  EnterpriseWorkspaceInvoiceRecognitionDraft,
  EnterpriseWorkspaceInvoiceRecognitionDraftPayload,
} from '#/api';
import type { TableColumnsType } from 'antdv-next';

import { computed, onUnmounted, reactive, shallowRef, useTemplateRef, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { Button, Checkbox, Empty, Form, FormItem, Input, message, Modal, Select, Table, Tag } from 'antdv-next';

import {
  approveEnterpriseWorkspaceInvoiceRecognitionDraftsApi,
  deleteEnterpriseWorkspaceInvoiceRecognitionDraftApi,
  getEnterpriseWorkspaceInvoiceRecognitionDraftsApi,
  rejectEnterpriseWorkspaceInvoiceRecognitionDraftsApi,
  retryEnterpriseWorkspaceInvoiceRecognitionDraftsApi,
  updateEnterpriseWorkspaceInvoiceRecognitionDraftApi,
  uploadEnterpriseWorkspaceInvoiceRecognitionPdfsApi,
} from '#/api';
import { showActionFailure } from '../../../../system/shared/action-feedback';

defineOptions({ name: 'InvoicePdfRecognizeModal' });

const props = defineProps<{
  contracts: EnterpriseWorkspaceContract[];
  enterpriseId: string;
}>();
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ approved: [] }>();

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInput');
const drafts = shallowRef<EnterpriseWorkspaceInvoiceRecognitionDraft[]>([]);
const selectedIds = shallowRef<string[]>([]);
const loading = shallowRef(false);
const uploading = shallowRef(false);
const approving = shallowRef(false);
const dragging = shallowRef(false);
const editing = shallowRef<EnterpriseWorkspaceInvoiceRecognitionDraft>();
const editorOpen = shallowRef(false);
const saving = shallowRef(false);
let pollingTimer: ReturnType<typeof setTimeout> | undefined;
const editForm = reactive<EnterpriseWorkspaceInvoiceRecognitionDraftPayload>({
  fp_date: '',
  fp_money: '',
  fp_num: '',
  fp_status: 1,
  ht_id: '',
  remark: '',
  zf_date: '',
});

const reviewDrafts = computed(() => drafts.value.filter((draft) => draft.status === 'reviewing'));
const processingDrafts = computed(() => drafts.value.filter((draft) => draft.status === 'processing'));
const failedDrafts = computed(() => drafts.value.filter((draft) => draft.status === 'failed'));
const approvableReviewDrafts = computed(() => reviewDrafts.value.filter(isApprovable));
const selectedReviewDrafts = computed(() => approvableReviewDrafts.value.filter((draft) => selectedIds.value.includes(draft.id)));
const contractOptions = computed(() => props.contracts.map((contract) => ({
  label: `${contract.htName ?? '未命名合同'}${contract.htNum ? ` (${contract.htNum})` : ''}`,
  value: String(contract.id),
})));
const columns: TableColumnsType<EnterpriseWorkspaceInvoiceRecognitionDraft> = [
  { key: 'select', width: 48 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 94 },
  { dataIndex: ['draftPayload', 'source_file_name'], key: 'source', title: '来源 PDF', width: 180 },
  { dataIndex: ['draftPayload', 'fp_num'], key: 'number', title: '发票号码', width: 150 },
  { dataIndex: ['draftPayload', 'fp_date'], key: 'date', title: '开票日期', width: 120 },
  { dataIndex: ['draftPayload', 'fp_money'], key: 'amount', title: '发票金额', width: 120 },
  { key: 'contract', title: '关联合同', width: 200 },
  { dataIndex: ['draftPayload', 'confidence'], key: 'confidence', title: '置信度', width: 96 },
  { dataIndex: ['draftPayload', 'recognition_note'], key: 'note', title: '识别说明', width: 220 },
  { key: 'actions', title: '操作', fixed: 'right', width: 200 },
];

watch(
  () => [open.value, props.enterpriseId] as const,
  ([visible]) => {
    if (visible) void loadDrafts();
    else stopPolling();
  },
);

onUnmounted(stopPolling);

function getStatusLabel(status: string) {
  return ({ approved: '已入库', failed: '识别失败', processing: '识别中', rejected: '已作废', reviewing: '待审核' }[status] ?? status);
}

function getStatusColor(status: string) {
  return ({ approved: 'success', failed: 'error', processing: 'processing', rejected: 'default', reviewing: 'warning' }[status] ?? 'default');
}

function confidenceColor(value: null | number | undefined) {
  const confidence = Number(value ?? 0);
  return confidence >= 80 ? 'success' : confidence >= 60 ? 'warning' : 'error';
}

function getReviewWarnings(draft: EnterpriseWorkspaceInvoiceRecognitionDraft) {
  return draft.draftPayload.review_warnings ?? [];
}

function isApprovable(draft: EnterpriseWorkspaceInvoiceRecognitionDraft) {
  return draft.status === 'reviewing' && getReviewWarnings(draft).length === 0;
}

function isProcessing(draft: EnterpriseWorkspaceInvoiceRecognitionDraft) {
  return draft.status === 'processing';
}

function getContractName(contractId?: null | string) {
  return props.contracts.find((contract) => String(contract.id) === String(contractId))?.htName ?? '未关联';
}

function stopPolling() {
  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = undefined;
  }
}

function syncPolling() {
  stopPolling();
  if (open.value && processingDrafts.value.length > 0) {
    pollingTimer = setTimeout(() => void loadDrafts(), 2000);
  }
}

async function loadDrafts() {
  if (!props.enterpriseId) return;
  loading.value = true;
  try {
    const result = await getEnterpriseWorkspaceInvoiceRecognitionDraftsApi(props.enterpriseId);
    drafts.value = result.items;
    selectedIds.value = [];
  } catch (error) {
    showActionFailure(error);
  } finally {
    loading.value = false;
    syncPolling();
  }
}

function chooseFiles() {
  fileInputRef.value?.click();
}

function onInputChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  void uploadFiles(files);
}

function onDrop(event: DragEvent) {
  dragging.value = false;
  void uploadFiles(Array.from(event.dataTransfer?.files ?? []));
}

async function uploadFiles(files: File[]) {
  const pdfFiles = files.filter((file) => /\.pdf$/i.test(file.name) || file.type === 'application/pdf');
  if (pdfFiles.length === 0) {
    message.warning('请选择 PDF 发票文件');
    return;
  }
  if (pdfFiles.length > 10 || pdfFiles.some((file) => file.size > 20 * 1024 * 1024)) {
    message.warning('单次最多上传 10 个 PDF，单个文件不超过 20MB');
    return;
  }
  uploading.value = true;
  try {
    const result = await uploadEnterpriseWorkspaceInvoiceRecognitionPdfsApi(props.enterpriseId, pdfFiles);
    await loadDrafts();
    message.success(`已上传 ${result.total} 个 PDF，正在识别。`);
  } catch (error) {
    showActionFailure(error);
  } finally {
    uploading.value = false;
  }
}

function toggleAll(checked: boolean) {
  selectedIds.value = checked ? approvableReviewDrafts.value.map((draft) => draft.id) : [];
}

function toggleDraft(id: string, checked: boolean) {
  const draft = reviewDrafts.value.find((item) => item.id === id);
  if (!draft || !isApprovable(draft)) return;
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, id])]
    : selectedIds.value.filter((item) => item !== id);
}

function openEditor(draft: EnterpriseWorkspaceInvoiceRecognitionDraft) {
  editing.value = draft;
  Object.assign(editForm, {
    fp_date: draft.draftPayload.fp_date ?? '',
    fp_money: draft.draftPayload.fp_money ?? '',
    fp_num: draft.draftPayload.fp_num ?? '',
    fp_status: draft.draftPayload.fp_status ?? 1,
    ht_id: draft.draftPayload.ht_id ?? '',
    remark: draft.draftPayload.remark ?? '',
    zf_date: draft.draftPayload.zf_date ?? '',
  });
  editorOpen.value = true;
}

async function saveDraft() {
  if (!editing.value) return;
  saving.value = true;
  try {
    await updateEnterpriseWorkspaceInvoiceRecognitionDraftApi(
      props.enterpriseId,
      editing.value.id,
      { ...editing.value.draftPayload, ...editForm },
    );
    editorOpen.value = false;
    await loadDrafts();
    message.success('发票识别草稿已保存');
  } catch (error) {
    showActionFailure(error);
  } finally {
    saving.value = false;
  }
}

async function retryDraft(draft: EnterpriseWorkspaceInvoiceRecognitionDraft) {
  try {
    await retryEnterpriseWorkspaceInvoiceRecognitionDraftsApi(props.enterpriseId, [draft.id]);
    await loadDrafts();
    message.success('已重新识别草稿');
  } catch (error) {
    showActionFailure(error);
  }
}

async function rejectDraft(draft: EnterpriseWorkspaceInvoiceRecognitionDraft) {
  try {
    await rejectEnterpriseWorkspaceInvoiceRecognitionDraftsApi(props.enterpriseId, [draft.id]);
    await loadDrafts();
    message.success('草稿已标记为无效');
  } catch (error) {
    showActionFailure(error);
  }
}

function confirmDeleteDraft(draft: EnterpriseWorkspaceInvoiceRecognitionDraft) {
  Modal.confirm({
    content: '删除后无法恢复该识别草稿。',
    okText: '删除',
    okType: 'danger',
    title: '删除识别草稿',
    onOk: async () => {
      await deleteEnterpriseWorkspaceInvoiceRecognitionDraftApi(props.enterpriseId, draft.id);
      await loadDrafts();
      message.success('识别草稿已删除');
    },
  });
}

async function approveSelected() {
  if (selectedReviewDrafts.value.length === 0) {
    message.warning('请选择字段已核对完整的发票草稿');
    return;
  }
  approving.value = true;
  try {
    const result = await approveEnterpriseWorkspaceInvoiceRecognitionDraftsApi(
      props.enterpriseId,
      selectedReviewDrafts.value.map((draft) => draft.id),
    );
    if (result.success.length > 0) {
      message.success(`已入库 ${result.success.length} 条发票`);
      emit('approved');
    }
    if (result.failed.length > 0) message.warning(`${result.failed.length} 条草稿未入库：${result.failed[0]?.reason ?? ''}`);
    await loadDrafts();
  } catch (error) {
    showActionFailure(error);
  } finally {
    approving.value = false;
  }
}
</script>

<template>
  <Modal v-model:open="open" :footer="null" title="发票 PDF 识别" width="min(1440px, calc(100vw - 48px))">
    <div class="recognition-modal">
      <div class="recognition-modal__dropzone" :class="{ 'is-dragging': dragging }" @dragenter.prevent="dragging = true" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="onDrop">
        <IconifyIcon icon="lucide:receipt-text" />
        <span>拖拽发票 PDF 到此处上传，自动识别并尝试关联合同</span>
        <Button :loading="uploading" size="small" @click="chooseFiles">选择 PDF</Button>
      </div>

      <div class="recognition-modal__toolbar">
        <div class="recognition-modal__summary">
          <span>识别中 {{ processingDrafts.length }} 条</span><span>待审核 {{ reviewDrafts.length }} 条</span><span>识别失败 {{ failedDrafts.length }} 条</span>
        </div>
        <div class="recognition-modal__actions">
          <input ref="fileInput" accept="application/pdf,.pdf" class="hidden" multiple type="file" @change="onInputChange" />
          <Button :loading="uploading" @click="chooseFiles"><IconifyIcon icon="lucide:file-up" />上传 PDF</Button>
          <Button type="primary" :loading="approving" @click="approveSelected">审核通过并入库</Button>
        </div>
      </div>

      <Table v-if="drafts.length" :columns="columns" :data-source="drafts" :loading="loading" :pagination="false" :scroll="{ x: 1650, y: 480 }" :row-key="(record: EnterpriseWorkspaceInvoiceRecognitionDraft) => record.id" size="small">
        <template #bodyCell="{ column, record }">
          <Checkbox v-if="column.key === 'select'" :checked="selectedIds.includes(record.id)" :disabled="!isApprovable(record)" @update:checked="(checked) => toggleDraft(record.id, checked)" />
          <Tag v-else-if="column.key === 'status'" :color="getStatusColor(record.status)">{{ getStatusLabel(record.status) }}</Tag>
          <span v-else-if="column.key === 'contract'">{{ getContractName(record.draftPayload.ht_id) }}</span>
          <Tag v-else-if="column.key === 'confidence'" :color="confidenceColor(record.draftPayload.confidence)">{{ record.draftPayload.confidence ?? '-' }}</Tag>
          <div v-else-if="column.key === 'note'" class="recognition-modal__note"><span>{{ record.draftPayload.recognition_note || '-' }}</span><span v-if="getReviewWarnings(record).length" class="recognition-modal__warning">{{ getReviewWarnings(record).join('；') }}</span></div>
          <div v-else-if="column.key === 'actions'" class="recognition-modal__row-actions">
            <Button size="small" type="link" :disabled="record.status === 'approved' || isProcessing(record)" @click="openEditor(record)">编辑</Button>
            <Button v-if="record.status !== 'approved'" size="small" type="link" :disabled="isProcessing(record)" @click="retryDraft(record)">重新识别</Button>
            <Button v-if="record.status === 'reviewing'" danger size="small" type="link" @click="rejectDraft(record)">作废</Button>
            <Button danger size="small" type="link" @click="confirmDeleteDraft(record)">删除</Button>
          </div>
        </template>
      </Table>
      <Empty v-else-if="!loading" description="暂无识别草稿，可拖拽上传发票 PDF 进行识别" />
      <div v-if="reviewDrafts.length" class="recognition-modal__footer"><Checkbox :checked="approvableReviewDrafts.length > 0 && approvableReviewDrafts.every((draft) => selectedIds.includes(draft.id))" @update:checked="toggleAll">全选可入库草稿</Checkbox></div>
    </div>

    <Modal v-model:open="editorOpen" :confirm-loading="saving" title="编辑发票识别草稿" @ok="saveDraft">
      <Form :model="editForm" layout="vertical">
        <FormItem label="发票号码"><Input v-model:value="editForm.fp_num" /></FormItem>
        <FormItem label="开票日期"><Input v-model:value="editForm.fp_date" type="date" /></FormItem>
        <FormItem label="发票金额"><Input v-model:value="editForm.fp_money" /></FormItem>
        <FormItem label="关联合同"><Select v-model:value="editForm.ht_id" allow-clear :options="contractOptions" placeholder="未关联，或选择当前企业合同" /></FormItem>
        <FormItem label="支付日期"><Input v-model:value="editForm.zf_date" type="date" /></FormItem>
        <FormItem label="发票摘要"><Input.TextArea v-model:value="editForm.remark" :rows="3" /></FormItem>
      </Form>
    </Modal>
  </Modal>
</template>

<style scoped>
.recognition-modal { display: grid; gap: 16px; }
.recognition-modal__dropzone { align-items: center; background: hsl(var(--muted) / 42%); border: 1px dashed hsl(var(--border)); cursor: pointer; display: flex; gap: 10px; justify-content: center; min-height: 68px; padding: 12px; }
.recognition-modal__dropzone.is-dragging { background: rgb(14 116 144 / 8%); border-color: rgb(14 116 144); }
.recognition-modal__dropzone :deep(svg) { color: rgb(14 116 144); font-size: 24px; }
.recognition-modal__toolbar, .recognition-modal__actions, .recognition-modal__summary, .recognition-modal__footer { align-items: center; display: flex; gap: 12px; }
.recognition-modal__toolbar { justify-content: space-between; }
.recognition-modal__summary, .recognition-modal__note { color: hsl(var(--muted-foreground)); }
.recognition-modal__note { display: grid; gap: 4px; max-width: 220px; white-space: normal; }
.recognition-modal__warning { color: #b45309; }
.recognition-modal__row-actions { display: flex; flex-wrap: wrap; gap: 2px; }
@media (max-width: 760px) { .recognition-modal__toolbar, .recognition-modal__dropzone { align-items: flex-start; flex-direction: column; } .recognition-modal__actions { flex-wrap: wrap; } }
</style>
