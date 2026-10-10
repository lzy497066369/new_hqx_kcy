<script setup lang="ts">
import type {
  DeclarationPresetItem,
  DeclarationPresetType,
  DeclarationSchemeForm,
  PolicyProjectItem,
} from '#/api';

import { computed, reactive, shallowRef, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { Button, Input, Popconfirm, Select, Space, Switch, Table, Tag, message } from 'antdv-next';

import {
  createDeclarationSchemeApi,
  getDeclarationPresetsApi,
  getDeclarationSchemesApi,
  getPolicyRegionsApi,
  publishDeclarationSchemeApi,
  updateDeclarationSchemeApi,
} from '#/api';

type PresetRefs = Record<DeclarationPresetType, DeclarationPresetItem[]>;

type SchemeFormState = {
  capabilities: Record<string, boolean>;
  effectiveEndDate?: string;
  effectiveStartDate?: string;
  flowPresetId?: string;
  materialPresetId?: string;
  qualificationPresetId?: string;
  regionId?: string;
  schemeName: string;
  scorePresetId?: string;
  version: string;
};

const props = defineProps<{ project: PolicyProjectItem }>();
const emit = defineEmits<{ close: [] }>();

const schemes = shallowRef<Awaited<ReturnType<typeof getDeclarationSchemesApi>>>([]);
const regions = shallowRef<Array<{ id: string; name: string }>>([]);
const presets = shallowRef<PresetRefs>({ enterprise: [], flow: [], material: [], qualification: [], score: [] });
const loading = shallowRef(false);
const saving = shallowRef(false);
const editingId = shallowRef<string>();

const defaults = (): SchemeFormState => ({
  capabilities: { exportPackage: false, gaoxinScore: false, score: true },
  schemeName: '',
  version: 'v1',
});
const form = reactive<SchemeFormState>(defaults());

const regionOptions = computed(() => [
  { label: '项目默认方案', value: '__default__' },
  ...regions.value.map((region) => ({ label: region.name, value: region.id })),
]);
const presetOptions = (type: DeclarationPresetType) => computed(() =>
  presets.value[type]
    .filter((item) => item.status === 'published')
    .map((item) => ({ label: `${item.name} · ${item.version}`, value: item.id })),
);
const qualificationOptions = presetOptions('qualification');
const materialOptions = presetOptions('material');
const scoreOptions = presetOptions('score');
const flowOptions = presetOptions('flow');

const selectedPresetSummary = computed(() => [
  ['准入条件预设', 'qualification', form.qualificationPresetId],
  ['材料清单预设', 'material', form.materialPresetId],
  ['评分模型预设', 'score', form.scorePresetId],
  ['流程模板预设', 'flow', form.flowPresetId],
].map(([label, type, id]) => ({
  label,
  value: id ? presets.value[type as DeclarationPresetType].find((item) => item.id === id)?.name ?? '已选择版本' : '未配置',
})));

watch(
  () => props.project.id,
  async () => {
    await Promise.all([loadRegions(), loadPresets(), refresh()]);
    resetForm();
  },
  { immediate: true },
);

function resetForm() {
  editingId.value = undefined;
  Object.assign(form, {
    ...defaults(),
    regionId: '__default__',
    schemeName: `${props.project.name}默认地区申报方案`,
  });
}

function editScheme(item: Awaited<ReturnType<typeof getDeclarationSchemesApi>>[number]) {
  if (item.status === 'published') {
    message.warning('已发布方案需要新建版本后再调整');
    return;
  }
  editingId.value = item.id;
  Object.assign(form, {
    capabilities: { ...item.capabilities },
    effectiveEndDate: item.effectiveEndDate ?? undefined,
    effectiveStartDate: item.effectiveStartDate ?? undefined,
    flowPresetId: item.flowPresetId ?? undefined,
    materialPresetId: item.materialPresetId ?? undefined,
    qualificationPresetId: item.qualificationPresetId ?? undefined,
    regionId: item.regionId ?? '__default__',
    schemeName: item.schemeName,
    scorePresetId: item.scorePresetId ?? undefined,
    version: item.version,
  });
}

function createVersion(item: Awaited<ReturnType<typeof getDeclarationSchemesApi>>[number]) {
  editingId.value = undefined;
  Object.assign(form, {
    capabilities: { ...item.capabilities },
    effectiveEndDate: item.effectiveEndDate ?? undefined,
    effectiveStartDate: item.effectiveStartDate ?? undefined,
    flowPresetId: item.flowPresetId ?? undefined,
    materialPresetId: item.materialPresetId ?? undefined,
    qualificationPresetId: item.qualificationPresetId ?? undefined,
    regionId: item.regionId ?? '__default__',
    schemeName: item.schemeName,
    scorePresetId: item.scorePresetId ?? undefined,
    version: nextVersion(item.version),
  });
}

async function loadRegions() {
  regions.value = (await getPolicyRegionsApi()).map((region) => ({ id: region.id, name: region.name }));
}

async function loadPresets() {
  const [enterprise, qualification, material, score, flow] = await Promise.all([
    getDeclarationPresetsApi('enterprise'),
    getDeclarationPresetsApi('qualification'),
    getDeclarationPresetsApi('material'),
    getDeclarationPresetsApi('score'),
    getDeclarationPresetsApi('flow'),
  ]);
  presets.value = { enterprise, qualification, material, score, flow };
}

async function refresh() {
  loading.value = true;
  try {
    schemes.value = await getDeclarationSchemesApi(props.project.id);
  } finally {
    loading.value = false;
  }
}

function toPayload(): DeclarationSchemeForm {
  if (!form.schemeName.trim()) throw new Error('方案名称不能为空');
  const required: Array<[keyof SchemeFormState, string]> = [
    ['qualificationPresetId', '准入条件预设'],
    ['materialPresetId', '材料清单预设'],
    ['scorePresetId', '评分模型预设'],
    ['flowPresetId', '流程模板预设'],
  ];
  const missing = required.find(([field]) => !form[field]);
  if (missing) throw new Error(`请选择${missing[1]}`);
  return {
    capabilities: { ...form.capabilities },
    effectiveEndDate: form.effectiveEndDate || null,
    effectiveStartDate: form.effectiveStartDate || null,
    flowPresetId: form.flowPresetId,
    materialPresetId: form.materialPresetId,
    qualificationPresetId: form.qualificationPresetId,
    regionId: form.regionId === '__default__' ? null : form.regionId,
    schemeName: form.schemeName.trim(),
    scorePresetId: form.scorePresetId,
    version: form.version.trim() || 'v1',
  };
}

async function save() {
  saving.value = true;
  try {
    const payload = toPayload();
    if (editingId.value) await updateDeclarationSchemeApi(editingId.value, payload);
    else await createDeclarationSchemeApi(props.project.id, payload);
    message.success('地区申报方案草稿已保存');
    await refresh();
    resetForm();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存地区申报方案失败');
  } finally {
    saving.value = false;
  }
}

async function publish(id: string) {
  try {
    await publishDeclarationSchemeApi(id);
    message.success('地区申报方案已发布');
    await refresh();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '发布方案失败');
  }
}

function nextVersion(value: string): string {
  const match = /^v(\d+)$/iu.exec(value.trim());
  return match ? `v${Number(match[1]) + 1}` : `${value}-next`;
}

function updateGaoxinScoreCapability(value: unknown) {
  form.capabilities.gaoxinScore = value === true;
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-5">
      <div>
        <Button type="text" @click="emit('close')">
          <IconifyIcon icon="lucide:arrow-left" class="mr-1" />
          返回统一政策项目
        </Button>
        <div class="mt-3 text-lg font-semibold text-gray-900">{{ props.project.name }} · 地区申报方案</div>
        <p class="mt-1 text-sm text-gray-500">这里只组合规则版本并发布，不在方案页直接编辑评分、材料和流程细节。</p>
      </div>
      <Space>
        <Button @click="resetForm">新建方案版本</Button>
        <Button :loading="saving" type="primary" @click="save">保存草稿</Button>
      </Space>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <Input v-model:value="form.schemeName" placeholder="地区申报方案名称" />
      <Input v-model:value="form.version" placeholder="版本，例如 v1" />
      <Select v-model:value="form.regionId" :options="regionOptions" class="md:col-span-2" placeholder="适用地区" />
      <Input v-model:value="form.effectiveStartDate" type="date" />
      <Input v-model:value="form.effectiveEndDate" type="date" />
    </div>

    <div class="grid gap-3 border-y border-gray-100 py-4 md:grid-cols-2">
      <Select v-model:value="form.qualificationPresetId" :options="qualificationOptions" class="md:col-span-2" placeholder="准入条件预设" />
      <Select v-model:value="form.materialPresetId" :options="materialOptions" placeholder="材料清单预设" />
      <Select v-model:value="form.scorePresetId" :options="scoreOptions" placeholder="评分模型预设" />
      <Select v-model:value="form.flowPresetId" :options="flowOptions" class="md:col-span-2" placeholder="流程模板预设" />
    </div>

    <div class="flex flex-wrap items-center gap-5 text-sm text-gray-600">
      <span class="font-medium text-gray-900">方案能力</span>
      <span class="flex items-center gap-2"><Switch v-model:checked="form.capabilities.score" size="small" />规则评分</span>
      <span class="flex items-center gap-2"><Switch :checked="form.capabilities.gaoxinScore" size="small" @update:checked="updateGaoxinScoreCapability" />高企测算</span>
      <span class="flex items-center gap-2"><Switch v-model:checked="form.capabilities.exportPackage" size="small" />导出申报包</span>
    </div>

    <div class="border-y border-gray-100 py-4">
      <div class="mb-3 flex items-center justify-between">
        <div>
          <div class="font-medium text-gray-900">发布前检查</div>
          <p class="mt-1 text-xs text-gray-500">发布时将把以下已选规则版本冻结到地区方案快照。</p>
        </div>
        <Tag color="blue">{{ form.version || 'v1' }}</Tag>
      </div>
      <div class="grid gap-2 md:grid-cols-4">
        <div v-for="item in selectedPresetSummary" :key="item.label" class="rounded border border-gray-100 bg-gray-50 p-3">
          <div class="text-xs text-gray-500">{{ item.label }}</div>
          <div class="mt-1 text-sm font-medium text-gray-900">{{ item.value }}</div>
        </div>
      </div>
    </div>

    <Table
      :columns="[
        { dataIndex: 'schemeName', title: '方案' },
        { dataIndex: 'version', title: '版本', width: 90 },
        { dataIndex: 'status', title: '状态', width: 100 },
        { key: 'action', title: '操作', width: 220 },
      ]"
      :data-source="schemes"
      :loading="loading"
      :pagination="false"
      row-key="id"
      :scroll="{ x: 700 }"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <Tag v-if="column.dataIndex === 'status'" :color="record.status === 'published' ? 'green' : 'default'">
          {{ record.status === 'published' ? '已发布' : '草稿' }}
        </Tag>
        <Space v-else-if="column.key === 'action'">
          <Button v-if="record.status === 'draft'" size="small" @click="editScheme(record)">编辑草稿</Button>
          <Button v-else size="small" @click="createVersion(record)">新建版本</Button>
          <Popconfirm title="发布后会下线同地区的旧发布方案" @confirm="publish(record.id)">
            <Button :disabled="record.status === 'published'" size="small" type="primary">发布</Button>
          </Popconfirm>
        </Space>
      </template>
    </Table>
  </div>
</template>
