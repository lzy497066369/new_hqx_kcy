<script setup lang="ts">
import type { ClientEnterprisePropertyApi } from '#/api/client';

import { computed, ref, shallowRef, watch } from 'vue';

import { message, Modal, Tag } from 'antdv-next';

import { getClientPropertyAiTasksApi } from '#/api/client';

defineOptions({ name: 'ClientPropertyAiTaskAuditModal' });

const open = defineModel<boolean>('open', { required: true });

type AiTask = ClientEnterprisePropertyApi.AiTask;

const tasks = ref<AiTask[]>([]);
const loading = shallowRef(false);

const taskSummary = computed(() => {
  const draftCount = tasks.value.reduce(
    (total, task) => total + (task.drafts?.length ?? 0),
    0,
  );
  const approvedCount = tasks.value.reduce(
    (total, task) =>
      total +
      (task.drafts?.filter((draft) => draft.status === 'approved').length ?? 0),
    0,
  );
  const rejectedCount = tasks.value.reduce(
    (total, task) =>
      total +
      (task.drafts?.filter((draft) => draft.status === 'rejected').length ?? 0),
    0,
  );
  const failedDraftCount = tasks.value.reduce(
    (total, task) =>
      total +
      (task.drafts?.filter((draft) => draft.status === 'failed').length ?? 0),
    0,
  );
  const failedResultCount = tasks.value.reduce(
    (total, task) => total + getTaskFailedItems(task).length,
    0,
  );
  const failedTaskCount = tasks.value.filter((task) => task.status === 'failed').length;
  const runningTaskCount = tasks.value.filter((task) =>
    ['pending', 'processing'].includes(task.status),
  ).length;
  return {
    approvedCount,
    draftCount,
    failedDraftCount,
    failedResultCount,
    failedTaskCount,
    rejectedCount,
    runningTaskCount,
    taskCount: tasks.value.length,
  };
});

watch(
  () => open.value,
  (value) => {
    if (value) {
      loadTasks().catch(() => {});
    }
  },
);

async function loadTasks() {
  loading.value = true;
  try {
    const result = await getClientPropertyAiTasksApi();
    tasks.value = result.items;
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'AI 生成记录加载失败');
  } finally {
    loading.value = false;
  }
}

function formatScene(scene: string) {
  const labels: Record<string, string> = {
    ip_recognition: '知识产权识别',
    product_service_generation: 'PS 生成',
    research_generation: 'RD 立项',
    transformation_generation: '成果生成',
  };
  return labels[scene] ?? scene;
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    approved: '已入库',
    failed: '失败',
    pending: '等待中',
    processing: '处理中',
    rejected: '已退回',
    reviewing: '待审核',
    success: '已生成',
  };
  return labels[status] ?? status;
}

function statusColor(status: string) {
  const colors: Record<string, string> = {
    approved: 'success',
    failed: 'error',
    pending: 'processing',
    processing: 'processing',
    rejected: 'default',
    reviewing: 'warning',
    success: 'success',
  };
  return colors[status] ?? 'default';
}

function draftTitle(draft: ClientEnterprisePropertyApi.AiDraft) {
  const payload = draft.draftPayload as Record<string, unknown>;
  return String(
    payload.soft_work_name ??
      payload.transformation_name ??
      payload.ky_project_name ??
      payload.ps_name ??
      `草稿 ${draft.id}`,
  );
}

function formatTaskInputSnapshot(task: AiTask) {
  const snapshot = task.inputSnapshot ?? {};
  const files = Array.isArray(snapshot.files) ? snapshot.files : [];
  const ipIds = Array.isArray(snapshot.ipIds) ? snapshot.ipIds : [];
  const rdIds = Array.isArray(snapshot.rdIds) ? snapshot.rdIds : [];
  const retryDraftIds = Array.isArray(snapshot.retryDraftIds)
    ? snapshot.retryDraftIds
    : [];

  if (files.length > 0) {
    return `上传 PDF ${files.length} 个`;
  }
  if (retryDraftIds.length > 0) {
    return `重新识别草稿 ${retryDraftIds.length} 条`;
  }
  if (ipIds.length > 0) {
    return `关联知识产权 ${ipIds.length} 条`;
  }
  if (rdIds.length > 0) {
    return `关联 RD ${rdIds.length} 条`;
  }
  return '已记录输入快照';
}

function formatResultSummary(task: AiTask) {
  const result = task.result;
  if (!result) {
    return task.errorMessage ? '任务失败，未生成结构化输出' : '暂无结构化输出';
  }

  const structuredResult = result.structuredResult ?? {};
  const records = structuredResult.records;
  const failedItems = getTaskFailedItems(task);
  const failedText = failedItems.length > 0 ? `，失败 ${failedItems.length} 条` : '';
  if (Array.isArray(records)) {
    return `${result.summary ?? '已生成结构化输出'}，记录 ${records.length} 条${failedText}`;
  }
  return `${result.summary ?? '已生成结构化输出'}${failedText}`;
}

function getTaskFailedItems(task: AiTask) {
  const failed = task.result?.structuredResult?.failed;
  if (!Array.isArray(failed)) {
    return [];
  }
  return failed
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      return {
        draftId: String(record.draftId ?? record.id ?? '-'),
        reason: String(record.reason ?? record.message ?? '未给出失败原因'),
      };
    })
    .filter((item): item is { draftId: string; reason: string } => Boolean(item));
}
</script>

<template>
  <Modal
    v-model:open="open"
    destroy-on-hidden
    :footer="null"
    title="AI 生成记录审计"
    width="1120px"
  >
    <div class="ai-task-audit">
      <div class="ai-task-audit__toolbar">
        <div>
          <strong>{{ taskSummary.taskCount }} 个任务</strong>
          <span>
            {{ taskSummary.draftCount }} 条草稿，{{ taskSummary.approvedCount }}
            条已入库，{{ taskSummary.rejectedCount }} 条已退回
          </span>
        </div>
      </div>

      <div
        v-if="
          taskSummary.failedTaskCount ||
          taskSummary.failedDraftCount ||
          taskSummary.failedResultCount ||
          taskSummary.runningTaskCount
        "
        class="ai-task-audit__summary-alert"
      >
        <strong>审计提示</strong>
        <span v-if="taskSummary.runningTaskCount">
          {{ taskSummary.runningTaskCount }} 个任务仍在处理中
        </span>
        <span v-if="taskSummary.failedTaskCount">
          {{ taskSummary.failedTaskCount }} 个任务失败
        </span>
        <span v-if="taskSummary.failedResultCount">
          {{ taskSummary.failedResultCount }} 条处理失败明细
        </span>
        <span v-if="taskSummary.failedDraftCount">
          {{ taskSummary.failedDraftCount }} 条失败草稿
        </span>
      </div>

      <div v-if="tasks.length === 0" class="ai-task-audit__empty">
        暂无 AI 生成记录。完成 PDF 识别、成果/RD/PS 生成后会在这里留痕。
      </div>

      <article
        v-for="task in tasks"
        :key="task.id"
        class="ai-task-audit__task"
      >
        <div class="ai-task-audit__task-header">
          <div>
            <strong>{{ formatScene(task.scene) }}</strong>
            <span>任务 #{{ task.id }} · {{ task.createTime }}</span>
          </div>
          <Tag :color="statusColor(task.status)">
            {{ formatStatus(task.status) }}
          </Tag>
        </div>

        <div class="ai-task-audit__task-meta">
          <span>完成时间：{{ task.finishedAt || '-' }}</span>
          <span>草稿数：{{ task.drafts?.length ?? 0 }}</span>
          <span>输入：{{ formatTaskInputSnapshot(task) }}</span>
          <span>输出：{{ formatResultSummary(task) }}</span>
          <span v-if="task.resultId">Result #{{ task.resultId }}</span>
          <span v-if="task.errorMessage">错误：{{ task.errorMessage }}</span>
        </div>

        <div
          v-if="getTaskFailedItems(task).length"
          class="ai-task-audit__failed-list"
        >
          <strong>处理失败明细</strong>
          <span
            v-for="item in getTaskFailedItems(task).slice(0, 4)"
            :key="`${task.id}-${item.draftId}-${item.reason}`"
          >
            草稿 {{ item.draftId }}：{{ item.reason }}
          </span>
          <em v-if="getTaskFailedItems(task).length > 4">
            还有 {{ getTaskFailedItems(task).length - 4 }} 条失败明细
          </em>
        </div>

        <div class="ai-task-audit__draft-table-wrap">
          <table class="ai-task-audit__draft-table">
            <thead>
              <tr>
                <th>草稿</th>
                <th>类型</th>
                <th>状态</th>
                <th>来源</th>
                <th>入库记录</th>
                <th>确认人</th>
                <th>确认时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!task.drafts?.length">
                <td colspan="7" class="ai-task-audit__empty-row">
                  暂无草稿记录
                </td>
              </tr>
              <tr v-for="draft in task.drafts" :key="draft.id">
                <td>{{ draftTitle(draft) }}</td>
                <td>{{ draft.draftType }}</td>
                <td>
                  <Tag :color="statusColor(draft.status)">
                    {{ formatStatus(draft.status) }}
                  </Tag>
                </td>
                <td>{{ draft.sourceIds.join('、') || '-' }}</td>
                <td>{{ draft.approvedRecordId || '-' }}</td>
                <td>{{ draft.reviewedBy || '-' }}</td>
                <td>{{ draft.reviewedAt || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>
  </Modal>
</template>

<style scoped>
.ai-task-audit {
  display: grid;
  gap: 14px;
}

.ai-task-audit__toolbar,
.ai-task-audit__task-header,
.ai-task-audit__task-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.ai-task-audit__toolbar span,
.ai-task-audit__task-header span,
.ai-task-audit__task-meta,
.ai-task-audit__empty,
.ai-task-audit__empty-row {
  color: hsl(var(--muted-foreground));
}

.ai-task-audit__toolbar > div,
.ai-task-audit__task-header > div {
  display: grid;
  gap: 4px;
}

.ai-task-audit__summary-alert,
.ai-task-audit__failed-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  font-size: 13px;
  color: hsl(36 80% 32%);
  background: hsl(42 100% 92%);
  border: 1px solid hsl(38 92% 72%);
  border-radius: 10px;
}

.ai-task-audit__summary-alert strong,
.ai-task-audit__failed-list strong {
  color: hsl(36 80% 24%);
}

.ai-task-audit__failed-list {
  align-items: flex-start;
  flex-direction: column;
}

.ai-task-audit__failed-list em {
  color: hsl(var(--muted-foreground));
}

.ai-task-audit__empty {
  padding: 28px;
  text-align: center;
  background: hsl(var(--muted) / 28%);
  border: 1px dashed hsl(var(--border));
  border-radius: 12px;
}

.ai-task-audit__task {
  display: grid;
  gap: 10px;
  padding: 14px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.ai-task-audit__task-meta {
  flex-wrap: wrap;
  justify-content: flex-start;
  font-size: 13px;
}

.ai-task-audit__draft-table-wrap {
  overflow: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.ai-task-audit__draft-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
}

.ai-task-audit__draft-table th,
.ai-task-audit__draft-table td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid hsl(var(--border));
}

.ai-task-audit__draft-table th {
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 34%);
}

.ai-task-audit__empty-row {
  height: 72px;
  text-align: center;
}

@media (max-width: 800px) {
  .ai-task-audit__toolbar,
  .ai-task-audit__task-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
