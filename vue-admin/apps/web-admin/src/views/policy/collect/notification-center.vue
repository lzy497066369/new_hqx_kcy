<script setup lang="ts">
import type { PolicyCollectNotification } from '#/api';

import { computed, onMounted, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Alert, Button, Card, Empty, message, Select, Tag } from 'antdv-next';

import {
  getPolicyCollectNotificationApi,
  getPolicyCollectNotificationsApi,
  markPolicyCollectNotificationReadApi,
} from '#/api';

const route = useRoute();
const router = useRouter();

const activeNotification = shallowRef<PolicyCollectNotification>();
const errorMessage = shallowRef('');
const loading = shallowRef(false);
const notifications = shallowRef<PolicyCollectNotification[]>([]);
const statusFilter = shallowRef<'all' | 'read' | 'unread'>('all');
const total = shallowRef(0);

const [DetailDrawer, detailDrawerApi] = useVbenDrawer();

const unreadCount = computed(
  () => notifications.value.filter((item) => item.status !== 'read').length,
);

const stats = computed(() => [
  { key: 'total', label: '通知总数', value: total.value },
  { key: 'unread', label: '当前未读', value: unreadCount.value },
  {
    key: 'failed',
    label: '失败提醒',
    value: notifications.value.filter((item) => item.type === 'run_failed').length,
  },
  {
    key: 'review',
    label: '待审提醒',
    value: notifications.value.filter((item) => item.runItemId).length,
  },
]);

onMounted(async () => {
  await load();
  const notificationId = Array.isArray(route.query.id)
    ? route.query.id[0]
    : route.query.id || route.params.id;
  if (notificationId) {
    await openNotification(String(notificationId), false);
  }
});

async function load() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const params: Record<string, string | number> = { page: 1, pageSize: 50 };
    if (statusFilter.value !== 'all') {
      params.status = statusFilter.value;
    }
    const result = await getPolicyCollectNotificationsApi(params);
    notifications.value = result.items;
    total.value = result.total;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : '通知中心加载失败';
  } finally {
    loading.value = false;
  }
}

async function openNotification(id: string, markRead = true) {
  try {
    const detail = await getPolicyCollectNotificationApi(id);
    activeNotification.value = detail;
    detailDrawerApi.open();
    if (markRead && detail.status !== 'read') {
      await markReadOnly(id);
    }
  } catch (error) {
    message.warning(error instanceof Error ? error.message : '通知详情加载失败');
  }
}

async function markReadOnly(id: string) {
  await markPolicyCollectNotificationReadApi(id);
  notifications.value = notifications.value.map((item) =>
    item.id === id
      ? {
          ...item,
          readAt: item.readAt || new Date().toLocaleString('zh-CN'),
          status: 'read',
        }
      : item,
  );
  if (activeNotification.value?.id === id) {
    activeNotification.value = {
      ...activeNotification.value,
      readAt: activeNotification.value.readAt || new Date().toLocaleString('zh-CN'),
      status: 'read',
    };
  }
}

async function markAllRead() {
  const unreadIds = notifications.value
    .filter((item) => item.status !== 'read')
    .map((item) => item.id);
  if (unreadIds.length === 0) {
    return;
  }
  await Promise.all(unreadIds.map((id) => markPolicyCollectNotificationReadApi(id)));
  await load();
  message.success('已标记全部已读');
}

function goAction(item: PolicyCollectNotification) {
  const path = item.runId
    ? { path: '/policy/collect-runs', query: { runId: item.runId } }
    : { path: '/policy/collect-review' };
  router.push(path).catch(() => {});
}

function statusColor(status: string) {
  return status === 'read' ? 'default' : 'blue';
}

function typeColor(type: string) {
  if (type === 'run_failed') return 'red';
  if (type === 'uncertain') return 'orange';
  if (type === 'no_result') return 'default';
  return 'green';
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    changed: '疑似变更',
    new_policy: '新增政策',
    no_result: '无结果',
    run_failed: '执行失败',
    uncertain: '待确认',
  };
  return labels[type] ?? type;
}
</script>

<template>
  <Page auto-content-height>
    <div class="policy-collect-page">
      <div class="policy-collect-header">
        <div>
          <h2 class="policy-collect-title">通知中心</h2>
          <div class="policy-collect-subtitle">
            查看政策采集提醒、失败原因和关联处理入口
          </div>
        </div>
        <div class="policy-collect-actions">
          <Select
            v-model:value="statusFilter"
            class="policy-collect-select"
            :options="[
              { label: '全部', value: 'all' },
              { label: '未读', value: 'unread' },
              { label: '已读', value: 'read' },
            ]"
            @change="load"
          />
          <Button @click="markAllRead">全部已读</Button>
        </div>
      </div>

      <Alert v-if="errorMessage" show-icon type="warning" :message="errorMessage" />

      <DetailDrawer
        :footer="false"
        :title="activeNotification ? `通知详情 #${activeNotification.id}` : '通知详情'"
        class="w-full max-w-160"
      >
        <div v-if="activeNotification" class="grid gap-4">
          <div class="policy-collect-detail-card">
            <div class="flex flex-wrap items-center gap-2">
              <Tag :color="statusColor(activeNotification.status)">
                {{ activeNotification.status === 'read' ? '已读' : '未读' }}
              </Tag>
              <Tag :color="typeColor(activeNotification.type)">
                {{ typeLabel(activeNotification.type) }}
              </Tag>
            </div>
            <h3 class="mt-3 text-lg font-semibold text-slate-950">
              {{ activeNotification.title }}
            </h3>
            <p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {{ activeNotification.content || '暂无详情' }}
            </p>
          </div>

          <div class="policy-collect-info-grid">
            <div>
              <span>创建时间</span>
              <strong>{{ activeNotification.createTime }}</strong>
            </div>
            <div>
              <span>读取时间</span>
              <strong>{{ activeNotification.readAt || '-' }}</strong>
            </div>
            <div>
              <span>执行记录</span>
              <strong>{{ activeNotification.runId || '-' }}</strong>
            </div>
            <div>
              <span>结果明细</span>
              <strong>{{ activeNotification.runItemId || '-' }}</strong>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button type="primary" @click="goAction(activeNotification)">
              <IconifyIcon icon="lucide:external-link" class="size-4" />
              {{ activeNotification.runId ? '查看执行记录' : '查看待审查' }}
            </Button>
            <Button
              v-if="activeNotification.status !== 'read'"
              @click="markReadOnly(activeNotification.id)"
            >
              标记已读
            </Button>
          </div>
        </div>
      </DetailDrawer>

      <div class="policy-collect-stat-grid">
        <div v-for="item in stats" :key="item.key" class="policy-collect-stat">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>

      <div class="policy-collect-list">
        <Empty
          v-if="notifications.length === 0 && !loading"
          description="暂无政策采集通知"
        />
        <Card
          v-for="item in notifications"
          :key="item.id"
          class="policy-collect-card policy-collect-card--clickable"
          variant="borderless"
          @click="openNotification(item.id)"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <Tag :color="statusColor(item.status)">
                  {{ item.status === 'read' ? '已读' : '未读' }}
                </Tag>
                <Tag :color="typeColor(item.type)">{{ typeLabel(item.type) }}</Tag>
              </div>
              <h3 class="policy-collect-card-title mt-2">{{ item.title }}</h3>
              <p class="policy-collect-card-body line-clamp-2">
                {{ item.content || '暂无详情' }}
              </p>
              <div class="policy-collect-card-note">
                {{ item.createTime }}
                <template v-if="item.runId"> · 执行记录 #{{ item.runId }}</template>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button size="small" @click.stop="goAction(item)">
                {{ item.runId ? '查看执行' : '去审查' }}
              </Button>
              <Button
                v-if="item.status !== 'read'"
                size="small"
                @click.stop="markReadOnly(item.id)"
              >
                已读
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </Page>
</template>

<style src="./collect-page.css"></style>
