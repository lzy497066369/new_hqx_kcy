<script setup lang="ts">
import type { EnterpriseWorkspaceSummary } from '#/api';

import { Button, Empty, Popconfirm, Progress, Space, Table, Tag } from 'antdv-next';

interface Props {
  declarations: EnterpriseWorkspaceSummary['declarations'];
}

defineProps<Props>();

const emit = defineEmits<{
  review: [payload: { action: 'approve' | 'return'; declarationId: string }];
}>();

const columns = [
  { dataIndex: 'projectName', key: 'projectName', title: '项目' },
  { dataIndex: 'status', key: 'status', title: '状态', width: 112 },
  { dataIndex: 'currentNodeName', key: 'currentNodeName', title: '当前节点', width: 132 },
  { dataIndex: 'missingMaterialCount', key: 'missingMaterialCount', title: '缺少材料', width: 98 },
  { dataIndex: 'progress', key: 'progress', title: '进度', width: 168 },
  { key: 'action', title: '操作', width: 150 },
];

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    approved: 'green',
    draft: 'default',
    preparing: 'blue',
    rejected: 'red',
    reviewing: 'orange',
    submitted: 'cyan',
  };
  return colors[status] ?? 'default';
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    approved: '已通过',
    draft: '草稿',
    preparing: '准备中',
    rejected: '已退回',
    reviewing: '审核中',
    submitted: '已提交',
  };
  return labels[status] ?? status;
}
</script>

<template>
  <Table
    v-if="declarations.length"
    :columns="columns"
    :data-source="declarations"
    :pagination="false"
    :row-key="(record) => record.id"
    :scroll="{ x: 860 }"
    size="small"
  >
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'status'">
        <Tag :color="getStatusColor(record.status)">
          {{ getStatusLabel(record.status) }}
        </Tag>
      </template>
      <template v-else-if="column.key === 'currentNodeName'">
        {{ record.currentNodeName || '-' }}
      </template>
      <template v-else-if="column.key === 'missingMaterialCount'">
        <Tag v-if="record.missingMaterialCount" color="orange">
          {{ record.missingMaterialCount }} 项
        </Tag>
        <span v-else>-</span>
      </template>
      <template v-else-if="column.key === 'progress'">
        <Progress :percent="record.progress" :show-info="false" size="small" />
      </template>
      <Space v-else-if="column.key === 'action'" size="small">
        <Popconfirm
          title="确认通过该申报？"
          @confirm="emit('review', { action: 'approve', declarationId: record.id })"
        >
          <Button v-if="record.status === 'reviewing'" size="small" type="primary">通过</Button>
        </Popconfirm>
        <Popconfirm
          title="确认退回企业补充资料？"
          @confirm="emit('review', { action: 'return', declarationId: record.id })"
        >
          <Button v-if="record.status === 'reviewing'" danger size="small">退回</Button>
        </Popconfirm>
        <span v-if="record.status !== 'reviewing'">-</span>
      </Space>
    </template>
  </Table>
  <Empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" description="暂无申报记录" />
</template>
