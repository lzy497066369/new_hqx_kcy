<script setup lang="ts">
import type { CrmSyncRecord, CrmSyncRecordDetail } from '#/api';

import { onMounted, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { Button, Card, Input, Pagination, Select } from 'antdv-next';

import {
  getCrmContractSyncRecordDetailApi,
  getCrmContractSyncRecordsApi,
  getCrmExecutionOrderSyncRecordDetailApi,
  getCrmExecutionOrderSyncRecordsApi,
  retryCrmContractSyncRecordApi,
  retryCrmExecutionOrderSyncRecordApi,
} from '#/api';
import { confirmAction, showActionFailure, showActionSuccess } from '../../system/shared/action-feedback';
import CrmSyncRecordDetailModal from './CrmSyncRecordDetailModal.vue';
import CrmSyncRecordTable from './CrmSyncRecordTable.vue';

const props = defineProps<{ mode: 'contract' | 'execution-order' }>();

const items = shallowRef<CrmSyncRecord[]>([]);
const total = shallowRef(0);
const loading = shallowRef(false);
const detailOpen = shallowRef(false);
const detail = shallowRef<CrmSyncRecordDetail | null>(null);
const keyword = shallowRef('');
const processStatus = shallowRef<string>();
const page = shallowRef(1);
const pageSize = shallowRef(20);

const statusOptions = [
  { label: '已接收', value: 'received' },
  { label: '处理中', value: 'processing' },
  { label: '成功', value: 'success' },
  { label: '无需创建', value: 'skipped' },
  { label: '失败', value: 'failed' },
];

async function load() {
  loading.value = true;
  try {
    const params = {
      keyword: keyword.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
      processStatus: processStatus.value,
    };
    const result = props.mode === 'contract'
      ? await getCrmContractSyncRecordsApi(params)
      : await getCrmExecutionOrderSyncRecordsApi(params);
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
  pageSize.value = 20;
  await load();
}

async function openDetail(record: CrmSyncRecord) {
  detailOpen.value = true;
  detail.value = null;
  try {
    detail.value = props.mode === 'contract'
      ? await getCrmContractSyncRecordDetailApi(record.id)
      : await getCrmExecutionOrderSyncRecordDetailApi(record.id);
  } catch (error) {
    detailOpen.value = false;
    showActionFailure(error);
  }
}

async function retry(record: CrmSyncRecord) {
  try {
    await confirmAction('确认重新执行该同步记录吗？', '重新执行同步');
    const result = props.mode === 'contract'
      ? await retryCrmContractSyncRecordApi(record.id)
      : await retryCrmExecutionOrderSyncRecordApi(record.id);
    if (result.processStatus === 'processing') {
      showActionSuccess('同步正在执行，请稍后查看结果');
    } else {
      showActionSuccess('已完成重新执行');
    }
    await load();
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') return;
    showActionFailure(error);
  }
}

async function changePage(nextPage: number, nextPageSize: number) {
  page.value = nextPage;
  pageSize.value = nextPageSize;
  await load();
}

onMounted(() => void load());
</script>

<template>
  <Page auto-content-height>
    <Card :title="mode === 'contract' ? 'CRM 合同同步记录' : 'CRM 执行单同步记录'">
      <div class="crm-sync-list__filters">
        <Input v-model:value="keyword" allow-clear placeholder="搜索客户、合同号、单号或名称" @press-enter="search" />
        <Select v-model:value="processStatus" allow-clear :options="statusOptions" placeholder="全部状态" />
        <Button type="primary" @click="search">查询</Button>
        <Button @click="reset">重置</Button>
      </div>
      <CrmSyncRecordTable :items="items" :loading="loading" :mode="mode" @detail="openDetail" @retry="retry" />
      <div v-if="total" class="crm-sync-list__pagination">
        <Pagination :current="page" :page-size="pageSize" :total="total" show-size-changer @change="changePage" />
      </div>
    </Card>
    <CrmSyncRecordDetailModal :detail="detail" :mode="mode" :open="detailOpen" @close="detailOpen = false" />
  </Page>
</template>

<style scoped>
.crm-sync-list__filters {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.crm-sync-list__filters :deep(.ant-input-affix-wrapper) {
  max-width: 360px;
}

.crm-sync-list__filters :deep(.ant-select) {
  width: 150px;
}

.crm-sync-list__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

@media (max-width: 720px) {
  .crm-sync-list__filters {
    flex-wrap: wrap;
  }

  .crm-sync-list__filters :deep(.ant-input-affix-wrapper),
  .crm-sync-list__filters :deep(.ant-select) {
    max-width: none;
    width: 100%;
  }
}
</style>
