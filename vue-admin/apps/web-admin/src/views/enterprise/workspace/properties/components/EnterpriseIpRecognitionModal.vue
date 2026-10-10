<script setup lang="ts">
import type { EnterpriseWorkspaceIpRecognitionDraft } from '#/api';
import type { TableColumnsType } from 'antdv-next';

import { computed, onUnmounted, reactive, shallowRef, useTemplateRef, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Checkbox, Empty, Form, FormItem, Input, message, Modal, Select, Table, Tag } from 'antdv-next';

import {
  approveEnterpriseWorkspaceIpRecognitionDraftsApi,
  deleteEnterpriseWorkspaceIpRecognitionDraftApi,
  getEnterpriseWorkspaceIpRecognitionDraftsApi,
  rejectEnterpriseWorkspaceIpRecognitionDraftsApi,
  retryEnterpriseWorkspaceIpRecognitionDraftsApi,
  updateEnterpriseWorkspaceIpRecognitionDraftApi,
  uploadEnterpriseWorkspaceIpRecognitionPdfsApi,
} from '#/api';

defineOptions({ name: 'EnterpriseIpRecognitionModal' });

const props = defineProps<{
  enterpriseId: string;
}>();

const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{
  approved: [];
}>();

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInput');
const drafts = shallowRef<EnterpriseWorkspaceIpRecognitionDraft[]>([]);
const selectedIds = shallowRef<string[]>([]);
const loading = shallowRef(false);
const uploading = shallowRef(false);
const approving = shallowRef(false);
const editing = shallowRef<EnterpriseWorkspaceIpRecognitionDraft>();
const editorOpen = shallowRef(false);
const saving = shallowRef(false);
let pollingTimer: ReturnType<typeof setTimeout> | undefined;
const editForm = reactive({
  apply_date: '',
  authorize_date: '',
  right_holder: '',
  soft_work_name: '',
  soft_work_num: '',
  soft_work_type: undefined as number | undefined,
});

const reviewDrafts = computed(() =>
  drafts.value.filter((draft) => draft.status === 'reviewing'),
);
const processingDrafts = computed(() =>
  drafts.value.filter((draft) => draft.status === 'processing'),
);
const failedDrafts = computed(() =>
  drafts.value.filter((draft) => draft.status === 'failed'),
);
const selectedReviewDrafts = computed(() =>
  reviewDrafts.value.filter((draft) => selectedIds.value.includes(draft.id)),
);
const columns: TableColumnsType<EnterpriseWorkspaceIpRecognitionDraft> = [
  { key: 'select', width: 48 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 94 },
  { dataIndex: ['draftPayload', 'source_file_name'], key: 'source', title: '来源 PDF', width: 180 },
  { dataIndex: ['draftPayload', 'soft_work_name'], key: 'name', title: '知识产权名称', width: 220 },
  { dataIndex: ['draftPayload', 'soft_work_num'], key: 'number', title: '登记号/专利号', width: 180 },
  { dataIndex: ['draftPayload', 'soft_work_type'], key: 'type', title: '类型', width: 112 },
  { dataIndex: ['draftPayload', 'right_holder'], key: 'holder', title: '权利人', width: 180 },
  { dataIndex: ['draftPayload', 'authorize_date'], key: 'date', title: '授权日期', width: 132 },
  { dataIndex: ['draftPayload', 'confidence'], key: 'confidence', title: '置信度', width: 96 },
  { dataIndex: ['draftPayload', 'recognition_note'], key: 'note', title: '识别说明', width: 260 },
  { key: 'actions', title: '操作', fixed: 'right', width: 200 },
];

watch(
  () => [open.value, props.enterpriseId] as const,
  ([visible]) => {
    if (visible) {
      void loadDrafts();
    } else {
      stopPolling();
    }
  },
);

function getStatusLabel(status: string) {
  return { approved: '已入库', failed: '识别失败', processing: '识别中', rejected: '已作废', reviewing: '待审核' }[status] ?? status;
}

function getStatusColor(status: string) {
  return { approved: 'success', failed: 'error', processing: 'processing', rejected: 'default', reviewing: 'warning' }[status] ?? 'default';
}

function getPropertyType(value: null | number | undefined) {
  return ({ 1: '发明专利', 2: '实用新型', 3: '软件著作权', 4: '外观设计' } as Record<number, string>)[value ?? 0] ?? '-';
}

function confidenceColor(value: null | number | undefined) {
  const confidence = Number(value ?? 0);
  return confidence >= 80 ? 'success' : confidence >= 60 ? 'warning' : 'error';
}

async function loadDrafts() {
  if (!props.enterpriseId) {
    return;
  }
  loading.value = true;
  try {
    const result = await getEnterpriseWorkspaceIpRecognitionDraftsApi(props.enterpriseId);
    drafts.value = result.items;
    selectedIds.value = result.items
      .filter((draft) => draft.status === 'reviewing')
      .map((draft) => draft.id);
  } finally {
    loading.value = false;
    syncPolling();
  }
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

function isProcessing(draft: EnterpriseWorkspaceIpRecognitionDraft) {
  return draft.status === 'processing';
}

onUnmounted(stopPolling);

function chooseFiles() {
  fileInputRef.value?.click();
}

function onInputChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  void uploadFiles(files);
}

async function uploadFiles(files: File[]) {
  const pdfFiles = files.filter((file) => /\.pdf$/i.test(file.name) || file.type === 'application/pdf');
  if (pdfFiles.length === 0) {
    message.warning('请选择 PDF 文件');
    return;
  }
  if (pdfFiles.length > 20 || pdfFiles.some((file) => file.size > 20 * 1024 * 1024)) {
    message.warning('单次最多上传 20 个 PDF，单个文件不超过 20MB');
    return;
  }
  uploading.value = true;
  try {
    const result = await uploadEnterpriseWorkspaceIpRecognitionPdfsApi(props.enterpriseId, pdfFiles);
    await loadDrafts();
    message.success(`已上传 ${result.total} 个 PDF，正在识别。`);
  } finally {
    uploading.value = false;
  }
}

function toggleAll(checked: boolean) {
  selectedIds.value = checked ? reviewDrafts.value.map((draft) => draft.id) : [];
}

function toggleDraft(id: string, checked: boolean) {
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, id])]
    : selectedIds.value.filter((item) => item !== id);
}

function openEditor(draft: EnterpriseWorkspaceIpRecognitionDraft) {
  editing.value = draft;
  Object.assign(editForm, {
    apply_date: draft.draftPayload.apply_date ?? '',
    authorize_date: draft.draftPayload.authorize_date ?? '',
    right_holder: draft.draftPayload.right_holder ?? '',
    soft_work_name: draft.draftPayload.soft_work_name ?? '',
    soft_work_num: draft.draftPayload.soft_work_num ?? '',
    soft_work_type: draft.draftPayload.soft_work_type ?? undefined,
  });
  editorOpen.value = true;
}

async function saveDraft() {
  if (!editing.value) {
    return;
  }
  saving.value = true;
  try {
    await updateEnterpriseWorkspaceIpRecognitionDraftApi(
      props.enterpriseId,
      editing.value.id,
      { ...editing.value.draftPayload, ...editForm },
    );
    editorOpen.value = false;
    await loadDrafts();
    message.success('识别草稿已保存');
  } finally {
    saving.value = false;
  }
}

async function rejectDraft(draft: EnterpriseWorkspaceIpRecognitionDraft) {
  await rejectEnterpriseWorkspaceIpRecognitionDraftsApi(props.enterpriseId, [draft.id]);
  await loadDrafts();
  message.success('草稿已标记为无效');
}

async function retryDraft(draft: EnterpriseWorkspaceIpRecognitionDraft) {
  await retryEnterpriseWorkspaceIpRecognitionDraftsApi(props.enterpriseId, [draft.id]);
  await loadDrafts();
  message.success('已重新识别草稿');
}

function confirmDeleteDraft(draft: EnterpriseWorkspaceIpRecognitionDraft) {
  Modal.confirm({
    content: '删除后无法恢复该识别草稿。',
    okText: '删除',
    okType: 'danger',
    title: '删除识别草稿',
    onOk: async () => {
      await deleteEnterpriseWorkspaceIpRecognitionDraftApi(props.enterpriseId, draft.id);
      await loadDrafts();
      message.success('识别草稿已删除');
    },
  });
}

async function approveSelected() {
  if (selectedReviewDrafts.value.length === 0) {
    message.warning('请选择待入库的识别草稿');
    return;
  }
  approving.value = true;
  try {
    const result = await approveEnterpriseWorkspaceIpRecognitionDraftsApi(
      props.enterpriseId,
      selectedReviewDrafts.value.map((draft) => draft.id),
    );
    if (result.success.length > 0) {
      message.success(`已入库 ${result.success.length} 条知识产权`);
      emit('approved');
    }
    if (result.failed.length > 0) {
      message.warning(`${result.failed.length} 条草稿未入库：${result.failed[0]?.reason ?? ''}`);
    }
    await loadDrafts();
  } finally {
    approving.value = false;
  }
}
</script>

<template>
  <Modal v-model:open="open" :footer="null" title="知识产权 PDF 识别" width="min(1440px, calc(100vw - 48px))">
    <div class="recognition-modal">
      <div class="recognition-modal__toolbar">
        <div class="recognition-modal__summary">
          <span>识别中 {{ processingDrafts.length }} 条</span>
          <span>待审核 {{ reviewDrafts.length }} 条</span>
          <span>识别失败 {{ failedDrafts.length }} 条</span>
          <span>已入库 {{ drafts.filter((item) => item.status === 'approved').length }} 条</span>
        </div>
        <div class="recognition-modal__actions">
          <input ref="fileInput" accept="application/pdf,.pdf" class="hidden" multiple type="file" @change="onInputChange" />
          <Button :loading="uploading" @click="chooseFiles"><IconifyIcon icon="lucide:file-up" />上传 PDF</Button>
          <Button type="primary" :loading="approving" @click="approveSelected">审核通过并入库</Button>
        </div>
      </div>

      <Table v-if="drafts.length" :columns="columns" :data-source="drafts" :loading="loading" :pagination="false" :scroll="{ x: 1600, y: 520 }" :row-key="(record: EnterpriseWorkspaceIpRecognitionDraft) => record.id" size="small">
        <template #bodyCell="{ column, record }">
          <Checkbox v-if="column.key === 'select'" :checked="selectedIds.includes(record.id)" :disabled="record.status !== 'reviewing'" @update:checked="(checked) => toggleDraft(record.id, checked)" />
          <Tag v-else-if="column.key === 'status'" :color="getStatusColor(record.status)">{{ getStatusLabel(record.status) }}</Tag>
          <template v-else-if="column.key === 'type'">{{ getPropertyType(record.draftPayload.soft_work_type) }}</template>
          <Tag v-else-if="column.key === 'confidence'" :color="confidenceColor(record.draftPayload.confidence)">{{ record.draftPayload.confidence ?? '-' }}</Tag>
          <span v-else-if="column.key === 'note'" class="recognition-modal__note">{{ record.draftPayload.recognition_note || record.draftPayload.review_warnings?.join('；') || '-' }}</span>
          <div v-else-if="column.key === 'actions'" class="recognition-modal__row-actions">
            <Button size="small" type="link" :disabled="record.status === 'approved' || isProcessing(record)" @click="openEditor(record)">编辑</Button>
            <Button v-if="record.status !== 'approved'" size="small" type="link" :disabled="isProcessing(record)" @click="retryDraft(record)">重新识别</Button>
            <Button v-if="record.status === 'reviewing'" danger size="small" type="link" @click="rejectDraft(record)">作废</Button>
            <Button danger size="small" type="link" @click="confirmDeleteDraft(record)">删除</Button>
          </div>
        </template>
      </Table>
      <Empty v-else-if="!loading" description="暂无识别草稿，可上传知识产权 PDF 进行识别" />
      <div v-if="reviewDrafts.length" class="recognition-modal__footer">
        <Checkbox :checked="reviewDrafts.length > 0 && reviewDrafts.every((draft) => selectedIds.includes(draft.id))" @update:checked="toggleAll">全选待审核草稿</Checkbox>
      </div>
    </div>

    <Modal v-model:open="editorOpen" :confirm-loading="saving" title="编辑识别草稿" @ok="saveDraft">
      <Form :model="editForm" layout="vertical">
        <FormItem label="知识产权名称"><Input v-model:value="editForm.soft_work_name" /></FormItem>
        <FormItem label="登记号/专利号"><Input v-model:value="editForm.soft_work_num" /></FormItem>
        <FormItem label="类型"><Select v-model:value="editForm.soft_work_type" :options="[{ label: '发明专利', value: 1 }, { label: '实用新型', value: 2 }, { label: '软件著作权', value: 3 }, { label: '外观设计', value: 4 }]" /></FormItem>
        <FormItem label="申请日期"><Input v-model:value="editForm.apply_date" /></FormItem>
        <FormItem label="授权日期"><Input v-model:value="editForm.authorize_date" /></FormItem>
        <FormItem label="权利人"><Input v-model:value="editForm.right_holder" /></FormItem>
      </Form>
    </Modal>
  </Modal>
</template>

<style scoped>
.recognition-modal { display: grid; gap: 16px; }
.recognition-modal__toolbar, .recognition-modal__actions, .recognition-modal__summary, .recognition-modal__footer { display: flex; gap: 12px; align-items: center; }
.recognition-modal__toolbar { justify-content: space-between; }
.recognition-modal__summary { color: hsl(var(--muted-foreground)); }
.recognition-modal__note { display: inline-block; max-width: 240px; white-space: normal; color: hsl(var(--muted-foreground)); }
.recognition-modal__row-actions { display: flex; flex-wrap: wrap; gap: 2px; }
@media (max-width: 760px) { .recognition-modal__toolbar { align-items: flex-start; flex-direction: column; }.recognition-modal__actions { flex-wrap: wrap; } }
</style>
