<script setup lang="ts">
import type {
  PolicyCollectRun,
  PolicyCollectRunItem,
  PolicyCollectSearchSnapshot,
} from '#/api';

import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Alert, Button, Card, Empty, message, Progress, Select, Tag } from 'antdv-next';

import {
  createPolicyCollectRunProgressStream,
  getPolicyCollectRunItemsApi,
  getPolicyCollectRunsApi,
  runPolicyCollectJobApi,
} from '#/api';

const errorMessage = shallowRef('');
const runs = shallowRef<PolicyCollectRun[]>([]);
const activeItems = shallowRef<PolicyCollectRunItem[]>([]);
const activeRun = shallowRef<PolicyCollectRun>();
const loading = shallowRef(false);
const route = useRoute();
const router = useRouter();
const statusFilter = shallowRef<'all' | 'failed' | 'running' | 'success'>('all');
let refreshTimer: null | ReturnType<typeof setInterval> = null;
const progressSources = new Map<string, EventSource>();

const [DetailDrawer, detailDrawerApi] = useVbenDrawer();

const runStats = computed(() => {
  return {
    failedCount: runs.value.filter((run) => run.status === 'failed').length,
    pendingReviewCount: runs.value.reduce(
      (total, run) => total + run.newCount + run.changedCount + run.uncertainCount,
      0,
    ),
    successCount: runs.value.filter((run) => run.status === 'success').length,
    totalCount: runs.value.length,
  };
});

const visibleRuns = computed(() => {
  if (statusFilter.value === 'all') {
    return runs.value;
  }
  return runs.value.filter((run) => run.status === statusFilter.value);
});

onMounted(() => {
  load();
  refreshTimer = setInterval(() => {
    if (runs.value.some((run) => run.status === 'running')) {
      void load({ silent: true });
    }
  }, 10_000);
});

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  closeProgressStreams();
});

async function load(options: { silent?: boolean } = {}) {
  if (!options.silent) {
    loading.value = true;
  }
  errorMessage.value = '';
  try {
    const result = await getPolicyCollectRunsApi({ page: 1, pageSize: 30 });
    runs.value = result.items;
    syncProgressStreams();
    const routeRunId = Array.isArray(route.query.runId)
      ? route.query.runId[0]
      : route.query.runId;
    const selectedRun =
      runs.value.find((run) => run.id === (routeRunId ?? activeRun.value?.id)) ??
      runs.value[0];
    if (selectedRun) {
      await showItems(selectedRun, Boolean(routeRunId), !options.silent);
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '执行记录加载失败';
  } finally {
    if (!options.silent) {
      loading.value = false;
    }
  }
}

async function retryRun(run: PolicyCollectRun) {
  if (run.status === 'running') {
    return;
  }
  const nextRun = await runPolicyCollectJobApi(run.jobId);
  message.success('已重新发起同步任务');
  await load({ silent: true });
  await router
    .push({ path: '/policy/collect-runs', query: { runId: nextRun.id } })
    .catch(() => {});
}

function syncProgressStreams() {
  const runningIds = new Set(
    runs.value.filter((run) => run.status === 'running').map((run) => run.id),
  );
  for (const runId of runningIds) {
    if (!progressSources.has(runId)) {
      openProgressStream(runId);
    }
  }
  for (const [runId, source] of progressSources) {
    if (!runningIds.has(runId)) {
      source.close();
      progressSources.delete(runId);
    }
  }
}

function openProgressStream(runId: string) {
  const source = createPolicyCollectRunProgressStream(runId);
  const handleMessage = (event: MessageEvent<string>) => {
    updateRunSnapshot(JSON.parse(event.data) as PolicyCollectRun);
  };

  source.addEventListener('progress', handleMessage);
  source.addEventListener('done', (event) => {
    handleMessage(event as MessageEvent<string>);
    source.close();
    progressSources.delete(runId);
    void load({ silent: true });
  });
  source.addEventListener('error', () => {
    source.close();
    progressSources.delete(runId);
  });
  progressSources.set(runId, source);
}

function updateRunSnapshot(nextRun: PolicyCollectRun) {
  runs.value = runs.value.map((run) => (run.id === nextRun.id ? nextRun : run));
  if (activeRun.value?.id === nextRun.id) {
    activeRun.value = nextRun;
  }
}

function getSearchDiagnostics(run?: PolicyCollectRun) {
  const raw = run?.searchedKeywords;
  const snapshot: PolicyCollectSearchSnapshot = Array.isArray(raw)
    ? { keywords: raw }
    : raw && typeof raw === 'object'
      ? raw
      : {};
  const publishDateRange =
    snapshot.publishDateStart && snapshot.publishDateEnd
      ? `${snapshot.publishDateStart} 至 ${snapshot.publishDateEnd}`
      : '未记录';

  return {
    keywords: normalizeStringList(snapshot.keywords),
    publishDateRange,
    queries: normalizeStringList(snapshot.queries),
    rawResultCount: normalizeCount(snapshot.rawResultCount),
    resultCount: normalizeCount(snapshot.resultCount),
    searchTaskId: snapshot.searchTaskId || '',
    systemDate: snapshot.systemDate || '',
    warnings: normalizeStringList(snapshot.warnings),
  };
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function normalizeCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function searchCountLabel(run: PolicyCollectRun) {
  const diagnostics = getSearchDiagnostics(run);
  if (diagnostics.rawResultCount === null && diagnostics.resultCount === null) {
    return '搜索未完成';
  }
  return `召回 ${diagnostics.rawResultCount ?? '-'} / 保留 ${
    diagnostics.resultCount ?? '-'
  }`;
}

function closeProgressStreams() {
  for (const source of progressSources.values()) {
    source.close();
  }
  progressSources.clear();
}

async function showItems(
  run: PolicyCollectRun,
  openDrawer = true,
  notify = true,
) {
  activeRun.value = run;

  if (run.status === 'running') {
    activeItems.value = [];
    if (notify) {
      message.info('采集任务正在执行，请稍后查看结果');
    }
    if (openDrawer) {
      detailDrawerApi.open();
    }
    return;
  }

  activeItems.value = await getPolicyCollectRunItemsApi(run.id);

  if (run.status !== 'running') {
    if (notify && activeItems.value.length === 0) {
      message.info('本次采集结果为空');
      return;
    }
  }

  if (openDrawer) {
    detailDrawerApi.open();
  }
}

function stepLabel(step?: null | string) {
  const labels: Record<string, string> = {
    ai_parse: 'AI 解析',
    comparing: '结果比对',
    completed: '已完成',
    failed: '执行失败',
    official_search: '官方搜索',
    queued: '排队中',
    saving: '保存结果',
    search_health_check: '联网自检',
  };
  return step ? (labels[step] ?? step) : '未开始';
}

function statusColor(status: string) {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'running') return 'processing';
  return 'default';
}

function openAiRecord(taskId?: null | string) {
  if (!taskId) {
    return;
  }
  router
    .push({ path: '/system/ai-record', query: { taskId } })
    .catch(() => {});
}

function openReview() {
  router.push('/policy/collect-review').catch(() => {});
}
</script>

<template>
  <Page auto-content-height>
    <div class="policy-collect-page">
      <div class="policy-collect-header">
        <div>
          <h2 class="policy-collect-title">同步中心</h2>
          <div class="policy-collect-subtitle">
            查看政策采集任务状态、失败原因和重试入口
          </div>
        </div>
        <div class="policy-collect-actions">
          <Select
            v-model:value="statusFilter"
            class="policy-collect-select"
            :options="[
              { label: '全部状态', value: 'all' },
              { label: '进行中', value: 'running' },
              { label: '失败', value: 'failed' },
              { label: '已完成', value: 'success' },
            ]"
          />
          <Button @click="openReview">
            <IconifyIcon icon="lucide:clipboard-check" class="size-4" />
            待审查
          </Button>
        </div>
      </div>

      <Alert v-if="errorMessage" show-icon type="warning" :message="errorMessage" />

      <DetailDrawer
        :footer="false"
        :title="activeRun ? `执行结果明细 #${activeRun.id}` : '执行结果明细'"
        class="w-full max-w-180"
      >
        <div v-if="!activeRun" class="text-sm text-slate-500">
          点击执行记录查看明细。
        </div>
        <div v-else class="grid gap-3">
          <Alert
            v-if="activeRun.status === 'failed'"
            show-icon
            type="error"
            :message="activeRun.errorMessage || activeRun.stepMessage || '同步任务执行失败'"
          >
            <template #action>
              <Button size="small" type="primary" @click="retryRun(activeRun)">
                重试
              </Button>
            </template>
          </Alert>
          <div class="policy-collect-search-panel">
            <div class="policy-collect-search-panel__header">
              <div>
                <div class="font-medium text-slate-900">联网搜索诊断</div>
                <div class="mt-1 text-xs text-slate-500">
                  用于确认本次是否触发搜索、搜索词和召回数量。
                </div>
              </div>
              <Button
                v-if="getSearchDiagnostics(activeRun).searchTaskId"
                size="small"
                @click="openAiRecord(getSearchDiagnostics(activeRun).searchTaskId)"
              >
                <IconifyIcon icon="lucide:bot" class="size-4" />
                搜索 AI 记录
              </Button>
            </div>
            <div class="policy-collect-search-grid">
              <div>
                <span>搜索任务 ID</span>
                <strong>{{ getSearchDiagnostics(activeRun).searchTaskId || '-' }}</strong>
              </div>
              <div>
                <span>原始召回</span>
                <strong>{{ getSearchDiagnostics(activeRun).rawResultCount ?? '-' }}</strong>
              </div>
              <div>
                <span>过滤保留</span>
                <strong>{{ getSearchDiagnostics(activeRun).resultCount ?? '-' }}</strong>
              </div>
              <div>
                <span>搜索词数量</span>
                <strong>{{ getSearchDiagnostics(activeRun).queries.length }}</strong>
              </div>
            </div>
            <div class="policy-collect-search-meta">
              <span>系统日期：{{ getSearchDiagnostics(activeRun).systemDate || '-' }}</span>
              <span>发布日期范围：{{ getSearchDiagnostics(activeRun).publishDateRange }}</span>
              <span>关键词：{{ getSearchDiagnostics(activeRun).keywords.join('、') || '-' }}</span>
            </div>
            <div
              v-if="getSearchDiagnostics(activeRun).queries.length > 0"
              class="policy-collect-search-list"
            >
              <div
                v-for="query in getSearchDiagnostics(activeRun).queries"
                :key="query"
              >
                {{ query }}
              </div>
            </div>
            <Alert
              v-if="getSearchDiagnostics(activeRun).warnings.length > 0"
              show-icon
              type="warning"
              :message="getSearchDiagnostics(activeRun).warnings.join('；')"
            />
          </div>

          <div v-if="activeRun.status === 'running'" class="policy-collect-empty-panel">
            <IconifyIcon icon="lucide:loader-circle" class="size-8 text-sky-500" />
            <div>
              <div class="font-medium text-slate-900">采集任务正在执行</div>
              <p class="mt-1 text-sm text-slate-500">
                稍后在执行记录中查看候选政策。
              </p>
            </div>
          </div>
          <div v-else-if="activeItems.length === 0" class="policy-collect-empty-panel">
            <IconifyIcon icon="lucide:search-x" class="size-8 text-slate-400" />
            <div>
              <div class="font-medium text-slate-900">本次采集未返回候选政策</div>
              <p class="mt-1 text-sm text-slate-500">
                AI 原始返回为空，未生成待审查数据。可查看 AI 记录确认提示词、搜索参数和真实返回。
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <Button v-if="activeRun.aiTaskId" size="small" @click="openAiRecord(activeRun.aiTaskId)">
                  <IconifyIcon icon="lucide:bot" class="size-4" />
                  查看 AI 记录
                </Button>
                <Button size="small" @click="openReview">
                  去待审查
                </Button>
              </div>
            </div>
          </div>
          <div v-else class="grid gap-3">
            <div
              v-for="item in activeItems"
              :key="item.id"
              class="rounded-md border border-slate-200 p-3"
            >
              <div class="font-medium">{{ item.title }}</div>
              <div class="mt-1 flex flex-wrap gap-1">
                <Tag>{{ item.policyCategoryName }}</Tag>
                <Tag>{{ item.regionName }}</Tag>
              </div>
              <div class="mt-1 text-xs text-slate-500">{{ item.aiReason }}</div>
              <div class="mt-2">
                <Tag>{{ item.compareStatus }}</Tag>
                <Tag>{{ item.status }}</Tag>
                <Button
                  v-if="item.aiTaskId"
                  class="ml-1"
                  size="small"
                  @click="openAiRecord(item.aiTaskId)"
                >
                  AI 记录
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DetailDrawer>

      <div class="policy-collect-stat-grid">
        <div class="policy-collect-stat">
          <span>执行总数</span>
          <strong>{{ runStats.totalCount }}</strong>
        </div>
        <div class="policy-collect-stat">
          <span>成功</span>
          <strong>{{ runStats.successCount }}</strong>
        </div>
        <div class="policy-collect-stat">
          <span>失败</span>
          <strong>{{ runStats.failedCount }}</strong>
        </div>
        <div class="policy-collect-stat">
          <span>待审查线索</span>
          <strong>{{ runStats.pendingReviewCount }}</strong>
        </div>
      </div>

      <div class="policy-collect-list">
          <Empty v-if="visibleRuns.length === 0 && !loading" description="暂无采集执行记录" />
          <Card
            v-for="run in visibleRuns"
            :key="run.id"
            class="policy-collect-card policy-collect-card--clickable"
            :class="{ 'policy-collect-card--active': activeRun?.id === run.id }"
            variant="borderless"
            @click="showItems(run)"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="policy-collect-card-title">{{ run.jobName }}</h3>
                <div class="policy-collect-card-meta">
                  {{ run.startedAt || '-' }} - {{ run.finishedAt || '-' }}
                </div>
              </div>
              <div class="flex items-center gap-2">
                <Button
                  v-if="run.aiTaskId"
                  size="small"
                  @click.stop="openAiRecord(run.aiTaskId)"
                >
                  <IconifyIcon icon="lucide:bot" class="size-4" />
                  AI 记录
                </Button>
                <Button
                  v-if="run.status === 'failed'"
                  size="small"
                  type="primary"
                  @click.stop="retryRun(run)"
                >
                  <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
                  重试
                </Button>
                <Tag :color="statusColor(run.status)">{{ run.status }}</Tag>
              </div>
            </div>
            <div class="mt-3 flex flex-wrap gap-2 text-sm">
              <Tag>总数 {{ run.totalCount }}</Tag>
              <Tag color="blue">新增 {{ run.newCount }}</Tag>
              <Tag color="orange">变更 {{ run.changedCount }}</Tag>
              <Tag>一致 {{ run.sameCount }}</Tag>
              <Tag color="purple">不确定 {{ run.uncertainCount }}</Tag>
              <Tag color="cyan">{{ searchCountLabel(run) }}</Tag>
            </div>
            <div class="mt-3">
              <div class="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Tag>{{ stepLabel(run.currentStep) }}</Tag>
                <span>{{ run.stepMessage || '暂无步骤信息' }}</span>
              </div>
              <Progress
                :percent="run.progress || 0"
                :show-info="false"
                size="small"
                :status="run.status === 'failed' ? 'exception' : run.status === 'success' ? 'success' : 'active'"
              />
            </div>
            <div v-if="run.errorMessage" class="mt-2 text-xs text-red-500">
              {{ run.errorMessage }}
            </div>
          </Card>
        </div>
    </div>
  </Page>
</template>

<style src="./collect-page.css"></style>
