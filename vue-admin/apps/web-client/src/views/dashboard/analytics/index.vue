<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Card, Empty, Progress, Skeleton, Tag } from 'antdv-next';

import DashboardChart from '../components/dashboard-chart.vue';
import { useClientDashboardData } from '../composables/use-client-dashboard-data';

const router = useRouter();
const dashboard = useClientDashboardData();
const analytics = computed(() => dashboard.analytics.value);

const chartPalette = ['#14b8a6', '#0ea5e9', '#6366f1', '#f59e0b', '#ef4444', '#64748b'];

const financeGrowthOption = computed(() => {
  const rows = analytics.value?.financeGrowthTrend ?? [];
  return {
    color: ['#14b8a6', '#0ea5e9', '#6366f1', '#f59e0b'],
    grid: { bottom: 28, containLabel: true, left: 8, right: 16, top: 36 },
    legend: { top: 0 },
    series: [
      {
        barMaxWidth: 24,
        data: rows.map((item) => item.revenue),
        name: '营收',
        type: 'bar',
      },
      {
        data: rows.map((item) => item.netProfit),
        name: '净利润',
        smooth: true,
        type: 'line',
      },
      {
        data: rows.map((item) => item.netAssets),
        name: '净资产',
        smooth: true,
        type: 'line',
      },
      {
        data: rows.map((item) => item.rdExpense),
        name: '研发费用',
        smooth: true,
        type: 'line',
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisTick: { show: false },
      data: rows.map((item) => item.year),
      type: 'category',
    },
    yAxis: { type: 'value' },
  };
});

const employeeStructureOption = computed(() => {
  const stats = analytics.value?.employeeStats;
  const total = stats?.total ?? 0;
  const rdTotal = stats?.rdStaffTotal ?? 0;
  return buildPieOption('员工结构', [
    { name: '研发人员', value: rdTotal },
    { name: '其他员工', value: Math.max(total - rdTotal, 0) },
  ]);
});

const educationOption = computed(() => {
  const rows = analytics.value?.employeeStats.educationStats ?? [];
  return {
    color: ['#0ea5e9'],
    grid: { bottom: 24, containLabel: true, left: 8, right: 18, top: 12 },
    series: [
      {
        barMaxWidth: 26,
        data: rows.map((item) => item.value),
        type: 'bar',
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisTick: { show: false },
      data: rows.map((item) => `学历 ${item.label}`),
      type: 'category',
    },
    yAxis: { minInterval: 1, type: 'value' },
  };
});

const materialOption = computed(() =>
  buildPieOption(
    '材料状态',
    analytics.value?.materialStats.map((item) => ({
      name: labelStatus(item.label),
      value: item.value,
    })) ?? [],
  ),
);

const declarationOption = computed(() =>
  buildPieOption(
    '申报状态',
    analytics.value?.declarationStats.map((item) => ({
      name: labelStatus(item.label),
      value: item.value,
    })) ?? [],
  ),
);

const propertyOption = computed(() => {
  const rows = analytics.value?.propertyStats ?? [];
  return {
    color: chartPalette,
    grid: { bottom: 28, containLabel: true, left: 8, right: 16, top: 18 },
    series: [
      {
        barMaxWidth: 30,
        data: rows.map((item) => item.value),
        type: 'bar',
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisLabel: { interval: 0 },
      axisTick: { show: false },
      data: rows.map((item) => propertyLabel(item.label)),
      type: 'category',
    },
    yAxis: { minInterval: 1, type: 'value' },
  };
});

const profileCards = computed(() => analytics.value?.profileItems ?? []);

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

function labelStatus(status: string) {
  const labels: Record<string, string> = {
    approved: '已通过',
    cancelled: '已取消',
    completed: '已完成',
    draft: '草稿',
    invalid: '需修正',
    not_uploaded: '未上传',
    preparing: '准备中',
    rejected: '已退回',
    reviewing: '审核中',
    submitted: '已提交',
    uploaded: '已上传',
    valid: '有效',
  };
  return labels[status] ?? status;
}

function propertyLabel(value: string) {
  const labels: Record<string, string> = {
    intellectual_property: '知识产权',
    product_service: '产品服务',
    research_project: '研发项目',
    transformation: '成果转化',
  };
  return labels[value] ?? value;
}
</script>

<template>
  <Page auto-content-height>
    <div class="client-analytics p-5">
      <Alert
        v-if="dashboard.errorMessage.value"
        class="mb-4"
        show-icon
        type="warning"
        :message="dashboard.errorMessage.value"
      />

      <Skeleton v-if="dashboard.loading.value" active />

      <template v-else-if="analytics">
        <section class="client-analytics__head">
          <div>
            <div class="text-sm font-medium text-teal-700">数据看板</div>
            <h1 class="mt-1 text-2xl font-semibold text-slate-950">
              {{ dashboard.companyName.value }}
            </h1>
            <p class="mt-1 text-sm text-slate-600">
              展示当前企业的增长性、员工结构、资料完整度、材料状态和申报概览。
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

        <div class="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <Card title="企业增长性" variant="borderless">
            <Empty
              v-if="analytics.financeGrowthTrend.length === 0"
              description="暂无财务增长数据"
            />
            <DashboardChart v-else height="340px" :option="financeGrowthOption" />
          </Card>

          <Card title="员工结构" variant="borderless">
            <Empty v-if="analytics.employeeStats.total === 0" description="暂无员工数据" />
            <DashboardChart v-else height="340px" :option="employeeStructureOption" />
          </Card>
        </div>

        <div class="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <Card title="员工学历分布" variant="borderless">
            <Empty
              v-if="analytics.employeeStats.educationStats.length === 0"
              description="暂无员工学历数据"
            />
            <DashboardChart v-else height="300px" :option="educationOption" />
          </Card>

          <Card title="知识产权与研发资料" variant="borderless">
            <Empty v-if="analytics.propertyStats.length === 0" description="暂无研发资料数据" />
            <DashboardChart v-else height="300px" :option="propertyOption" />
          </Card>
        </div>

        <Card class="mt-5" title="企业资料总览" variant="borderless">
          <Empty v-if="profileCards.length === 0" description="暂无资料统计" />
          <div v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <button
              v-for="item in profileCards"
              :key="`${item.moduleKey}-${item.tabKey}`"
              class="client-analytics__profile-card"
              type="button"
              @click="navTo('/client/company')"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate font-medium text-slate-950">
                    {{ item.itemName }}
                  </div>
                  <div class="mt-1 truncate text-xs text-slate-500">
                    {{ item.moduleName }}
                  </div>
                </div>
                <Tag :color="item.isCompleted ? 'success' : 'warning'">
                  {{ item.isCompleted ? '已完善' : '待完善' }}
                </Tag>
              </div>
              <Progress class="mt-3" size="small" :percent="item.score" />
              <div class="mt-3 grid grid-cols-2 gap-2 text-center">
                <div class="client-analytics__mini">
                  <div class="text-lg font-semibold">{{ item.recordCount }}</div>
                  <div class="text-xs text-slate-500">记录</div>
                </div>
                <div class="client-analytics__mini">
                  <div class="text-lg font-semibold">{{ item.attachmentCount }}</div>
                  <div class="text-xs text-slate-500">附件</div>
                </div>
              </div>
            </button>
          </div>
        </Card>

        <div class="mt-5 grid gap-5 xl:grid-cols-[0.8fr_0.8fr_1.4fr]">
          <Card title="材料状态" variant="borderless">
            <Empty v-if="analytics.materialStats.length === 0" description="暂无材料数据" />
            <DashboardChart v-else height="280px" :option="materialOption" />
          </Card>

          <Card title="申报状态" variant="borderless">
            <Empty v-if="analytics.declarationStats.length === 0" description="暂无申报记录" />
            <DashboardChart v-else height="280px" :option="declarationOption" />
          </Card>

          <Card title="近期申报" variant="borderless">
            <Empty
              v-if="analytics.recentDeclarations.length === 0"
              description="暂无申报记录"
            />
            <div v-else class="space-y-3">
              <button
                v-for="item in analytics.recentDeclarations"
                :key="item.id"
                class="client-analytics__declaration"
                type="button"
                @click="navTo(`/projects/my/detail/${item.id}`)"
              >
                <div class="min-w-0 flex-1 text-left">
                  <div class="truncate font-medium">{{ item.projectName }}</div>
                  <div class="mt-1 text-xs text-slate-500">
                    {{ item.declarationNo }} · {{ item.currentNodeName || labelStatus(item.status) }}
                  </div>
                </div>
                <Progress class="max-w-36" size="small" :percent="item.progress" />
              </button>
            </div>
          </Card>
        </div>
      </template>
    </div>
  </Page>
</template>

<style scoped>
.client-analytics {
  min-height: 100%;
  background: linear-gradient(180deg, rgb(248 250 252) 0%, rgb(241 245 249) 100%);
}

.client-analytics__head,
.client-analytics__profile-card,
.client-analytics__declaration {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: #fff;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
}

.client-analytics__profile-card {
  display: block;
  width: 100%;
  min-height: 174px;
  text-align: left;
}

.client-analytics__mini {
  padding: 8px;
  background: rgb(248 250 252);
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
}

.client-analytics__declaration {
  width: 100%;
  padding: 14px;
}

.client-analytics__profile-card:hover,
.client-analytics__declaration:hover {
  border-color: rgb(20 184 166 / 45%);
  box-shadow: 0 10px 26px rgb(15 23 42 / 8%);
}

@media (max-width: 640px) {
  .client-analytics__head,
  .client-analytics__declaration {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
