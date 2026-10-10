<script setup lang="ts">
import type { ClientEnterprisePropertyApi } from '#/api/client';

import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';

import { Button, Input, InputNumber, message, Modal, Select, Tag } from 'antdv-next';

import {
  approveClientTransformationGenerationDraftsApi,
  createClientTransformationGenerationTaskApi,
  deleteClientTransformationGenerationDraftApi,
  getClientTransformationGenerationDraftsApi,
  getClientTransformationGenerationSourcesApi,
  getClientTransformationGenerationTaskApi,
  rejectClientTransformationGenerationDraftsApi,
  updateClientTransformationGenerationDraftApi,
} from '#/api/client';

defineOptions({ name: 'ClientTransformationBatchGenerateModal' });

const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{
  approved: [];
}>();

type Source = ClientEnterprisePropertyApi.TransformationGenerationSource;
type Draft =
  ClientEnterprisePropertyApi.AiDraft<ClientEnterprisePropertyApi.TransformationGenerationDraftPayload>;
type AiTask =
  ClientEnterprisePropertyApi.AiTask<ClientEnterprisePropertyApi.TransformationGenerationDraftPayload>;

const sources = ref<Source[]>([]);
const drafts = ref<Draft[]>([]);
const currentTask = ref<AiTask | null>(null);
const selectedSourceIds = ref<string[]>([]);
const selectedDraftIds = ref<string[]>([]);
const loading = shallowRef(false);
const generating = shallowRef(false);
const approving = shallowRef(false);
const batchSaving = shallowRef(false);
const rejecting = shallowRef(false);
const includeExisting = shallowRef(false);
const batchMethod = shallowRef('自行实施');
const batchYear = shallowRef(String(new Date().getFullYear()));
const targetCount = shallowRef(5);
const businessMode = shallowRef<'auto' | 'mixed' | 'product' | 'service'>('auto');
const businessModeOptions = [{ label: '自动识别', value: 'auto' }, { label: '产品型', value: 'product' }, { label: '服务型', value: 'service' }, { label: '混合型', value: 'mixed' }];
const pollingTask = shallowRef(false);
const taskPollingTimer = shallowRef<null | number>(null);

const selectableSources = computed(() =>
  sources.value.filter((source) => includeExisting.value || !source.hasTransformation),
);
const existingSourceCount = computed(
  () => sources.value.filter((source) => source.hasTransformation).length,
);
const selectedExistingSourceCount = computed(
  () =>
    sources.value.filter(
      (source) =>
        source.hasTransformation && selectedSourceIds.value.includes(source.id),
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
    '成果转化生成任务处理中，请稍候。'
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
      getClientTransformationGenerationSourcesApi(),
      getClientTransformationGenerationDraftsApi(),
    ]);
    sources.value = sourceResult.items;
    drafts.value = draftResult.items;
    selectedSourceIds.value = sourceResult.items
      .filter((source) => includeExisting.value || !source.hasTransformation)
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
  if (source.hasTransformation && !includeExisting.value) {
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
    message.warning('请选择要生成成果转化的知识产权');
    return;
  }

  generating.value = true;
  try {
    const result = await createClientTransformationGenerationTaskApi({
      businessMode: businessMode.value,
      includeExisting: includeExisting.value,
      ipIds: selectedSourceIds.value,
      targetCount: targetCount.value,
    });
    message.success(`已创建生成任务，预计生成 ${result.total} 条成果转化草稿`);
    await trackGenerationTask(result.taskId);
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
    const task = await getClientTransformationGenerationTaskApi(taskId);
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
  const saved = await updateClientTransformationGenerationDraftApi(
    draft.id,
    draft.draftPayload,
  );
  drafts.value = drafts.value.map((item) => (item.id === saved.id ? saved : item));
  message.success('成果转化草稿已保存');
}

async function applyBatchFields() {
  if (selectedReviewDrafts.value.length === 0) {
    message.warning('请选择要批量设置的成果转化草稿');
    return;
  }
  if (!batchYear.value && !batchMethod.value) {
    message.warning('请填写转化年度或转化方式');
    return;
  }

  batchSaving.value = true;
  try {
    const savedDrafts = await Promise.all(
      selectedReviewDrafts.value.map((draft) => {
        const payload = {
          ...draft.draftPayload,
          transformation_method:
            batchMethod.value || draft.draftPayload.transformation_method,
          transformation_year:
            batchYear.value || draft.draftPayload.transformation_year,
        };
        return updateClientTransformationGenerationDraftApi(draft.id, payload);
      }),
    );
    const savedMap = new Map(savedDrafts.map((draft) => [draft.id, draft]));
    drafts.value = drafts.value.map((draft) => savedMap.get(draft.id) ?? draft);
    message.success(`已批量更新 ${savedDrafts.length} 条草稿`);
  } finally {
    batchSaving.value = false;
  }
}

async function approveSelectedDrafts() {
  if (selectedReviewDrafts.value.length === 0) {
    message.warning('请选择要入库的成果转化草稿');
    return;
  }

  approving.value = true;
  try {
    const result = await approveClientTransformationGenerationDraftsApi(
      selectedReviewDrafts.value.map((draft) => draft.id),
    );
    if (result.success.length > 0) {
      message.success(`已添加 ${result.success.length} 条成果转化`);
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
    message.warning('请选择要标记不入库的成果转化草稿');
    return;
  }

  rejecting.value = true;
  try {
    const result = await rejectClientTransformationGenerationDraftsApi(
      selectedReviewDrafts.value.map((draft) => draft.id),
    );
    if (result.success.length > 0) {
      message.success(`已标记 ${result.success.length} 条成果草稿不入库`);
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
    content: '删除后该草稿不会入库，如需使用需要重新生成。确认删除吗？',
    okText: '确认删除',
    onOk: async () => {
      await deleteClientTransformationGenerationDraftApi(draft.id);
      drafts.value = drafts.value.filter((item) => item.id !== draft.id);
      selectedDraftIds.value = selectedDraftIds.value.filter(
        (id) => id !== draft.id,
      );
      message.success('成果转化草稿已删除');
    },
    title: '删除成果转化草稿',
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
    title="按知识产权批量生成成果转化"
    width="100%"
  >
    <div class="transformation-generate">
      <section class="transformation-generate__panel">
        <div class="transformation-generate__header">
          <div>
            <strong>第一步：选择知识产权</strong>
            <p>默认选择还没有成果转化记录的 IP，每个 IP 生成一条成果草稿。</p>
          </div>
          <label class="transformation-generate__include">
            <input v-model="includeExisting" type="checkbox" />
            包含已生成成果的知识产权
          </label>
          <InputNumber v-model:value="targetCount" :max="30" :min="1" :precision="0" />
          <Select v-model:value="businessMode" :options="businessModeOptions" style="width: 108px" />
        </div>

        <div v-if="existingSourceCount" class="transformation-generate__duplicate">
          已检测到 {{ existingSourceCount }} 个知识产权已有成果转化。
          <span v-if="selectedExistingSourceCount">
            当前选中 {{ selectedExistingSourceCount }} 个已生成项，继续生成可能产生重复成果。
          </span>
          <span v-else>默认不会参与本次生成。</span>
        </div>

        <div v-if="currentTask" class="transformation-generate__task-status">
          <div>
            <strong>生成任务 #{{ currentTask.id }}</strong>
            <span>{{ currentTaskSummary }}</span>
          </div>
          <div class="transformation-generate__task-meta">
            <Tag :color="getTaskStatusColor(currentTask.status)">
              {{ getTaskStatusText(currentTask.status) }}
            </Tag>
            <span>草稿 {{ currentTaskDraftCount }} 条</span>
            <span v-if="currentTask.resultId">Result #{{ currentTask.resultId }}</span>
            <span v-if="pollingTask">正在刷新状态...</span>
          </div>
        </div>

        <div class="transformation-generate__source-table-wrap">
          <table class="transformation-generate__source-table">
            <thead>
              <tr>
                <th class="transformation-generate__sequence">序号</th>
                <th class="transformation-generate__check">
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
                <th>授权日期</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="sources.length === 0">
                <td colspan="8" class="transformation-generate__empty">
                  暂无知识产权，请先在知识产权页添加或上传识别。
                </td>
              </tr>
              <tr v-for="(source, index) in sources" :key="source.id">
                <td class="transformation-generate__sequence">
                  {{ index + 1 }}
                </td>
                <td class="transformation-generate__check">
                  <input
                    :checked="selectedSourceIds.includes(source.id)"
                    :disabled="source.hasTransformation && !includeExisting"
                    type="checkbox"
                    @change="handleToggleSource(source, $event)"
                  />
                </td>
                <td>
                  <Tag :color="source.hasTransformation ? 'default' : 'processing'">
                    {{ source.hasTransformation ? '已有成果' : '可生成' }}
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

        <div class="transformation-generate__actions">
          <Button type="primary" :loading="generating" @click="generateDrafts">
            生成成果转化草稿
          </Button>
        </div>
      </section>

      <section class="transformation-generate__panel">
        <div class="transformation-generate__header">
          <div>
            <strong>第二步：审核并入库</strong>
            <p>
              待审核 {{ reviewDrafts.length }} 条，已入库
              {{ approvedDrafts.length }} 条。请重点核对成果名称、成果内容和技术描述。
            </p>
          </div>
          <div class="transformation-generate__actions">
            <Input
              v-model:value="batchYear"
              class="transformation-generate__batch-input"
              placeholder="转化年度"
            />
            <Input
              v-model:value="batchMethod"
              class="transformation-generate__batch-input"
              placeholder="转化方式"
            />
            <Button :loading="batchSaving" @click="applyBatchFields">
              应用到选中草稿
            </Button>
            <Button danger :loading="rejecting" @click="rejectSelectedDrafts">
              标记不入库
            </Button>
            <Button
              type="primary"
              :loading="approving"
              @click="approveSelectedDrafts"
            >
              批量审核通过并添加到系统
            </Button>
          </div>
        </div>

        <div class="transformation-generate__draft-table-wrap">
          <table class="transformation-generate__draft-table">
            <thead>
              <tr>
                <th class="transformation-generate__sequence">序号</th>
                <th class="transformation-generate__check">
                  <input
                    :checked="allReviewSelected"
                    type="checkbox"
                    @change="handleToggleAllDrafts"
                  />
                </th>
                <th>状态</th>
                <th>来源 IP</th>
                <th>成果名称</th>
                <th>成果内容</th>
                <th>技术描述</th>
                <th>年度</th>
                <th>方式</th>
                <th>证明材料</th>
                <th>审核提示</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="drafts.length === 0">
                <td colspan="12" class="transformation-generate__empty">
                  暂无成果转化草稿，请先选择知识产权生成。
                </td>
              </tr>
              <tr v-for="(draft, index) in drafts" :key="draft.id">
                <td class="transformation-generate__sequence">
                  {{ index + 1 }}
                </td>
                <td class="transformation-generate__check">
                  <input
                    :checked="selectedDraftIds.includes(draft.id)"
                    :disabled="!isDraftReviewable(draft.status)"
                    type="checkbox"
                    @change="handleToggleDraft(draft, $event)"
                  />
                </td>
                <td>
                  <Tag :color="getDraftStatusColor(draft.status)">
                    {{ getDraftStatusText(draft.status) }}
                  </Tag>
                </td>
                <td>
                  <strong>
                    <span v-if="draft.draftPayload.source_ip_code">
                      {{ draft.draftPayload.source_ip_code }} -
                    </span>
                    {{ draft.draftPayload.source_ip_name || '-' }}
                  </strong>
                  <span>{{ draft.draftPayload.source_ip_num || '' }}</span>
                </td>
                <td>
                  <Input
                    v-model:value="draft.draftPayload.transformation_name"
                    :disabled="draft.status === 'approved'"
                  />
                </td>
                <td>
                  <textarea
                    v-model="draft.draftPayload.application_scene"
                    class="transformation-generate__textarea"
                    :disabled="draft.status === 'approved'"
                    rows="3"
                  />
                </td>
                <td>
                  <textarea
                    v-model="draft.draftPayload.remark"
                    class="transformation-generate__textarea"
                    :disabled="draft.status === 'approved'"
                    rows="3"
                  />
                </td>
                <td>
                  <Input
                    v-model:value="draft.draftPayload.transformation_year"
                    :disabled="draft.status === 'approved'"
                  />
                </td>
                <td>
                  <Input
                    v-model:value="draft.draftPayload.transformation_method"
                    :disabled="draft.status === 'approved'"
                  />
                </td>
                <td>
                  <textarea
                    v-model="draft.draftPayload.proof_files"
                    class="transformation-generate__textarea"
                    :disabled="draft.status === 'approved'"
                    rows="3"
                  />
                </td>
                <td>
                  <div
                    v-if="draft.draftPayload.review_warnings?.length"
                    class="transformation-generate__warnings"
                  >
                    <span
                      v-for="warning in draft.draftPayload.review_warnings"
                      :key="warning"
                    >
                      {{ warning }}
                    </span>
                  </div>
                  <span v-else>无阻断提示</span>
                </td>
                <td>
                  <div class="transformation-generate__row-actions">
                    <Button
                      size="small"
                      :disabled="draft.status === 'approved'"
                      @click="saveDraft(draft)"
                    >
                      保存
                    </Button>
                    <Button
                      danger
                      size="small"
                      :disabled="draft.status === 'approved'"
                      @click="deleteDraft(draft)"
                    >
                      删除
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="transformation-generate__hint">
          入库后会写入“成果转化”正式列表，并保留与来源知识产权的关联关系。
        </div>
      </section>
    </div>
  </Modal>
</template>

<style scoped>
.transformation-generate {
  display: grid;
  gap: 16px;
}

.transformation-generate__panel {
  display: grid;
  gap: 12px;
  padding: 14px;
  background: hsl(var(--muted) / 28%);
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.transformation-generate__header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.transformation-generate__header p,
.transformation-generate__hint,
.transformation-generate__empty,
.transformation-generate__draft-table td span {
  color: hsl(var(--muted-foreground));
}

.transformation-generate__header p {
  margin: 4px 0 0;
}

.transformation-generate__include,
.transformation-generate__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.transformation-generate__duplicate {
  padding: 10px 12px;
  font-size: 13px;
  color: hsl(36 80% 32%);
  background: hsl(42 100% 92%);
  border: 1px solid hsl(38 92% 72%);
  border-radius: 10px;
}

.transformation-generate__warnings {
  display: grid;
  gap: 4px;
  min-width: 180px;
}

.transformation-generate__warnings span {
  padding: 4px 6px;
  color: hsl(36 80% 32%);
  background: hsl(42 100% 92%);
  border: 1px solid hsl(38 92% 72%);
  border-radius: 6px;
}

.transformation-generate__task-status {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: hsl(var(--primary) / 6%);
  border: 1px solid hsl(var(--primary) / 18%);
  border-radius: 10px;
}

.transformation-generate__task-status > div:first-child {
  display: grid;
  gap: 4px;
}

.transformation-generate__task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.transformation-generate__task-status span,
.transformation-generate__task-meta {
  color: hsl(var(--muted-foreground));
}

.transformation-generate__source-table-wrap,
.transformation-generate__draft-table-wrap {
  overflow: auto;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.transformation-generate__source-table,
.transformation-generate__draft-table {
  width: 100%;
  border-collapse: collapse;
}

.transformation-generate__source-table {
  min-width: 960px;
}

.transformation-generate__draft-table {
  min-width: 1480px;
}

.transformation-generate__source-table th,
.transformation-generate__source-table td,
.transformation-generate__draft-table th,
.transformation-generate__draft-table td {
  padding: 10px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid hsl(var(--border));
}

.transformation-generate__source-table th,
.transformation-generate__draft-table th {
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 34%);
}

.transformation-generate__check {
  width: 44px;
  text-align: center;
}

.transformation-generate__empty {
  height: 88px;
  text-align: center;
  vertical-align: middle;
}

.transformation-generate__actions {
  justify-content: flex-end;
}

.transformation-generate__row-actions {
  display: flex;
  gap: 8px;
}

.transformation-generate__batch-input {
  width: 120px;
}

.transformation-generate__textarea {
  width: 260px;
  min-height: 76px;
  padding: 6px 10px;
  color: hsl(var(--foreground));
  resize: vertical;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.transformation-generate__textarea:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.transformation-generate__hint {
  font-size: 13px;
}

@media (max-width: 900px) {
  .transformation-generate__header {
    flex-direction: column;
  }
}
.transformation-generate__sequence {
  width: 56px;
  min-width: 56px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}
</style>
