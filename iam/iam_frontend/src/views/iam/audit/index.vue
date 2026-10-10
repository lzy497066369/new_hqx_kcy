<script setup lang="ts">
import { onMounted, reactive, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import { Button, DatePicker, Input, Pagination, Select, Table, Tag } from 'antdv-next';

import { listAuditEventsApi, type IamAuditEvent, type IamAuditQuery } from '#/api';

dayjs.extend(utc);
dayjs.extend(timezone);

const BEIJING_TIMEZONE = 'Asia/Shanghai';

const events = shallowRef<IamAuditEvent[]>([]);
const loading = shallowRef(false);
const page = shallowRef(1);
const pageSize = shallowRef(20);
const total = shallowRef(0);
const filters = reactive<Pick<IamAuditQuery, 'action' | 'endAt' | 'outcome' | 'startAt' | 'username'>>({});

const outcomeOptions = [
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failure' },
];
const columns = [
  { key: 'createdAt', title: '时间', width: 180 },
  { dataIndex: 'action', key: 'action', title: '操作' },
  { dataIndex: 'username', key: 'username', title: '用户', width: 140 },
  { dataIndex: 'appCode', key: 'appCode', title: '应用', width: 140 },
  { dataIndex: 'clientId', key: 'clientId', title: '客户端', width: 180 },
  { key: 'outcome', title: '结果', width: 100 },
];

function formatBeijingDateTime(value: string) {
  return dayjs(value).tz(BEIJING_TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
}

function toBeijingQueryTime(value?: string) {
  return value
    ? dayjs.tz(value, 'YYYY-MM-DDTHH:mm:ss', BEIJING_TIMEZONE).format('YYYY-MM-DDTHH:mm:ssZ')
    : undefined;
}

async function reload(resetPage = false) {
  if (resetPage) page.value = 1;
  loading.value = true;
  try {
    const response = await listAuditEventsApi({
      action: filters.action?.trim() || undefined,
      endAt: toBeijingQueryTime(filters.endAt),
      limit: pageSize.value,
      outcome: filters.outcome,
      page: page.value,
      startAt: toBeijingQueryTime(filters.startAt),
      username: filters.username?.trim() || undefined,
    });
    events.value = response.items;
    total.value = response.total;
    page.value = response.page;
    pageSize.value = response.limit;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  Object.assign(filters, { action: undefined, endAt: undefined, outcome: undefined, startAt: undefined, username: undefined });
  void reload(true);
}

function changePage(nextPage: number, nextPageSize: number) {
  page.value = nextPage;
  pageSize.value = nextPageSize;
  void reload();
}

onMounted(() => void reload());
</script>

<template>
  <Page auto-content-height>
    <section class="iam-audit">
      <header class="iam-audit__header">
        <div>
          <h1 class="iam-audit__title">审计日志</h1>
          <p class="iam-audit__summary">查看统一登录、授权签发、令牌轮换和 IAM 管理操作。</p>
        </div>
      </header>

      <div class="iam-audit__filters">
        <Input v-model:value="filters.action" allow-clear placeholder="操作名称" />
        <Input v-model:value="filters.username" allow-clear placeholder="用户名" />
        <Select v-model:value="filters.outcome" allow-clear :options="outcomeOptions" placeholder="全部结果" />
        <DatePicker v-model:value="filters.startAt" show-time value-format="YYYY-MM-DDTHH:mm:ss" placeholder="开始时间" />
        <DatePicker v-model:value="filters.endAt" show-time value-format="YYYY-MM-DDTHH:mm:ss" placeholder="结束时间" />
        <Button type="primary" @click="reload(true)">查询</Button>
        <Button @click="resetFilters">重置</Button>
      </div>

      <Table :columns="columns" :data-source="events" :loading="loading" :pagination="false" row-key="id">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'createdAt'">{{ formatBeijingDateTime(record.createdAt) }}</template>
          <Tag v-else-if="column.key === 'outcome'" :color="record.outcome === 'success' ? 'green' : 'red'">
            {{ record.outcome === 'success' ? '成功' : '失败' }}
          </Tag>
        </template>
      </Table>

      <footer class="iam-audit__pagination">
        <Pagination
          :current="page"
          :page-size="pageSize"
          :page-size-options="['20', '50', '100']"
          :total="total"
          show-size-changer
          show-quick-jumper
          @change="changePage"
        />
      </footer>
    </section>
  </Page>
</template>

<style scoped>
.iam-audit { min-height: 100%; padding: 24px; background: #f6f8fb; }
.iam-audit__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.iam-audit__title { margin: 0; color: #172033; font-size: 20px; font-weight: 600; }
.iam-audit__summary { margin: 6px 0 0; color: #667085; font-size: 14px; }
.iam-audit__filters { display: grid; grid-template-columns: repeat(5, minmax(140px, 1fr)) auto auto; gap: 12px; margin-bottom: 16px; }
.iam-audit__pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
@media (max-width: 1024px) { .iam-audit__filters { grid-template-columns: repeat(3, minmax(140px, 1fr)); } }
@media (max-width: 640px) { .iam-audit { padding: 16px; }.iam-audit__header { align-items: flex-start; flex-direction: column; }.iam-audit__filters { grid-template-columns: 1fr; }.iam-audit__pagination { justify-content: center; } }
</style>
