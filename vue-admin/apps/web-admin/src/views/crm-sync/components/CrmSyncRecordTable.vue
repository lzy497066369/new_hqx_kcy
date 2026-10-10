<script setup lang="ts">
import type { CrmSyncRecord } from '#/api';

import { computed } from 'vue';

import { Button, Table, Tag } from 'antdv-next';

const props = defineProps<{
  items: CrmSyncRecord[];
  loading: boolean;
  mode: 'contract' | 'execution-order';
}>();

const emit = defineEmits<{
  detail: [record: CrmSyncRecord];
  retry: [record: CrmSyncRecord];
}>();

const columns = computed(() => props.mode === 'contract'
  ? [
      { dataIndex: 'companyName', key: 'companyName', title: '客户企业', width: 220 },
      { dataIndex: 'contractNo', key: 'contractNo', title: '合同号', width: 150 },
      { dataIndex: 'customerContractNo', key: 'customerContractNo', title: '客户合同编号/PO', width: 180 },
      { dataIndex: 'contractName', key: 'contractName', title: '合同单名称', minWidth: 220 },
      { dataIndex: 'enterpriseName', key: 'enterpriseName', title: '导入企业', width: 220 },
      { key: 'processStatus', title: '处理状态', width: 110 },
      { key: 'failureReason', title: '失败原因', width: 250 },
      { key: 'actions', title: '操作', width: 145 },
    ]
  : [
      { dataIndex: 'orderNo', key: 'orderNo', title: '单号', width: 145 },
      { dataIndex: 'companyName', key: 'companyName', title: '客户', width: 200 },
      { dataIndex: 'contractNo', key: 'contractNo', title: '合同号', width: 145 },
      { dataIndex: 'executionOrderName', key: 'executionOrderName', title: '项目执行单名称', minWidth: 260 },
      { key: 'projectCodes', title: '识别结果', width: 190 },
      { key: 'intellectualPropertyCount', title: '知识产权数量', width: 120 },
      { key: 'processStatus', title: '处理状态', width: 110 },
      { key: 'failureReason', title: '失败原因', width: 240 },
      { key: 'actions', title: '操作', width: 145 },
    ],
);

function statusColor(status: string) {
  return ({ failed: 'red', processing: 'blue', received: 'default', skipped: 'gold', success: 'green' } as Record<string, string>)[status] ?? 'default';
}

function statusLabel(status: string) {
  return ({ failed: '失败', processing: '处理中', received: '已接收', skipped: '无需创建', success: '成功' } as Record<string, string>)[status] ?? status;
}

function projectLabel(record: CrmSyncRecord) {
  if (!('projectCodes' in record) || record.projectCodes.length === 0) return '-';
  return record.projectCodes.map((code) => ({
    QUAL_HIGH_TECH_ENTERPRISE_NATIONAL: '国家高新技术企业',
    QUAL_TECH_SME_PROVINCIAL: '省级科技型中小企业',
  }[code] ?? code)).join('、');
}
</script>

<template>
  <Table
    :columns="columns"
    :data-source="items"
    :loading="loading"
    :pagination="false"
    :row-key="(record: CrmSyncRecord) => record.id"
    :scroll="{ x: mode === 'contract' ? 1395 : 1555 }"
    size="middle"
  >
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'processStatus'">
        <Tag :color="statusColor(record.processStatus)">{{ statusLabel(record.processStatus) }}</Tag>
      </template>
      <template v-else-if="column.key === 'failureReason'">
        <span class="crm-sync-table__reason">{{ record.failureReason || '-' }}</span>
      </template>
      <template v-else-if="column.key === 'projectCodes'">{{ projectLabel(record) }}</template>
      <template v-else-if="column.key === 'intellectualPropertyCount'">
        {{ 'intellectualPropertyCount' in record && record.intellectualPropertyCount !== null ? record.intellectualPropertyCount : '-' }}
      </template>
      <template v-else-if="column.key === 'actions'">
        <Button size="small" type="link" @click="emit('detail', record)">详情</Button>
        <Button :disabled="record.processStatus === 'processing'" size="small" type="link" @click="emit('retry', record)">重新执行</Button>
      </template>
    </template>
  </Table>
</template>

<style scoped>
.crm-sync-table__reason {
  display: inline-block;
  max-width: 230px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}
</style>
