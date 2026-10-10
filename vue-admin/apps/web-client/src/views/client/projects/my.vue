<script setup lang="ts">
import ClientJourneyTrail from '#/views/client/components/ClientJourneyTrail.vue';

import { onMounted, shallowRef } from 'vue';
import { useRouter } from 'vue-router';

import {
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
} from 'antdv-next';

import {
  getClientDeclarationsApi,
  getClientDeclarationStatsApi,
} from '#/api/client';
import type { ClientDeclarationApi } from '#/api/client';
import { useClientEnterpriseStore } from '#/store';

const store = useClientEnterpriseStore();
const router = useRouter();

const keyword = shallowRef('');
const selectedStatus = shallowRef<
  ClientDeclarationApi.DeclarationStatus | undefined
>();
const loading = shallowRef(false);
const declarations = shallowRef<ClientDeclarationApi.DeclarationItem[]>([]);
const stats = shallowRef<ClientDeclarationApi.DeclarationStats>({
  all: 0,
  approved: 0,
  draft: 0,
  preparing: 0,
  rejected: 0,
  reviewing: 0,
});

const columns = [
  { dataIndex: 'projectName', key: 'projectName', title: '项目名称' },
  { dataIndex: 'declarationNo', key: 'declarationNo', title: '申报编号' },
  { dataIndex: 'currentNodeName', key: 'currentNodeName', title: '当前节点' },
  { dataIndex: 'progress', key: 'progress', title: '进度' },
  {
    dataIndex: 'missingMaterialCount',
    key: 'missingMaterialCount',
    title: '待补材料',
  },
  { dataIndex: 'deadline', key: 'deadline', title: '截止时间' },
  { dataIndex: 'status', key: 'status', title: '状态' },
  { dataIndex: 'updateTime', key: 'updateTime', title: '更新时间' },
  { key: 'action', title: '操作', width: 120 },
];

const statusOptions = [
  { label: '全部状态', value: undefined },
  { label: '草稿', value: 'draft' },
  { label: '准备中', value: 'preparing' },
  { label: '已提交', value: 'submitted' },
  { label: '审核中', value: 'reviewing' },
  { label: '已退回', value: 'rejected' },
  { label: '已通过', value: 'approved' },
  { label: '已完成', value: 'completed' },
];

function getStatusColor(status: ClientDeclarationApi.DeclarationStatus) {
  const colorMap: Record<ClientDeclarationApi.DeclarationStatus, string> = {
    approved: 'green',
    cancelled: 'default',
    completed: 'green',
    draft: 'default',
    preparing: 'blue',
    rejected: 'red',
    reviewing: 'orange',
    submitted: 'purple',
  };

  return colorMap[status] ?? 'default';
}

function getStatusLabel(status: ClientDeclarationApi.DeclarationStatus) {
  const labelMap: Record<ClientDeclarationApi.DeclarationStatus, string> = {
    approved: '已通过',
    cancelled: '已取消',
    completed: '已完成',
    draft: '草稿',
    preparing: '准备中',
    rejected: '已退回',
    reviewing: '审核中',
    submitted: '已提交',
  };

  return labelMap[status] ?? status;
}

function getDeadlineMeta(
  deadline: null | string,
  status: ClientDeclarationApi.DeclarationStatus,
) {
  if (!deadline || ['approved', 'cancelled', 'completed'].includes(status)) {
    return { color: 'default', label: '' };
  }

  const deadlineTime = Date.parse(`${deadline}T23:59:59`);
  if (Number.isNaN(deadlineTime)) {
    return { color: 'default', label: '' };
  }

  const remainingDays = Math.ceil(
    (deadlineTime - Date.now()) / (24 * 60 * 60 * 1000),
  );
  if (remainingDays < 0) {
    return { color: 'red', label: '已截止' };
  }
  if (remainingDays === 0) {
    return { color: 'red', label: '今天截止' };
  }
  if (remainingDays <= 7) {
    return { color: 'orange', label: `剩余 ${remainingDays} 天` };
  }

  return { color: 'default', label: '' };
}

async function loadDeclarations() {
  loading.value = true;
  try {
    const [listResult, statsResult] = await Promise.all([
      getClientDeclarationsApi({
        keyword: keyword.value || undefined,
        status: selectedStatus.value,
      }),
      getClientDeclarationStatsApi(),
    ]);
    declarations.value = listResult.items;
    stats.value = statsResult;
  } finally {
    loading.value = false;
  }
}

function openDeclarationDetail(record: ClientDeclarationApi.DeclarationItem) {
  router.push(`/projects/my/detail/${record.id}`);
}

onMounted(loadDeclarations);
</script>

<template>
  <div class="client-declaration-list">
    <ClientJourneyTrail />
    <Card :bordered="false">
      <div class="client-declaration-list__summary">
        <div>
          <p class="client-declaration-list__eyebrow">
            {{ store.currentCompanyName || '当前企业' }}
          </p>
          <h1 class="client-declaration-list__title">我的申报</h1>
          <p class="client-declaration-list__description">
            查看当前企业已创建的申报记录，继续完善材料并跟踪申报进度。
          </p>
        </div>
        <Statistic title="全部申报" :value="stats.all" />
        <Statistic title="准备中" :value="stats.preparing" />
        <Statistic title="审核中" :value="stats.reviewing" />
      </div>
    </Card>

    <Card :bordered="false" title="申报列表">
      <div class="client-declaration-list__toolbar">
        <Input.Search
          v-model:value="keyword"
          allow-clear
          placeholder="搜索项目名称或申报编号"
          @search="loadDeclarations"
        />
        <Select
          v-model:value="selectedStatus"
          :options="statusOptions"
          allow-clear
          placeholder="筛选申报状态"
          @change="loadDeclarations"
        />
      </div>

      <Table
        :columns="columns"
        :data-source="declarations"
        :loading="loading"
        :pagination="false"
        row-key="id"
        :scroll="{ x: 1180 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <Tag :color="getStatusColor(record.status)">
              {{ getStatusLabel(record.status) }}
            </Tag>
          </template>
          <template v-if="column.key === 'progress'">
            {{ record.progress }}%
          </template>
          <template v-if="column.key === 'missingMaterialCount'">
            <Tag v-if="record.missingMaterialCount > 0" color="red">
              {{ record.missingMaterialCount }} 项待补
            </Tag>
            <span v-else>已齐</span>
          </template>
          <template v-if="column.key === 'currentNodeName'">
            {{ record.currentNodeName || '-' }}
          </template>
          <template v-if="column.key === 'deadline'">
            <template v-if="record.deadline">
              <Tag
                :color="getDeadlineMeta(record.deadline, record.status).color"
              >
                {{ record.deadline }}
              </Tag>
              <span
                v-if="getDeadlineMeta(record.deadline, record.status).label"
                class="client-declaration-list__deadline-hint"
              >
                {{ getDeadlineMeta(record.deadline, record.status).label }}
              </span>
            </template>
            <span v-else>-</span>
          </template>
          <template v-if="column.key === 'action'">
            <Button
              size="small"
              type="link"
              @click="openDeclarationDetail(record)"
            >
              详情
            </Button>
          </template>
        </template>
        <template #emptyText>
          <Empty description="暂无申报记录">
            <template #description>
              <Space direction="vertical">
                <span>暂无申报记录</span>
                <span>请先在项目列表中选择项目并创建申报草稿。</span>
              </Space>
            </template>
          </Empty>
        </template>
      </Table>
    </Card>
  </div>
</template>

<style scoped>
.client-declaration-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.client-declaration-list__summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) repeat(3, 120px);
  gap: 16px;
  align-items: center;
}

.client-declaration-list__eyebrow,
.client-declaration-list__description {
  margin: 0;
  color: rgb(0 0 0 / 45%);
}

.client-declaration-list__title {
  margin: 6px 0;
  font-size: 24px;
  font-weight: 600;
}

.client-declaration-list__toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.client-declaration-list__deadline-hint {
  margin-left: 4px;
  color: rgb(0 0 0 / 45%);
  font-size: 12px;
}

@media (max-width: 900px) {
  .client-declaration-list__summary {
    grid-template-columns: 1fr;
  }

  .client-declaration-list__toolbar {
    flex-direction: column;
  }
}
</style>
