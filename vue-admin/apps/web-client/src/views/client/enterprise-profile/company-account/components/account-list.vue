<script setup lang="ts">
import type { ClientEnterpriseAccountApi } from '#/api/client/enterprise-account';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Empty,
  InputSearch,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antdv-next';

import {
  enterpriseAccountStatusOptions,
  enterpriseAccountTypeOptions,
  formatAccountUrl,
  getEnterpriseAccountStatusColor,
  getEnterpriseAccountStatusLabel,
  getEnterpriseAccountTypeLabel,
  normalizeNullableText,
} from '../shared';

const props = defineProps<{
  accounts: ClientEnterpriseAccountApi.ClientEnterpriseAccount[];
  keyword: string;
  loading: boolean;
  selectedStatus?: number;
  selectedType?: number;
}>();

const emit = defineEmits<{
  create: [];
  delete: [account: ClientEnterpriseAccountApi.ClientEnterpriseAccount];
  detail: [account: ClientEnterpriseAccountApi.ClientEnterpriseAccount];
  edit: [account: ClientEnterpriseAccountApi.ClientEnterpriseAccount];
  'update:keyword': [value: string];
  'update:selectedStatus': [value?: number];
  'update:selectedType': [value?: number];
}>();

const columns = computed(() => [
  {
    dataIndex: 'pt_name',
    key: 'pt_name',
    title: '平台名称',
    width: 220,
  },
  {
    dataIndex: 'zh_type',
    key: 'zh_type',
    title: '账号类型',
    width: 220,
  },
  {
    dataIndex: 'zh_number',
    key: 'zh_number',
    title: '账号',
    width: 180,
  },
  {
    dataIndex: 'charge',
    key: 'charge',
    title: '负责人',
    width: 120,
  },
  {
    dataIndex: 'b_phone',
    key: 'b_phone',
    title: '联系电话',
    width: 160,
  },
  {
    dataIndex: 'b_email',
    key: 'b_email',
    title: '联系邮箱',
    width: 220,
  },
  {
    dataIndex: 'pt_url',
    key: 'pt_url',
    title: '平台网址',
    width: 220,
  },
  {
    dataIndex: 'zh_status',
    key: 'zh_status',
    title: '状态',
    width: 100,
  },
  {
    dataIndex: 'remark',
    ellipsis: true,
    key: 'remark',
    title: '备注',
    width: 240,
  },
  {
    fixed: 'right' as const,
    key: 'action',
    title: '操作',
    width: 220,
  },
]);

function updateKeyword(value?: string) {
  emit('update:keyword', value ?? '');
}

function updateSelectedType(value: unknown) {
  emit(
    'update:selectedType',
    value === undefined || value === null ? undefined : Number(value),
  );
}

function updateSelectedStatus(value: unknown) {
  emit(
    'update:selectedStatus',
    value === undefined || value === null ? undefined : Number(value),
  );
}
</script>

<template>
  <div class="space-y-4">
    <div
      class="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between"
    >
      <div class="flex flex-1 flex-col gap-3 md:flex-row">
        <InputSearch
          :value="props.keyword"
          allow-clear
          placeholder="搜索平台名称、账号、负责人、邮箱"
          @search="updateKeyword"
          @update:value="updateKeyword"
        />
        <Select
          :options="enterpriseAccountTypeOptions"
          :value="props.selectedType"
          allow-clear
          placeholder="筛选账号类型"
          style="min-width: 240px"
          @update:value="updateSelectedType"
        />
        <Select
          :options="enterpriseAccountStatusOptions"
          :value="props.selectedStatus"
          allow-clear
          placeholder="筛选状态"
          style="min-width: 160px"
          @update:value="updateSelectedStatus"
        />
      </div>

      <Space>
        <Button type="primary" @click="emit('create')">
          <IconifyIcon icon="lucide:plus" class="size-4" />
          新增账号
        </Button>
      </Space>
    </div>

    <Table
      :columns="columns"
      :data-source="props.accounts"
      :loading="props.loading"
      :pagination="{
        pageSize: 10,
        showSizeChanger: true,
        showTotal: (total: number) => `共 ${total} 条`,
      }"
      :row-key="(record: ClientEnterpriseAccountApi.ClientEnterpriseAccount) => record.id"
      :scroll="{ x: 1680 }"
    >
      <template #emptyText>
        <Empty description="暂无企业账号数据" />
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'zh_type'">
          <Tag color="processing">
            {{ getEnterpriseAccountTypeLabel(record.zh_type) }}
          </Tag>
        </template>

        <template v-else-if="column.key === 'pt_url'">
          <a
            v-if="record.pt_url"
            :href="record.pt_url"
            rel="noreferrer"
            target="_blank"
          >
            {{ formatAccountUrl(record.pt_url) }}
          </a>
          <span v-else>{{ normalizeNullableText(record.pt_url) }}</span>
        </template>

        <template v-else-if="column.key === 'zh_status'">
          <Tag :color="getEnterpriseAccountStatusColor(record.zh_status)">
            {{ getEnterpriseAccountStatusLabel(record.zh_status) }}
          </Tag>
        </template>

        <template v-else-if="column.key === 'remark'">
          <Tooltip :title="record.remark || '暂无备注'">
            <span>{{ normalizeNullableText(record.remark) }}</span>
          </Tooltip>
        </template>

        <template v-else-if="column.key === 'action'">
          <Space>
            <Button size="small" @click="emit('detail', record)">
              查看详情
            </Button>
            <Button size="small" @click="emit('edit', record)">
              编辑
            </Button>
            <Button danger size="small" @click="emit('delete', record)">
              删除
            </Button>
          </Space>
        </template>

        <template v-else>
          <span>{{ normalizeNullableText(record[column.dataIndex as string] as string) }}</span>
        </template>
      </template>
    </Table>
  </div>
</template>
