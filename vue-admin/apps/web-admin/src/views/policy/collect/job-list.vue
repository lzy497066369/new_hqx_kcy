<script setup lang="ts">
import type {
  PolicyCollectJob,
  PolicyCollectJobForm,
  PolicyProjectItem,
  PolicyRegionItem,
} from '#/api';
import type { VbenFormSchema } from '#/adapter/form';

import { computed, nextTick, onMounted, reactive, shallowRef } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Card, Empty, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createPolicyCollectJobApi,
  deletePolicyCollectJobApi,
  disablePolicyCollectJobApi,
  enablePolicyCollectJobApi,
  getPolicyCollectJobsApi,
  getPolicyProjectsApi,
  getPolicyRegionTreeApi,
  runAiSearchHealthCheck,
  runPolicyCollectJobApi,
} from '#/api';
import {
  confirmAction,
  showActionError,
  showActionFailure,
  showActionSuccess,
} from '../../system/shared/action-feedback';

const scheduleOptions = [
  { label: '不启用定时', value: '' },
  { label: '1天', value: 'P1D' },
  { label: '1周', value: 'P1W' },
  { label: '2周', value: 'P2W' },
  { label: '1月', value: 'P1M' },
  { label: '2个月', value: 'P2M' },
  { label: '3个月', value: 'P3M' },
  { label: '6个月', value: 'P6M' },
  { label: '1年', value: 'P1Y' },
];

const policyCategoryOptions = [
  { label: '全部', value: 'all' },
  { label: '奖补情况', value: 'reward' },
  { label: '公示情况', value: 'publicity' },
  { label: '申报通知', value: 'notice' },
  { label: '其他', value: 'other' },
];

const regionScopeOptions = [
  { label: '全部', value: 'all' },
  { label: '省', value: 'province' },
  { label: '市', value: 'city' },
  { label: '区县', value: 'district' },
];

const router = useRouter();
const pageLoading = shallowRef(false);
const runningJobId = shallowRef<null | string>(null);
const searchChecking = shallowRef(false);
const syncingForm = shallowRef(false);
const togglingJobId = shallowRef<null | string>(null);
const jobs = shallowRef<PolicyCollectJob[]>([]);
const projects = shallowRef<PolicyProjectItem[]>([]);
const regionTree = shallowRef<PolicyRegionItem[]>([]);
const formPreview = reactive({
  cronExpression: '',
  name: '',
  policyCategory: 'notice',
  projectId: '',
  cityId: '',
  districtId: '',
  provinceId: '',
  regionScope: 'district',
});

type SelectOption = { label: string; value: string };
type PolicyCollectJobFormValues = PolicyCollectJobForm & {
  cityId?: string;
  districtId?: string;
  provinceId?: string;
};

const selectedProject = computed(() =>
  projects.value.find((project) => project.id === formPreview.projectId),
);

const projectKeywordText = computed(() => {
  const project = selectedProject.value;
  if (!project) {
    return '';
  }
  return [
    project.name,
    project.policyType,
    project.applicableObjects,
    project.basicDescription,
  ]
    .filter((item): item is string => Boolean(item?.trim()))
    .join('；');
});

const provinceOptions = computed(() => regionTree.value);
const projectSelectOptions = computed<SelectOption[]>(() =>
  projects.value.map((project) => ({ label: project.name, value: project.id })),
);
const provinceSelectOptions = computed<SelectOption[]>(() =>
  provinceOptions.value.map((region) => ({ label: region.name, value: region.id })),
);
const cityOptions = computed(() => {
  return (
    provinceOptions.value.find((item) => item.id === formPreview.provinceId)
      ?.children ?? []
  );
});
const citySelectOptions = computed<SelectOption[]>(() =>
  cityOptions.value.map((region) => ({ label: region.name, value: region.id })),
);
const districtOptions = computed(() => {
  return (
    cityOptions.value.find((item) => item.id === formPreview.cityId)?.children ?? []
  );
});
const districtSelectOptions = computed<SelectOption[]>(() =>
  districtOptions.value.map((region) => ({ label: region.name, value: region.id })),
);

const jobStats = computed(() => {
  const enabledCount = jobs.value.filter((job) => job.enabled === 1).length;
  const scheduledCount = jobs.value.filter((job) => job.cronExpression).length;
  const neverRunCount = jobs.value.filter((job) => !job.lastRunAt).length;
  return {
    enabledCount,
    neverRunCount,
    scheduledCount,
    totalCount: jobs.value.length,
  };
});

const createJobFormSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'Input',
    fieldName: 'name',
    label: '任务名称',
  },
  {
    component: 'Select',
    componentProps: {
      options: projectSelectOptions.value,
    },
    fieldName: 'projectId',
    label: '统一政策项目',
    rules: 'selectRequired',
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: policyCategoryOptions,
      optionType: 'button',
    },
    fieldName: 'policyCategory',
    label: '政策文件分类',
    rules: 'selectRequired',
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: regionScopeOptions,
      optionType: 'button',
    },
    fieldName: 'regionScope',
    label: '采集区域范围',
    rules: 'selectRequired',
  },
  {
    component: 'Select',
    componentProps: {
      options: provinceSelectOptions.value,
    },
    dependencies: {
      show: (values) => values.regionScope !== 'all',
      triggerFields: ['regionScope'],
    },
    fieldName: 'provinceId',
    label: '省份',
    rules: 'selectRequired',
  },
  {
    component: 'Select',
    componentProps: {
      options: citySelectOptions.value,
    },
    dependencies: {
      show: (values) => ['city', 'district'].includes(values.regionScope),
      triggerFields: ['regionScope'],
    },
    fieldName: 'cityId',
    label: '城市',
    rules: 'selectRequired',
  },
  {
    component: 'Select',
    componentProps: {
      options: districtSelectOptions.value,
    },
    dependencies: {
      show: (values) => values.regionScope === 'district',
      triggerFields: ['regionScope'],
    },
    fieldName: 'districtId',
    label: '区县',
    rules: 'selectRequired',
  },
  {
    component: 'Select',
    componentProps: {
      options: scheduleOptions,
    },
    fieldName: 'cronExpression',
    label: '定时周期',
  },
]);

const [CreateJobForm, createJobFormApi] = useVbenForm({
  commonConfig: {
    formItemClass: 'col-span-2 md:col-span-1',
  },
  handleValuesChange(values, fieldsChanged) {
    syncPreviewValues(values as PolicyCollectJobFormValues);
    void syncRegionDependentFields(
      values as PolicyCollectJobFormValues,
      fieldsChanged,
    );
  },
  layout: 'vertical',
  schema: createJobFormSchema.value,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2 gap-x-4',
});

const [CreateModal, createModalApi] = useVbenModal({
  async onConfirm() {
    await createJob();
  },
  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }
    await resetCreateForm();
  },
});

onMounted(() => {
  loadPage();
});

async function loadJobs() {
  const jobResult = await getPolicyCollectJobsApi({ page: 1, pageSize: 50 });
  jobs.value = jobResult.items;
}

async function loadBaseData() {
  const [projectResult, regionResult] = await Promise.all([
    getPolicyProjectsApi({ enabled: 1, page: 1, pageSize: 200 }),
    getPolicyRegionTreeApi({ status: 1 }),
  ]);
  projects.value = projectResult.items;
  regionTree.value = regionResult;
}

async function loadPage() {
  pageLoading.value = true;
  try {
    await Promise.all([loadJobs(), loadBaseData()]);
    await resetCreateForm();
  } catch (error) {
    showActionFailure(error);
  } finally {
    pageLoading.value = false;
  }
}

async function createJob() {
  const { valid } = await createJobFormApi.validate();
  if (!valid) {
    return;
  }

  const values = await createJobFormApi.getValues<PolicyCollectJobFormValues>();
  const regionId = resolveSelectedRegionId(values);
  if (!values.projectId || (values.regionScope !== 'all' && !regionId)) {
    showActionError('请选择统一政策项目和采集区域');
    return;
  }
  createModalApi.lock();
  try {
    await createPolicyCollectJobApi({
      cronExpression: values.cronExpression,
      departmentName: undefined,
      enabled: 0,
      keywords: projectKeywordText.value,
      name: values.name,
      policyCategory: values.policyCategory,
      projectId: values.projectId,
      regionId,
      regionScope: values.regionScope,
    });
    createModalApi.close();
    await loadJobs();
    showActionSuccess('政策采集任务已创建');
  } catch (error) {
    showActionFailure(error);
  } finally {
    createModalApi.unlock();
  }
}

function openCreateModal() {
  createModalApi.open();
}

async function checkAiSearchHealth() {
  searchChecking.value = true;
  try {
    const result = await runAiSearchHealthCheck();
    if (result.searchAvailable) {
      showActionSuccess(`AI 联网搜索自检通过，来源 ${result.sources.length} 个`);
      return;
    }
    showActionError(
      `AI 联网搜索自检未通过：${result.warnings.join('；') || '未返回可核验来源'}`,
    );
  } catch (error) {
    showActionFailure(error);
  } finally {
    searchChecking.value = false;
  }
}

async function runJob(row: PolicyCollectJob) {
  runningJobId.value = row.id;
  try {
    const run = await runPolicyCollectJobApi(row.id);
    showActionSuccess('采集任务已开始执行，可在采集结果中查看进度');
    router
      .push({ path: '/policy/collect-runs', query: { runId: run.id } })
      .catch(() => {});
  } catch (error) {
    showActionFailure(error);
  } finally {
    runningJobId.value = null;
  }
}

async function toggleJob(row: PolicyCollectJob) {
  togglingJobId.value = row.id;
  try {
    if (row.enabled === 1) {
      await disablePolicyCollectJobApi(row.id);
      showActionSuccess('采集任务已停用');
    } else {
      await enablePolicyCollectJobApi(row.id);
      showActionSuccess('采集任务已启用');
    }
    await loadJobs();
  } catch (error) {
    showActionFailure(error);
  } finally {
    togglingJobId.value = null;
  }
}

function deleteJob(row: PolicyCollectJob) {
  confirmAction(
    `确认删除采集任务“${row.name}”？历史执行记录和 AI 记录会保留。`,
    '删除采集任务',
  )
    .then(async () => {
      await deletePolicyCollectJobApi(row.id);
      showActionSuccess('采集任务已删除');
      await loadJobs();
    })
    .catch((error) => {
      if (error instanceof Error && error.message === 'cancel') {
        return;
      }
      showActionFailure(error);
    });
}

async function resetCreateForm() {
  const province = provinceOptions.value[0];
  const city = province?.children?.[0];
  const district = city?.children?.[0];
  const values: PolicyCollectJobFormValues = {
    cronExpression: '',
    name: '',
    policyCategory: 'notice',
    projectId: projects.value[0]?.id ?? '',
    provinceId: province?.id ?? '',
    cityId: city?.id ?? '',
    districtId: district?.id ?? '',
    regionScope: 'district',
  };
  syncPreviewValues(values);
  createJobFormApi.resetForm();
  createJobFormApi.updateSchema(createJobFormSchema.value);
  await nextTick();
  await createJobFormApi.setValues(values);
}

function formatSchedule(value?: null | string) {
  return scheduleOptions.find((item) => item.value === value)?.label ?? value ?? '不启用';
}

function formatCategory(value?: null | string) {
  return policyCategoryOptions.find((item) => item.value === value)?.label ?? value ?? '申报通知';
}

function formatRegionScope(value?: null | string) {
  return regionScopeOptions.find((item) => item.value === value)?.label ?? value ?? '区县';
}

function syncPreviewValues(values: PolicyCollectJobFormValues) {
  formPreview.cronExpression = values.cronExpression ?? '';
  formPreview.name = values.name ?? '';
  formPreview.policyCategory = values.policyCategory ?? 'notice';
  formPreview.projectId = values.projectId ?? '';
  formPreview.regionScope = values.regionScope ?? 'district';
  formPreview.provinceId = values.provinceId ?? '';
  formPreview.cityId = values.cityId ?? '';
  formPreview.districtId = values.districtId ?? '';
}

async function syncRegionDependentFields(
  values: PolicyCollectJobFormValues,
  fieldsChanged: string[],
) {
  if (syncingForm.value) {
    return;
  }
  const nextValues: Partial<PolicyCollectJobFormValues> = {};

  if (
    fieldsChanged.includes('regionScope') ||
    fieldsChanged.includes('provinceId')
  ) {
    const city = getCityItems(values.provinceId)[0];
    const district = getDistrictItems(city?.id)[0];
    nextValues.cityId = city?.id ?? '';
    nextValues.districtId = district?.id ?? '';
  } else if (fieldsChanged.includes('cityId')) {
    const district = getDistrictItems(values.cityId)[0];
    nextValues.districtId = district?.id ?? '';
  }

  if (Object.keys(nextValues).length === 0) {
    return;
  }

  syncingForm.value = true;
  try {
    const mergedValues = { ...values, ...nextValues };
    syncPreviewValues(mergedValues);
    createJobFormApi.updateSchema(createJobFormSchema.value);
    await createJobFormApi.setValues(nextValues, false, false);
  } finally {
    syncingForm.value = false;
  }
}

function getCityItems(provinceId?: null | string) {
  return (
    provinceOptions.value.find((item) => item.id === provinceId)?.children ?? []
  );
}

function getDistrictItems(cityId?: null | string) {
  return cityOptions.value.find((item) => item.id === cityId)?.children ?? [];
}

function resolveSelectedRegionId(values: PolicyCollectJobFormValues) {
  if (values.regionScope === 'all') {
    return null;
  }
  if (values.regionScope === 'province') {
    return values.provinceId || null;
  }
  if (values.regionScope === 'city') {
    return values.cityId || null;
  }
  return values.districtId || null;
}
</script>

<template>
  <Page auto-content-height>
    <div class="policy-collect-page">
      <div class="policy-collect-header">
        <div>
          <h2 class="policy-collect-title">政策采集任务</h2>
          <div class="policy-collect-subtitle">
            按统一政策项目、区域范围和政策分类配置自动采集任务。
          </div>
        </div>
        <div class="policy-collect-actions">
          <Button :loading="searchChecking" @click="checkAiSearchHealth">
            <IconifyIcon icon="lucide:radar" class="size-4" />
            联网搜索自检
          </Button>
          <Button type="primary" @click="openCreateModal">
            <IconifyIcon icon="lucide:plus" class="size-4" />
            创建任务
          </Button>
        </div>
      </div>

      <div class="policy-collect-stat-grid">
        <div class="policy-collect-stat">
          <span>任务总数</span>
          <strong>{{ jobStats.totalCount }}</strong>
        </div>
        <div class="policy-collect-stat">
          <span>已启用</span>
          <strong>{{ jobStats.enabledCount }}</strong>
        </div>
        <div class="policy-collect-stat">
          <span>配置定时</span>
          <strong>{{ jobStats.scheduledCount }}</strong>
        </div>
        <div class="policy-collect-stat">
          <span>未执行</span>
          <strong>{{ jobStats.neverRunCount }}</strong>
        </div>
      </div>

      <CreateModal class="w-full max-w-220" title="创建政策采集任务">
        <CreateJobForm class="policy-collect-form mx-4" />
        <div class="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <div class="font-medium text-slate-900">采集关键词</div>
          <div class="mt-1 line-clamp-2">
            {{ formatCategory(formPreview.policyCategory) }} /
            {{ formatRegionScope(formPreview.regionScope) }} /
            {{ projectKeywordText || '请选择统一政策项目后自动生成' }}
          </div>
        </div>
        <div class="mt-3 text-xs text-slate-500">
          政策分类和采集区域范围相互独立；区域可选全部、省、市或区县；定时周期可选择 1天 到 1年。
        </div>
      </CreateModal>

      <div class="policy-collect-list">
        <Empty v-if="jobs.length === 0 && !pageLoading" description="暂无政策采集任务" />
        <Card
          v-for="job in jobs"
          :key="job.id"
          class="policy-collect-card"
          variant="borderless"
        >
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="policy-collect-card-title">{{ job.name }}</h3>
                <Tag :color="job.enabled === 1 ? 'success' : 'default'">
                  {{ job.enabled === 1 ? '已启用' : '未启用' }}
                </Tag>
              </div>
              <div class="policy-collect-card-meta">
                {{ job.policyCategoryName }} / {{ job.regionScopeName }}：{{ job.regionName }} /
                {{ job.projectName }} / {{ formatSchedule(job.cronExpression) }}
              </div>
              <div class="policy-collect-card-note">
                最近执行：{{ job.lastRunAt || '暂无' }}；下次执行：{{ job.nextRunAt || '未配置' }}
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button @click="router.push('/policy/collect-runs')">
                采集结果
              </Button>
              <Button :loading="togglingJobId === job.id" @click="toggleJob(job)">
                {{ job.enabled === 1 ? '停用' : '启用' }}
              </Button>
              <Button :loading="runningJobId === job.id" type="primary" @click="runJob(job)">
                手动执行
              </Button>
              <Button danger @click="deleteJob(job)">
                删除
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </Page>
</template>

<style src="./collect-page.css"></style>
