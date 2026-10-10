<script setup lang="ts">
import type { ClientEnterprisePropertyApi } from '#/api/client';

import {
  computed,
  onBeforeUnmount,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue';

import { IconifyIcon } from '@vben/icons';
import { useAccessStore } from '@vben/stores';

import { Button, Input, message, Modal, Select, Tag } from 'antdv-next';

import {
  approveClientIpRecognitionDraftsApi,
  deleteClientIpRecognitionDraftApi,
  getClientIpRecognitionDraftsApi,
  getClientIpRecognitionTaskApi,
  rejectClientIpRecognitionDraftsApi,
  retryClientIpRecognitionDraftsApi,
  updateClientIpRecognitionDraftApi,
  uploadClientIpRecognitionPdfsApi,
} from '#/api/client';

import { ipTypeOptions } from '../data';

defineOptions({ name: 'ClientIpPdfImportModal' });

const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{
  approved: [];
}>();
const accessStore = useAccessStore();

type IpDraft =
  ClientEnterprisePropertyApi.AiDraft<ClientEnterprisePropertyApi.IpRecognitionDraftPayload>;
type IpRecognitionTask =
  ClientEnterprisePropertyApi.AiTask<ClientEnterprisePropertyApi.IpRecognitionDraftPayload>;

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInput');
const drafts = ref<IpDraft[]>([]);
const selectedIds = ref<string[]>([]);
const currentTask = ref<IpRecognitionTask | null>(null);
const loading = shallowRef(false);
const uploading = shallowRef(false);
const approving = shallowRef(false);
const dragging = shallowRef(false);
const rejecting = shallowRef(false);
const retrying = shallowRef(false);
const deleting = shallowRef(false);
const pollingTask = shallowRef(false);
const taskPollingTimer = shallowRef<null | number>(null);

const reviewDrafts = computed(() =>
  drafts.value.filter((draft) => draft.status !== 'approved' && draft.status !== 'rejected'),
);
const selectableReviewDrafts = computed(() =>
  reviewDrafts.value.filter(
    (draft) => !isStrongDuplicateDraft(draft) && isOwnerMatchedDraft(draft),
  ),
);
const duplicateReviewDrafts = computed(() =>
  reviewDrafts.value.filter((draft) => isStrongDuplicateDraft(draft)),
);
const approvedDrafts = computed(() =>
  drafts.value.filter((draft) => draft.status === 'approved'),
);
const selectedReviewDrafts = computed(() =>
  reviewDrafts.value.filter((draft) => selectedIds.value.includes(draft.id)),
);
const rejectedDrafts = computed(() =>
  drafts.value.filter((draft) => draft.status === 'rejected'),
);
const allReviewSelected = computed(
  () =>
    selectableReviewDrafts.value.length > 0 &&
    selectableReviewDrafts.value.every((draft) =>
      selectedIds.value.includes(draft.id),
    ),
);
const currentTaskSummary = computed(() => {
  if (!currentTask.value) {
    return '';
  }
  return (
    currentTask.value.result?.summary ??
    currentTask.value.errorMessage ??
    '识别任务处理中，请稍候。'
  );
});
const currentTaskDraftCount = computed(
  () => currentTask.value?.drafts?.length ?? 0,
);

watch(
  () => open.value,
  (value) => {
    if (value) {
      loadDrafts().catch(() => {});
    } else {
      stopTaskPolling();
    }
  },
);

onBeforeUnmount(() => {
  stopTaskPolling();
});

async function loadDrafts() {
  loading.value = true;
  try {
    const result = await getClientIpRecognitionDraftsApi();
    drafts.value = result.items;
    selectedIds.value = result.items
      .filter(
        (draft) =>
          draft.status !== 'approved' &&
          draft.status !== 'rejected' &&
          !isStrongDuplicateDraft(draft) &&
          isOwnerMatchedDraft(draft),
      )
      .map((draft) => draft.id);
  } finally {
    loading.value = false;
  }
}

function openFileDialog() {
  fileInputRef.value?.click();
}

function handleFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  uploadFiles(files).catch(() => {});
}

function handleDrop(event: DragEvent) {
  dragging.value = false;
  const files = Array.from(event.dataTransfer?.files ?? []);
  uploadFiles(files).catch(() => {});
}

async function uploadFiles(files: File[]) {
  const pdfFiles = files.filter((file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
  if (pdfFiles.length === 0) {
    message.warning('请上传 PDF 文件');
    return;
  }
  if (pdfFiles.length > 20) {
    message.warning('单次最多上传 20 个 PDF');
    return;
  }
  const oversized = pdfFiles.find((file) => file.size > 20 * 1024 * 1024);
  if (oversized) {
    message.warning(`${oversized.name} 超过 20MB`);
    return;
  }

  uploading.value = true;
  try {
    const result = await uploadClientIpRecognitionPdfsApi(pdfFiles);
    message.success(`已上传 ${result.total} 个 PDF，识别任务正在后台处理。`);
    await trackIpRecognitionTask(result.taskId);
  } finally {
    uploading.value = false;
  }
}

async function trackIpRecognitionTask(taskId: string) {
  stopTaskPolling();
  await refreshIpRecognitionTask(taskId, true);
}

async function refreshIpRecognitionTask(taskId: string, enablePolling = false) {
  pollingTask.value = true;
  try {
    const task = await getClientIpRecognitionTaskApi(taskId);
    currentTask.value = task;
    if (enablePolling && isRunningTaskStatus(task.status) && open.value) {
      taskPollingTimer.value = window.setTimeout(() => {
        refreshIpRecognitionTask(taskId, true).catch(() => {});
      }, 2000);
      return;
    }

    if (!isRunningTaskStatus(task.status)) {
      await loadDrafts();
    }
  } finally {
    pollingTask.value = false;
  }
}

function stopTaskPolling() {
  if (taskPollingTimer.value) {
    window.clearTimeout(taskPollingTimer.value);
    taskPollingTimer.value = null;
  }
  pollingTask.value = false;
}

function toggleAllReviewDrafts(checked: boolean) {
  selectedIds.value = checked
    ? selectableReviewDrafts.value.map((draft) => draft.id)
    : [];
}

function toggleDraft(id: string, checked: boolean) {
  const draft = drafts.value.find((item) => item.id === id);
  if (draft && !isOwnerMatchedDraft(draft)) {
    message.warning('仅本公司作为权利人的知识产权可以添加到系统');
    return;
  }
  if (draft && isStrongDuplicateDraft(draft)) {
    message.warning('该草稿存在重复风险，请先修改编号或确认正式记录后再勾选');
    return;
  }
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, id])]
    : selectedIds.value.filter((item) => item !== id);
}

function handleToggleAll(event: Event) {
  toggleAllReviewDrafts((event.target as HTMLInputElement).checked);
}

function handleToggleDraft(id: string, event: Event) {
  toggleDraft(id, (event.target as HTMLInputElement).checked);
}

async function saveDraft(draft: IpDraft) {
  const saved = await updateClientIpRecognitionDraftApi(
    draft.id,
    draft.draftPayload,
  );
  drafts.value = drafts.value.map((item) => (item.id === saved.id ? saved : item));
  message.success('识别草稿已保存');
}

async function retrySelectedDrafts() {
  if (selectedReviewDrafts.value.length === 0) {
    message.warning('请选择要重新识别的草稿');
    return;
  }

  retrying.value = true;
  try {
    const result = await retryClientIpRecognitionDraftsApi(
      selectedReviewDrafts.value.map((draft) => draft.id),
    );
    if (result.success.length > 0) {
      message.success(`已重新识别 ${result.success.length} 条草稿`);
    }
    if (result.failed.length > 0) {
      message.warning(`${result.failed.length} 条未重新识别，请检查状态`);
    }
    await trackIpRecognitionTask(result.taskId);
    selectedIds.value = result.success.map((draft) => draft.id);
  } finally {
    retrying.value = false;
  }
}

async function retryDraft(draft: IpDraft) {
  if (draft.status === 'approved') {
    return;
  }

  retrying.value = true;
  try {
    const result = await retryClientIpRecognitionDraftsApi([draft.id]);
    if (result.success.length > 0) {
      message.success('已重新识别草稿');
    }
    if (result.failed.length > 0) {
      message.warning(result.failed[0]?.reason ?? '草稿未重新识别');
    }
    await trackIpRecognitionTask(result.taskId);
    selectedIds.value = result.success.map((item) => item.id);
  } finally {
    retrying.value = false;
  }
}

async function rejectSelectedDrafts() {
  if (selectedReviewDrafts.value.length === 0) {
    message.warning('请选择要标记无效的草稿');
    return;
  }

  rejecting.value = true;
  try {
    const result = await rejectClientIpRecognitionDraftsApi(
      selectedReviewDrafts.value.map((draft) => draft.id),
    );
    if (result.success.length > 0) {
      message.success(`已标记 ${result.success.length} 条无效草稿`);
    }
    if (result.failed.length > 0) {
      message.warning(`${result.failed.length} 条未标记，请检查状态`);
    }
    await loadDrafts();
  } finally {
    rejecting.value = false;
  }
}

function confirmDeleteDraft(draft: IpDraft) {
  Modal.confirm({
    content: '删除后该条识别草稿不可恢复。',
    okText: '删除',
    okType: 'danger',
    title: '删除识别草稿',
    onOk() {
      return deleteDraft(draft);
    },
  });
}

async function deleteDraft(draft: IpDraft) {
  deleting.value = true;
  try {
    await deleteClientIpRecognitionDraftApi(draft.id);
    selectedIds.value = selectedIds.value.filter((id) => id !== draft.id);
    message.success('识别草稿已删除');
    await loadDrafts();
  } finally {
    deleting.value = false;
  }
}

async function approveSelectedDrafts() {
  if (selectedReviewDrafts.value.length === 0) {
    message.warning('请选择要添加到系统的识别结果');
    return;
  }

  approving.value = true;
  try {
    const result = await approveClientIpRecognitionDraftsApi(
      selectedReviewDrafts.value.map((draft) => draft.id),
    );
    if (result.success.length > 0) {
      message.success(`已添加 ${result.success.length} 条知识产权`);
      emit('approved');
    }
    if (result.failed.length > 0) {
      message.warning(
        `${result.failed.length} 条未入库：${formatFailedReasons(result.failed)}`,
      );
    }
    await loadDrafts();
    applyApprovalFailedReasons(result.failed);
  } finally {
    approving.value = false;
  }
}

function getConfidenceTagColor(value: null | number | undefined) {
  const confidence = Number(value ?? 0);
  if (confidence >= 80) {
    return 'success';
  }
  if (confidence >= 60) {
    return 'warning';
  }
  return 'error';
}

function getRecognitionTagColor(
  payload: ClientEnterprisePropertyApi.IpRecognitionDraftPayload,
) {
  if (payload.pdf_text_status === 'success' && Number(payload.confidence ?? 0) >= 60) {
    return 'success';
  }
  if (payload.pdf_text_status === 'success' || payload.soft_work_num) {
    return 'warning';
  }
  return 'error';
}

function getRecognitionStatusText(
  payload: ClientEnterprisePropertyApi.IpRecognitionDraftPayload,
) {
  if (payload.pdf_text_status === 'success' && Number(payload.confidence ?? 0) >= 60) {
    return '识别成功';
  }
  if (payload.pdf_text_status === 'success' || payload.soft_work_num) {
    return '部分识别';
  }
  return '需人工核对';
}

function getRecognitionNote(
  payload: ClientEnterprisePropertyApi.IpRecognitionDraftPayload,
) {
  const note = String(payload.recognition_note ?? '').trim();
  if (/OCR|AI|兜底|乱码|PDF文本片段|pdf文本片段/i.test(note)) {
    return payload.soft_work_num ? '已识别编号，请补全其他字段。' : '未识别完整信息，请人工核对。';
  }
  if (note) {
    return note;
  }
  if (payload.pdf_text_status === 'empty' || payload.pdf_text_status === 'unreadable') {
    return 'PDF 文本不可读，请人工核对。';
  }
  if (payload.pdf_text_status === 'failed') {
    return 'PDF 解析失败，请人工核对。';
  }
  return '请按原 PDF 人工核对。';
}

function getDuplicateTagColor(
  status: ClientEnterprisePropertyApi.IpRecognitionDraftPayload['duplicate_status'],
) {
  if (status === 'existing_record' || status === 'draft_duplicate') {
    return 'error';
  }
  if (status === 'unchecked') {
    return 'warning';
  }
  return 'success';
}

function getDuplicateTagText(
  status: ClientEnterprisePropertyApi.IpRecognitionDraftPayload['duplicate_status'],
) {
  const labels = {
    draft_duplicate: '草稿重复',
    existing_record: '正式记录重复',
    none: '未重复',
    unchecked: '待核对',
  };
  return labels[status ?? 'unchecked'];
}

function getOwnerMatchTagColor(status: string | undefined | null) {
  if (status === 'matched') {
    return 'success';
  }
  if (status === 'mismatched') {
    return 'error';
  }
  return 'warning';
}

function formatFailedReasons(failed: Array<{ draftId: string; reason: string }>) {
  return failed
    .map((item) => `草稿 ${item.draftId}：${item.reason}`)
    .join('；');
}

function applyApprovalFailedReasons(
  failed: Array<{ draftId: string; reason: string }>,
) {
  if (failed.length === 0) {
    return;
  }
  const reasonMap = new Map(
    failed.map((item) => [item.draftId, `入库失败：${item.reason}`]),
  );
  drafts.value = drafts.value.map((draft) => {
    const reason = reasonMap.get(draft.id);
    if (!reason) {
      return draft;
    }
    return {
      ...draft,
      draftPayload: {
        ...draft.draftPayload,
        review_warnings: [
          ...new Set([...(draft.draftPayload.review_warnings ?? []), reason]),
        ],
      },
    };
  });
}

function isStrongDuplicateDraft(draft: IpDraft) {
  return (
    draft.draftPayload.duplicate_status === 'existing_record' ||
    draft.draftPayload.duplicate_status === 'draft_duplicate'
  );
}

function isOwnerMatchedDraft(draft: IpDraft) {
  return draft.draftPayload.right_holder_match_status === 'matched';
}

function isRunningTaskStatus(status: string) {
  return status === 'pending' || status === 'processing';
}

function getDraftStatusColor(status: string) {
  if (status === 'approved') {
    return 'success';
  }
  if (status === 'rejected') {
    return 'default';
  }
  return 'processing';
}

function getTaskStatusColor(status: string) {
  if (status === 'success') {
    return 'success';
  }
  if (status === 'failed') {
    return 'error';
  }
  return 'processing';
}

function getDraftStatusText(status: string) {
  const labels: Record<string, string> = {
    approved: '已入库',
    failed: '识别失败',
    processing: '识别中',
    rejected: '已标记无效',
    reviewing: '待审核',
  };
  return labels[status] ?? '待审核';
}

function getTaskStatusText(status: string) {
  const labels: Record<string, string> = {
    failed: '识别失败',
    pending: '等待识别',
    processing: '识别中',
    success: '识别完成',
  };
  return labels[status] ?? status;
}

function buildProtectedPdfHref(value: unknown) {
  const rawUrl = String(value ?? '').trim();
  const accessToken = accessStore.accessToken;
  if (!rawUrl || !accessToken) {
    return rawUrl;
  }

  try {
    const url = new URL(rawUrl, window.location.origin);
    url.searchParams.set('access_token', accessToken);
    return rawUrl.startsWith('http')
      ? url.toString()
      : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}access_token=${encodeURIComponent(accessToken)}`;
  }
}
</script>

<template>
  <Modal
    v-model:open="open"
    destroy-on-hidden
    :footer="null"
    title="上传识别知识产权 PDF"
    width="100%"
  >
    <div class="ip-pdf-import">
      <button
        class="ip-pdf-import__dropzone"
        :class="{ 'ip-pdf-import__dropzone--dragging': dragging }"
        type="button"
        @click="openFileDialog"
        @dragenter.prevent="dragging = true"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="handleDrop"
      >
        <IconifyIcon icon="lucide:file-up" class="ip-pdf-import__drop-icon" />
        <strong>拖拽 PDF 到这里，或点击选择文件</strong>
        <span>支持一次上传多个知识产权证书 PDF，单个文件不超过 20MB。</span>
      </button>

      <input
        ref="fileInput"
        accept="application/pdf,.pdf"
        multiple
        type="file"
        class="ip-pdf-import__file-input"
        @change="handleFileInput"
      />

      <div v-if="currentTask" class="ip-pdf-import__task-status">
        <div>
          <strong>识别任务 #{{ currentTask.id }}</strong>
          <span>{{ currentTaskSummary }}</span>
        </div>
        <div class="ip-pdf-import__task-meta">
          <Tag :color="getTaskStatusColor(currentTask.status)">
            {{ getTaskStatusText(currentTask.status) }}
          </Tag>
          <span>草稿 {{ currentTaskDraftCount }} 条</span>
          <span v-if="currentTask.resultId">Result #{{ currentTask.resultId }}</span>
          <span v-if="pollingTask">正在刷新状态...</span>
        </div>
      </div>

      <div class="ip-pdf-import__toolbar">
        <div>
          <strong>待审核 {{ reviewDrafts.length }} 条</strong>
          <span>已入库 {{ approvedDrafts.length }} 条</span>
          <span v-if="rejectedDrafts.length">已标记无效 {{ rejectedDrafts.length }} 条</span>
          <span v-if="duplicateReviewDrafts.length" class="ip-pdf-import__duplicate-count">
            {{ duplicateReviewDrafts.length }} 条重复风险
          </span>
        </div>
        <div class="ip-pdf-import__actions">
          <Button :loading="retrying" @click="retrySelectedDrafts">
            重新识别选中草稿
          </Button>
          <Button :loading="rejecting" @click="rejectSelectedDrafts">
            标记选中为无效
          </Button>
          <Button
            type="primary"
            :loading="uploading || approving || retrying || rejecting"
            @click="approveSelectedDrafts"
          >
            批量审核通过并添加到系统
          </Button>
        </div>
      </div>

      <div class="ip-pdf-import__table-wrap">
        <table class="ip-pdf-import__table">
          <colgroup>
            <col style="width: 44px" />
            <col style="width: 96px" />
            <col style="width: 110px" />
            <col style="width: 180px" />
            <col style="width: 220px" />
            <col style="width: 140px" />
            <col style="width: 180px" />
            <col style="width: 140px" />
            <col style="width: 140px" />
            <col style="width: 180px" />
            <col style="width: 100px" />
            <col style="width: 140px" />
            <col style="width: 100px" />
            <col style="width: 150px" />
            <col style="width: 280px" />
            <col style="width: 220px" />
            <col style="width: 96px" />
          </colgroup>
          <thead>
            <tr>
              <th class="ip-pdf-import__check">
                <input
                  :checked="allReviewSelected"
                  type="checkbox"
                  @change="handleToggleAll"
                />
              </th>
              <th>状态</th>
              <th>识别状态</th>
              <th>来源 PDF</th>
              <th>知识产权名称</th>
              <th>类型</th>
              <th>编号</th>
              <th>申请日期</th>
              <th>授权日期</th>
              <th>权利人</th>
              <th>归属</th>
              <th>获得方式</th>
              <th>置信度</th>
              <th>重复检测</th>
              <th>识别说明</th>
              <th>审核提示</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="drafts.length === 0">
              <td colspan="17" class="ip-pdf-import__empty">
                暂无识别草稿，请先上传 PDF。
              </td>
            </tr>
            <tr v-for="draft in drafts" :key="draft.id">
              <td class="ip-pdf-import__check">
                <input
                  :checked="selectedIds.includes(draft.id)"
                  :disabled="
                    draft.status === 'approved' ||
                    draft.status === 'rejected' ||
                    isStrongDuplicateDraft(draft) ||
                    !isOwnerMatchedDraft(draft)
                  "
                  type="checkbox"
                  @change="handleToggleDraft(draft.id, $event)"
                />
              </td>
              <td>
                <Tag :color="getDraftStatusColor(draft.status)">
                  {{ getDraftStatusText(draft.status) }}
                </Tag>
              </td>
              <td>
                <Tag :color="getRecognitionTagColor(draft.draftPayload)">
                  {{ getRecognitionStatusText(draft.draftPayload) }}
                </Tag>
              </td>
              <td>
                <a
                  v-if="draft.draftPayload.soft_work_file"
                  class="ip-pdf-import__source-link"
                  :href="buildProtectedPdfHref(draft.draftPayload.soft_work_file)"
                  rel="noopener noreferrer"
                  target="_blank"
                  :title="draft.draftPayload.source_file_name || '查看 PDF'"
                >
                  {{ draft.draftPayload.source_file_name || '查看 PDF' }}
                </a>
                <span
                  v-else
                  class="ip-pdf-import__source-link"
                  :title="draft.draftPayload.source_file_name || '-'"
                >
                  {{ draft.draftPayload.source_file_name || '-' }}
                </span>
              </td>
              <td>
                <Input
                  v-model:value="draft.draftPayload.soft_work_name"
                  :disabled="draft.status === 'approved'"
                />
              </td>
              <td>
                <Select
                  v-model:value="draft.draftPayload.soft_work_type"
                  :disabled="draft.status === 'approved'"
                  :options="ipTypeOptions"
                />
              </td>
              <td>
                <Input
                  v-model:value="draft.draftPayload.soft_work_num"
                  :disabled="draft.status === 'approved'"
                />
              </td>
              <td>
                <Input
                  v-model:value="draft.draftPayload.apply_date"
                  :disabled="draft.status === 'approved'"
                />
              </td>
              <td>
                <Input
                  v-model:value="draft.draftPayload.authorize_date"
                  :disabled="draft.status === 'approved'"
                />
              </td>
              <td>
                <Input
                  v-model:value="draft.draftPayload.right_holder"
                  :disabled="draft.status === 'approved'"
                />
              </td>
              <td>
                <Tag :color="getOwnerMatchTagColor(draft.draftPayload.right_holder_match_status)">
                  {{ draft.draftPayload.right_holder_match_text || '待核对' }}
                </Tag>
              </td>
              <td>
                <Input
                  v-model:value="draft.draftPayload.obtain_method"
                  :disabled="draft.status === 'approved'"
                />
              </td>
              <td>
                <Tag :color="getConfidenceTagColor(draft.draftPayload.confidence)">
                  {{ draft.draftPayload.confidence ?? '-' }}
                </Tag>
              </td>
              <td class="ip-pdf-import__duplicate">
                <Tag :color="getDuplicateTagColor(draft.draftPayload.duplicate_status)">
                  {{ getDuplicateTagText(draft.draftPayload.duplicate_status) }}
                </Tag>
                <span v-if="draft.draftPayload.duplicate_warning">
                  {{ draft.draftPayload.duplicate_warning }}
                </span>
              </td>
              <td class="ip-pdf-import__note">
                {{ getRecognitionNote(draft.draftPayload) }}
              </td>
              <td>
                <div
                  v-if="draft.draftPayload.review_warnings?.length"
                  class="ip-pdf-import__warnings"
                >
                  <span
                    v-for="warning in draft.draftPayload.review_warnings"
                    :key="warning"
                  >
                    {{ warning }}
                  </span>
                </div>
                <span v-else class="ip-pdf-import__safe-text">无阻断提示</span>
              </td>
              <td>
                <div class="ip-pdf-import__row-actions">
                  <Button
                    size="small"
                    :disabled="draft.status === 'approved' || draft.status === 'rejected'"
                    @click="saveDraft(draft)"
                  >
                    保存
                  </Button>
                  <Button
                    danger
                    size="small"
                    :loading="deleting"
                    @click="confirmDeleteDraft(draft)"
                  >
                    删除
                  </Button>
                  <Button
                    v-if="draft.status === 'rejected'"
                    size="small"
                    :loading="retrying"
                    @click="retryDraft(draft)"
                  >
                    重新识别
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="ip-pdf-import__hint">
        可复制文本版 PDF 会自动识别字段；无法提取文本时仅保留可确认编号，请人工补全后再入库。
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.ip-pdf-import {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ip-pdf-import__dropzone {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  min-height: 144px;
  padding: 20px;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: hsl(var(--muted) / 35%);
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
}

.ip-pdf-import__dropzone--dragging {
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary));
}

.ip-pdf-import__drop-icon {
  width: 32px;
  height: 32px;
  color: hsl(var(--primary));
}

.ip-pdf-import__dropzone span,
.ip-pdf-import__toolbar span:not(.ip-pdf-import__duplicate-count),
.ip-pdf-import__hint {
  color: hsl(var(--muted-foreground));
}

.ip-pdf-import__duplicate-count {
  color: hsl(var(--destructive, 0 84% 60%));
}

.ip-pdf-import__file-input {
  display: none;
}

.ip-pdf-import__task-status {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: hsl(var(--primary) / 6%);
  border: 1px solid hsl(var(--primary) / 18%);
  border-radius: 10px;
}

.ip-pdf-import__task-status > div:first-child {
  display: grid;
  gap: 4px;
}

.ip-pdf-import__task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.ip-pdf-import__task-status span,
.ip-pdf-import__task-meta {
  color: hsl(var(--muted-foreground));
}

.ip-pdf-import__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.ip-pdf-import__toolbar > div:first-child {
  display: flex;
  gap: 12px;
  align-items: center;
}

.ip-pdf-import__actions {
  display: flex;
  gap: 8px;
}

.ip-pdf-import__table-wrap {
  overflow: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.ip-pdf-import__table {
  width: 100%;
  min-width: 2570px;
  border-collapse: collapse;
}

.ip-pdf-import__table th,
.ip-pdf-import__table td {
  padding: 10px;
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid hsl(var(--border));
}

.ip-pdf-import__table th {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 28%);
}

.ip-pdf-import__table td {
  white-space: nowrap;
}

.ip-pdf-import__table td:nth-child(5),
.ip-pdf-import__table td:nth-child(15),
.ip-pdf-import__table td:nth-child(16) {
  white-space: normal;
}

.ip-pdf-import__table td :deep(.ant-input),
.ip-pdf-import__table td :deep(.ant-select) {
  min-width: 100%;
}

.ip-pdf-import__check {
  width: 44px;
  text-align: center;
}

.ip-pdf-import__empty {
  height: 96px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.ip-pdf-import__source-link {
  display: inline-block;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

.ip-pdf-import__note {
  max-width: 260px;
  font-size: 12px;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

.ip-pdf-import__duplicate {
  max-width: 240px;
  font-size: 12px;
  line-height: 1.5;
}

.ip-pdf-import__duplicate span:not(.ant-tag) {
  display: block;
  margin-top: 4px;
  color: hsl(var(--destructive, 0 84% 60%));
}

.ip-pdf-import__warnings {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 220px;
}

.ip-pdf-import__warnings span {
  max-width: 100%;
  padding: 4px 6px;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: hsl(36 80% 32%);
  background: hsl(42 100% 92%);
  border: 1px solid hsl(38 92% 72%);
  border-radius: 6px;
}

.ip-pdf-import__safe-text {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.ip-pdf-import__row-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.ip-pdf-import__hint {
  font-size: 13px;
}
</style>
