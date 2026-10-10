<script setup lang="ts">
import type { TableColumnsType } from 'antdv-next';

import type { EnterpriseWorkspaceAiTask } from '#/api';

import { computed, onBeforeUnmount, shallowRef, watch } from 'vue';

import { Button, Modal, Table, Tag } from 'antdv-next';

import {
  deleteEnterpriseWorkspaceAiTaskApi,
  getEnterpriseWorkspaceAiTasksApi,
} from '#/api';

import { showActionFailure, showActionSuccess } from '../../../system/shared/action-feedback';

defineOptions({ name: 'EnterpriseAiTaskStatusList' });

const props = defineProps<{
  active: boolean;
  enterpriseId: string;
  scenes: readonly string[];
}>();
const emit = defineEmits<{ completed: [] }>();

const tasks = shallowRef<EnterpriseWorkspaceAiTask[]>([]);
const deletingTaskId = shallowRef<string>();
let refreshTimer: null | number = null;
let hasLoaded = false;
let previousTaskStatuses = new Map<string, string>();

const sceneLabels: Record<string, string> = {
  contract_recognition: '合同 PDF 识别',
  finance_ai_parse: '财税 AI 解析',
  ip_recognition: '知识产权 PDF 识别',
  product_service_generation: '产品服务草稿生成',
  research_generation: '研发项目草稿生成',
  transformation_generation: '成果转化草稿生成',
};

const rows = computed(() =>
  tasks.value
    .filter((task) => task.status !== 'success')
    .flatMap((task) => taskSources(task).map((source, index) => ({
      id: `${task.id}-${index}`,
      taskId: task.id,
      message: task.errorMessage ?? (task.status === 'failed' ? '后台处理失败' : '后台处理中'),
      scene: sceneLabels[task.scene] ?? task.scene,
      source,
      status: task.status,
      submittedAt: task.createTime,
    }))),
);

const columns: TableColumnsType<(typeof rows.value)[number]> = [
  { dataIndex: 'source', key: 'source', title: '文件/任务', width: 300 },
  { dataIndex: 'scene', key: 'scene', title: '处理类型', width: 180 },
  { key: 'status', title: '状态', width: 120 },
  { dataIndex: 'message', key: 'message', title: '处理说明', width: 280 },
  { dataIndex: 'submittedAt', key: 'submittedAt', title: '提交时间', width: 180 },
  { key: 'actions', title: '操作', width: 84 },
];

function taskSources(task: EnterpriseWorkspaceAiTask) {
  const files = task.inputSnapshot.files;
  if (Array.isArray(files) && files.length > 0) {
    return files.map((file, index) => {
      if (file && typeof file === 'object' && 'name' in file) {
        return String(file.name || `文件 ${index + 1}`);
      }
      return `文件 ${index + 1}`;
    });
  }
  const targetCount = Number(task.inputSnapshot.targetCount ?? 0);
  return [targetCount > 0 ? `计划生成 ${targetCount} 条` : sceneLabels[task.scene] ?? '后台任务'];
}

function statusLabel(status: string) {
  return {
    failed: '处理失败',
    pending: '等待处理',
    processing: '后台处理中',
  }[status] ?? status;
}

function statusColor(status: string) {
  return { failed: 'error', pending: 'default', processing: 'processing' }[status] ?? 'default';
}

function stopPolling() {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

async function loadTasks() {
  if (!props.enterpriseId) return;
  const result = await getEnterpriseWorkspaceAiTasksApi(props.enterpriseId);
  const nextTasks = result.items.filter((task) => props.scenes.includes(task.scene));
  if (
    hasLoaded &&
    nextTasks.some(
      (task) =>
        ['pending', 'processing'].includes(previousTaskStatuses.get(task.id) ?? '') &&
        task.status === 'success',
    )
  ) {
    emit('completed');
  }
  previousTaskStatuses = new Map(nextTasks.map((task) => [task.id, task.status]));
  hasLoaded = true;
  tasks.value = nextTasks;
}

function confirmDelete(taskId: string) {
  Modal.confirm({
    content: '仅删除失败任务记录，不会删除已上传的文件。',
    okText: '删除',
    okType: 'danger',
    title: '删除失败任务',
    onOk: async () => {
      deletingTaskId.value = taskId;
      try {
        await deleteEnterpriseWorkspaceAiTaskApi(props.enterpriseId, taskId);
        await loadTasks();
        showActionSuccess('失败任务已删除');
      } catch (error) {
        showActionFailure(error);
      } finally {
        deletingTaskId.value = undefined;
      }
    },
  });
}

watch(
  () => [props.active, props.enterpriseId, props.scenes.join(',')] as const,
  ([active]) => {
    stopPolling();
    if (!active) {
      hasLoaded = false;
      previousTaskStatuses = new Map();
      return;
    }
    void loadTasks();
    refreshTimer = window.setInterval(() => void loadTasks(), 2000);
  },
  { immediate: true },
);

onBeforeUnmount(stopPolling);
</script>

<template>
  <section v-if="rows.length" class="enterprise-ai-task-status-list">
    <h3 class="enterprise-ai-task-status-list__title">后台任务</h3>
    <Table :columns="columns" :data-source="rows" :pagination="false" :row-key="(record) => record.id" :scroll="{ x: 1060 }" size="small">
      <template #bodyCell="{ column, record }">
        <Tag v-if="column.key === 'status'" :color="statusColor(record.status)">
          {{ statusLabel(record.status) }}
        </Tag>
        <Button
          v-else-if="column.key === 'actions' && record.status === 'failed'"
          danger
          :loading="deletingTaskId === record.taskId"
          size="small"
          type="link"
          @click="confirmDelete(record.taskId)"
        >
          删除
        </Button>
      </template>
    </Table>
  </section>
</template>

<style scoped>
.enterprise-ai-task-status-list { display: grid; gap: 8px; }
.enterprise-ai-task-status-list__title { margin: 0; font-size: 14px; font-weight: 600; }
</style>
