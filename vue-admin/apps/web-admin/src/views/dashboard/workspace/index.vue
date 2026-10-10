<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { preferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';

import { Alert, Button, Card, Empty, Progress, Skeleton, Tag } from 'antdv-next';

import { useAdminDashboardData } from '../composables/use-admin-dashboard-data';
import {
  markPolicyCollectNotificationReadApi,
  runPolicyCollectJobApi,
} from '#/api';

const router = useRouter();
const userStore = useUserStore();
const dashboard = useAdminDashboardData();

const workbench = computed(() => dashboard.workbench.value);
const policyCollectSummary = computed(() => workbench.value?.policyCollectSummary);
const syncSummary = computed(() => workbench.value?.syncSummary);
const todayLabel = computed(() =>
  new Date().toLocaleDateString('zh-CN', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }),
);

const priorityColor: Record<string, string> = {
  high: 'error',
  low: 'default',
  medium: 'warning',
};

onMounted(() => {
  loadWorkbench();
});

function navTo(path: string) {
  router.push(path).catch(() => {});
}

async function readCollectNotification(id: string) {
  await markPolicyCollectNotificationReadApi(id);
  await loadWorkbench();
}

async function retrySyncJob(jobId?: string) {
  if (!jobId) {
    return;
  }
  const run = await runPolicyCollectJobApi(jobId);
  await loadWorkbench();
  router
    .push({ path: '/policy/collect-runs', query: { runId: run.id } })
    .catch(() => {});
}

function notificationColor(level: 'high' | 'medium' | 'low') {
  if (level === 'high') return 'red';
  if (level === 'medium') return 'orange';
  return 'blue';
}

function syncStatusColor(status: string) {
  if (status === 'failed') return 'red';
  if (status === 'running') return 'processing';
  return 'green';
}

async function loadWorkbench() {
  await dashboard.loadWorkbench();
}
</script>

<template>
  <Page auto-content-height>
    <div class="admin-workspace p-5">
      <Alert
        v-if="dashboard.errorMessage.value"
        class="mb-4"
        show-icon
        type="warning"
        :message="dashboard.errorMessage.value"
      />

      <Skeleton v-if="dashboard.loading.value" active />

      <template v-else-if="workbench">
        <section class="admin-workspace__hero">
          <div class="flex min-w-0 flex-1 items-center gap-4">
            <img
              class="size-14 rounded-full border border-white/70 bg-white"
              :src="userStore.userInfo?.avatar || preferences.app.defaultAvatar"
              alt=""
            />
            <div class="min-w-0">
              <div class="text-sm font-medium text-sky-700">{{ todayLabel }}</div>
              <h1 class="mt-1 truncate text-2xl font-semibold text-slate-950">
                早安，{{ userStore.userInfo?.realName || '管理员' }}
              </h1>
              <p class="mt-1 text-sm text-slate-600">
                聚焦企业资料、申报推进、材料异常和政策维护。
              </p>
            </div>
          </div>
        </section>

        <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card v-for="card in workbench.overview" :key="card.key" variant="borderless">
            <div class="text-sm text-slate-500">{{ card.label }}</div>
            <div class="mt-2 text-3xl font-semibold text-slate-950">
              {{ card.value }}
            </div>
            <div class="mt-1 line-clamp-2 text-xs text-slate-500">
              {{ card.hint }}
            </div>
          </Card>
        </div>

        <div class="mt-5 grid gap-5 xl:grid-cols-[0.85fr_0.575fr_0.575fr]">
          <Card title="快捷入口" variant="borderless">
            <div class="grid gap-3 sm:grid-cols-2">
              <button
                v-for="entry in workbench.quickEntries"
                :key="entry.path"
                class="admin-workspace__entry"
                type="button"
                @click="navTo(entry.path)"
              >
                <IconifyIcon :icon="entry.icon" class="size-5 text-sky-700" />
                <span>{{ entry.label }}</span>
              </button>
            </div>
          </Card>

          <Card title="通知中心" variant="borderless">
            <div v-if="workbench.notificationSummary.items.length" class="grid gap-3">
              <button
                v-for="notice in workbench.notificationSummary.items"
                :key="notice.id"
                class="admin-workspace__notice"
                type="button"
                @click="router.push({ path: '/policy/collect-notifications', query: { id: notice.id } }).catch(() => {})"
              >
                <div class="min-w-0 text-left">
                  <div class="flex flex-wrap items-center gap-2">
                    <Tag :color="notificationColor(notice.level)">
                      {{ notice.status === 'unread' ? '未读' : '已读' }}
                    </Tag>
                    <span class="font-medium text-slate-900">{{ notice.title }}</span>
                  </div>
                  <p class="mt-1 line-clamp-2 text-sm text-slate-500">
                    {{ notice.content || '暂无详情' }}
                  </p>
                  <div class="mt-2 text-xs text-slate-400">{{ notice.time }}</div>
                </div>
                <Button
                  v-if="notice.status === 'unread'"
                  size="small"
                  @click.stop="readCollectNotification(notice.id)"
                >
                  标记已读
                </Button>
              </button>
            </div>
            <div v-else class="admin-workspace__notice">
              <div>
                <div class="text-base font-medium text-slate-900">暂无政策采集通知</div>
                <p class="mt-1 text-sm text-slate-500">
                  {{ workbench.notificationSummary.description }}
                </p>
              </div>
              <Tag color="blue">
                {{ workbench.notificationSummary.unread }} 条未读
              </Tag>
            </div>
          </Card>

          <Card title="同步中心" variant="borderless">
            <div v-if="syncSummary?.items.length" class="grid gap-3">
              <button
                v-for="item in syncSummary.items"
                :key="item.id"
                class="admin-workspace__notice"
                type="button"
                @click="navTo(item.actionPath)"
              >
                <div class="min-w-0 text-left">
                  <div class="flex flex-wrap items-center gap-2">
                    <Tag :color="syncStatusColor(item.status)">
                      {{ item.status === 'failed' ? '失败' : item.status === 'running' ? '进行中' : '已完成' }}
                    </Tag>
                    <span class="font-medium text-slate-900">{{ item.title }}</span>
                  </div>
                  <p class="mt-1 line-clamp-2 text-sm text-slate-500">
                    {{ item.description }}
                  </p>
                  <div class="mt-2 text-xs text-slate-400">
                    {{ item.currentStep || '等待处理' }} · {{ item.time }}
                  </div>
                </div>
                <Button
                  v-if="item.status === 'failed' && item.jobId"
                  size="small"
                  type="primary"
                  @click.stop="retrySyncJob(item.jobId)"
                >
                  重试
                </Button>
              </button>
            </div>
            <div v-else class="admin-workspace__notice">
              <div>
                <div class="text-base font-medium text-slate-900">暂无进行中的同步任务</div>
                <p class="mt-1 text-sm text-slate-500">
                  {{ syncSummary?.description || '当前没有需要关注的政策采集执行任务。' }}
                </p>
              </div>
              <Tag color="default">0 个运行中</Tag>
            </div>
          </Card>
        </div>

        <Card
          v-if="policyCollectSummary && policyCollectSummary.pendingReviewCount > 0"
          class="mt-5"
          title="政策采集提醒"
          variant="borderless"
        >
          <div class="admin-workspace__policy-alert">
            <div>
              <div class="text-base font-semibold text-slate-950">
                有 {{ policyCollectSummary.pendingReviewCount }} 条政策待审查
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <Tag color="blue">新增 {{ policyCollectSummary.newPolicyCount }}</Tag>
                <Tag color="orange">疑似变更 {{ policyCollectSummary.changedPolicyCount }}</Tag>
                <Tag color="purple">待确认 {{ policyCollectSummary.uncertainCount }}</Tag>
                <Tag v-if="policyCollectSummary.lastRun" color="default">
                  最近执行 {{ policyCollectSummary.lastRun.status }}
                </Tag>
              </div>
            </div>
            <Button type="primary" @click="navTo('/policy/collect-review')">
              <IconifyIcon icon="lucide:clipboard-check" class="size-4" />
              去审核
            </Button>
          </div>
        </Card>

        <div class="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Card title="工作进度" variant="borderless">
            <div class="space-y-5">
              <div v-for="item in workbench.workProgress" :key="item.key">
                <div class="mb-2 flex items-center justify-between text-sm">
                  <span class="text-slate-700">{{ item.label }}</span>
                  <span class="font-medium text-slate-950">{{ item.value }}</span>
                </div>
                <Progress :percent="item.percent" />
              </div>
            </div>
          </Card>

          <Card title="待处理事项" variant="borderless">
            <Empty v-if="workbench.todoItems.length === 0" description="暂无待办事项" />
            <div v-else class="space-y-3">
              <button
                v-for="todo in workbench.todoItems"
                :key="todo.key"
                class="admin-workspace__todo"
                type="button"
                @click="navTo(todo.routePath)"
              >
                <div class="min-w-0 flex-1 text-left">
                  <div class="flex flex-wrap items-center gap-2">
                    <Tag :color="priorityColor[todo.priority]">{{ todo.source }}</Tag>
                    <span class="font-medium text-slate-900">{{ todo.title }}</span>
                  </div>
                  <div class="mt-1 line-clamp-2 text-sm text-slate-500">
                    {{ todo.description }}
                  </div>
                </div>
                <span class="text-sm font-medium text-sky-700">
                  {{ todo.actionText }}
                </span>
              </button>
            </div>
          </Card>
        </div>
      </template>
    </div>
  </Page>
</template>

<style scoped>
.admin-workspace {
  min-height: 100%;
  background: linear-gradient(180deg, rgb(248 250 252) 0%, rgb(241 245 249) 100%);
}

.admin-workspace__hero {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: #fff;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
}

.admin-workspace__entry,
.admin-workspace__todo,
.admin-workspace__notice,
.admin-workspace__policy-alert {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px;
  background: #fff;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
}

.admin-workspace__entry {
  justify-content: flex-start;
  min-height: 56px;
  font-weight: 500;
}

.admin-workspace__entry:hover,
.admin-workspace__todo:hover {
  border-color: rgb(14 165 233 / 45%);
  box-shadow: 0 10px 26px rgb(15 23 42 / 8%);
}

@media (max-width: 640px) {
  .admin-workspace__hero,
  .admin-workspace__todo,
  .admin-workspace__notice,
  .admin-workspace__policy-alert {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
