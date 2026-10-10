<script setup lang="ts">
import type { ClientEnterprisePropertyApi } from '#/api/client';

import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';

import { Button, Input, InputNumber, message, Modal, Select, Tag } from 'antdv-next';

import {
  approveClientProductServiceGenerationDraftsApi,
  createClientProductServiceGenerationTaskApi,
  deleteClientProductServiceGenerationDraftApi,
  duplicateClientProductServiceGenerationDraftApi,
  getClientProductServiceGenerationDraftsApi,
  getClientProductServiceGenerationSourcesApi,
  getClientProductServiceGenerationTaskApi,
  rejectClientProductServiceGenerationDraftsApi,
  updateClientProductServiceGenerationDraftApi,
} from '#/api/client';

defineOptions({ name: 'ClientProductServiceBatchGenerateModal' });

const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{
  approved: [];
}>();

type Source = ClientEnterprisePropertyApi.ProductServiceGenerationSource;
type Draft =
  ClientEnterprisePropertyApi.AiDraft<ClientEnterprisePropertyApi.ProductServiceGenerationDraftPayload>;
type AiTask =
  ClientEnterprisePropertyApi.AiTask<ClientEnterprisePropertyApi.ProductServiceGenerationDraftPayload>;

const sources = ref<Source[]>([]);
const drafts = ref<Draft[]>([]);
const currentTask = ref<AiTask | null>(null);
const selectedSourceIds = ref<string[]>([]);
const selectedDraftIds = ref<string[]>([]);
const loading = shallowRef(false);
const generating = shallowRef(false);
const approving = shallowRef(false);
const merging = shallowRef(false);
const rejecting = shallowRef(false);
const includeExisting = shallowRef(false);
const mergeTargetDraftId = shallowRef('');
const targetCount = shallowRef(5);
const businessMode = shallowRef<'auto' | 'mixed' | 'product' | 'service'>('auto');
const businessModeOptions = [{ label: '自动识别', value: 'auto' }, { label: '产品型', value: 'product' }, { label: '服务型', value: 'service' }, { label: '混合型', value: 'mixed' }];
const pollingTask = shallowRef(false);
const taskPollingTimer = shallowRef<null | number>(null);

const selectableSources = computed(() =>
  sources.value.filter((source) => includeExisting.value || !source.hasProductService),
);
const existingSourceCount = computed(
  () => sources.value.filter((source) => source.hasProductService).length,
);
const selectedExistingSourceCount = computed(
  () =>
    sources.value.filter(
      (source) =>
        source.hasProductService && selectedSourceIds.value.includes(source.id),
    ).length,
);
const reviewDrafts = computed(() =>
  drafts.value.filter((draft) => isDraftReviewable(draft.status)),
);
const approvedDrafts = computed(() =>
  drafts.value.filter((draft) => draft.status === 'approved'),
);
const selectedReviewDrafts = computed(() =>
  reviewDrafts.value.filter((draft) => selectedDraftIds.value.includes(draft.id)),
);
const mergeTargetOptions = computed(() =>
  selectedReviewDrafts.value.map((draft) => ({
    id: draft.id,
    name: draft.draftPayload.ps_name || `PS 草稿 ${draft.id}`,
  })),
);
const allSourceSelected = computed(
  () =>
    selectableSources.value.length > 0 &&
    selectableSources.value.every((source) =>
      selectedSourceIds.value.includes(source.id),
    ),
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
    'PS 生成任务处理中，请稍候。'
  );
});
const currentTaskDraftCount = computed(
  () => currentTask.value?.drafts?.length ?? 0,
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

watch(includeExisting, () => {
  selectedSourceIds.value = selectableSources.value.map((source) => source.id);
});

async function loadAll() {
  loading.value = true;
  try {
    const [sourceResult, draftResult] = await Promise.all([
      getClientProductServiceGenerationSourcesApi(),
      getClientProductServiceGenerationDraftsApi(),
    ]);
    sources.value = sourceResult.items;
    drafts.value = draftResult.items;
    selectedSourceIds.value = sourceResult.items
      .filter((source) => includeExisting.value || !source.hasProductService)
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
  selectedSourceIds.value = checked
    ? selectableSources.value.map((source) => source.id)
    : [];
}

function handleToggleSource(source: Source, event: Event) {
  if (source.hasProductService && !includeExisting.value) {
    return;
  }
  const checked = (event.target as HTMLInputElement).checked;
  selectedSourceIds.value = checked
    ? [...new Set([...selectedSourceIds.value, source.id])]
    : selectedSourceIds.value.filter((id) => id !== source.id);
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

async function generateDrafts() {
  if (selectedSourceIds.value.length === 0) {
    message.warning('请选择要生成 PS 的 RD 项目');
    return;
  }

  generating.value = true;
  try {
    const result = await createClientProductServiceGenerationTaskApi({
      businessMode: businessMode.value,
      includeExisting: includeExisting.value,
      rdIds: selectedSourceIds.value,
      targetCount: targetCount.value,
    });
    message.success(`已生成 ${result.total} 条 PS 草稿`);
    await trackGenerationTask(result.taskId);
    selectedDraftIds.value = [
      ...new Set([
        ...result.drafts.map((draft) => draft.id),
        ...selectedDraftIds.value,
      ]),
    ];
  } finally {
    generating.value = false;
  }
}

async function trackGenerationTask(taskId: string) {
  stopTaskPolling();
  await refreshGenerationTask(taskId, true);
}

async function refreshGenerationTask(taskId: string, enablePolling = false) {
  pollingTask.value = true;
  try {
    const task = await getClientProductServiceGenerationTaskApi(taskId);
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
  const saved = await updateClientProductServiceGenerationDraftApi(
    draft.id,
    draft.draftPayload,
  );
  drafts.value = drafts.value.map((item) => (item.id === saved.id ? saved : item));
  message.success('PS 草稿已保存');
}

async function duplicateDraftForSplit(draft: Draft) {
  if (draft.status === 'approved') {
    return;
  }

  const saved = await duplicateClientProductServiceGenerationDraftApi(draft.id);
  drafts.value = [saved, ...drafts.value];
  selectedDraftIds.value = [...new Set([saved.id, ...selectedDraftIds.value])];
  message.success('已复制为新的 PS 草稿，可修改关联 RD 完成拆分');
}

function chooseNameCandidate(draft: Draft, name: string) {
  if (draft.status === 'approved') {
    return;
  }
  draft.draftPayload.ps_name = name;
}

async function mergeSelectedDrafts() {
  if (selectedReviewDrafts.value.length < 2) {
    message.warning('请至少选择 2 条待审核 PS 草稿进行合并');
    return;
  }

  const target =
    selectedReviewDrafts.value.find(
      (draft) => draft.id === mergeTargetDraftId.value,
    ) ?? selectedReviewDrafts.value[0];
  if (!target) {
    message.warning('请选择合并目标草稿');
    return;
  }

  const sourcesToMerge = selectedReviewDrafts.value.filter(
    (draft) => draft.id !== target.id,
  );
  const mergedCount = selectedReviewDrafts.value.length;
  merging.value = true;
  try {
    const mergedPayload = {
      ...target.draftPayload,
      competitive_advantage: mergeText(
        selectedReviewDrafts.value.map(
          (draft) => draft.draftPayload.competitive_advantage,
        ),
      ),
      related_ip_ids: mergeIds(
        selectedReviewDrafts.value.map((draft) => draft.draftPayload.related_ip_ids),
      ),
      related_rd_ids: mergeIds(
        selectedReviewDrafts.value.map((draft) => draft.draftPayload.related_rd_ids),
      ),
      related_transformation_ids: mergeIds(
        selectedReviewDrafts.value.map(
          (draft) => draft.draftPayload.related_transformation_ids,
        ),
      ),
      source_ip_names: mergeNameArrays(
        selectedReviewDrafts.value.map((draft) => draft.draftPayload.source_ip_names),
      ),
      source_rd_names: mergeNameArrays(
        selectedReviewDrafts.value.map((draft) => draft.draftPayload.source_rd_names),
      ),
      tech_description: mergeText(
        selectedReviewDrafts.value.map(
          (draft) => draft.draftPayload.tech_description,
        ),
      ),
      tech_index: mergeText(
        selectedReviewDrafts.value.map((draft) => draft.draftPayload.tech_index),
      ),
    };
    const savedTarget = await updateClientProductServiceGenerationDraftApi(
      target.id,
      mergedPayload,
    );
    await Promise.all(
      sourcesToMerge.map((draft) =>
        deleteClientProductServiceGenerationDraftApi(draft.id),
      ),
    );
    const removedIds = new Set(sourcesToMerge.map((draft) => draft.id));
    drafts.value = drafts.value
      .filter((draft) => !removedIds.has(draft.id))
      .map((draft) => (draft.id === savedTarget.id ? savedTarget : draft));
    selectedDraftIds.value = [savedTarget.id];
    mergeTargetDraftId.value = savedTarget.id;
    message.success(`已合并 ${mergedCount} 条 PS 草稿`);
  } finally {
    merging.value = false;
  }
}

async function approveSelectedDrafts() {
  if (selectedReviewDrafts.value.length === 0) {
    message.warning('请选择要入库的 PS 草稿');
    return;
  }

  approving.value = true;
  try {
    const result = await approveClientProductServiceGenerationDraftsApi(
      selectedReviewDrafts.value.map((draft) => draft.id),
    );
    if (result.success.length > 0) {
      message.success(`已添加 ${result.success.length} 条高新产品/服务`);
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
    message.warning('请选择要标记不入库的 PS 草稿');
    return;
  }

  rejecting.value = true;
  try {
    const result = await rejectClientProductServiceGenerationDraftsApi(
      selectedReviewDrafts.value.map((draft) => draft.id),
    );
    if (result.success.length > 0) {
      message.success(`已标记 ${result.success.length} 条 PS 草稿不入库`);
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
    content: '删除后该 PS 草稿不会入库，如需使用需要重新生成。确认删除吗？',
    okText: '确认删除',
    onOk: async () => {
      await deleteClientProductServiceGenerationDraftApi(draft.id);
      drafts.value = drafts.value.filter((item) => item.id !== draft.id);
      selectedDraftIds.value = selectedDraftIds.value.filter(
        (id) => id !== draft.id,
      );
      message.success('PS 草稿已删除');
    },
    title: '删除 PS 草稿',
  });
}

function splitIds(value: null | string | undefined) {
  return String(value ?? '')
    .split(/[,，\s]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeIds(values: Array<null | string | undefined>) {
  return [...new Set(values.flatMap((value) => splitIds(value)))].join(',');
}

function mergeNameArrays(values: Array<string[] | undefined>) {
  return [...new Set(values.flatMap((value) => value ?? []).filter(Boolean))];
}

function mergeText(values: Array<null | string | undefined>) {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))]
    .join('\n\n');
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
    title="按 RD 批量生成 PS 高新产品"
    width="1240px"
  >
    <div class="ps-generate">
      <section class="ps-generate__panel">
        <div class="ps-generate__header">
          <div>
            <strong>第一步：选择 RD 项目</strong>
            <p>系统会按技术领域自动聚合 RD，并生成对应 PS 草稿。</p>
          </div>
          <label class="ps-generate__include">
            <input v-model="includeExisting" type="checkbox" />
            包含已生成 PS 的 RD
          </label>
          <InputNumber v-model:value="targetCount" :max="10" :min="1" :precision="0" />
          <Select v-model:value="businessMode" :options="businessModeOptions" style="width: 108px" />
        </div>

        <div v-if="existingSourceCount" class="ps-generate__duplicate">
          已检测到 {{ existingSourceCount }} 个 RD 已有关联 PS。
          <span v-if="selectedExistingSourceCount">
            当前选中 {{ selectedExistingSourceCount }} 个已生成项，继续生成可能产生重复 PS。
          </span>
          <span v-else>默认不会参与本次生成。</span>
        </div>

        <div v-if="currentTask" class="ps-generate__task-status">
          <div>
            <strong>生成任务 #{{ currentTask.id }}</strong>
            <span>{{ currentTaskSummary }}</span>
          </div>
          <div class="ps-generate__task-meta">
            <Tag :color="getTaskStatusColor(currentTask.status)">
              {{ getTaskStatusText(currentTask.status) }}
            </Tag>
            <span>草稿 {{ currentTaskDraftCount }} 条</span>
            <span v-if="currentTask.resultId">Result #{{ currentTask.resultId }}</span>
            <span v-if="pollingTask">正在刷新状态...</span>
          </div>
        </div>

        <div class="ps-generate__source-table-wrap">
          <table class="ps-generate__source-table">
            <thead>
              <tr>
                <th class="ps-generate__check">
                  <input
                    :checked="allSourceSelected"
                    type="checkbox"
                    @change="handleToggleAllSources"
                  />
                </th>
                <th>状态</th>
                <th>RD 名称</th>
                <th>编号</th>
                <th>技术领域</th>
                <th>周期</th>
                <th>关联 IP</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="sources.length === 0">
                <td colspan="7" class="ps-generate__empty">
                  暂无 RD 项目，请先新增或生成 RD。
                </td>
              </tr>
              <tr v-for="source in sources" :key="source.id">
                <td class="ps-generate__check">
                  <input
                    :checked="selectedSourceIds.includes(source.id)"
                    :disabled="source.hasProductService && !includeExisting"
                    type="checkbox"
                    @change="handleToggleSource(source, $event)"
                  />
                </td>
                <td>
                  <Tag :color="source.hasProductService ? 'default' : 'processing'">
                    {{ source.hasProductService ? '已有PS' : '可生成' }}
                  </Tag>
                </td>
                <td>{{ source.name || '-' }}</td>
                <td>{{ source.number || '-' }}</td>
                <td>{{ source.projectType || '待识别' }}</td>
                <td>{{ source.initDate || '-' }} 至 {{ source.endDate || '-' }}</td>
                <td>{{ source.relatedIpLabels || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="ps-generate__actions">
          <Button type="primary" :loading="generating" @click="generateDrafts">
            生成 PS 草稿
          </Button>
        </div>
      </section>

      <section class="ps-generate__panel">
        <div class="ps-generate__header">
          <div>
            <strong>第二步：审核 PS 草稿</strong>
            <p>
              待审核 {{ reviewDrafts.length }} 条，已入库
              {{ approvedDrafts.length }} 条。请核对名称、技术领域和关联 RD/IP。
            </p>
          </div>
          <div class="ps-generate__actions">
            <label class="ps-generate__select-all">
              <input
                :checked="allReviewSelected"
                type="checkbox"
                @change="handleToggleAllDrafts"
              />
              全选待审核
            </label>
            <select
              v-model="mergeTargetDraftId"
              class="ps-generate__select"
              :disabled="selectedReviewDrafts.length < 2"
            >
              <option value="">合并到首个选中草稿</option>
              <option
                v-for="option in mergeTargetOptions"
                :key="option.id"
                :value="option.id"
              >
                {{ option.name }}
              </option>
            </select>
            <Button
              :disabled="selectedReviewDrafts.length < 2"
              :loading="merging"
              @click="mergeSelectedDrafts"
            >
              合并选中草稿
            </Button>
            <Button danger :loading="rejecting" @click="rejectSelectedDrafts">
              标记不入库
            </Button>
            <Button type="primary" :loading="approving" @click="approveSelectedDrafts">
              批量审核通过并添加到系统
            </Button>
          </div>
        </div>

        <div class="ps-generate__merge-hint">
          关联 RD、IP 和成果由生成依据自动带入并使用业务编号展示；需要调整链路时，请先在对应记录中完成关联后重新生成。需要合并时可多选草稿，系统会去重汇总关联关系。
        </div>

        <div v-if="drafts.length === 0" class="ps-generate__empty-card">
          暂无 PS 草稿，请先选择 RD 生成。
        </div>

        <article
          v-for="draft in drafts"
          :key="draft.id"
          class="ps-generate__draft-card"
        >
          <div class="ps-generate__draft-title">
            <label>
              <input
                :checked="selectedDraftIds.includes(draft.id)"
                :disabled="!isDraftReviewable(draft.status)"
                type="checkbox"
                @change="handleToggleDraft(draft, $event)"
              />
              <span>{{ draft.draftPayload.ps_name || '未命名 PS' }}</span>
            </label>
            <Tag :color="getDraftStatusColor(draft.status)">
              {{ getDraftStatusText(draft.status) }}
            </Tag>
          </div>

          <div
            v-if="draft.draftPayload.review_warnings?.length"
            class="ps-generate__warnings"
          >
            <span
              v-for="warning in draft.draftPayload.review_warnings"
              :key="warning"
            >
              {{ warning }}
            </span>
          </div>

          <div class="ps-generate__draft-grid">
            <label>
              PS 编号
              <Input
                v-model:value="draft.draftPayload.ps_code"
                :disabled="draft.status === 'approved'"
              />
            </label>
            <label>
              产品/服务名称
              <Input
                v-model:value="draft.draftPayload.ps_name"
                :disabled="draft.status === 'approved'"
              />
              <div
                v-if="draft.draftPayload.ps_name_candidates?.length"
                class="ps-generate__candidates"
              >
                <button
                  v-for="candidate in draft.draftPayload.ps_name_candidates"
                  :key="candidate"
                  :disabled="draft.status === 'approved'"
                  type="button"
                  @click="chooseNameCandidate(draft, candidate)"
                >
                  {{ candidate }}
                </button>
              </div>
            </label>
            <label>
              技术领域
              <Input
                v-model:value="draft.draftPayload.tech_field"
                :disabled="draft.status === 'approved'"
              />
            </label>
            <label>
              技术来源
              <Input
                v-model:value="draft.draftPayload.tech_source"
                :disabled="draft.status === 'approved'"
              />
            </label>
            <label>
              关联 RD
              <div class="ps-generate__relation-label">
                {{ draft.draftPayload.related_rd_labels || '-' }}
              </div>
            </label>
            <label>
              关联 IP
              <div class="ps-generate__relation-label">
                {{ draft.draftPayload.related_ip_labels || '-' }}
              </div>
            </label>
            <label>
              关联成果
              <div class="ps-generate__relation-label">
                {{ draft.draftPayload.related_transformation_labels || '-' }}
              </div>
            </label>
          </div>

          <div class="ps-generate__draft-long">
            <label>
              关键技术
              <textarea
                v-model="draft.draftPayload.tech_description"
                class="ps-generate__textarea"
                :disabled="draft.status === 'approved'"
                rows="4"
              />
            </label>
            <label>
              技术指标
              <textarea
                v-model="draft.draftPayload.tech_index"
                class="ps-generate__textarea"
                :disabled="draft.status === 'approved'"
                rows="4"
              />
            </label>
            <label>
              竞争优势
              <textarea
                v-model="draft.draftPayload.competitive_advantage"
                class="ps-generate__textarea"
                :disabled="draft.status === 'approved'"
                rows="4"
              />
            </label>
            <label>
              证明材料说明
              <textarea
                v-model="draft.draftPayload.proof_files"
                class="ps-generate__textarea"
                :disabled="draft.status === 'approved'"
                rows="3"
              />
            </label>
          </div>

          <div class="ps-generate__actions">
            <Button
              size="small"
              :disabled="draft.status === 'approved'"
              @click="duplicateDraftForSplit(draft)"
            >
              复制拆分
            </Button>
            <Button
              size="small"
              :disabled="draft.status === 'approved'"
              @click="saveDraft(draft)"
            >
              保存草稿
            </Button>
            <Button
              danger
              size="small"
              :disabled="draft.status === 'approved'"
              @click="deleteDraft(draft)"
            >
              删除草稿
            </Button>
          </div>
        </article>
      </section>
    </div>
  </Modal>
</template>

<style scoped>
.ps-generate {
  display: grid;
  gap: 16px;
}

.ps-generate__panel,
.ps-generate__draft-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  background: hsl(var(--muted) / 28%);
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.ps-generate__header,
.ps-generate__draft-title,
.ps-generate__actions,
.ps-generate__include,
.ps-generate__select-all {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.ps-generate__header p {
  margin: 4px 0 0;
  color: hsl(var(--muted-foreground));
}

.ps-generate__duplicate {
  padding: 10px 12px;
  font-size: 13px;
  color: hsl(36 80% 32%);
  background: hsl(42 100% 92%);
  border: 1px solid hsl(38 92% 72%);
  border-radius: 10px;
}

.ps-generate__warnings {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ps-generate__warnings span {
  padding: 5px 8px;
  font-size: 12px;
  color: hsl(36 80% 32%);
  background: hsl(42 100% 92%);
  border: 1px solid hsl(38 92% 72%);
  border-radius: 999px;
}

.ps-generate__task-status {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: hsl(var(--primary) / 6%);
  border: 1px solid hsl(var(--primary) / 18%);
  border-radius: 10px;
}

.ps-generate__task-status > div:first-child {
  display: grid;
  gap: 4px;
}

.ps-generate__task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.ps-generate__task-status span,
.ps-generate__task-meta {
  color: hsl(var(--muted-foreground));
}

.ps-generate__merge-hint {
  padding: 10px 12px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px dashed hsl(var(--border));
  border-radius: 10px;
}

.ps-generate__select {
  min-width: 180px;
  height: 32px;
  padding: 0 10px;
  color: hsl(var(--foreground));
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.ps-generate__select:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.ps-generate__source-table-wrap {
  overflow: auto;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.ps-generate__source-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
}

.ps-generate__source-table th,
.ps-generate__source-table td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid hsl(var(--border));
}

.ps-generate__source-table th {
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 34%);
}

.ps-generate__check {
  width: 44px;
  text-align: center;
}

.ps-generate__empty,
.ps-generate__empty-card {
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.ps-generate__empty {
  height: 88px;
}

.ps-generate__empty-card {
  padding: 28px;
  background: hsl(var(--card));
  border: 1px dashed hsl(var(--border));
  border-radius: 12px;
}

.ps-generate__actions {
  justify-content: flex-end;
}

.ps-generate__draft-card {
  background: hsl(var(--card));
}

.ps-generate__draft-title label {
  display: flex;
  gap: 8px;
  align-items: center;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.ps-generate__draft-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr));
  gap: 10px;
}

.ps-generate__draft-grid label,
.ps-generate__draft-long label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.ps-generate__relation-label {
  min-height: 32px;
  padding: 6px 10px;
  color: hsl(var(--foreground));
  line-height: 20px;
  overflow-wrap: anywhere;
  background: hsl(var(--muted) / 28%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.ps-generate__draft-long {
  display: grid;
  gap: 10px;
}

.ps-generate__candidates {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ps-generate__candidates button {
  padding: 3px 8px;
  font-size: 12px;
  color: hsl(var(--primary));
  cursor: pointer;
  background: hsl(var(--primary) / 8%);
  border: 1px solid hsl(var(--primary) / 22%);
  border-radius: 999px;
}

.ps-generate__candidates button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.ps-generate__textarea {
  width: 100%;
  padding: 6px 10px;
  color: hsl(var(--foreground));
  resize: vertical;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.ps-generate__textarea:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

@media (max-width: 1000px) {
  .ps-generate__draft-grid {
    grid-template-columns: repeat(2, minmax(150px, 1fr));
  }
}

@media (max-width: 700px) {
  .ps-generate__header,
  .ps-generate__draft-title {
    align-items: flex-start;
    flex-direction: column;
  }

  .ps-generate__draft-grid {
    grid-template-columns: 1fr;
  }
}
</style>
