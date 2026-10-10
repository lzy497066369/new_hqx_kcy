<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Card, Empty, Progress, Skeleton, Tag } from 'antdv-next';

import DashboardChart from '../components/dashboard-chart.vue';
import { useAdminDashboardData } from '../composables/use-admin-dashboard-data';

const router = useRouter();
const dashboard = useAdminDashboardData();
const analytics = computed(() => dashboard.analytics.value);

const chartPalette = ['#0ea5e9', '#14b8a6', '#6366f1', '#f59e0b', '#ef4444', '#64748b'];

const enterpriseTrendOption = computed(() => {
  const rows = analytics.value?.enterpriseTrend ?? [];
  return {
    color: ['#0ea5e9', '#14b8a6'],
    grid: { bottom: 28, containLabel: true, left: 8, right: 16, top: 28 },
    legend: { top: 0 },
    series: [
      {
        barMaxWidth: 28,
        data: rows.map((item) => item.value),
        name: '新增企业',
        type: 'bar',
      },
      {
        data: rows.map((item) => item.value),
        name: '增长趋势',
        smooth: true,
        type: 'line',
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisTick: { show: false },
      data: rows.map((item) => item.label),
      type: 'category',
    },
    yAxis: { minInterval: 1, type: 'value' },
  };
});

const activityTrendOption = computed(() => {
  const rows = analytics.value?.activityTrend ?? [];
  return {
    color: ['#14b8a6', '#f97316'],
    grid: { bottom: 28, containLabel: true, left: 8, right: 16, top: 28 },
    legend: { top: 0 },
    series: [
      {
        data: rows.map((item) => item.success),
        name: '成功操作',
        stack: 'activity',
        type: 'bar',
      },
      {
        data: rows.map((item) => item.failed),
        name: '异常操作',
        stack: 'activity',
        type: 'bar',
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisTick: { show: false },
      data: rows.map((item) => item.label.slice(5)),
      type: 'category',
    },
    yAxis: { minInterval: 1, type: 'value' },
  };
});

const profileStatusOption = computed(() =>
  buildPieOption(
    '企业资料',
    analytics.value?.profileStatusStats.map((item) => ({
      name: statusLabel(item.label),
      value: item.value,
    })) ?? [],
  ),
);

const policyStatusOption = computed(() =>
  buildPieOption(
    '政策文件',
    analytics.value?.policyStatusStats.map((item) => ({
      name: statusLabel(item.label),
      value: item.value,
    })) ?? [],
  ),
);

const declarationStatusOption = computed(() => {
  const rows = analytics.value?.declarationStatusStats ?? [];
  return {
    color: chartPalette,
    grid: { bottom: 24, containLabel: true, left: 8, right: 12, top: 18 },
    series: [
      {
        barMaxWidth: 34,
        data: rows.map((item) => item.value),
        type: 'bar',
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisLabel: { interval: 0 },
      axisTick: { show: false },
      data: rows.map((item) => statusLabel(item.label)),
      type: 'category',
    },
    yAxis: { minInterval: 1, type: 'value' },
  };
});

const enterpriseHealthOption = computed(() => {
  const rows = [...(analytics.value?.tableRows ?? [])]
    .sort((left, right) => right.completenessRate - left.completenessRate)
    .slice(0, 8)
    .reverse();
  return {
    color: ['#0ea5e9'],
    grid: { bottom: 12, containLabel: true, left: 8, right: 36, top: 12 },
    series: [
      {
        data: rows.map((item) => item.completenessRate),
        label: {
          formatter: '{c}%',
          position: 'right',
          show: true,
        },
        type: 'bar',
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: { max: 100, type: 'value' },
    yAxis: {
      axisTick: { show: false },
      data: rows.map((item) => item.name),
      type: 'category',
    },
  };
});

const healthCards = computed(() =>
  [...(analytics.value?.tableRows ?? [])]
    .sort((left, right) => right.completenessRate - left.completenessRate)
    .slice(0, 6),
);

onMounted(() => {
  dashboard.loadAnalytics();
});

function navTo(path: string) {
  router.push(path).catch(() => {});
}

function buildPieOption(name: string, data: Array<{ name: string; value: number }>) {
  return {
    color: chartPalette,
    legend: { bottom: 0, left: 'center' },
    series: [
      {
        data,
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: { formatter: '{b}\n{c}', lineHeight: 18 },
        name,
        radius: ['48%', '68%'],
        type: 'pie',
      },
    ],
    tooltip: { trigger: 'item' },
  };
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    approved: '已通过',
    cancelled: '已取消',
    completed: '已完成',
    draft: '待完善',
    incomplete: '未完善',
    need_resubmit: '需补正',
    pending_review: '待审核',
    preparing: '准备中',
    published: '已发布',
    rejected: '已驳回',
    reviewing: '审核中',
    submitted: '已提交',
  };
  return labels[status] ?? status;
}
</script>

<template>
  <Page auto-content-height>
    <div class="admin-analytics p-5">
      <Alert
        v-if="dashboard.errorMessage.value"
        class="mb-4"
        show-icon
        type="warning"
        :message="dashboard.errorMessage.value"
      />

      <Skeleton v-if="dashboard.loading.value" active />

      <template v-else-if="analytics">
        <section class="admin-analytics__head">
          <div>
            <div class="text-sm font-medium text-sky-700">分析页</div>
            <h1 class="mt-1 text-2xl font-semibold text-slate-950">
              系统数据总览看板
            </h1>
            <p class="mt-1 text-sm text-slate-600">
              以图表方式汇总企业、政策、申报和业务活跃度；项目老师仅统计自己负责企业。
            </p>
          </div>
        </section>

        <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card v-for="card in analytics.overview" :key="card.key" variant="borderless">
            <div class="text-sm text-slate-500">{{ card.label }}</div>
            <div class="mt-2 text-3xl font-semibold text-slate-950">
              {{ card.value }}
            </div>
            <div class="mt-1 line-clamp-2 text-xs text-slate-500">
              {{ card.hint }}
            </div>
          </Card>
        </div>

        <div class="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <Card title="企业增长趋势" variant="borderless">
            <DashboardChart height="320px" :option="enterpriseTrendOption" />
          </Card>

          <Card title="业务活跃度分析" variant="borderless">
            <DashboardChart height="320px" :option="activityTrendOption" />
          </Card>
        </div>

        <div class="mt-5 grid gap-5 xl:grid-cols-3">
          <Card title="企业资料状态" variant="borderless">
            <Empty
              v-if="analytics.profileStatusStats.length === 0"
              description="暂无企业资料"
            />
            <DashboardChart v-else height="280px" :option="profileStatusOption" />
          </Card>

          <Card title="政策文件状态" variant="borderless">
            <Empty
              v-if="analytics.policyStatusStats.length === 0"
              description="暂无政策文件"
            />
            <DashboardChart v-else height="280px" :option="policyStatusOption" />
          </Card>

          <Card title="申报状态分析" variant="borderless">
            <Empty
              v-if="analytics.declarationStatusStats.length === 0"
              description="暂无申报记录"
            />
            <DashboardChart v-else height="280px" :option="declarationStatusOption" />
          </Card>
        </div>

        <div class="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Card title="企业健康度排行" variant="borderless">
            <Empty v-if="analytics.tableRows.length === 0" description="暂无企业数据" />
            <DashboardChart v-else height="360px" :option="enterpriseHealthOption" />
          </Card>

          <Card title="企业健康卡片" variant="borderless">
            <Empty v-if="healthCards.length === 0" description="暂无企业数据" />
            <div v-else class="grid gap-3 md:grid-cols-2">
              <button
                v-for="row in healthCards"
                :key="row.id"
                class="admin-analytics__enterprise-card"
                type="button"
                @click="navTo('/enterprise/profile')"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="truncate font-medium text-slate-950">
                      {{ row.name }}
                    </div>
                    <div class="mt-1 truncate text-xs text-slate-500">
                      {{ row.industry || '未填写行业' }} · 申报 {{ row.declarationCount }} 项
                    </div>
                  </div>
                  <Tag :color="row.status === 1 ? 'success' : 'default'">
                    {{ row.status === 1 ? '启用' : '停用' }}
                  </Tag>
                </div>
                <Progress class="mt-3" size="small" :percent="row.completenessRate" />
                <div class="mt-2 text-xs text-slate-500">
                  最近更新：{{ row.updateTime }}
                </div>
              </button>
            </div>
          </Card>
        </div>
      </template>
    </div>
  </Page>
</template>

<style scoped>
.admin-analytics {
  min-height: 100%;
  background: linear-gradient(180deg, rgb(248 250 252) 0%, rgb(241 245 249) 100%);
}

.admin-analytics__head {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: #fff;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
}

.admin-analytics__enterprise-card {
  width: 100%;
  padding: 14px;
  text-align: left;
  background: #fff;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
}

.admin-analytics__enterprise-card:hover {
  border-color: rgb(14 165 233 / 45%);
  box-shadow: 0 10px 26px rgb(15 23 42 / 8%);
}

@media (max-width: 640px) {
  .admin-analytics__head {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
