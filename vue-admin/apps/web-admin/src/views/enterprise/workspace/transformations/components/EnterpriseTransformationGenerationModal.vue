<script setup lang="ts">
import type { EnterpriseWorkspaceAiDraft, EnterpriseWorkspaceAiTask } from '#/api';

import { computed, shallowRef, watch } from 'vue';

import { Button, Checkbox, Empty, InputNumber, message, Modal, Select, Table, Tag } from 'antdv-next';

import {
  approveEnterpriseWorkspaceTransformationGenerationDraftsApi,
  createEnterpriseWorkspaceTransformationGenerationTaskApi,
  getEnterpriseWorkspaceAiTasksApi,
  getEnterpriseWorkspaceTransformationGenerationDraftsApi,
} from '#/api';
import EnterpriseAiTaskStatusList from '../../components/EnterpriseAiTaskStatusList.vue';

defineOptions({ name: 'EnterpriseTransformationGenerationModal' });

const props = defineProps<{ enterpriseId: string }>();
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ approved: [] }>();

const drafts = shallowRef<EnterpriseWorkspaceAiDraft[]>([]);
const selectedIds = shallowRef<string[]>([]);
const loading = shallowRef(false);
const generating = shallowRef(false);
const approving = shallowRef(false);
const tasks = shallowRef<EnterpriseWorkspaceAiTask[]>([]);
const targetCount = shallowRef(5);
const businessMode = shallowRef<'auto' | 'mixed' | 'product' | 'service'>('auto');
const businessModeOptions = [{ label: '自动识别', value: 'auto' }, { label: '产品型', value: 'product' }, { label: '服务型', value: 'service' }, { label: '混合型', value: 'mixed' }];
const reviewDrafts = computed(() => drafts.value.filter((item) => item.status === 'reviewing'));
const hasProcessingTask = computed(() =>
  tasks.value.some(
    (task) =>
      task.scene === 'transformation_generation' &&
      ['pending', 'processing'].includes(task.status),
  ),
);
const columns = [
  { key: 'select', width: 48 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 96 },
  { key: 'name', title: '成果转化名称', width: 250 },
  { key: 'method', title: '转化方式', width: 150 },
  { key: 'ips', title: '关联 IP', width: 180 },
  { key: 'remark', title: '生成说明', width: 280 },
];

watch(() => [open.value, props.enterpriseId] as const, ([visible]) => { if (visible) void loadDrafts(); });

function payloadValue(draft: EnterpriseWorkspaceAiDraft, key: string) {
  return String(draft.draftPayload[key] ?? '-');
}

function relatedIpCodeLabels(draft: EnterpriseWorkspaceAiDraft) {
  const labels = String(draft.draftPayload.related_ip_labels ?? '');
  const codes = labels
    .split(/[,，、]/u)
    .map((label) => label.trim().match(/^IP\d+/iu)?.[0])
    .filter((code): code is string => Boolean(code));
  return codes.length > 0 ? codes.join('、') : '-';
}

function statusLabel(status: string) {
  return ({ approved: '已入库', rejected: '已作废', reviewing: '待审核' } as Record<string, string>)[status] ?? status;
}

function statusColor(status: string) {
  return ({ approved: 'success', rejected: 'default', reviewing: 'processing' } as Record<string, string>)[status] ?? 'default';
}

async function loadDrafts() {
  if (!props.enterpriseId) return;
  loading.value = true;
  try {
    const [draftResult, taskResult] = await Promise.all([
      getEnterpriseWorkspaceTransformationGenerationDraftsApi(props.enterpriseId),
      getEnterpriseWorkspaceAiTasksApi(props.enterpriseId),
    ]);
    drafts.value = draftResult.items;
    selectedIds.value = draftResult.items.filter((item) => item.status === 'reviewing').map((item) => item.id);
    tasks.value = taskResult.items;
  } finally { loading.value = false; }
}

async function generate() {
  if (hasProcessingTask.value) {
    message.warning('成果转化生成任务处理中，请稍候');
    return;
  }
  generating.value = true;
  try {
    const result = await createEnterpriseWorkspaceTransformationGenerationTaskApi(props.enterpriseId, { businessMode: businessMode.value, targetCount: targetCount.value });
    message.success(`已提交 ${result.total} 条成果转化草稿生成任务`);
    await loadDrafts();
  } finally { generating.value = false; }
}

async function approve() {
  const ids = selectedIds.value.filter((id) => reviewDrafts.value.some((item) => item.id === id));
  if (!ids.length) { message.warning('请选择待入库草稿'); return; }
  approving.value = true;
  try {
    const result = await approveEnterpriseWorkspaceTransformationGenerationDraftsApi(props.enterpriseId, ids);
    if (result.success.length) { message.success(`已入库 ${result.success.length} 条成果转化`); emit('approved'); }
    if (result.failed.length) message.warning(`${result.failed.length} 条未入库：${result.failed[0]?.reason ?? ''}`);
    await loadDrafts();
  } finally { approving.value = false; }
}

function toggle(id: string, checked: boolean) {
  selectedIds.value = checked ? [...new Set([...selectedIds.value, id])] : selectedIds.value.filter((item) => item !== id);
}
</script>

<template>
  <Modal v-model:open="open" :footer="null" title="成果转化草稿生成" width="min(1180px, calc(100vw - 48px))">
    <div class="generation">
      <div class="generation__toolbar">
        <div class="generation__hint">按当前企业尚未关联成果转化的知识产权生成草稿，审核后入库。</div>
        <div class="generation__actions">
          <span>目标数量</span><InputNumber v-model:value="targetCount" :max="30" :min="1" :precision="0" />
          <Select v-model:value="businessMode" :options="businessModeOptions" style="width: 108px" />
          <Button :disabled="hasProcessingTask" :loading="generating" @click="generate">生成草稿</Button>
          <Button type="primary" :loading="approving" @click="approve">审核入库</Button>
        </div>
      </div>
      <EnterpriseAiTaskStatusList :active="open" :enterprise-id="props.enterpriseId" :scenes="['transformation_generation']" @completed="loadDrafts" />
      <Table v-if="drafts.length" :columns="columns" :data-source="drafts" :loading="loading" :pagination="false" :row-key="(record: EnterpriseWorkspaceAiDraft) => record.id" :scroll="{ x: 1100, y: 460 }" size="small">
        <template #bodyCell="{ column, record }">
          <Checkbox v-if="column.key === 'select'" :checked="selectedIds.includes(record.id)" :disabled="record.status !== 'reviewing'" @update:checked="(checked) => toggle(record.id, checked)" />
          <Tag v-else-if="column.key === 'status'" :color="statusColor(record.status)">{{ statusLabel(record.status) }}</Tag>
          <template v-else-if="column.key === 'name'">{{ payloadValue(record, 'transformation_name') }}</template>
          <template v-else-if="column.key === 'method'">{{ payloadValue(record, 'transformation_method') }}</template>
          <template v-else-if="column.key === 'ips'">{{ relatedIpCodeLabels(record) }}</template>
          <span v-else-if="column.key === 'remark'" class="generation__remark">{{ payloadValue(record, 'remark') }}</span>
        </template>
      </Table>
      <Empty v-else-if="!loading" description="暂无成果转化草稿" />
    </div>
  </Modal>
</template>

<style scoped>
.generation { display: grid; gap: 16px; }.generation__toolbar, .generation__actions { display: flex; gap: 12px; align-items: center; }.generation__toolbar { justify-content: space-between; }.generation__hint, .generation__remark { color: hsl(var(--muted-foreground)); }.generation__remark { white-space: normal; }@media (max-width: 760px) { .generation__toolbar { align-items: flex-start; flex-direction: column; }.generation__actions { flex-wrap: wrap; } }
</style>
