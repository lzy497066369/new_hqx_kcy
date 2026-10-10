<script setup lang="ts">
import type { CrmIntegrationInboundRequest } from '#/api';

import { onMounted, shallowRef } from 'vue';

import { Button, Card, Input, Pagination, Select, Table, Tag } from 'antdv-next';

import { getCrmIntegrationRequestsApi, retryCrmIntegrationRequestApi } from '#/api';
import { confirmAction, showActionFailure, showActionSuccess } from '../../../system/shared/action-feedback';

const items = shallowRef<CrmIntegrationInboundRequest[]>([]);
const total = shallowRef(0);
const loading = shallowRef(false);
const keyword = shallowRef('');
const processStatus = shallowRef<string>();
const page = shallowRef(1);
const pageSize = shallowRef(20);

const columns = [
  { dataIndex: 'sourceRequestId', key: 'sourceRequestId', title: '来源请求 ID', minWidth: 220 },
  { dataIndex: 'requestType', key: 'requestType', title: '类型', width: 120 },
  { dataIndex: 'clientId', key: 'clientId', title: '调用方 ID', width: 110 },
  { key: 'processStatus', title: '状态', width: 110 },
  { dataIndex: 'syncRecordId', key: 'syncRecordId', title: '同步记录', width: 110 },
  { dataIndex: 'failureReason', key: 'failureReason', title: '失败原因', minWidth: 260 },
  { key: 'actions', title: '操作', width: 100 },
];

const statusOptions = [
  { label: '已接收', value: 'accepted' },
  { label: '处理中', value: 'processing' },
  { label: '成功', value: 'success' },
  { label: '无需创建', value: 'skipped' },
  { label: '失败', value: 'failed' },
];

function statusColor(status: string) {
  return ({ accepted: 'default', failed: 'red', processing: 'blue', skipped: 'gold', success: 'green' } as Record<string, string>)[status] ?? 'default';
}

async function load() {
  loading.value = true;
  try {
    const result = await getCrmIntegrationRequestsApi({
      keyword: keyword.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
      processStatus: processStatus.value,
    });
    items.value = result.items;
    total.value = result.total;
  } catch (error) {
    showActionFailure(error);
  } finally {
    loading.value = false;
  }
}

async function search() {
  page.value = 1;
  await load();
}

async function reset() {
  keyword.value = '';
  processStatus.value = undefined;
  page.value = 1;
  await load();
}

async function changePage(nextPage: number, nextPageSize: number) {
  page.value = nextPage;
  pageSize.value = nextPageSize;
  await load();
}

async function retry(record: CrmIntegrationInboundRequest) {
  try {
    await confirmAction('确认重新执行该 CRM 入站请求吗？', '重新执行请求');
    await retryCrmIntegrationRequestApi(record.id);
    showActionSuccess('请求已重新入队');
    await load();
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') return;
    showActionFailure(error);
  }
}

onMounted(() => void load());
</script>

<template>
  <Card title="v2 入站请求审计">
    <div class="crm-integration-request__filters">
      <Input v-model:value="keyword" allow-clear placeholder="搜索来源请求 ID 或类型" @press-enter="search" />
      <Select v-model:value="processStatus" allow-clear :options="statusOptions" placeholder="全部状态" />
      <Button type="primary" @click="search">查询</Button>
      <Button @click="reset">重置</Button>
    </div>
    <Table :columns="columns" :data-source="items" :loading="loading" :pagination="false" :row-key="(item: CrmIntegrationInboundRequest) => item.id" :scroll="{ x: 1030 }">
      <template #bodyCell="{ column, record }">
        <Tag v-if="column.key === 'processStatus'" :color="statusColor(record.processStatus)">{{ record.processStatus }}</Tag>
        <span v-else-if="column.key === 'failureReason'" class="crm-integration-request__reason">{{ record.failureReason || '-' }}</span>
        <span v-else-if="column.key === 'syncRecordId'">{{ record.syncRecordId || '-' }}</span>
        <Button v-else-if="column.key === 'actions'" :disabled="record.processStatus === 'processing'" size="small" type="link" @click="retry(record)">重新执行</Button>
      </template>
    </Table>
    <div v-if="total" class="crm-integration-request__pagination"><Pagination :current="page" :page-size="pageSize" :total="total" show-size-changer @change="changePage" /></div>
  </Card>
</template>

<style scoped>
.crm-integration-request__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.crm-integration-request__filters :deep(.ant-input-affix-wrapper) {
  max-width: 360px;
}

.crm-integration-request__filters :deep(.ant-select) {
  width: 150px;
}

.crm-integration-request__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.crm-integration-request__reason {
  display: inline-block;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}
</style>
