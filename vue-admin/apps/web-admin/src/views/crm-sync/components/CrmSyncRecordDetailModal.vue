<script setup lang="ts">
import type { CrmSyncRecordDetail } from '#/api';

import { computed } from 'vue';

import { Descriptions, DescriptionsItem, Empty, Modal, Table, Tag } from 'antdv-next';

const props = defineProps<{
  detail: CrmSyncRecordDetail | null;
  mode: 'contract' | 'execution-order';
  open: boolean;
}>();

const emit = defineEmits<{ close: [] }>();

const payloadText = computed(() => JSON.stringify(props.detail?.payload ?? {}, null, 2));
const attemptColumns = [
  { dataIndex: 'createdAt', key: 'createdAt', title: '时间', width: 180 },
  { dataIndex: 'attemptType', key: 'attemptType', title: '方式', width: 100 },
  { dataIndex: 'operatorName', key: 'operatorName', title: '执行人', width: 120 },
  { key: 'status', title: '结果', width: 100 },
  { dataIndex: 'failureReason', key: 'failureReason', title: '原因', minWidth: 220 },
];

function statusColor(status: string) {
  return ({ failed: 'red', skipped: 'gold', success: 'green' } as Record<string, string>)[status] ?? 'default';
}

function statusLabel(status: string) {
  return ({ failed: '失败', skipped: '无需创建', success: '成功' } as Record<string, string>)[status] ?? status;
}
</script>

<template>
  <Modal :footer="null" :open="open" :title="mode === 'contract' ? '合同同步详情' : '执行单同步详情'" width="920px" @cancel="emit('close')">
    <template v-if="detail">
      <Descriptions bordered :column="2" size="small">
        <DescriptionsItem label="来源请求 ID">{{ detail.sourceRequestId }}</DescriptionsItem>
        <DescriptionsItem label="处理状态">{{ detail.processStatus }}</DescriptionsItem>
        <DescriptionsItem label="企业">{{ detail.enterpriseName || '-' }}</DescriptionsItem>
        <DescriptionsItem label="重试次数">{{ detail.retryCount }}</DescriptionsItem>
        <DescriptionsItem :span="2" label="失败原因">{{ detail.failureReason || '-' }}</DescriptionsItem>
      </Descriptions>
      <div class="crm-sync-detail__section">执行历史</div>
      <Table :columns="attemptColumns" :data-source="detail.attempts" :pagination="false" :row-key="(item) => item.id" :scroll="{ x: 720 }" size="small">
        <template #bodyCell="{ column, record }">
          <Tag v-if="column.key === 'status'" :color="statusColor(record.status)">{{ statusLabel(record.status) }}</Tag>
        </template>
      </Table>
      <div class="crm-sync-detail__section">原始请求</div>
      <pre class="crm-sync-detail__payload">{{ payloadText }}</pre>
    </template>
    <Empty v-else description="暂无详情" />
  </Modal>
</template>

<style scoped>
.crm-sync-detail__section {
  margin: 20px 0 10px;
  color: #1f2937;
  font-size: 14px;
  font-weight: 600;
}

.crm-sync-detail__payload {
  max-height: 260px;
  margin: 0;
  overflow: auto;
  padding: 12px;
  background: #f6f8fa;
  border: 1px solid #e5e7eb;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
