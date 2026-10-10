<script setup lang="ts">
import ClientJourneyTrail from '#/views/client/components/ClientJourneyTrail.vue';

import { computed, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Empty,
  Progress,
  Space,
  Tag,
  message,
} from 'antdv-next';

import {
  checkClientDeclarationMaterialApi,
  downloadClientDeclarationGaoxinExportPackageApi,
  getClientDeclarationAiDiagnosisApi,
  getClientDeclarationDetailApi,
  getClientDeclarationGaoxinBookApi,
  getClientDeclarationGaoxinExportReadinessApi,
  getClientDeclarationGaoxinScoreApi,
  getClientDeclarationSchemeScoreApi,
  getClientDeclarationMaterialReadinessApi,
  saveClientDeclarationGaoxinBookApi,
  syncClientDeclarationSchemeApi,
} from '#/api/client';
import type {
  ClientDeclarationApi,
  ClientDeclareProjectApi,
} from '#/api/client';
import { useClientEnterpriseStore } from '#/store';

import DeclarationFlowPanel from './components/declaration-flow-panel.vue';
import DeclarationSchemeSummaryPanel from './components/declaration-scheme-summary-panel.vue';
import GaoxinAiDiagnosisPanel from './components/gaoxin-ai-diagnosis-panel.vue';
import GaoxinBookDraftPanel from './components/gaoxin-book-draft-panel.vue';
import GaoxinExportReadinessPanel from './components/gaoxin-export-readiness-panel.vue';
import GaoxinScorePanel from './components/gaoxin-score-panel.vue';
import ProjectMaterialReadinessPanel from './components/project-material-readiness-panel.vue';

defineOptions({ name: 'ClientMyProjectDetail' });

const route = useRoute();
const router = useRouter();
const store = useClientEnterpriseStore();

const loading = shallowRef(false);
const diagnosisLoading = shallowRef(false);
const materialReadinessLoading = shallowRef(false);
const scoreLoading = shallowRef(false);
const bookDraftLoading = shallowRef(false);
const bookDraftSaving = shallowRef(false);
const exportReadinessLoading = shallowRef(false);
const exportPackageLoading = shallowRef(false);
const schemeSyncing = shallowRef(false);
const declaration = shallowRef<ClientDeclarationApi.DeclarationItem | null>(
  null,
);
const aiDiagnosis =
  shallowRef<ClientDeclareProjectApi.GaoxinAiDiagnosis | null>(null);
const materialReadiness =
  shallowRef<ClientDeclareProjectApi.MaterialReadiness | null>(null);
const gaoxinScore =
  shallowRef<ClientDeclareProjectApi.GaoxinScoreResult | null>(null);
const schemeScore = shallowRef<ClientDeclarationApi.SchemeScoreResult | null>(
  null,
);
const gaoxinBookDraft = shallowRef<ClientDeclarationApi.GaoxinBookDraft | null>(
  null,
);
const exportReadiness =
  shallowRef<ClientDeclarationApi.GaoxinExportReadiness | null>(null);

const declarationId = computed(() => String(route.params.id || ''));
const showSchemeScore = computed(
  () => declaration.value?.capabilities.score === true,
);
const showGaoxinModules = computed(
  () => declaration.value?.capabilities.gaoxinScore === true,
);
const showExportPackage = computed(
  () => declaration.value?.capabilities.exportPackage === true,
);
const showApplyCurrentScheme = computed(() => {
  const item = declaration.value;
  return Boolean(
    item?.matchedScheme &&
    ['draft', 'preparing'].includes(item.status) &&
    item.matchedScheme.id !== item.appliedScheme?.id,
  );
});

const statusMetaMap: Record<
  ClientDeclarationApi.DeclarationStatus,
  { color: string; label: string }
> = {
  approved: { color: 'green', label: '已通过' },
  cancelled: { color: 'default', label: '已取消' },
  completed: { color: 'green', label: '已完成' },
  draft: { color: 'default', label: '草稿' },
  preparing: { color: 'blue', label: '准备中' },
  rejected: { color: 'red', label: '已退回' },
  reviewing: { color: 'orange', label: '审核中' },
  submitted: { color: 'purple', label: '已提交' },
};

const statusMeta = computed(() => {
  const status = declaration.value?.status ?? 'draft';
  return statusMetaMap[status] ?? { color: 'default', label: status };
});

const profileRouteNameMap: Record<string, string> = {
  account: 'ClientEnterpriseUser',
  basic: 'ClientCompanyBasic',
  certificate: 'ClientCompanyCertificates',
  contract: 'ClientCompanyContract',
  document: 'ClientCompanyDocument',
  employee: 'ClientCompanyEmployees',
  finance: 'ClientCompanyTax',
  photo: 'ClientCompanyPhotos',
  property: 'ClientCompanyProperty',
};

async function loadMaterialReadiness(forceCheck = false) {
  if (!declarationId.value) {
    return;
  }

  materialReadinessLoading.value = true;
  try {
    materialReadiness.value = forceCheck
      ? await checkClientDeclarationMaterialApi(declarationId.value)
      : await getClientDeclarationMaterialReadinessApi(declarationId.value);
  } finally {
    materialReadinessLoading.value = false;
  }
}

async function loadGaoxinScore() {
  if (!declarationId.value || !showGaoxinModules.value) {
    return;
  }

  scoreLoading.value = true;
  try {
    gaoxinScore.value = await getClientDeclarationGaoxinScoreApi(
      declarationId.value,
    );
  } finally {
    scoreLoading.value = false;
  }
}

async function loadSchemeScore() {
  if (!declarationId.value || !showSchemeScore.value) return;
  schemeScore.value = await getClientDeclarationSchemeScoreApi(
    declarationId.value,
  );
}

async function loadAiDiagnosis() {
  if (!declarationId.value || !showGaoxinModules.value) {
    return;
  }

  diagnosisLoading.value = true;
  try {
    aiDiagnosis.value = await getClientDeclarationAiDiagnosisApi(
      declarationId.value,
    );
  } finally {
    diagnosisLoading.value = false;
  }
}

async function loadGaoxinBookDraft() {
  if (!declarationId.value || !showGaoxinModules.value) {
    return;
  }

  bookDraftLoading.value = true;
  try {
    gaoxinBookDraft.value = await getClientDeclarationGaoxinBookApi(
      declarationId.value,
    );
  } finally {
    bookDraftLoading.value = false;
  }
}

async function loadExportReadiness() {
  if (!declarationId.value || !showExportPackage.value) {
    return;
  }

  exportReadinessLoading.value = true;
  try {
    exportReadiness.value = await getClientDeclarationGaoxinExportReadinessApi(
      declarationId.value,
    );
  } finally {
    exportReadinessLoading.value = false;
  }
}

async function saveGaoxinBookDraft(supplemental: Record<string, string>) {
  if (!declarationId.value) {
    return;
  }

  bookDraftSaving.value = true;
  try {
    gaoxinBookDraft.value = await saveClientDeclarationGaoxinBookApi(
      declarationId.value,
      supplemental,
    );
    await Promise.all([loadExportReadiness(), loadAiDiagnosis()]);
    message.success('申报书补充说明已保存');
  } finally {
    bookDraftSaving.value = false;
  }
}

async function downloadGaoxinExportPackage() {
  if (!declarationId.value) {
    return;
  }

  exportPackageLoading.value = true;
  try {
    const blob = await downloadClientDeclarationGaoxinExportPackageApi(
      declarationId.value,
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const projectName = declaration.value?.projectName || '高企申报';
    link.href = url;
    link.download = `${projectName}-申报数据包.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    message.success('申报数据包已生成');
  } catch (error) {
    message.error(
      error instanceof Error ? error.message : '申报数据包导出失败',
    );
  } finally {
    exportPackageLoading.value = false;
  }
}

async function syncDeclarationScheme() {
  if (!declarationId.value) return;
  schemeSyncing.value = true;
  try {
    await syncClientDeclarationSchemeApi(declarationId.value);
    await loadDetail();
    message.success('申报已同步到当前地区方案');
  } finally {
    schemeSyncing.value = false;
  }
}

async function loadDetail() {
  if (!declarationId.value) {
    return;
  }

  loading.value = true;
  aiDiagnosis.value = null;
  materialReadiness.value = null;
  gaoxinScore.value = null;
  schemeScore.value = null;
  gaoxinBookDraft.value = null;
  exportReadiness.value = null;
  try {
    declaration.value = await getClientDeclarationDetailApi(
      declarationId.value,
    );
    const tasks = [loadMaterialReadiness()];
    if (showGaoxinModules.value) {
      tasks.push(loadAiDiagnosis(), loadGaoxinScore(), loadGaoxinBookDraft());
    }
    if (showSchemeScore.value) tasks.push(loadSchemeScore());
    if (showExportPackage.value) tasks.push(loadExportReadiness());
    await Promise.all(tasks);
  } finally {
    loading.value = false;
  }
}

async function refreshAiDiagnosis() {
  await Promise.all([
    loadMaterialReadiness(),
    loadGaoxinScore(),
    loadGaoxinBookDraft(),
    ...(showExportPackage.value ? [loadExportReadiness()] : []),
  ]);
  await loadAiDiagnosis();
}

async function openProfileModule(payload: {
  moduleKey: string;
  tabKey: string;
}) {
  const routeName = profileRouteNameMap[payload.moduleKey] ?? 'ClientCompany';
  await router.push({
    name: routeName,
    query: {
      from: 'declaration-readiness',
      tab: payload.tabKey,
    },
  });
}

function openBookDraftSection() {
  document.querySelector('#gaoxin-book-draft-section')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

function openMaterialReadinessSection() {
  document
    .querySelector('#declaration-material-readiness-section')
    ?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
}

watch(declarationId, loadDetail, { immediate: true });
</script>

<template>
  <div class="client-declaration-detail">
    <ClientJourneyTrail :status="declaration?.status" />
    <Card :bordered="false" :loading="loading">
      <div class="client-declaration-detail__hero">
        <div>
          <p class="client-declaration-detail__eyebrow">
            {{ store.currentCompanyName || '当前企业' }}
          </p>
          <h1 class="client-declaration-detail__title">
            {{ declaration?.projectName || '申报详情' }}
          </h1>
          <p class="client-declaration-detail__description">
            申报编号：{{ declaration?.declarationNo || '-' }}
          </p>
        </div>
        <Space wrap>
          <Button @click="router.push('/projects/my')">返回我的申报</Button>
          <Button
            v-if="declaration"
            @click="router.push(`/projects/detail/${declaration.projectId}`)"
          >
            查看项目详情
          </Button>
          <Button
            v-if="
              declaration &&
              declaration.missingMaterialCount > 0 &&
              ['draft', 'preparing', 'rejected'].includes(declaration.status)
            "
            type="primary"
            @click="openMaterialReadinessSection"
          >
            补齐材料
          </Button>
          <Tag v-if="declaration" :color="statusMeta.color">
            {{ statusMeta.label }}
          </Tag>
        </Space>
      </div>
    </Card>

    <Empty v-if="!loading && !declaration" description="未找到申报记录" />

    <template v-if="declaration">
      <div class="client-declaration-detail__grid">
        <Card :bordered="false" title="基础信息">
          <Descriptions :column="1" bordered size="small">
            <DescriptionsItem label="申报编号">
              {{ declaration.declarationNo }}
            </DescriptionsItem>
            <DescriptionsItem label="项目名称">
              {{ declaration.projectName }}
            </DescriptionsItem>
            <DescriptionsItem label="政策类型">
              {{ declaration.policyType || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="申报地区">
              {{ declaration.regionName || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="当前节点">
              {{
                declaration.activeNodeNames.length
                  ? declaration.activeNodeNames.join('、')
                  : declaration.currentNodeName || '-'
              }}
            </DescriptionsItem>
            <DescriptionsItem label="截止时间">
              {{ declaration.deadline || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="提交时间">
              {{ declaration.submitTime || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="更新时间">
              {{ declaration.updateTime }}
            </DescriptionsItem>
          </Descriptions>
        </Card>

        <Card :bordered="false" title="申报进度">
          <div class="client-declaration-detail__progress">
            <Progress :percent="declaration.progress" />
            <div class="client-declaration-detail__metric">
              <span>待补材料</span>
              <strong>{{ declaration.missingMaterialCount }}</strong>
            </div>
            <Button
              v-if="declaration.missingMaterialCount > 0"
              type="primary"
              @click="openMaterialReadinessSection"
            >
              去补齐材料
            </Button>
            <div
              v-if="declaration.rejectedReason"
              class="client-declaration-detail__reject-reason"
            >
              {{ declaration.rejectedReason }}
            </div>
          </div>
        </Card>
      </div>

      <DeclarationSchemeSummaryPanel
        :declaration="declaration"
        :scheme-syncing="schemeSyncing"
        :show-apply-current-scheme="showApplyCurrentScheme"
        @apply-current-scheme="syncDeclarationScheme"
      />

      <Card
        id="declaration-material-readiness-section"
        :bordered="false"
        title="待办与材料"
      >
        <ProjectMaterialReadinessPanel
          :loading="materialReadinessLoading"
          :readiness="materialReadiness"
          @open-profile="openProfileModule"
          @recheck="loadMaterialReadiness(true)"
        />
      </Card>

      <Card v-if="showGaoxinModules" :bordered="false" title="申报诊断">
        <GaoxinAiDiagnosisPanel
          :diagnosis="aiDiagnosis"
          :loading="diagnosisLoading"
          @open-book-draft="openBookDraftSection"
          @open-profile="openProfileModule"
          @refresh="refreshAiDiagnosis"
        />
      </Card>

      <Card v-if="showGaoxinModules" :bordered="false" title="高企认定评分">
        <GaoxinScorePanel
          :loading="scoreLoading"
          :score="gaoxinScore"
          @open-profile="openProfileModule"
          @refresh="loadGaoxinScore"
        />
      </Card>

      <Card
        v-if="showSchemeScore && schemeScore"
        :bordered="false"
        title="本方案评分"
      >
        <div class="client-declaration-detail__scheme-score">
          <strong
            >{{ schemeScore.totalScore }} / {{ schemeScore.passScore }}</strong
          >
          <Tag :color="schemeScore.passed ? 'green' : 'orange'">
            {{ schemeScore.passed ? '达到方案评分要求' : '未达到方案评分要求' }}
          </Tag>
          <div
            v-for="item in schemeScore.items"
            :key="item.label"
            class="client-declaration-detail__scheme-score-item"
          >
            <span>{{ item.label }}</span>
            <span>{{ item.score }} / {{ item.maxScore }}</span>
          </div>
        </div>
      </Card>

      <Card
        v-if="showGaoxinModules"
        id="gaoxin-book-draft-section"
        :bordered="false"
        title="申报书草稿"
      >
        <GaoxinBookDraftPanel
          :draft="gaoxinBookDraft"
          :loading="bookDraftLoading"
          :saving="bookDraftSaving"
          @open-profile="openProfileModule"
          @refresh="loadGaoxinBookDraft"
          @save="saveGaoxinBookDraft"
        />
      </Card>

      <Card v-if="showExportPackage" :bordered="false" title="材料包导出">
        <GaoxinExportReadinessPanel
          :exporting="exportPackageLoading"
          :loading="exportReadinessLoading"
          :readiness="exportReadiness"
          @export-package="downloadGaoxinExportPackage"
          @open-book-draft="openBookDraftSection"
          @open-profile="openProfileModule"
          @refresh="loadExportReadiness"
        />
      </Card>

      <Card :bordered="false" title="进度与历史">
        <DeclarationFlowPanel :flow="declaration.flow" />
      </Card>
    </template>
  </div>
</template>

<style scoped>
.client-declaration-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.client-declaration-detail__hero {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.client-declaration-detail__eyebrow,
.client-declaration-detail__description {
  margin: 0;
  color: rgb(0 0 0 / 45%);
}

.client-declaration-detail__title {
  margin: 6px 0;
  font-size: 26px;
  font-weight: 600;
}

.client-declaration-detail__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
}

.client-declaration-detail__progress {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.client-declaration-detail__scheme-score {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.client-declaration-detail__scheme-score > strong {
  font-size: 22px;
}

.client-declaration-detail__scheme-score-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.client-declaration-detail__metric {
  padding: 14px;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  background: #fafafa;
}

.client-declaration-detail__metric span {
  display: block;
  margin-bottom: 4px;
  color: rgb(0 0 0 / 45%);
}

.client-declaration-detail__metric strong {
  font-size: 28px;
}

.client-declaration-detail__reject-reason {
  padding: 12px;
  color: #cf1322;
  white-space: pre-wrap;
  background: #fff1f0;
  border: 1px solid #ffa39e;
  border-radius: 10px;
}

@media (max-width: 900px) {
  .client-declaration-detail__hero {
    flex-direction: column;
  }

  .client-declaration-detail__grid {
    grid-template-columns: 1fr;
  }
}
</style>
