<script setup lang="ts">
import type { AiApi } from '#/api';

import { computed, onMounted, shallowRef } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Alert, Button, Card, Empty, Skeleton, Statistic, Tag } from 'antdv-next';

import { getAiTaskList } from '#/api';

import { useAiStatsSummary } from '../composables/use-ai-stats-summary';

const router = useRouter();
const aiStats = useAiStatsSummary();
const recentTasks = shallowRef<AiApi.AiTask[]>([]);
const taskLoading = shallowRef(false);
const taskErrorMessage = shallowRef('');

const cards = computed(() => [
  {
    label: 'AI 调用次数',
    value: aiStats.stats.value?.requestCount ?? 0,
  },
  {
    label: '成功率',
    suffix: '%',
    value: aiStats.successRate.value,
  },
  {
    label: '总 Token',
    value: aiStats.stats.value?.totalTokens ?? 0,
  },
  {
    label: '平均耗时',
    suffix: 'ms',
    value: aiStats.stats.value?.avgDurationMs ?? 0,
  },
]);

const maxSceneCount = computed(() =>
  Math.max(...aiStats.topSceneStats.value.map((item) => item.requestCount), 1),
);
const maxDailyRequest = computed(() =>
  Math.max(...aiStats.dailyStats.value.map((item) => item.requestCount), 1),
);
const maxDailyToken = computed(() =>
  Math.max(...aiStats.dailyStats.value.map((item) => item.totalTokens), 1),
);
const maxDailyDuration = computed(() =>
  Math.max(...aiStats.dailyStats.value.map((item) => item.avgDurationMs), 1),
);

onMounted(() => {
  load();
});

async function load() {
  await Promise.all([aiStats.load(), loadRecentTasks()]);
}

async function loadRecentTasks() {
  taskLoading.value = true;
  taskErrorMessage.value = '';
  try {
    const result = await getAiTaskList({ page: 1, pageSize: 8 });
    recentTasks.value = result.items;
  } catch (error) {
    taskErrorMessage.value =
      error instanceof Error ? error.message : 'AI 请求记录加载失败';
  } finally {
    taskLoading.value = false;
  }
}

function navToRecord() {
  router.push('/system/ai-record').catch(() => {});
}

function statusColor(status: string) {
  if (status === 'success') {
    return 'success';
  }
  if (status === 'failed') {
    return 'error';
  }
  if (status === 'running') {
    return 'processing';
  }
  return 'default';
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    failed: '失败',
    pending: '等待中',
    running: '处理中',
    success: '成功',
  };
  return labels[status] ?? status;
}
</script>

<template>
  <Page auto-content-height>
    <div class="ai-analysis p-5">
      <section class="ai-analysis__head">
        <div>
          <div class="text-sm font-medium text-sky-700">AI 分析</div>
          <h1 class="mt-1 text-2xl font-semibold text-slate-950">
            AI 调用统计与趋势
          </h1>
          <p class="mt-1 text-sm text-slate-600">
            汇总 AI 请求次数、成功率、Token 消耗、耗时趋势和最近调用记录。
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button @click="navToRecord">
            <IconifyIcon icon="lucide:list-search" class="size-4" />
            请求记录
          </Button>
        </div>
      </section>

      <Alert
        v-if="aiStats.errorMessage.value || taskErrorMessage"
        class="mt-4"
        show-icon
        type="warning"
        :message="aiStats.errorMessage.value || taskErrorMessage"
      />

      <Skeleton v-if="aiStats.loading.value || taskLoading" class="mt-5" active />

      <template v-else>
        <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card v-for="card in cards" :key="card.label" variant="borderless">
            <Statistic
              :suffix="card.suffix"
              :title="card.label"
              :value="card.value"
            />
          </Card>
        </div>

        <div class="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Card title="调用趋势" variant="borderless">
            <Empty v-if="aiStats.dailyStats.value.length === 0" description="暂无趋势数据" />
            <div v-else class="ai-analysis__daily-chart">
              <div
                v-for="item in aiStats.dailyStats.value"
                :key="item.label"
                class="ai-analysis__daily-column"
              >
                <div class="ai-analysis__daily-track">
                  <div
                    class="ai-analysis__daily-success"
                    :style="{ height: `${Math.max((item.successCount / maxDailyRequest) * 100, item.successCount ? 5 : 0)}%` }"
                  ></div>
                  <div
                    class="ai-analysis__daily-failed"
                    :style="{ height: `${Math.max((item.failedCount / maxDailyRequest) * 100, item.failedCount ? 5 : 0)}%` }"
                  ></div>
                </div>
                <div class="mt-2 text-center text-[11px] text-slate-500">
                  {{ item.label.slice(5) }}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Token 与耗时趋势" variant="borderless">
            <Empty v-if="aiStats.dailyStats.value.length === 0" description="暂无趋势数据" />
            <div v-else class="space-y-3">
              <div
                v-for="item in aiStats.dailyStats.value"
                :key="item.label"
                class="ai-analysis__trend-row"
              >
                <span class="w-16 text-xs text-slate-500">{{ item.label.slice(5) }}</span>
                <div class="grid flex-1 gap-1">
                  <div class="h-2 rounded-full bg-slate-100">
                    <div
                      class="h-2 rounded-full bg-sky-500"
                      :style="{ width: `${Math.max((item.totalTokens / maxDailyToken) * 100, item.totalTokens ? 6 : 0)}%` }"
                    ></div>
                  </div>
                  <div class="h-2 rounded-full bg-slate-100">
                    <div
                      class="h-2 rounded-full bg-amber-500"
                      :style="{ width: `${Math.max((item.avgDurationMs / maxDailyDuration) * 100, item.avgDurationMs ? 6 : 0)}%` }"
                    ></div>
                  </div>
                </div>
                <span class="w-24 text-right text-xs text-slate-500">
                  {{ item.totalTokens }} / {{ item.avgDurationMs }}ms
                </span>
              </div>
            </div>
          </Card>
        </div>

        <div class="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Card title="场景调用分布" variant="borderless">
            <Empty
              v-if="aiStats.topSceneStats.value.length === 0"
              description="暂无 AI 调用数据"
            />
            <div v-else class="space-y-4">
              <div
                v-for="item in aiStats.topSceneStats.value"
                :key="item.scene"
                class="ai-analysis__scene"
              >
                <div class="flex items-center justify-between gap-3 text-sm">
                  <span class="truncate font-medium">{{ item.scene }}</span>
                  <Tag color="blue">{{ item.requestCount }} 次</Tag>
                </div>
                <div class="mt-2 h-2 rounded-full bg-slate-100">
                  <div
                    class="h-2 rounded-full bg-sky-500"
                    :style="{ width: `${Math.round((item.requestCount / maxSceneCount) * 100)}%` }"
                  ></div>
                </div>
                <div class="mt-2 text-xs text-slate-500">
                  成功 {{ item.successCount }} / 失败 {{ item.failedCount }} /
                  Token {{ item.totalTokens }}
                </div>
              </div>
            </div>
          </Card>

          <Card title="最近 AI 请求" variant="borderless">
            <Empty v-if="recentTasks.length === 0" description="暂无请求记录" />
            <div v-else class="space-y-3">
              <button
                v-for="task in recentTasks"
                :key="task.id"
                class="ai-analysis__task"
                type="button"
                @click="navToRecord"
              >
                <div class="min-w-0 flex-1 text-left">
                  <div class="truncate font-medium text-slate-900">
                    {{ task.scene }} · {{ task.bizType }}/{{ task.bizId }}
                  </div>
                  <div class="mt-1 truncate text-xs text-slate-500">
                    {{ task.createTime }} · {{ task.result?.summary || task.errorMessage || '暂无摘要' }}
                  </div>
                </div>
                <Tag :color="statusColor(task.status)">
                  {{ statusLabel(task.status) }}
                </Tag>
              </button>
            </div>
          </Card>
        </div>
      </template>
    </div>
  </Page>
</template>

<style scoped>
.ai-analysis {
  min-height: 100%;
  background: linear-gradient(180deg, rgb(248 250 252) 0%, rgb(241 245 249) 100%);
}

.ai-analysis__head,
.ai-analysis__task {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: #fff;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
}

.ai-analysis__daily-chart {
  display: grid;
  grid-template-columns: repeat(14, minmax(18px, 1fr));
  gap: 8px;
  min-height: 220px;
}

.ai-analysis__daily-track {
  display: flex;
  flex-direction: column-reverse;
  height: 176px;
  overflow: hidden;
  background: rgb(241 245 249);
  border-radius: 8px;
}

.ai-analysis__daily-success {
  background: #0ea5e9;
}

.ai-analysis__daily-failed {
  background: #f97316;
}

.ai-analysis__trend-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.ai-analysis__scene {
  padding: 12px;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
}

.ai-analysis__task {
  width: 100%;
  padding: 14px;
}

.ai-analysis__task:hover {
  border-color: rgb(14 165 233 / 45%);
  box-shadow: 0 10px 26px rgb(15 23 42 / 8%);
}

@media (max-width: 640px) {
  .ai-analysis__head,
  .ai-analysis__task {
    align-items: stretch;
    flex-direction: column;
  }

  .ai-analysis__daily-chart {
    grid-template-columns: repeat(7, minmax(18px, 1fr));
  }
}
</style>
