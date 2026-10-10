<script setup lang="ts">
import type {
  EnterpriseWorkspaceTransformation,
  EnterpriseWorkspaceTransformationInput,
} from '#/api';

import { reactive, shallowRef, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';
import { Button, Card, Empty, Form, FormItem, Input, Modal, Select, Spin, Table } from 'antdv-next';

import {
  createEnterpriseWorkspaceTransformationApi,
  deleteEnterpriseWorkspaceTransformationApi,
  getEnterpriseWorkspaceIntellectualPropertiesApi,
  getEnterpriseWorkspaceArchiveRecordsApi,
  getEnterpriseWorkspaceProductServicesApi,
  getEnterpriseWorkspaceResearchProjectsApi,
  getEnterpriseWorkspaceTransformationsApi,
  updateEnterpriseWorkspaceTransformationApi,
} from '#/api';
import { useEnterpriseContextStore } from '#/store';

import { confirmAction, showActionFailure, showActionSuccess } from '../../../system/shared/action-feedback';
import EnterpriseMaterialTemplateActions from '../materials/components/EnterpriseMaterialTemplateActions.vue';
import EnterpriseTransformationGenerationModal from './components/EnterpriseTransformationGenerationModal.vue';

defineOptions({ name: 'EnterpriseWorkspaceTransformations' });

const enterpriseContextStore = useEnterpriseContextStore();
const loading = shallowRef(false);
const saving = shallowRef(false);
const editorOpen = shallowRef(false);
const generationOpen = shallowRef(false);
const editing = shallowRef<EnterpriseWorkspaceTransformation>();
const rows = shallowRef<EnterpriseWorkspaceTransformation[]>([]);
const intellectualPropertyOptions = shallowRef<{ label: string; value: string }[]>([]);
const researchProjectOptions = shallowRef<{ label: string; value: string }[]>([]);
const productServiceOptions = shallowRef<{ label: string; value: string }[]>([]);
const contractOptions = shallowRef<{ label: string; value: string }[]>([]);
const invoiceOptions = shallowRef<{ label: string; value: string }[]>([]);
const form = reactive<EnterpriseWorkspaceTransformationInput>(createEmptyForm());

const columns = [
  { dataIndex: 'transformationName', key: 'transformationName', title: '成果名称' },
  { dataIndex: 'transformationMethod', key: 'transformationMethod', title: '转化方式', width: 160 },
  { dataIndex: 'customerName', key: 'customerName', title: '客户', width: 180 },
  { key: 'actions', title: '操作', width: 130 },
];

function createEmptyForm(): EnterpriseWorkspaceTransformationInput {
  return {
    applicationScene: null,
    customerName: null,
    proofFiles: null,
    relatedContractIds: [],
    relatedInvoiceIds: [],
    relatedIpIds: [],
    relatedPsIds: [],
    relatedRdIds: [],
    remark: null,
    transformationCode: null,
    transformationIncome: null,
    transformationMethod: null,
    transformationName: '',
  };
}

function enterpriseId() {
  return enterpriseContextStore.currentEnterpriseId ?? '';
}

function normalizeTransformationName(value: null | string | undefined) {
  return String(value ?? '')
    .replace(/^成果\d+\s*[-—_:：]\s*/u, '')
    .trim();
}

function displayTransformationName(item: EnterpriseWorkspaceTransformation) {
  const name = normalizeTransformationName(item.transformationName) || '-';
  return item.transformationCode ? `${item.transformationCode}-${name}` : name;
}

async function load() {
  const id = enterpriseId();
  if (!id) {
    rows.value = [];
    return;
  }
  loading.value = true;
  try {
    const [transformations, properties, projects, services, archives] = await Promise.all([
      getEnterpriseWorkspaceTransformationsApi(id),
      getEnterpriseWorkspaceIntellectualPropertiesApi(id),
      getEnterpriseWorkspaceResearchProjectsApi(id),
      getEnterpriseWorkspaceProductServicesApi(id),
      getEnterpriseWorkspaceArchiveRecordsApi(id),
    ]);
    rows.value = transformations;
    intellectualPropertyOptions.value = properties.items.map((item) => ({
      label: [item.ipCode, item.softWorkName].filter(Boolean).join(' ') || item.id,
      value: item.id,
    }));
    researchProjectOptions.value = projects.map((item) => ({
      label: [item.kyProjectNum, item.kyProjectName].filter(Boolean).join(' ') || item.id,
      value: item.id,
    }));
    productServiceOptions.value = services.map((item) => ({
      label: [item.psCode, item.psName].filter(Boolean).join(' ') || item.id,
      value: item.id,
    }));
    contractOptions.value = archives.contracts.map((item) => ({ label: item.htName || item.htNum || item.id, value: item.id }));
    invoiceOptions.value = archives.invoices.map((item) => ({ label: item.fpNum || item.id, value: item.id }));
  } finally {
    loading.value = false;
  }
}

function openEditor(item?: EnterpriseWorkspaceTransformation) {
  editing.value = item;
  Object.assign(form, createEmptyForm(), item ?? {});
  form.transformationName = normalizeTransformationName(form.transformationName);
  editorOpen.value = true;
}

async function save() {
  form.transformationName = normalizeTransformationName(form.transformationName);
  if (!form.transformationName.trim()) {
    showActionFailure(new Error('请填写成果名称'));
    return;
  }
  saving.value = true;
  try {
    if (editing.value) {
      await updateEnterpriseWorkspaceTransformationApi(enterpriseId(), editing.value.id, form);
    } else {
      await createEnterpriseWorkspaceTransformationApi(enterpriseId(), form);
    }
    editorOpen.value = false;
    await load();
    showActionSuccess(editing.value ? '成果转化已更新' : '成果转化已新增');
  } catch (error) {
    showActionFailure(error);
  } finally {
    saving.value = false;
  }
}

async function remove(item: EnterpriseWorkspaceTransformation) {
  try {
    await confirmAction(`确认删除“${item.transformationName ?? ''}”吗？`, '删除成果转化');
    await deleteEnterpriseWorkspaceTransformationApi(enterpriseId(), item.id);
    await load();
    showActionSuccess('成果转化已删除');
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') return;
    showActionFailure(error);
  }
}

watch(() => enterpriseContextStore.currentEnterpriseId, () => void load(), { immediate: true });
</script>

<template>
  <Page auto-content-height>
    <Spin :spinning="loading">
      <div class="transformations">
        <Card title="成果转化">
          <template #extra>
            <div class="transformations__actions">
              <Button @click="generationOpen = true"><IconifyIcon class="size-4" icon="lucide:sparkles" />AI 生成成果转化草稿</Button>
              <EnterpriseMaterialTemplateActions :enterprise-id="enterpriseId()" template-id="transformation-info" @imported="load" />
              <Button type="primary" @click="openEditor()"><Plus class="size-4" />新增成果转化</Button>
            </div>
          </template>
          <Table v-if="rows.length" :columns="columns" :data-source="rows" :pagination="false" :row-key="(item: EnterpriseWorkspaceTransformation) => item.id" :scroll="{ x: 900 }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'transformationName'">{{ displayTransformationName(record) }}</template><template v-else-if="column.key === 'actions'"><Button size="small" type="link" @click="openEditor(record)">编辑</Button><Button danger size="small" type="link" @click="remove(record)">删除</Button></template>
            </template>
          </Table>
          <Empty v-else description="暂无成果转化" />
        </Card>
      </div>
    </Spin>
    <Modal v-model:open="editorOpen" :confirm-loading="saving" :title="editing ? '编辑成果转化' : '新增成果转化'" @ok="save">
      <Form :model="form" layout="vertical">
        <FormItem label="成果名称" required><Input v-model:value="form.transformationName" /></FormItem>
        <FormItem label="成果编号"><Input v-model:value="form.transformationCode" /></FormItem>
        <FormItem label="转化方式"><Input v-model:value="form.transformationMethod" /></FormItem>
        <FormItem label="客户"><Input v-model:value="form.customerName" /></FormItem>
        <FormItem label="转化收入"><Input v-model:value="form.transformationIncome" /></FormItem>
        <FormItem label="应用场景"><Input v-model:value="form.applicationScene" /></FormItem>
        <FormItem label="关联知识产权"><Select v-model:value="form.relatedIpIds" :options="intellectualPropertyOptions" mode="multiple" /></FormItem>
        <FormItem label="关联 RD"><Select v-model:value="form.relatedRdIds" :options="researchProjectOptions" mode="multiple" /></FormItem>
        <FormItem label="关联 PS"><Select v-model:value="form.relatedPsIds" :options="productServiceOptions" mode="multiple" /></FormItem>
        <FormItem label="关联合同"><Select v-model:value="form.relatedContractIds" :options="contractOptions" mode="multiple" /></FormItem>
        <FormItem label="关联发票"><Select v-model:value="form.relatedInvoiceIds" :options="invoiceOptions" mode="multiple" /></FormItem>
        <FormItem label="证明材料"><Input v-model:value="form.proofFiles" placeholder="材料台账中的文件说明或编号" /></FormItem>
        <FormItem label="备注"><Input v-model:value="form.remark" /></FormItem>
      </Form>
    </Modal>
    <EnterpriseTransformationGenerationModal v-model:open="generationOpen" :enterprise-id="enterpriseId()" @approved="load" />
  </Page>
</template>

<style scoped>
.transformations { display: grid; gap: 16px; }.transformations__actions { display: flex; gap: 8px; }
</style>
