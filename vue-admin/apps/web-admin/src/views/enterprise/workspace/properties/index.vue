<script setup lang="ts">
import type {
  EnterpriseWorkspaceIntellectualProperty,
  EnterpriseWorkspaceIntellectualPropertyInput,
} from '#/api';
import type { TableColumnsType } from 'antdv-next';

import { reactive, shallowRef, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import {
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  FormItem,
  Input,
  Modal,
  Select,
  Spin,
  Statistic,
  Switch,
  Table,
  Tag,
} from 'antdv-next';

import {
  createEnterpriseWorkspaceIntellectualPropertyApi,
  deleteEnterpriseWorkspaceIntellectualPropertyApi,
  getEnterpriseWorkspaceIntellectualPropertiesApi,
  getEnterpriseWorkspaceProductServicesApi,
  getEnterpriseWorkspaceResearchProjectsApi,
  getEnterpriseWorkspaceTransformationsApi,
  previewEnterpriseWorkspaceIntellectualPropertySourceApi,
  updateEnterpriseWorkspaceIntellectualPropertyApi,
} from '#/api';
import { useEnterpriseContextStore } from '#/store';

import { confirmAction, showActionFailure, showActionSuccess } from '../../../system/shared/action-feedback';
import EnterpriseMaterialTemplateActions from '../materials/components/EnterpriseMaterialTemplateActions.vue';
import EnterpriseIpRecognitionModal from './components/EnterpriseIpRecognitionModal.vue';

defineOptions({ name: 'EnterpriseWorkspaceProperties' });

const enterpriseContextStore = useEnterpriseContextStore();
const loading = shallowRef(false);
const saving = shallowRef(false);
const editorOpen = shallowRef(false);
const recognitionOpen = shallowRef(false);
const editing = shallowRef<EnterpriseWorkspaceIntellectualProperty>();
const researchProjectOptions = shallowRef<{ label: string; value: string }[]>([]);
const productServiceOptions = shallowRef<{ label: string; value: string }[]>([]);
const transformationOptions = shallowRef<{ label: string; value: string }[]>([]);
const data = shallowRef<{
  items: EnterpriseWorkspaceIntellectualProperty[];
  stats: { coreCount: number; grantedCount: number; total: number };
}>();
const form = reactive<EnterpriseWorkspaceIntellectualPropertyInput>(createEmptyForm());

const columns: TableColumnsType<EnterpriseWorkspaceIntellectualProperty> = [
  { dataIndex: 'ipCode', key: 'ipCode', title: '编号', width: 128 },
  { dataIndex: 'softWorkName', key: 'softWorkName', title: '知识产权名称', width: 220 },
  { dataIndex: 'softWorkType', key: 'softWorkType', title: '类型', width: 120 },
  { dataIndex: 'softWorkNum', key: 'softWorkNum', title: '登记号/专利号', width: 180 },
  { dataIndex: 'softWorkStatus', key: 'softWorkStatus', title: '状态', width: 108 },
  { dataIndex: 'authorizeDate', key: 'authorizeDate', title: '授权日期', width: 132 },
  { dataIndex: 'isCoreIp', key: 'isCoreIp', title: '核心 IP', width: 96 },
  { key: 'actions', title: '操作', fixed: 'right', width: 188 },
];

const propertyTypeOptions = [
  { label: '发明专利', value: 1 },
  { label: '实用新型', value: 2 },
  { label: '软件著作权', value: 3 },
  { label: '外观设计', value: 4 },
];

const propertyStatusOptions = [
  { label: '审核中', value: 1 },
  { label: '已授权/已登记', value: 2 },
];

const propertyLevelOptions = [
  { label: 'I类', value: 'I类' },
  { label: 'II类', value: 'II类' },
];

const obtainMethodOptions = [
  { label: '自主研发', value: '自主研发' },
  { label: '受让', value: '受让' },
  { label: '许可', value: '许可' },
  { label: '共有', value: '共有' },
  { label: '其他', value: '其他' },
];

function createEmptyForm(): EnterpriseWorkspaceIntellectualPropertyInput {
  return {
    advancedDegree: null,
    applyDate: null,
    authorizeDate: null,
    inventor: null,
    ipLevel: null,
    isCoreIp: false,
    obtainMethod: null,
    relatedPsIds: [],
    relatedRdIds: [],
    relatedTransformationIds: [],
    remark: null,
    rightHolder: null,
    softWorkFile: null,
    softWorkName: '',
    softWorkNum: null,
    softWorkStatus: null,
    softWorkType: null,
    supportEffect: null,
  };
}

function enterpriseId() {
  return enterpriseContextStore.currentEnterpriseId ?? '';
}

function propertyTypeLabel(value: null | number) {
  return (
    {
      1: '发明专利',
      2: '实用新型',
      3: '软件著作权',
      4: '外观设计',
    } as Record<number, string>
  )[value ?? 0] ?? '-';
}

async function load() {
  const id = enterpriseId();
  if (!id) {
    data.value = undefined;
    return;
  }
  loading.value = true;
  try {
    const [properties, researchProjects, productServices, transformations] = await Promise.all([
      getEnterpriseWorkspaceIntellectualPropertiesApi(id),
      getEnterpriseWorkspaceResearchProjectsApi(id),
      getEnterpriseWorkspaceProductServicesApi(id),
      getEnterpriseWorkspaceTransformationsApi(id),
    ]);
    data.value = properties;
    researchProjectOptions.value = researchProjects.map((item) => ({
      label: [item.kyProjectNum, item.kyProjectName].filter(Boolean).join(' ') || item.id,
      value: item.id,
    }));
    productServiceOptions.value = productServices.map((item) => ({
      label: [item.psCode, item.psName].filter(Boolean).join(' ') || item.id,
      value: item.id,
    }));
    transformationOptions.value = transformations.map((item) => ({
      label: [item.transformationCode, item.transformationName].filter(Boolean).join(' ') || item.id,
      value: item.id,
    }));
  } finally {
    loading.value = false;
  }
}

function openEditor(item?: EnterpriseWorkspaceIntellectualProperty) {
  editing.value = item;
  Object.assign(form, createEmptyForm(), item ?? {});
  editorOpen.value = true;
}

async function save() {
  if (!form.softWorkName.trim()) {
    showActionFailure(new Error('请填写知识产权名称'));
    return;
  }
  saving.value = true;
  try {
    if (editing.value) {
      await updateEnterpriseWorkspaceIntellectualPropertyApi(enterpriseId(), editing.value.id, form);
    } else {
      await createEnterpriseWorkspaceIntellectualPropertyApi(enterpriseId(), form);
    }
    editorOpen.value = false;
    await load();
    showActionSuccess(editing.value ? '知识产权已更新' : '知识产权已新增');
  } catch (error) {
    showActionFailure(error);
  } finally {
    saving.value = false;
  }
}

async function remove(item: EnterpriseWorkspaceIntellectualProperty) {
  try {
    await confirmAction(`确认删除“${item.softWorkName ?? ''}”吗？`, '删除知识产权');
    await deleteEnterpriseWorkspaceIntellectualPropertyApi(enterpriseId(), item.id);
    await load();
    showActionSuccess('知识产权已删除');
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') {
      return;
    }
    showActionFailure(error);
  }
}

async function previewSourceFile(item: EnterpriseWorkspaceIntellectualProperty) {
  if (!item.softWorkFile?.trim()) {
    return;
  }
  try {
    const blob = await previewEnterpriseWorkspaceIntellectualPropertySourceApi(
      enterpriseId(),
      item.id,
    );
    const previewUrl = URL.createObjectURL(blob);
    window.open(previewUrl, '_blank', 'noopener');
    window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
  } catch (error) {
    showActionFailure(error);
  }
}

watch(
  () => enterpriseContextStore.currentEnterpriseId,
  () => void load(),
  { immediate: true },
);
</script>

<template>
  <Page auto-content-height>
    <Spin :spinning="loading">
      <div class="properties">
        <template v-if="data">
          <div class="properties__stats">
            <Card><Statistic title="知识产权" :value="data.stats.total" /></Card>
            <Card><Statistic title="已授权" :value="data.stats.grantedCount" /></Card>
            <Card><Statistic title="核心 IP" :value="data.stats.coreCount" /></Card>
          </div>

          <Card title="知识产权台账">
            <template #extra>
              <div class="properties__actions">
                <Button @click="recognitionOpen = true"><IconifyIcon class="size-4" icon="lucide:sparkles" />AI 识别知识产权 PDF</Button>
                <EnterpriseMaterialTemplateActions :enterprise-id="enterpriseId()" template-id="ip-info" @imported="load" />
                <Button type="primary" @click="openEditor()"><Plus class="size-4" />新增知识产权</Button>
              </div>
            </template>
            <Table
              v-if="data.items.length"
              :columns="columns"
              :data-source="data.items"
              :pagination="false"
              :row-key="(record: EnterpriseWorkspaceIntellectualProperty) => record.id"
              :scroll="{ x: 1120 }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'softWorkType'">{{ propertyTypeLabel(record.softWorkType) }}</template>
                <Tag v-else-if="column.key === 'softWorkStatus'" :color="record.softWorkStatus === 2 ? 'success' : 'processing'">
                  {{ record.softWorkStatus === 2 ? '已授权' : '审核中' }}
                </Tag>
                <template v-else-if="column.key === 'isCoreIp'">{{ record.isCoreIp ? '是' : '否' }}</template>
                <template v-else-if="column.key === 'actions'">
                  <Button :disabled="!record.softWorkFile" size="small" type="link" @click="previewSourceFile(record)">查看源文件</Button>
                  <Button size="small" type="link" @click="openEditor(record)">编辑</Button>
                  <Button danger size="small" type="link" @click="remove(record)">删除</Button>
                </template>
              </template>
            </Table>
            <Empty v-else description="暂无知识产权记录" />
          </Card>
        </template>
      </div>
    </Spin>

    <Modal v-model:open="editorOpen" :confirm-loading="saving" :title="editing ? '编辑知识产权' : '新增知识产权'" width="960px" @ok="save">
      <Form :model="form" layout="vertical">
        <section class="properties__form-section">
          <h3 class="properties__form-section-title">基本信息</h3>
          <div class="properties__form-grid">
            <FormItem class="properties__form-item--wide" label="知识产权名称" required><Input v-model:value="form.softWorkName" placeholder="例如：一种环保工程用垃圾处理装置" /></FormItem>
            <FormItem label="类型"><Select v-model:value="form.softWorkType" :options="propertyTypeOptions" placeholder="请选择类型" /></FormItem>
            <FormItem label="状态"><Select v-model:value="form.softWorkStatus" :options="propertyStatusOptions" placeholder="请选择状态" /></FormItem>
            <FormItem class="properties__form-item--wide" label="登记号/专利号"><Input v-model:value="form.softWorkNum" placeholder="专利填 ZL 号，软著填登记号" /></FormItem>
          </div>
        </section>
        <section class="properties__form-section">
          <h3 class="properties__form-section-title">权属与状态</h3>
          <div class="properties__form-grid">
            <FormItem label="申请/完成日期"><DatePicker v-model:value="form.applyDate" class="w-full" format="YYYY-MM-DD" value-format="YYYY-MM-DD" /></FormItem>
            <FormItem label="授权/登记日期"><DatePicker v-model:value="form.authorizeDate" class="w-full" format="YYYY-MM-DD" value-format="YYYY-MM-DD" /></FormItem>
            <FormItem label="权利人/著作权人"><Input v-model:value="form.rightHolder" /></FormItem>
            <FormItem label="发明人/设计人/开发者"><Input v-model:value="form.inventor" placeholder="多个姓名用顿号分隔" /></FormItem>
            <FormItem label="获得方式"><Select v-model:value="form.obtainMethod" :options="obtainMethodOptions" /></FormItem>
            <FormItem label="知识产权类别"><Select v-model:value="form.ipLevel" :options="propertyLevelOptions" /></FormItem>
            <FormItem label="核心 IP"><Switch v-model:checked="form.isCoreIp" /></FormItem>
          </div>
        </section>
        <section class="properties__form-section">
          <h3 class="properties__form-section-title">申报关联</h3>
          <div class="properties__form-grid">
            <FormItem label="技术先进程度"><Input v-model:value="form.advancedDegree" placeholder="例如：国内领先" /></FormItem>
            <FormItem class="properties__form-item--wide" label="核心支持作用"><Input.TextArea v-model:value="form.supportEffect" :auto-size="{ minRows: 2, maxRows: 4 }" placeholder="说明其对 RD、PS 或成果转化的支撑作用" /></FormItem>
            <FormItem class="properties__form-item--wide" label="证书/登记文件"><Input v-model:value="form.softWorkFile" placeholder="可通过“AI 识别知识产权 PDF”上传，或填写已上传文件路径" /></FormItem>
          </div>
        </section>
        <FormItem label="关联 RD"><Select v-model:value="form.relatedRdIds" :options="researchProjectOptions" mode="multiple" /></FormItem>
        <FormItem label="关联 PS"><Select v-model:value="form.relatedPsIds" :options="productServiceOptions" mode="multiple" /></FormItem>
        <FormItem label="关联成果转化"><Select v-model:value="form.relatedTransformationIds" :options="transformationOptions" mode="multiple" /></FormItem>
        <FormItem label="备注"><Input.TextArea v-model:value="form.remark" :auto-size="{ minRows: 2, maxRows: 4 }" /></FormItem>
      </Form>
    </Modal>

    <EnterpriseIpRecognitionModal v-model:open="recognitionOpen" :enterprise-id="enterpriseId()" @approved="load" />
  </Page>
</template>

<style scoped>
.properties { display: grid; gap: 16px; }
.properties__stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.properties__actions { display: flex; gap: 8px; }
.properties__form-section { padding-top: 16px; margin-top: 16px; border-top: 1px solid hsl(var(--border)); }
.properties__form-section:first-child { padding-top: 0; margin-top: 0; border-top: 0; }
.properties__form-section-title { margin: 0 0 12px; font-size: 14px; font-weight: 600; }
.properties__form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.properties__form-item--wide { grid-column: 1 / -1; }
@media (max-width: 640px) { .properties__stats, .properties__form-grid { grid-template-columns: 1fr; }.properties__form-item--wide { grid-column: auto; }.properties__actions { flex-wrap: wrap; } }
</style>
