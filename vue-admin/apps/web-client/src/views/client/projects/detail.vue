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
  Select,
  Space,
  Tag,
  TypographyParagraph,
  message,
} from 'antdv-next';

import {
  checkClientDeclareProjectMaterialApi,
  createClientDeclarationDraftApi,
  getClientDeclareProjectAiDiagnosisApi,
  getClientDeclareProjectDetailApi,
  getClientDeclareProjectGaoxinScoreApi,
  getClientDeclareProjectSchemeScoreApi,
  getClientDeclareProjectMaterialReadinessApi,
} from '#/api/client';
import type { ClientDeclareProjectApi } from '#/api/client';
import { useClientEnterpriseStore } from '#/store';

import GaoxinAiDiagnosisPanel from './components/gaoxin-ai-diagnosis-panel.vue';
import GaoxinScorePanel from './components/gaoxin-score-panel.vue';
import ProjectMaterialReadinessPanel from './components/project-material-readiness-panel.vue';

defineOptions({ name: 'ClientProjectDetail' });

const route = useRoute();
const router = useRouter();
const store = useClientEnterpriseStore();

const loading = shallowRef(false);
const creating = shallowRef(false);
const diagnosisLoading = shallowRef(false);
const materialReadinessLoading = shallowRef(false);
const scoreLoading = shallowRef(false);
const project = shallowRef<ClientDeclareProjectApi.DeclareProject | null>(null);
const aiDiagnosis =
  shallowRef<ClientDeclareProjectApi.GaoxinAiDiagnosis | null>(null);
const materialReadiness =
  shallowRef<ClientDeclareProjectApi.MaterialReadiness | null>(null);
const gaoxinScore =
  shallowRef<ClientDeclareProjectApi.GaoxinScoreResult | null>(null);
const schemeScore =
  shallowRef<ClientDeclareProjectApi.SchemeScoreResult | null>(null);
const selectedRegionId = shallowRef<string | undefined>(
  typeof route.query.regionId === 'string' ? route.query.regionId : undefined,
);

const projectId = computed(() => String(route.params.id || ''));
const hasMultipleRegions = computed(
  () =>
    new Set(
      project.value?.matchedPolicies
        .map((item) => item.regionId)
        .filter(Boolean),
    ).size > 1,
);
const regionOptions = computed(() => {
  const unique = new Map<string, string>();
  project.value?.matchedPolicies.forEach((policy) => {
    if (policy.regionId) unique.set(policy.regionId, policy.regionName);
  });
  return [...unique].map(([value, label]) => ({ label, value }));
});

const projectHint = computed(() => {
  if (!project.value) {
    return '申报项目详情';
  }

  const regions = project.value.regionNames.join(' / ') || '未指定地区';
  return `${project.value.matchedPolicyCount} 条政策命中 · ${regions}`;
});

const existingDeclaration = computed(
  () => project.value?.existingDeclaration ?? null,
);
const existingDeclarationStatusMeta = computed(() => {
  const status = existingDeclaration.value?.status ?? 'draft';
  const labelMap: Record<string, string> = {
    approved: '已通过',
    cancelled: '已取消',
    completed: '已完成',
    draft: '草稿',
    preparing: '准备中',
    rejected: '已退回',
    reviewing: '审核中',
    submitted: '已提交',
  };
  const colorMap: Record<string, string> = {
    approved: 'green',
    cancelled: 'default',
    completed: 'green',
    draft: 'default',
    preparing: 'blue',
    rejected: 'red',
    reviewing: 'orange',
    submitted: 'purple',
  };
  return {
    color: colorMap[status] ?? 'default',
    label: labelMap[status] ?? status,
  };
});

const canCreateDeclaration = computed(() => {
  const scheme = project.value?.scheme;
  return (
    Boolean(project.value) &&
    !existingDeclaration.value &&
    project.value?.canCreateDeclaration !== false &&
    scheme?.qualification.status !== 'ineligible' &&
    (!hasMultipleRegions.value || Boolean(selectedRegionId.value))
  );
});
const showSchemeScore = computed(
  () => project.value?.scheme?.capabilities.score === true,
);
const showGaoxinModules = computed(
  () => project.value?.scheme?.capabilities.gaoxinScore === true,
);

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
  if (!projectId.value) {
    return;
  }

  materialReadinessLoading.value = true;
  try {
    materialReadiness.value = forceCheck
      ? await checkClientDeclareProjectMaterialApi(
          projectId.value,
          undefined,
          selectedRegionId.value,
        )
      : await getClientDeclareProjectMaterialReadinessApi(
          projectId.value,
          selectedRegionId.value,
        );
  } finally {
    materialReadinessLoading.value = false;
  }
}

async function loadGaoxinScore() {
  if (!projectId.value || !showGaoxinModules.value) {
    return;
  }

  scoreLoading.value = true;
  try {
    gaoxinScore.value = await getClientDeclareProjectGaoxinScoreApi(
      projectId.value,
      selectedRegionId.value,
    );
  } finally {
    scoreLoading.value = false;
  }
}

async function loadSchemeScore() {
  if (!projectId.value || !showSchemeScore.value) {
    return;
  }

  schemeScore.value = await getClientDeclareProjectSchemeScoreApi(
    projectId.value,
    selectedRegionId.value,
  );
}

async function loadAiDiagnosis() {
  if (!projectId.value || !showGaoxinModules.value) {
    return;
  }

  diagnosisLoading.value = true;
  try {
    aiDiagnosis.value = await getClientDeclareProjectAiDiagnosisApi(
      projectId.value,
      selectedRegionId.value,
    );
  } finally {
    diagnosisLoading.value = false;
  }
}

async function loadDetail() {
  if (!projectId.value) {
    return;
  }

  loading.value = true;
  aiDiagnosis.value = null;
  materialReadiness.value = null;
  gaoxinScore.value = null;
  schemeScore.value = null;
  try {
    project.value = await getClientDeclareProjectDetailApi(
      projectId.value,
      selectedRegionId.value,
    );
    const tasks = [loadMaterialReadiness()];
    if (showGaoxinModules.value)
      tasks.push(loadGaoxinScore(), loadAiDiagnosis());
    if (showSchemeScore.value) tasks.push(loadSchemeScore());
    await Promise.all(tasks);
  } finally {
    loading.value = false;
  }
}

async function createDeclarationDraft() {
  if (!project.value) {
    message.warning('未找到可申报项目');
    return;
  }

  creating.value = true;
  try {
    const declaration = await createClientDeclarationDraftApi(
      project.value.id,
      selectedRegionId.value,
    );
    message.success('申报草稿已创建');
    await router.push(`/projects/my/detail/${declaration.id}`);
  } finally {
    creating.value = false;
  }
}

async function refreshAiDiagnosis() {
  await Promise.all([
    loadMaterialReadiness(),
    loadGaoxinScore(),
    ...(showSchemeScore.value ? [loadSchemeScore()] : []),
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
      from: 'project-readiness',
      tab: payload.tabKey,
    },
  });
}

function openExistingDeclaration() {
  if (!existingDeclaration.value) {
    return;
  }

  router.push(`/projects/my/detail/${existingDeclaration.value.id}`);
}

watch([projectId, selectedRegionId], loadDetail, { immediate: true });
</script>

<template>
  <div class="client-project-detail">
    <ClientJourneyTrail />
    <Card :bordered="false" :loading="loading">
      <div class="client-project-detail__hero">
        <div>
          <p class="client-project-detail__eyebrow">
            {{ store.currentCompanyName || '当前企业' }}
          </p>
          <h1 class="client-project-detail__title">
            {{ project?.name || '项目详情' }}
          </h1>
          <p class="client-project-detail__description">
            {{ projectHint }}
          </p>
        </div>
        <Space wrap>
          <Button @click="router.push('/projects/list')">返回列表</Button>
          <Button
            v-if="existingDeclaration"
            type="primary"
            @click="openExistingDeclaration"
          >
            继续申报
          </Button>
          <Button
            v-else
            :disabled="!canCreateDeclaration"
            :loading="creating"
            type="primary"
            @click="createDeclarationDraft"
          >
            发起申报
          </Button>
        </Space>
      </div>
    </Card>

    <Empty v-if="!loading && !project" description="未找到项目详情" />

    <template v-if="project">
      <div class="client-project-detail__grid">
        <Card :bordered="false" title="项目概览">
          <Space class="client-project-detail__tags" wrap>
            <Tag color="blue">{{ project.policyType || '政策项目' }}</Tag>
            <Tag color="green">{{ project.matchedPolicyCount }} 条政策</Tag>
            <Tag v-if="project.nearestDeadline" color="orange">
              截止 {{ project.nearestDeadline }}
            </Tag>
            <Tag v-if="project.subsidyText" color="red">
              奖补 {{ project.subsidyText }}
            </Tag>
            <Tag v-for="regionName in project.regionNames" :key="regionName">
              {{ regionName }}
            </Tag>
            <Tag v-if="project.scheme" color="cyan">
              {{ project.scheme.schemeName }} · {{ project.scheme.version }}
            </Tag>
            <Tag
              v-if="project.scheme"
              :color="
                project.scheme.qualification.status === 'eligible'
                  ? 'green'
                  : 'red'
              "
            >
              {{
                project.scheme.qualification.status === 'eligible'
                  ? '满足前置资格'
                  : '暂不满足前置资格'
              }}
            </Tag>
          </Space>

          <TypographyParagraph class="client-project-detail__content">
            {{ project.basicDescription || '暂无项目说明' }}
          </TypographyParagraph>

          <Descriptions :column="1" bordered size="small">
            <DescriptionsItem label="政策类型">
              {{ project.policyType || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="适用对象">
              {{ project.applicableObjects || '待后台补充' }}
            </DescriptionsItem>
            <DescriptionsItem label="最近截止时间">
              {{ project.nearestDeadline || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="奖补信息">
              {{ project.subsidyText || '-' }}
            </DescriptionsItem>
          </Descriptions>
        </Card>

        <Card :bordered="false" title="申报动作">
          <div class="client-project-detail__action-card">
            <Select
              v-if="hasMultipleRegions"
              v-model:value="selectedRegionId"
              :options="regionOptions"
              placeholder="请选择实际申报地区"
            />
            <p>
              {{
                existingDeclaration
                  ? `当前项目已有申报记录（${existingDeclarationStatusMeta.label}），可以继续完善申报材料。`
                  : project.scheme
                    ? '企业资料不完整也可以先创建申报草稿，系统会在详情里继续诊断缺口。'
                    : '当前地区尚未配置申报方案，可先创建草稿，待后台完成配置后在申报详情中同步应用。'
              }}
            </p>
            <Button
              v-if="existingDeclaration"
              block
              type="primary"
              @click="openExistingDeclaration"
            >
              继续申报
            </Button>
            <Button
              v-else
              block
              :disabled="!canCreateDeclaration"
              :loading="creating"
              type="primary"
              @click="createDeclarationDraft"
            >
              发起申报
            </Button>
            <Button
              block
              :loading="materialReadinessLoading"
              @click="loadMaterialReadiness(true)"
            >
              重新检查材料
            </Button>
          </div>
        </Card>
      </div>

      <Card v-if="showGaoxinModules" :bordered="false" title="AI 申报诊断">
        <GaoxinAiDiagnosisPanel
          :diagnosis="aiDiagnosis"
          :loading="diagnosisLoading"
          @open-profile="openProfileModule"
          @refresh="refreshAiDiagnosis"
        />
      </Card>

      <Card v-if="showGaoxinModules" :bordered="false" title="高企评分测算">
        <GaoxinScorePanel
          :loading="scoreLoading"
          :score="gaoxinScore"
          @open-profile="openProfileModule"
          @refresh="loadGaoxinScore"
        />
      </Card>

      <Card v-if="showSchemeScore" :bordered="false" title="方案评分">
        <div v-if="schemeScore" class="client-project-detail__scheme-score">
          <strong
            >{{ schemeScore.totalScore }} / {{ schemeScore.passScore }}</strong
          >
          <Tag :color="schemeScore.passed ? 'green' : 'orange'">
            {{ schemeScore.passed ? '达到方案评分要求' : '未达到方案评分要求' }}
          </Tag>
          <div
            v-for="item in schemeScore.items"
            :key="item.label"
            class="client-project-detail__scheme-score-item"
          >
            <span>{{ item.label }}</span>
            <span>{{ item.score }} / {{ item.maxScore }}</span>
          </div>
        </div>
        <Empty v-else description="该方案暂未配置评分规则" />
      </Card>

      <Card :bordered="false" title="材料准备度">
        <ProjectMaterialReadinessPanel
          :loading="materialReadinessLoading"
          :readiness="materialReadiness"
          @open-profile="openProfileModule"
          @recheck="loadMaterialReadiness(true)"
        />
      </Card>

      <Card :bordered="false" title="命中政策">
        <Empty
          v-if="project.matchedPolicies.length === 0"
          description="暂无命中政策"
        />
        <div v-else class="client-project-detail__policies">
          <div
            v-for="policy in project.matchedPolicies"
            :key="policy.id"
            class="client-project-detail__policy"
          >
            <div class="client-project-detail__policy-title">
              <strong>{{ policy.title }}</strong>
              <Tag>{{ policy.regionName }}</Tag>
            </div>
            <TypographyParagraph
              :ellipsis="{ rows: 2 }"
              class="client-project-detail__content"
            >
              {{ policy.content || policy.materialText || '暂无政策说明' }}
            </TypographyParagraph>
            <Space wrap>
              <Tag v-if="policy.endDate" color="orange">
                截止 {{ policy.endDate }}
              </Tag>
              <Tag v-if="policy.subsidyText" color="red">
                {{ policy.subsidyText }}
              </Tag>
              <Tag v-if="policy.conditionText">申报条件</Tag>
              <Tag v-if="policy.materialText">材料要求</Tag>
            </Space>
          </div>
        </div>
      </Card>
    </template>
  </div>
</template>

<style scoped>
.client-project-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.client-project-detail__hero {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.client-project-detail__eyebrow,
.client-project-detail__description,
.client-project-detail__content,
.client-project-detail__action-card p {
  margin: 0;
  color: rgb(0 0 0 / 45%);
}

.client-project-detail__title {
  margin: 6px 0;
  font-size: 26px;
  font-weight: 600;
}

.client-project-detail__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
}

.client-project-detail__tags,
.client-project-detail__content {
  margin-bottom: 16px;
}

.client-project-detail__action-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.client-project-detail__scheme-score {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.client-project-detail__scheme-score > strong {
  font-size: 22px;
}

.client-project-detail__scheme-score-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.client-project-detail__policies {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.client-project-detail__policy {
  padding: 14px;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  background: #fff;
}

.client-project-detail__policy-title {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
}

@media (max-width: 900px) {
  .client-project-detail__hero,
  .client-project-detail__policy-title {
    flex-direction: column;
  }

  .client-project-detail__grid {
    grid-template-columns: 1fr;
  }
}
</style>
