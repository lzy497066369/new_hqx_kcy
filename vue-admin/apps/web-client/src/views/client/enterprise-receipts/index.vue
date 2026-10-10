<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Card, Empty, Skeleton, Table, Tooltip } from 'antdv-next';

import {
  getClientCompaniesApi,
  type ClientCompanyApi,
} from '#/api/client';

import { isHighTechProject } from '../high-tech-application/model';

defineOptions({ name: 'ClientEnterpriseReceipts' });

const companies = ref<ClientCompanyApi.ClientCompany[]>([]);
const loading = ref(false);
const errorMessage = ref('');
const currentPage = ref(1);
const pageSize = ref(10);
let loaded = false;

const hasCompanies = computed(() => companies.value.length > 0);

const columns = [
  { title: '序号', key: 'sequence', width: 80 },
  { title: '企业名称', dataIndex: 'name', key: 'name', width: 280 },
  { title: '客户经理', dataIndex: 'salesOwner', key: 'salesOwner', width: 140 },
  { title: '项目负责人', dataIndex: 'projectLeader', key: 'projectLeader', width: 140 },
  { title: '申报年份', dataIndex: 'preDeclarationYear', key: 'preDeclarationYear', width: 110 },
  { title: '自评分', key: 'selfScore', width: 160 },
  { title: '进度', key: 'progress', width: 240 },
];

function hasHighTech(company: ClientCompanyApi.ClientCompany) {
  return company.enterpriseProjects?.some(isHighTechProject) ?? false;
}

function progressDescription(progress: ClientCompanyApi.HighTechProgress) {
  return progress.stages.map((stage) => `${stage.title}：${stage.percent}%（权重 ${stage.weight}%）`).join('；');
}

function changePage(pagination: { current?: number; pageSize?: number }) {
  currentPage.value = pagination.current ?? 1;
  pageSize.value = pagination.pageSize ?? 10;
}

async function loadCompanies() {
  loading.value = true;
  errorMessage.value = '';
  try {
    companies.value = await getClientCompaniesApi();
    currentPage.value = Math.min(currentPage.value, Math.max(1, Math.ceil(companies.value.length / pageSize.value)));
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : '企业档案加载失败';
  } finally {
    loading.value = false;
    loaded = true;
  }
}

onMounted(loadCompanies);
// Refresh saved progress when returning from the editor in a cached route.
onActivated(() => { if (loaded && !loading.value) void loadCompanies(); });
</script>

<template>
  <Page auto-content-height>
    <div class="receipts-page">
      <header class="receipts-page__header">
        <h1>企业档案</h1>
      </header>

      <Alert
        v-if="errorMessage"
        show-icon
        type="warning"
        :message="errorMessage"
      />

      <Card>
        <Skeleton v-if="loading && !companies.length" active />
        <Empty
          v-else-if="!hasCompanies"
          description="暂无企业档案"
        />
        <Table
          v-else
          :columns="columns"
          :data-source="companies"
          :loading="loading"
          :pagination="{ current: currentPage, pageSize, showSizeChanger: true }"
          :scroll="{ x: 1150 }"
          @change="changePage"
          row-key="id"
        >
          <template #emptyText>
            <Empty description="暂无企业档案" />
          </template>
          <template #bodyCell="{ column, record, index }">
            <span v-if="column.key === 'sequence'">{{ (currentPage - 1) * pageSize + index + 1 }}</span>
            <RouterLink
              v-else-if="column.key === 'name' && hasHighTech(record)"
              :to="{ name: 'ClientHighTechApplication', params: { companyId: record.id } }"
              class="enterprise-name-link"
              :aria-label="`${record.name}，进入高新技术企业申报`"
            >{{ record.name }}</RouterLink>
            <template v-else-if="column.key === 'selfScore'">
              <template v-if="hasHighTech(record)">
                <RouterLink
                  v-if="typeof record.highTechSelfScore === 'number' && Number.isFinite(record.highTechSelfScore)"
                  :to="{ name: 'ClientHighTechSelfAssessment', params: { companyId: record.id } }"
                  class="enterprise-name-link"
                  :aria-label="`${record.name}，自评分 ${record.highTechSelfScore} 分，查看自评`"
                >{{ record.highTechSelfScore }} 分</RouterLink>
                <span v-else class="enterprise-unscored">未评分 <RouterLink
                  :to="{ name: 'ClientHighTechSelfAssessment', params: { companyId: record.id } }"
                  class="enterprise-name-link"
                  :aria-label="`${record.name}，去评分`"
                >去评分</RouterLink></span>
              </template>
              <span v-else title="未关联高新技术企业项目">—</span>
            </template>
            <template v-else-if="column.key === 'progress'">
              <Tooltip v-if="record.highTechProgress" :title="progressDescription(record.highTechProgress)" :trigger="['hover', 'focus']">
                <div
                  class="enterprise-progress"
                  role="progressbar"
                  tabindex="0"
                  :aria-label="`${record.name}申报进度；${progressDescription(record.highTechProgress)}`"
                  :aria-valuenow="record.highTechProgress.percent"
                  :aria-valuemin="0"
                  :aria-valuemax="100"
                >
                  <span class="enterprise-progress__track" aria-hidden="true">
                    <span class="enterprise-progress__fill" :class="{ 'is-complete': record.highTechProgress.percent === 100 }" :style="{ width: `${record.highTechProgress.percent}%` }"></span>
                  </span>
                  <span class="enterprise-progress__value">{{ record.highTechProgress.percent }}%</span>
                </div>
              </Tooltip>
              <span v-else :title="hasHighTech(record) ? '进度暂不可用' : '未关联高新技术企业项目'">—</span>
            </template>
            <span v-else>{{ record[String(column.dataIndex)] === '' ? '—' : (record[String(column.dataIndex)] ?? '—') }}</span>
          </template>
        </Table>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.enterprise-unscored { display: flex; flex-wrap: wrap; gap: 8px; }
.enterprise-name-link { color: hsl(var(--primary)); overflow-wrap: anywhere; }
.enterprise-name-link:hover { text-decoration: underline; }
.enterprise-name-link:focus-visible, .enterprise-progress:focus-visible { outline: 2px solid hsl(var(--primary)); outline-offset: 4px; border-radius: 4px; }
.enterprise-progress { display: flex; align-items: center; gap: 12px; min-width: 180px; }
.enterprise-progress__track { flex: 1; height: 8px; overflow: hidden; border-radius: 999px; background: hsl(var(--muted)); }
.enterprise-progress__fill { display: block; height: 100%; border-radius: inherit; background: hsl(var(--primary)); }
.enterprise-progress__fill.is-complete { background: #16a34a; }
.enterprise-progress__value { min-width: 52px; text-align: right; font-variant-numeric: tabular-nums; }

.receipts-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  width: 100%;
  min-width: 0;
  max-width: 1440px;
  padding: 28px 32px 40px;
  margin: 0 auto;
}

.receipts-page > * {
  min-width: 0;
}

.receipts-page__header {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  justify-content: space-between;
}

h1 {
  margin: 7px 0 8px;
  font-size: 30px;
  line-height: 1.2;
  color: #101828;
}

.receipts-page__header p {
  margin: 0;
  color: #667085;
}

@media (max-width: 760px) {
  .receipts-page {
    padding: 20px 16px 32px;
  }

  .receipts-page__header {
    flex-direction: column;
  }
}
</style>
