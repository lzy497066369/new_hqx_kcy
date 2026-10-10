<script setup lang="ts">
import type { ClientEnterprisePropertyApi } from '#/api/client';

import { computed, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue';

import { Button, Input, InputNumber, message, Modal, Tag } from 'antdv-next';

import {
  approveClientResearchGenerationDraftsApi,
  createClientResearchAutoMatchTaskApi,
  createClientResearchGenerationTaskApi,
  deleteClientResearchGenerationDraftApi,
  deleteClientResearchGenerationDraftsApi,
  getClientResearchGenerationDraftsApi,
  getClientResearchGenerationSourcesApi,
  getClientResearchGenerationTaskApi,
  previewClientResearchAutoMatchApi,
  rejectClientResearchGenerationDraftsApi,
  updateClientResearchGenerationDraftApi,
} from '#/api/client';

defineOptions({ name: 'ClientResearchProjectAiGenerateModal' });

const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{
  approved: [];
}>();

type Source = ClientEnterprisePropertyApi.ResearchGenerationSource;
type Draft =
  ClientEnterprisePropertyApi.AiDraft<ClientEnterprisePropertyApi.ResearchGenerationDraftPayload>;
type AiTask =
  ClientEnterprisePropertyApi.AiTask<ClientEnterprisePropertyApi.ResearchGenerationDraftPayload>;
type AutoMatchPreview = ClientEnterprisePropertyApi.ResearchAutoMatchPreview;

const currentYear = new Date().getFullYear();
const sources = ref<Source[]>([]);
const drafts = ref<Draft[]>([]);
const currentTask = ref<AiTask | null>(null);
const autoMatchPreview = ref<AutoMatchPreview | null>(null);
const selectedSourceIds = ref<string[]>([]);
const selectedDraftIds = ref<string[]>([]);
const loading = shallowRef(false);
const autoMatching = shallowRef(false);
const previewingAutoMatch = shallowRef(false);
const generating = shallowRef(false);
const approving = shallowRef(false);
const deleting = shallowRef(false);
const autoMatchTargetCount = shallowRef(6);
const rejecting = shallowRef(false);
const pollingTask = shallowRef(false);
const taskPollingTimer = shallowRef<null | number>(null);
const form = reactive({
  endDate: `${currentYear}-12-31`,
  initDate: `${currentYear}-01-01`,
  leader: '',
  rdBudget: '',
  remark: '',
  technicalField: '',
});

const reviewDrafts = computed(() =>
  drafts.value.filter((draft) => isDraftReviewable(draft.status)),
);
const selectedSources = computed(() =>
  sources.value.filter((source) => selectedSourceIds.value.includes(source.id)),
);
const existingSourceCount = computed(
  () => sources.value.filter((source) => source.hasResearchProject).length,
);
const selectedExistingSourceCount = computed(
  () =>
    sources.value.filter(
      (source) =>
        source.hasResearchProject && selectedSourceIds.value.includes(source.id),
    ).length,
);
const approvedDrafts = computed(() =>
  drafts.value.filter((draft) => draft.status === 'approved'),
);
const selectedReviewDrafts = computed(() =>
  reviewDrafts.value.filter((draft) => selectedDraftIds.value.includes(draft.id)),
);
const allSourceSelected = computed(
  () =>
    sources.value.length > 0 &&
    sources.value.every((source) => selectedSourceIds.value.includes(source.id)),
);
const allReviewSelected = computed(
  () =>
    reviewDrafts.value.length > 0 &&
    reviewDrafts.value.every((draft) => selectedDraftIds.value.includes(draft.id)),
);
const currentTaskSummary = computed(() => {
  if (!currentTask.value) {
    return '';
  }
  return (
    currentTask.value.result?.summary ??
    currentTask.value.errorMessage ??
    '研发立项报告生成任务处理中，请稍候。'
  );
});
const currentTaskDraftCount = computed(
  () => currentTask.value?.drafts?.length ?? 0,
);
const selectedIpDateValidationMessage = computed(() =>
  getSelectedIpDateValidationMessage(),
);

watch(
  () => open.value,
  (value) => {
    if (value) {
      loadAll().catch(() => {});
    } else {
      stopTaskPolling();
    }
  },
);

onBeforeUnmount(() => {
  stopTaskPolling();
});

async function loadAll() {
  loading.value = true;
  try {
    const [sourceResult, draftResult] = await Promise.all([
      getClientResearchGenerationSourcesApi(),
      getClientResearchGenerationDraftsApi(),
    ]);
    sources.value = sourceResult.items;
    drafts.value = draftResult.items;
    selectedSourceIds.value = sourceResult.items
      .filter((source) => !source.hasResearchProject)
      .map((source) => source.id);
    selectedDraftIds.value = draftResult.items
      .filter((draft) => isDraftReviewable(draft.status))
      .map((draft) => draft.id);
  } finally {
    loading.value = false;
  }
}

function handleToggleAllSources(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  selectedSourceIds.value = checked ? sources.value.map((source) => source.id) : [];
}

function handleToggleSource(id: string, event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  selectedSourceIds.value = checked
    ? [...new Set([...selectedSourceIds.value, id])]
    : selectedSourceIds.value.filter((item) => item !== id);
}

function handleToggleAllDrafts(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  selectedDraftIds.value = checked ? reviewDrafts.value.map((draft) => draft.id) : [];
}

function handleToggleDraft(draft: Draft, event: Event) {
  if (!isDraftReviewable(draft.status)) {
    return;
  }
  const checked = (event.target as HTMLInputElement).checked;
  selectedDraftIds.value = checked
    ? [...new Set([...selectedDraftIds.value, draft.id])]
    : selectedDraftIds.value.filter((id) => id !== draft.id);
}

async function generateDraft() {
  if (selectedSourceIds.value.length === 0) {
    message.warning('请选择关联知识产权');
    return;
  }
  if (!form.initDate || !form.endDate) {
    message.warning('请选择研发起止时间');
    return;
  }
  if (Date.parse(form.initDate) > Date.parse(form.endDate)) {
    message.warning('研发开始时间不能晚于结束时间');
    return;
  }
  if (selectedIpDateValidationMessage.value) {
    message.warning(selectedIpDateValidationMessage.value);
    return;
  }

  generating.value = true;
  try {
    const result = await createClientResearchGenerationTaskApi({
      endDate: form.endDate,
      initDate: form.initDate,
      ipIds: selectedSourceIds.value,
      leader: form.leader,
      rdBudget: form.rdBudget,
      remark: form.remark,
      technicalField: form.technicalField,
    });
    message.success('已创建研发立项报告生成任务，正在后台生成草稿');
    await trackGenerationTask(result.taskId);
  } finally {
    generating.value = false;
  }
}

async function autoMatchDrafts() {
  if (selectedSourceIds.value.length === 0) {
    message.warning('请选择用于自动匹配的知识产权');
    return;
  }

  previewingAutoMatch.value = true;
  try {
    autoMatchPreview.value = await previewClientResearchAutoMatchApi({
      ipIds: selectedSourceIds.value,
      targetCount: autoMatchTargetCount.value,
    });
    if (autoMatchPreview.value.candidateCount === 0) {
      message.warning('当前选择的知识产权无法生成新的 RD 草稿，请查看跳过原因');
    }
  } finally {
    previewingAutoMatch.value = false;
  }
}

async function confirmAutoMatchDrafts() {
  if (!autoMatchPreview.value || autoMatchPreview.value.candidateCount === 0) {
    return;
  }

  if (selectedSourceIds.value.length === 0) {
    message.warning('请选择用于自动匹配的知识产权');
    return;
  }

  autoMatching.value = true;
  try {
    const result = await createClientResearchAutoMatchTaskApi({
      ipIds: selectedSourceIds.value,
      targetCount: autoMatchTargetCount.value,
    });
    autoMatchPreview.value = null;
    message.success('已创建研发立项报告自动匹配任务，正在后台生成草稿');
    if (result.warning) {
      message.warning(result.warning);
    }
    await trackGenerationTask(result.taskId);
  } finally {
    autoMatching.value = false;
  }
}

async function trackGenerationTask(taskId: string) {
  stopTaskPolling();
  await refreshGenerationTask(taskId, true);
}

async function refreshGenerationTask(taskId: string, enablePolling = false) {
  pollingTask.value = true;
  try {
    const task = await getClientResearchGenerationTaskApi(taskId);
    currentTask.value = task;
    if (task && enablePolling && isRunningTaskStatus(task.status) && open.value) {
      taskPollingTimer.value = window.setTimeout(() => {
        refreshGenerationTask(taskId, true).catch(() => {});
      }, 2000);
      return;
    }

    await loadAll();
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

async function saveDraft(draft: Draft) {
  const saved = await updateClientResearchGenerationDraftApi(
    draft.id,
    draft.draftPayload,
  );
  drafts.value = drafts.value.map((item) => (item.id === saved.id ? saved : item));
  message.success('研发立项报告草稿已保存');
}

async function approveSelectedDrafts() {
  if (selectedReviewDrafts.value.length === 0) {
    message.warning('请选择要入库的研发立项报告草稿');
    return;
  }

  approving.value = true;
  try {
    const result = await approveClientResearchGenerationDraftsApi(
      selectedReviewDrafts.value.map((draft) => draft.id),
    );
    if (result.success.length > 0) {
      message.success(`已添加 ${result.success.length} 条研发立项报告`);
      emit('approved');
    }
    if (result.failed.length > 0) {
      message.warning(
        `${result.failed.length} 条未入库：${formatFailedReasons(result.failed)}`,
      );
    }
    await loadAll();
    applyApprovalFailedReasons(result.failed);
  } finally {
    approving.value = false;
  }
}

async function rejectSelectedDrafts() {
  if (selectedReviewDrafts.value.length === 0) {
    message.warning('请选择要标记不入库的研发立项报告草稿');
    return;
  }

  rejecting.value = true;
  try {
    const result = await rejectClientResearchGenerationDraftsApi(
      selectedReviewDrafts.value.map((draft) => draft.id),
    );
    if (result.success.length > 0) {
      message.success(`已标记 ${result.success.length} 条研发立项报告草稿不入库`);
    }
    if (result.failed.length > 0) {
      message.warning(
        `${result.failed.length} 条处理失败：${formatFailedReasons(result.failed)}`,
      );
    }
    await loadAll();
  } finally {
    rejecting.value = false;
  }
}

function deleteDraft(draft: Draft) {
  if (draft.status === 'approved') {
    message.warning('已入库草稿不能删除');
    return;
  }

  Modal.confirm({
    content: '删除后该研发立项报告草稿不会入库，如需使用需要重新生成。确认删除吗？',
    okText: '确认删除',
    onOk: async () => {
      await deleteClientResearchGenerationDraftApi(draft.id);
      drafts.value = drafts.value.filter((item) => item.id !== draft.id);
      selectedDraftIds.value = selectedDraftIds.value.filter(
        (id) => id !== draft.id,
      );
      message.success('研发立项报告草稿已删除');
    },
    title: '删除研发立项报告草稿',
  });
}

function deleteSelectedDrafts() {
  if (selectedReviewDrafts.value.length === 0) {
    message.warning('请选择要删除的研发立项报告草稿');
    return;
  }

  Modal.confirm({
    content: `将删除选中的 ${selectedReviewDrafts.value.length} 条研发立项报告草稿，删除后不可恢复。`,
    okText: '确认删除',
    okType: 'danger',
    title: '批量删除研发立项报告草稿',
    onOk: async () => {
      deleting.value = true;
      try {
        const result = await deleteClientResearchGenerationDraftsApi(
          selectedReviewDrafts.value.map((draft) => draft.id),
        );
        if (result.success.length > 0) {
          message.success(`已删除 ${result.success.length} 条研发立项报告草稿`);
        }
        if (result.failed.length > 0) {
          message.warning(
            `${result.failed.length} 条删除失败：${formatFailedReasons(result.failed)}`,
          );
        }
        await loadAll();
      } finally {
        deleting.value = false;
      }
    },
  });
}

function formatIpType(value: null | number | undefined) {
  const labels: Record<number, string> = {
    1: '发明专利',
    2: '实用新型',
    3: '软件著作权',
    4: '外观设计',
  };
  return value ? labels[value] ?? '知识产权' : '-';
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

function isRunningTaskStatus(status: string) {
  return status === 'pending' || status === 'processing';
}

function isDraftReviewable(status: string) {
  return status !== 'approved' && status !== 'rejected';
}

function getSelectedIpDateValidationMessage() {
  const missingDateSources = selectedSources.value.filter(
    (source) => !parseDateOnlyTime(source.authorizeDate),
  );
  if (missingDateSources.length > 0) {
    return `所选知识产权缺少登记/授权日期：${formatSourceNames(missingDateSources)}`;
  }

  const endTime = parseDateOnlyTime(form.endDate);
  if (!endTime) {
    return '';
  }

  const conflictSources = selectedSources.value.filter((source) => {
    const authorizeTime = parseDateOnlyTime(source.authorizeDate);
    return authorizeTime ? endTime >= authorizeTime : false;
  });
  if (conflictSources.length > 0) {
    return `研发结束时间必须早于知识产权登记/授权日期：${formatSourceNames(
      conflictSources,
    )}`;
  }

  return '';
}

function parseDateOnlyTime(value?: null | string) {
  if (!value) {
    return null;
  }
  const match = value.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/u);
  const normalized = match
    ? `${match[1]}-${match[2]?.padStart(2, '0')}-${match[3]?.padStart(2, '0')}`
    : value.slice(0, 10);
  const time = Date.parse(normalized);
  return Number.isNaN(time) ? null : time;
}

function formatSourceNames(items: Source[]) {
  return items
    .slice(0, 3)
    .map((source) => source.name || source.number || `IP ${source.id}`)
    .join('、');
}

function getDraftStatusColor(status: string) {
  if (status === 'approved') {
    return 'success';
  }
  if (status === 'rejected') {
    return 'default';
  }
  if (status === 'failed') {
    return 'error';
  }
  return 'processing';
}

function getDraftStatusText(status: string) {
  const labels: Record<string, string> = {
    approved: '已入库',
    failed: '处理失败',
    rejected: '已退回',
    reviewing: '待审核',
  };
  return labels[status] ?? status;
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

function getTaskStatusText(status: string) {
  const labels: Record<string, string> = {
    failed: '生成失败',
    pending: '等待生成',
    processing: '生成中',
    success: '生成完成',
  };
  return labels[status] ?? status;
}
</script>

<template>
  <Modal
    v-model:open="open"
    destroy-on-hidden
    :footer="null"
    title="新增研发立项报告"
    width="1240px"
  >
    <div class="rd-generate">
      <section class="rd-generate__panel">
        <div class="rd-generate__header">
          <div>
            <strong>第一步：选择知识产权和研发参数</strong>
            <p>
              一份研发立项报告可关联多个知识产权，系统会重新生成独立的研发报告草稿；研发结束时间需早于所选 IP 的登记/授权日期。
            </p>
          </div>
          <div class="rd-generate__actions">
            <span>目标总数</span>
            <InputNumber v-model:value="autoMatchTargetCount" :max="10" :min="6" :precision="0" />
            <Button
              v-if="reviewDrafts.length"
              danger
              :loading="deleting"
              @click="deleteSelectedDrafts"
            >
              删除已选草稿
            </Button>
            <Button :loading="previewingAutoMatch" type="primary" @click="autoMatchDrafts">
              预览自动匹配
            </Button>
          </div>
        </div>

        <div class="rd-generate__form">
          <label>
            研发开始时间
            <input v-model="form.initDate" class="rd-generate__input" type="date" />
          </label>
          <label>
            研发结束时间
            <input v-model="form.endDate" class="rd-generate__input" type="date" />
          </label>
          <label>
            技术领域
            <Input v-model:value="form.technicalField" placeholder="如：电子信息" />
          </label>
          <label>
            研发负责人
            <Input v-model:value="form.leader" placeholder="可选" />
          </label>
          <label>
            预算金额
            <Input v-model:value="form.rdBudget" placeholder="可选，如：50万元" />
          </label>
        </div>

        <label class="rd-generate__remark">
          补充说明
          <textarea
            v-model="form.remark"
            class="rd-generate__textarea"
            placeholder="可补充研发背景、产品方向、客户需求等真实信息"
            rows="3"
          />
        </label>

        <div v-if="selectedIpDateValidationMessage" class="rd-generate__date-alert">
          {{ selectedIpDateValidationMessage }}
        </div>

        <div v-if="existingSourceCount" class="rd-generate__duplicate">
          已检测到 {{ existingSourceCount }} 个知识产权已关联 RD。
          <span v-if="selectedExistingSourceCount">
            当前选中 {{ selectedExistingSourceCount }} 个已关联项，请确认是否需要重新生成新的研发立项报告。
          </span>
          <span v-else>默认仅选中尚未关联 RD 的知识产权。</span>
        </div>

        <section v-if="autoMatchPreview" class="rd-generate__preview">
          <div class="rd-generate__preview-header">
            <div>
              <strong>RD 自动匹配预览</strong>
              <span>
                可生成 {{ autoMatchPreview.candidateCount }} 条，规划目标
                {{ autoMatchPreview.targetCount }} 条；当前可用 IP
                {{ autoMatchPreview.availableIpCount }} 个。
              </span>
            </div>
            <div class="rd-generate__actions">
              <Button @click="autoMatchPreview = null">取消</Button>
              <Button
                :disabled="autoMatchPreview.candidateCount === 0"
                :loading="autoMatching"
                type="primary"
                @click="confirmAutoMatchDrafts"
              >
                确认生成 {{ autoMatchPreview.candidateCount }} 条草稿
              </Button>
            </div>
          </div>
          <p v-if="autoMatchPreview.candidateCount < autoMatchPreview.targetCount" class="rd-generate__preview-gap">
            当前知识产权只能支撑 {{ autoMatchPreview.candidateCount }} 条可信 RD，补充更多未关联 RD 的知识产权后可继续完善。
          </p>
          <div v-if="autoMatchPreview.items.length" class="rd-generate__preview-table-wrap">
            <table class="rd-generate__preview-table">
              <thead>
                <tr>
                  <th>年度</th>
                  <th>分类</th>
                  <th>技术领域</th>
                  <th>关联知识产权</th>
                  <th>关联成果</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in autoMatchPreview.items" :key="`${item.plannedYear}-${item.ipIds.join('-')}-${index}`">
                  <td>{{ item.plannedYear }}</td>
                  <td>{{ item.category }}</td>
                  <td>{{ item.technicalField }}</td>
                  <td>{{ item.ipNames.join('、') }}</td>
                  <td>{{ item.transformationIds.length ? `${item.transformationIds.length} 条` : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul v-if="autoMatchPreview.blockedReasons.length" class="rd-generate__preview-reasons">
            <li v-for="reason in autoMatchPreview.blockedReasons" :key="reason">{{ reason }}</li>
          </ul>
        </section>

        <div v-if="currentTask" class="rd-generate__task-status">
          <div>
            <strong>生成任务 #{{ currentTask.id }}</strong>
            <span>{{ currentTaskSummary }}</span>
          </div>
          <div class="rd-generate__task-meta">
            <Tag :color="getTaskStatusColor(currentTask.status)">
              {{ getTaskStatusText(currentTask.status) }}
            </Tag>
            <span>草稿 {{ currentTaskDraftCount }} 条</span>
            <span v-if="currentTask.resultId">Result #{{ currentTask.resultId }}</span>
            <span v-if="pollingTask">正在刷新状态...</span>
          </div>
        </div>

        <div class="rd-generate__source-table-wrap">
          <table class="rd-generate__source-table">
            <thead>
              <tr>
                <th class="rd-generate__check">
                  <input
                    :checked="allSourceSelected"
                    type="checkbox"
                    @change="handleToggleAllSources"
                  />
                </th>
                <th>状态</th>
                <th>知识产权名称</th>
                <th>类型</th>
                <th>编号</th>
                <th>权利人</th>
                <th>登记/授权日期</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="sources.length === 0">
                <td colspan="7" class="rd-generate__empty">
                  暂无知识产权，请先添加或上传识别。
                </td>
              </tr>
              <tr v-for="source in sources" :key="source.id">
                <td class="rd-generate__check">
                  <input
                    :checked="selectedSourceIds.includes(source.id)"
                    type="checkbox"
                    @change="handleToggleSource(source.id, $event)"
                  />
                </td>
                <td>
                  <Tag :color="source.hasResearchProject ? 'default' : 'processing'">
                    {{ source.hasResearchProject ? '已关联RD' : '可关联' }}
                  </Tag>
                </td>
                <td>{{ source.name || '-' }}</td>
                <td>{{ formatIpType(source.type) }}</td>
                <td>{{ source.ipCode || source.number || '-' }}</td>
                <td>{{ source.rightHolder || '-' }}</td>
                <td>{{ source.authorizeDate || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="rd-generate__actions">
          <Button type="primary" :loading="generating" @click="generateDraft">
            生成研发立项报告草稿
          </Button>
        </div>
      </section>

      <section class="rd-generate__panel">
        <div class="rd-generate__header">
          <div>
            <strong>第二步：审核研发立项报告草稿</strong>
            <p>
              待审核 {{ reviewDrafts.length }} 条，已入库
              {{ approvedDrafts.length }} 条。长文本会保存到项目描述、核心技术、创新点等字段。
            </p>
          </div>
          <div class="rd-generate__actions">
            <label class="rd-generate__select-all">
              <input
                :checked="allReviewSelected"
                type="checkbox"
                @change="handleToggleAllDrafts"
              />
              全选待审核
            </label>
            <Button danger :loading="rejecting" @click="rejectSelectedDrafts">
              标记不入库
            </Button>
            <Button danger :loading="deleting" @click="deleteSelectedDrafts">
              批量删除草稿
            </Button>
            <Button type="primary" :loading="approving" @click="approveSelectedDrafts">
              批量审核通过并添加到系统
            </Button>
          </div>
        </div>

        <div v-if="drafts.length === 0" class="rd-generate__empty-card">
          暂无研发立项报告草稿，请先选择知识产权和研发时间生成。
        </div>

        <article
          v-for="draft in drafts"
          :key="draft.id"
          class="rd-generate__draft-card"
        >
          <div class="rd-generate__draft-title">
            <label>
              <input
                :checked="selectedDraftIds.includes(draft.id)"
                :disabled="!isDraftReviewable(draft.status)"
                type="checkbox"
                @change="handleToggleDraft(draft, $event)"
              />
              <span>{{ draft.draftPayload.ky_project_name || '未命名研发立项报告' }}</span>
            </label>
            <div class="rd-generate__draft-title-actions">
              <Tag :color="getDraftStatusColor(draft.status)">
                {{ getDraftStatusText(draft.status) }}
              </Tag>
              <Button
                danger
                size="small"
                :disabled="draft.status === 'approved'"
                @click="deleteDraft(draft)"
              >
                删除草稿
              </Button>
            </div>
          </div>

          <div
            v-if="draft.draftPayload.review_warnings?.length"
            class="rd-generate__warnings"
          >
            <span
              v-for="warning in draft.draftPayload.review_warnings"
              :key="warning"
            >
              {{ warning }}
            </span>
          </div>

          <div class="rd-generate__draft-grid">
            <label>
              RD 编号
              <Input
                v-model:value="draft.draftPayload.ky_project_num"
                :disabled="draft.status === 'approved'"
              />
            </label>
            <label>
              研发立项报告名称
              <Input
                v-model:value="draft.draftPayload.ky_project_name"
                :disabled="draft.status === 'approved'"
              />
            </label>
            <label>
              技术领域
              <Input
                v-model:value="draft.draftPayload.project_type"
                :disabled="draft.status === 'approved'"
              />
            </label>
            <label>
              负责人
              <Input
                v-model:value="draft.draftPayload.ky_project_leader"
                :disabled="draft.status === 'approved'"
              />
            </label>
            <label>
              开始时间
              <input
                v-model="draft.draftPayload.init_date"
                class="rd-generate__input"
                :disabled="draft.status === 'approved'"
                type="date"
              />
            </label>
            <label>
              结束时间
              <input
                v-model="draft.draftPayload.end_date"
                class="rd-generate__input"
                :disabled="draft.status === 'approved'"
                type="date"
              />
            </label>
            <label>
              预算
              <Input
                v-model:value="draft.draftPayload.rd_budget"
                :disabled="draft.status === 'approved'"
              />
            </label>
            <label>
              关联 IP
              <Input
                v-model:value="draft.draftPayload.related_ip_ids"
                :disabled="draft.status === 'approved'"
              />
            </label>
          </div>

          <div class="rd-generate__draft-long">
            <label>
              研发立项报告正文
              <textarea
                v-model="draft.draftPayload.ky_project_des"
                class="rd-generate__textarea"
                :disabled="draft.status === 'approved'"
                rows="9"
              />
            </label>
            <label>
              核心技术
              <textarea
                v-model="draft.draftPayload.core_technology"
                class="rd-generate__textarea"
                :disabled="draft.status === 'approved'"
                rows="4"
              />
            </label>
            <label>
              创新点
              <textarea
                v-model="draft.draftPayload.innovation_points"
                class="rd-generate__textarea"
                :disabled="draft.status === 'approved'"
                rows="4"
              />
            </label>
            <label>
              阶段成果
              <textarea
                v-model="draft.draftPayload.stage_result"
                class="rd-generate__textarea"
                :disabled="draft.status === 'approved'"
                rows="3"
              />
            </label>
          </div>

          <div class="rd-generate__actions">
            <Button
              size="small"
              :disabled="draft.status === 'approved'"
              @click="saveDraft(draft)"
            >
              保存草稿
            </Button>
          </div>
        </article>
      </section>
    </div>
  </Modal>
</template>

<style scoped>
.rd-generate {
  display: grid;
  gap: 16px;
}

.rd-generate__panel,
.rd-generate__draft-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  background: hsl(var(--muted) / 28%);
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.rd-generate__header,
.rd-generate__draft-title,
.rd-generate__draft-title-actions,
.rd-generate__actions,
.rd-generate__select-all {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.rd-generate__header p {
  margin: 4px 0 0;
  color: hsl(var(--muted-foreground));
}

.rd-generate__date-alert,
.rd-generate__duplicate,
.rd-generate__preview {
  padding: 10px 12px;
  font-size: 13px;
  color: hsl(36 80% 32%);
  background: hsl(42 100% 92%);
  border: 1px solid hsl(38 92% 72%);
  border-radius: 10px;
}

.rd-generate__preview {
  display: grid;
  gap: 12px;
  color: hsl(var(--foreground));
  background: hsl(var(--primary) / 5%);
  border-color: hsl(var(--primary) / 20%);
}

.rd-generate__preview-header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.rd-generate__preview-header > div:first-child {
  display: grid;
  gap: 4px;
}

.rd-generate__preview-header span,
.rd-generate__preview-gap,
.rd-generate__preview-reasons {
  margin: 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.rd-generate__preview-gap {
  padding: 8px 10px;
  color: hsl(36 80% 32%);
  background: hsl(42 100% 92%);
  border: 1px solid hsl(38 92% 72%);
  border-radius: 6px;
}

.rd-generate__preview-table-wrap {
  overflow-x: auto;
}

.rd-generate__preview-table {
  width: 100%;
  min-width: 780px;
  border-collapse: collapse;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
}

.rd-generate__preview-table th,
.rd-generate__preview-table td {
  padding: 9px 10px;
  font-size: 13px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid hsl(var(--border));
}

.rd-generate__preview-table th {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 34%);
}

.rd-generate__preview-reasons {
  padding-left: 18px;
}

.rd-generate__warnings {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.rd-generate__warnings span {
  padding: 5px 8px;
  font-size: 12px;
  color: hsl(36 80% 32%);
  background: hsl(42 100% 92%);
  border: 1px solid hsl(38 92% 72%);
  border-radius: 999px;
}

.rd-generate__task-status {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: hsl(var(--primary) / 6%);
  border: 1px solid hsl(var(--primary) / 18%);
  border-radius: 10px;
}

.rd-generate__task-status > div:first-child {
  display: grid;
  gap: 4px;
}

.rd-generate__task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.rd-generate__task-status span,
.rd-generate__task-meta {
  color: hsl(var(--muted-foreground));
}

.rd-generate__form,
.rd-generate__draft-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(150px, 1fr));
  gap: 10px;
}

.rd-generate__form label,
.rd-generate__remark,
.rd-generate__draft-grid label,
.rd-generate__draft-long label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.rd-generate__input,
.rd-generate__textarea {
  width: 100%;
  padding: 6px 10px;
  color: hsl(var(--foreground));
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.rd-generate__textarea {
  resize: vertical;
}

.rd-generate__input:disabled,
.rd-generate__textarea:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.rd-generate__source-table-wrap {
  overflow: auto;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.rd-generate__source-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
}

.rd-generate__source-table th,
.rd-generate__source-table td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid hsl(var(--border));
}

.rd-generate__source-table th {
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 34%);
}

.rd-generate__check {
  width: 44px;
  text-align: center;
}

.rd-generate__empty,
.rd-generate__empty-card {
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.rd-generate__empty {
  height: 88px;
}

.rd-generate__empty-card {
  padding: 28px;
  background: hsl(var(--card));
  border: 1px dashed hsl(var(--border));
  border-radius: 12px;
}

.rd-generate__actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.rd-generate__draft-card {
  background: hsl(var(--card));
}

.rd-generate__draft-title label {
  display: flex;
  gap: 8px;
  align-items: center;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.rd-generate__draft-long {
  display: grid;
  gap: 10px;
}

@media (max-width: 1100px) {
  .rd-generate__form,
  .rd-generate__draft-grid {
    grid-template-columns: repeat(2, minmax(150px, 1fr));
  }
}

@media (max-width: 700px) {
  .rd-generate__header,
  .rd-generate__draft-title,
  .rd-generate__preview-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .rd-generate__form,
  .rd-generate__draft-grid {
    grid-template-columns: 1fr;
  }
}
</style>
