<script setup lang="ts">
import type { EnterpriseWorkspaceAiDraft, EnterpriseWorkspaceAiTask } from '#/api';

import { computed, shallowRef, watch } from 'vue';

import { Button, Checkbox, Empty, InputNumber, message, Modal, Table, Tag } from 'antdv-next';

import {
  approveEnterpriseWorkspaceResearchGenerationDraftsApi,
  createEnterpriseWorkspaceResearchAutoMatchTaskApi,
  deleteEnterpriseWorkspaceResearchGenerationDraftsApi,
  getEnterpriseWorkspaceAiTasksApi,
  getEnterpriseWorkspaceResearchGenerationDraftsApi,
} from '#/api';
import EnterpriseAiTaskStatusList from '../../components/EnterpriseAiTaskStatusList.vue';

defineOptions({ name: 'EnterpriseResearchGenerationModal' });

const props = defineProps<{ enterpriseId: string }>();
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ approved: [] }>();
const drafts = shallowRef<EnterpriseWorkspaceAiDraft[]>([]);
const selectedIds = shallowRef<string[]>([]);
const loading = shallowRef(false);
const generating = shallowRef(false);
const approving = shallowRef(false);
const deleting = shallowRef(false);
const tasks = shallowRef<EnterpriseWorkspaceAiTask[]>([]);
const targetCount = shallowRef(6);
const reviewDrafts = computed(() => drafts.value.filter((item) => item.status === 'reviewing'));
const selectedReviewIds = computed(() => selectedIds.value.filter((id) => reviewDrafts.value.some((item) => item.id === id)));
const hasProcessingTask = computed(() =>
  tasks.value.some(
    (task) =>
      task.scene === 'research_generation' &&
      ['pending', 'processing'].includes(task.status),
  ),
);
const columns = [
  { key: 'select', width: 48 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 96 },
  { key: 'name', title: '研发项目名称', width: 260 },
  { key: 'number', title: '项目编号', width: 140 },
  { key: 'leader', title: '负责人', width: 120 },
  { key: 'period', title: '研发周期', width: 190 },
  { key: 'ips', title: '关联 IP', width: 180 },
];

watch(() => [open.value, props.enterpriseId] as const, ([visible]) => { if (visible) void loadDrafts(); });

function valueOf(draft: EnterpriseWorkspaceAiDraft, key: string) { return String(draft.draftPayload[key] ?? '-'); }
function relatedIpCodeLabels(draft: EnterpriseWorkspaceAiDraft) {
  const labels = String(draft.draftPayload.related_ip_labels ?? '');
  const codes = labels
    .split(/[,，、]/u)
    .map((label) => label.trim().match(/^IP\d+/iu)?.[0])
    .filter((code): code is string => Boolean(code));
  return codes.length > 0 ? codes.join('、') : '-';
}
function statusLabel(status: string) { return ({ approved: '已入库', rejected: '已作废', reviewing: '待审核' } as Record<string, string>)[status] ?? status; }
function statusColor(status: string) { return ({ approved: 'success', rejected: 'default', reviewing: 'processing' } as Record<string, string>)[status] ?? 'default'; }

async function loadDrafts() { if (!props.enterpriseId) return; loading.value = true; try { const [draftResult, taskResult] = await Promise.all([getEnterpriseWorkspaceResearchGenerationDraftsApi(props.enterpriseId), getEnterpriseWorkspaceAiTasksApi(props.enterpriseId)]); drafts.value = draftResult.items; selectedIds.value = draftResult.items.filter((item) => item.status === 'reviewing').map((item) => item.id); tasks.value = taskResult.items; } finally { loading.value = false; } }
async function generate() { if (hasProcessingTask.value) { message.warning('RD 自动匹配任务处理中，请稍候'); return; } generating.value = true; try { const result = await createEnterpriseWorkspaceResearchAutoMatchTaskApi(props.enterpriseId, { targetCount: targetCount.value }); message.success(`已提交 ${result.total} 条 RD 自动匹配草稿任务`); if (result.warning) message.warning(result.warning); await loadDrafts(); } finally { generating.value = false; } }
async function approve() { const ids = selectedIds.value.filter((id) => reviewDrafts.value.some((item) => item.id === id)); if (!ids.length) { message.warning('请选择待入库草稿'); return; } approving.value = true; try { const result = await approveEnterpriseWorkspaceResearchGenerationDraftsApi(props.enterpriseId, ids); if (result.success.length) { message.success(`已入库 ${result.success.length} 条研发项目`); emit('approved'); } if (result.failed.length) message.warning(`${result.failed.length} 条未入库：${result.failed[0]?.reason ?? ''}`); await loadDrafts(); } finally { approving.value = false; } }
function deleteSelectedDrafts() {
  if (!selectedReviewIds.value.length) { message.warning('请选择待删除的草稿'); return; }
  Modal.confirm({
    content: `将删除选中的 ${selectedReviewIds.value.length} 条研发项目草稿，删除后不可恢复。`,
    okText: '确认删除',
    okType: 'danger',
    title: '批量删除研发项目草稿',
    onOk: async () => {
      deleting.value = true;
      try {
        const result = await deleteEnterpriseWorkspaceResearchGenerationDraftsApi(props.enterpriseId, selectedReviewIds.value);
        if (result.success.length) message.success(`已删除 ${result.success.length} 条草稿`);
        if (result.failed.length) message.warning(`${result.failed.length} 条未删除：${result.failed[0]?.reason ?? ''}`);
        await loadDrafts();
      } finally { deleting.value = false; }
    },
  });
}
function toggle(id: string, checked: boolean) { selectedIds.value = checked ? [...new Set([...selectedIds.value, id])] : selectedIds.value.filter((item) => item !== id); }
</script>

<template>
  <Modal v-model:open="open" :footer="null" title="RD 自动匹配草稿" width="min(1120px, calc(100vw - 48px))">
    <div class="research-generation">
      <div class="research-generation__toolbar"><span>根据当前企业已有 IP 的授权日期自动规划研发项目草稿。</span><div><span>目标总数</span><InputNumber v-model:value="targetCount" :max="10" :min="6" :precision="0" /><Button danger :disabled="!selectedReviewIds.length" :loading="deleting" @click="deleteSelectedDrafts">删除已选草稿（{{ selectedReviewIds.length }}）</Button><Button :disabled="hasProcessingTask" :loading="generating" @click="generate">自动匹配生成</Button><Button type="primary" :loading="approving" @click="approve">审核入库</Button></div></div>
      <EnterpriseAiTaskStatusList :active="open" :enterprise-id="props.enterpriseId" :scenes="['research_generation']" @completed="loadDrafts" />
      <Table v-if="drafts.length" :columns="columns" :data-source="drafts" :loading="loading" :pagination="false" :row-key="(record: EnterpriseWorkspaceAiDraft) => record.id" :scroll="{ x: 1000, y: 460 }" size="small"><template #bodyCell="{ column, record }"><Checkbox v-if="column.key === 'select'" :checked="selectedIds.includes(record.id)" :disabled="record.status !== 'reviewing'" @update:checked="(checked) => toggle(record.id, checked)" /><Tag v-else-if="column.key === 'status'" :color="statusColor(record.status)">{{ statusLabel(record.status) }}</Tag><template v-else-if="column.key === 'name'">{{ valueOf(record, 'ky_project_name') }}</template><template v-else-if="column.key === 'number'">{{ valueOf(record, 'ky_project_num') }}</template><template v-else-if="column.key === 'leader'">{{ valueOf(record, 'ky_project_leader') }}</template><template v-else-if="column.key === 'period'">{{ valueOf(record, 'init_date') }} 至 {{ valueOf(record, 'end_date') }}</template><template v-else-if="column.key === 'ips'">{{ relatedIpCodeLabels(record) }}</template></template></Table>
      <Empty v-else-if="!loading" description="暂无 RD 草稿" />
    </div>
  </Modal>
</template>

<style scoped>
.research-generation { display: grid; gap: 16px; }.research-generation__toolbar, .research-generation__toolbar > div { display: flex; gap: 12px; align-items: center; }.research-generation__toolbar { justify-content: space-between; color: hsl(var(--muted-foreground)); }@media (max-width: 760px) { .research-generation__toolbar { align-items: flex-start; flex-direction: column; }.research-generation__toolbar > div { flex-wrap: wrap; } }
</style>
