<script setup lang="ts">
import type { DeclarationPresetItem, DeclarationPresetType } from '#/api';
import type {
  FlowTemplate,
  EnterprisePresetConfig,
  QualificationRuleConfig,
  SchemeMaterialRule,
  ScoreRuleConfig,
} from '../project/modules/declaration-scheme-types';

import { computed, reactive, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import { Button, Input, Popconfirm, Space, Table, Tag, message } from 'antdv-next';

import {
  createDeclarationPresetApi,
  getDeclarationPresetsApi,
  publishDeclarationPresetApi,
  updateDeclarationPresetApi,
} from '#/api';

import EnterprisePresetEditor from '../project/modules/enterprise-preset-editor.vue';
import FlowTemplateEditor from '../project/modules/flow-template-editor.vue';
import QualificationRuleEditor from '../project/modules/qualification-rule-editor.vue';
import SchemeMaterialRuleEditor from '../project/modules/scheme-material-rule-editor.vue';
import ScoreRuleEditor from '../project/modules/score-rule-editor.vue';

const props = defineProps<{ presetType: DeclarationPresetType }>();

const config = computed(() => ({
  enterprise: { title: '企业预设' },
  flow: { title: '流程模板预设' },
  material: { title: '材料清单预设' },
  qualification: { title: '资格条件预设' },
  score: { title: '评分模型预设' },
}[props.presetType]));

const rows = shallowRef<DeclarationPresetItem[]>([]);
const qualificationOptions = shallowRef<Array<{ label: string; value: string }>>([]);
const loading = shallowRef(false);
const saving = shallowRef(false);
const editing = shallowRef(false);
const editingId = shallowRef<string>();
const payload = shallowRef<unknown>(defaultPayload());
const form = reactive({ description: '', name: '', version: 'v1' });

const enterprisePayload = computed<EnterprisePresetConfig>({
  get: () => normalizeEnterprise(payload.value),
  set: (value) => { payload.value = value; },
});
const qualificationPayload = computed<QualificationRuleConfig>({
  get: () => normalizeQualification(payload.value),
  set: (value) => { payload.value = value; },
});
const materialPayload = computed<SchemeMaterialRule[]>({
  get: () => normalizeMaterial(payload.value),
  set: (value) => { payload.value = value; },
});
const scorePayload = computed<ScoreRuleConfig>({
  get: () => normalizeScore(payload.value),
  set: (value) => { payload.value = value; },
});
const flowPayload = computed<FlowTemplate>({
  get: () => normalizeFlow(payload.value),
  set: (value) => { payload.value = value; },
});

function defaultPayload(): unknown {
  switch (props.presetType) {
    case 'enterprise':
      return { mode: 'all', rules: [] } satisfies EnterprisePresetConfig;
    case 'qualification':
      return { mode: 'all', rules: [] } satisfies QualificationRuleConfig;
    case 'material':
      return [] satisfies SchemeMaterialRule[];
    case 'score':
      return { items: [], passScore: 0 } satisfies ScoreRuleConfig;
    case 'flow':
      return {
        nodes: [
          { code: 'precheck', name: '预检', type: 'auto' },
          { code: 'enterprise_submit', name: '企业提交', role: 'enterprise', type: 'manual' },
          { code: 'review', name: '顾问审核', role: 'consultant', type: 'manual' },
          { code: 'completed', name: '完成', type: 'end' },
        ],
      } satisfies FlowTemplate;
  }
}

function openCreate() {
  editingId.value = undefined;
  Object.assign(form, { description: '', name: '', version: 'v1' });
  payload.value = defaultPayload();
  editing.value = true;
}

function openEdit(row: DeclarationPresetItem) {
  if (row.status === 'published') {
    message.warning('已发布预设需要新建版本后再修改');
    return;
  }
  editingId.value = row.id;
  Object.assign(form, {
    description: row.description ?? '',
    name: row.name,
    version: row.version,
  });
  payload.value = row.payload;
  editing.value = true;
}

function createVersion(row: DeclarationPresetItem) {
  editingId.value = undefined;
  Object.assign(form, {
    description: row.description ?? '',
    name: row.name,
    version: nextVersion(row.version),
  });
  payload.value = row.payload;
  editing.value = true;
}

function closeEditor() {
  editing.value = false;
}

async function refresh() {
  loading.value = true;
  try {
    rows.value = await getDeclarationPresetsApi(props.presetType);
  } finally {
    loading.value = false;
  }
}

async function loadQualificationOptions() {
  const presets = await getDeclarationPresetsApi('qualification');
  qualificationOptions.value = presets
    .filter((item) => item.status === 'published')
    .map((item) => ({ label: `${item.name} (${item.version})`, value: item.id }));
}

async function save() {
  if (!form.name.trim()) {
    message.warning('请填写预设名称');
    return;
  }
  saving.value = true;
  try {
    const data = {
      description: form.description || null,
      name: form.name.trim(),
      payload: payload.value,
      presetType: props.presetType,
      version: form.version.trim() || 'v1',
    };
    if (editingId.value) await updateDeclarationPresetApi(editingId.value, data);
    else await createDeclarationPresetApi(data);
    message.success('预设草稿已保存');
    editing.value = false;
    await refresh();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存预设失败');
  } finally {
    saving.value = false;
  }
}

async function publish(id: string) {
  try {
    await publishDeclarationPresetApi(id);
    message.success('预设已发布');
    await refresh();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '发布预设失败');
  }
}

function normalizeEnterprise(value: unknown): EnterprisePresetConfig {
  const item = value as Partial<EnterprisePresetConfig>;
  return { mode: item?.mode === 'any' ? 'any' : 'all', rules: Array.isArray(item?.rules) ? item.rules : [] };
}

function normalizeQualification(value: unknown): QualificationRuleConfig {
  const item = value as Partial<QualificationRuleConfig>;
  return { mode: item?.mode === 'any' ? 'any' : 'all', rules: Array.isArray(item?.rules) ? item.rules : [] };
}


function normalizeMaterial(value: unknown): SchemeMaterialRule[] {
  return Array.isArray(value) ? value as SchemeMaterialRule[] : [];
}

function normalizeScore(value: unknown): ScoreRuleConfig {
  const item = value as Partial<ScoreRuleConfig>;
  return { items: Array.isArray(item?.items) ? item.items : [], passScore: Number(item?.passScore ?? 0) };
}

function normalizeFlow(value: unknown): FlowTemplate {
  const item = value as Partial<FlowTemplate>;
  return { nodes: Array.isArray(item?.nodes) ? item.nodes : [] };
}

function nextVersion(value: string): string {
  const match = /^v(\d+)$/iu.exec(value.trim());
  return match ? `v${Number(match[1]) + 1}` : `${value}-next`;
}

void Promise.all([refresh(), loadQualificationOptions()]);
</script>

<template>
  <Page auto-content-height>
    <div v-if="editing" class="space-y-6">
      <div class="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <Button type="text" @click="closeEditor">
            <IconifyIcon icon="lucide:arrow-left" class="mr-1" />
            返回{{ config.title }}列表
          </Button>
          <div class="mt-3 text-lg font-semibold text-gray-900">
            {{ editingId ? '编辑' : '新建' }}{{ config.title }}
          </div>
          <p class="mt-1 text-sm text-gray-500">独立维护规则版本，发布后由地区申报方案引用。</p>
        </div>
        <Button :loading="saving" type="primary" @click="save">保存草稿</Button>
      </div>

      <div class="space-y-5">
        <div class="grid gap-3 md:grid-cols-2">
          <Input v-model:value="form.name" placeholder="预设名称" />
          <Input v-model:value="form.version" placeholder="版本，例如 v1" />
          <Input.TextArea v-model:value="form.description" class="md:col-span-2" :rows="2" placeholder="适用说明" />
        </div>

        <div class="border-t border-gray-100 pt-5">
          <EnterprisePresetEditor v-if="presetType === 'enterprise'" v-model="enterprisePayload" />
          <QualificationRuleEditor v-else-if="presetType === 'qualification'" v-model="qualificationPayload" />
          <SchemeMaterialRuleEditor v-else-if="presetType === 'material'" v-model="materialPayload" />
          <ScoreRuleEditor v-else-if="presetType === 'score'" v-model="scorePayload" />
          <FlowTemplateEditor v-else-if="presetType === 'flow'" v-model="flowPayload" :qualification-options="qualificationOptions" />
        </div>

        <div class="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button @click="closeEditor">取消</Button>
          <Button :loading="saving" type="primary" @click="save">保存草稿</Button>
        </div>
      </div>
    </div>

    <template v-else>
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <div class="text-base font-semibold text-gray-900">{{ config.title }}</div>
          <div class="mt-1 text-sm text-gray-500">已发布版本可被地区申报方案引用，修改请新建版本。</div>
        </div>
        <Button type="primary" @click="openCreate">
          <Plus class="size-4" />
          新建预设
        </Button>
      </div>

      <Table
        :columns="[
          { dataIndex: 'name', title: '预设名称' },
          { dataIndex: 'version', title: '版本', width: 90 },
          { dataIndex: 'description', title: '适用说明' },
          { dataIndex: 'status', title: '状态', width: 100 },
          { dataIndex: 'updateTime', title: '更新时间', width: 180 },
          { key: 'action', title: '操作', width: 180 },
        ]"
        :data-source="rows"
        :loading="loading"
        row-key="id"
        :scroll="{ x: 980 }"
      >
        <template #bodyCell="{ column, record }">
          <Tag v-if="column.dataIndex === 'status'" :color="record.status === 'published' ? 'green' : 'default'">
            {{ record.status === 'published' ? '已发布' : '草稿' }}
          </Tag>
          <Space v-else-if="column.key === 'action'">
            <Button v-if="record.status === 'draft'" size="small" @click="openEdit(record)">编辑</Button>
            <Button v-else size="small" @click="createVersion(record)">新建版本</Button>
            <Popconfirm title="发布后，同名旧版本会自动转为草稿" @confirm="publish(record.id)">
              <Button :disabled="record.status === 'published'" size="small" type="primary">发布</Button>
            </Popconfirm>
          </Space>
        </template>
      </Table>
    </template>
  </Page>
</template>
