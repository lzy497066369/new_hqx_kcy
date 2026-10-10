<script setup lang="ts">
import type {
  EnterpriseWorkspaceProductService,
  EnterpriseWorkspaceProductServiceInput,
} from '#/api';
import { reactive, shallowRef, watch } from 'vue';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import {
  Button,
  Card,
  Empty,
  Form,
  FormItem,
  Input,
  Modal,
  Select,
  Spin,
  Table,
} from 'antdv-next';
import {
  createEnterpriseWorkspaceProductServiceApi,
  deleteEnterpriseWorkspaceProductServiceApi,
  getEnterpriseWorkspaceArchiveRecordsApi,
  getEnterpriseWorkspaceIntellectualPropertiesApi,
  getEnterpriseWorkspaceProductServicesApi,
  getEnterpriseWorkspaceResearchProjectsApi,
  getEnterpriseWorkspaceTransformationsApi,
  updateEnterpriseWorkspaceProductServiceApi,
} from '#/api';
import { useEnterpriseContextStore } from '#/store';
import {
  confirmAction,
  showActionFailure,
  showActionSuccess,
} from '../../../system/shared/action-feedback';
import EnterpriseMaterialTemplateActions from '../materials/components/EnterpriseMaterialTemplateActions.vue';
import EnterpriseProductServiceGenerationModal from './components/EnterpriseProductServiceGenerationModal.vue';
defineOptions({ name: 'EnterpriseWorkspaceProductServices' });
const enterpriseContextStore = useEnterpriseContextStore();
const loading = shallowRef(false);
const saving = shallowRef(false);
const rows = shallowRef<EnterpriseWorkspaceProductService[]>([]);
const intellectualPropertyOptions = shallowRef<
  { label: string; value: string }[]
>([]);
const researchProjectOptions = shallowRef<{ label: string; value: string }[]>(
  [],
);
const transformationOptions = shallowRef<{ label: string; value: string }[]>(
  [],
);
const contractOptions = shallowRef<{ label: string; value: string }[]>([]);
const invoiceOptions = shallowRef<{ label: string; value: string }[]>([]);
const editorOpen = shallowRef(false);
const generationOpen = shallowRef(false);
const editing = shallowRef<EnterpriseWorkspaceProductService>();
const form =
  reactive<EnterpriseWorkspaceProductServiceInput>(createEmptyForm());
const columns = [
  { dataIndex: 'psName', key: 'psName', title: '产品/服务名称' },
  { dataIndex: 'techField', key: 'techField', title: '技术领域' },
  { dataIndex: 'techSource', key: 'techSource', title: '技术来源' },
  { key: 'actions', title: '操作' },
];
function createEmptyForm(): EnterpriseWorkspaceProductServiceInput {
  return {
    competitiveAdvantage: null,
    highTechIncome: null,
    lastYearIncome: null,
    proofFiles: null,
    psCode: null,
    psName: '',
    relatedContractIds: [],
    relatedInvoiceIds: [],
    relatedIpIds: [],
    relatedRdIds: [],
    relatedTransformationIds: [],
    remark: null,
    techDescription: null,
    techField: null,
    techIndex: null,
    techSource: null,
  };
}
function enterpriseId() {
  return enterpriseContextStore.currentEnterpriseId ?? '';
}
async function load() {
  const id = enterpriseId();
  if (!id) {
    rows.value = [];
    intellectualPropertyOptions.value = [];
    researchProjectOptions.value = [];
    transformationOptions.value = [];
    contractOptions.value = [];
    invoiceOptions.value = [];
    return;
  }
  loading.value = true;
  try {
    const [services, properties, projects, transformations, archives] =
      await Promise.all([
        getEnterpriseWorkspaceProductServicesApi(id),
        getEnterpriseWorkspaceIntellectualPropertiesApi(id),
        getEnterpriseWorkspaceResearchProjectsApi(id),
        getEnterpriseWorkspaceTransformationsApi(id),
        getEnterpriseWorkspaceArchiveRecordsApi(id),
      ]);
    rows.value = services;
    intellectualPropertyOptions.value = properties.items.map((item) => ({
      label: [item.ipCode, item.softWorkName].filter(Boolean).join(' ') || item.id,
      value: item.id,
    }));
    researchProjectOptions.value = projects.map((item) => ({
      label: [item.kyProjectNum, item.kyProjectName]
        .filter(Boolean)
        .join(' ') || item.id,
      value: item.id,
    }));
    transformationOptions.value = transformations.map((item) => ({
      label: [item.transformationCode, item.transformationName]
        .filter(Boolean)
        .join(' ') || item.id,
      value: item.id,
    }));
    contractOptions.value = archives.contracts.map((item) => ({
      label: item.htName || item.htNum || item.id,
      value: item.id,
    }));
    invoiceOptions.value = archives.invoices.map((item) => ({
      label: item.fpNum || item.id,
      value: item.id,
    }));
  } finally {
    loading.value = false;
  }
}
function openEditor(item?: EnterpriseWorkspaceProductService) {
  editing.value = item;
  Object.assign(form, createEmptyForm(), item ?? {});
  editorOpen.value = true;
}
async function save() {
  if (!form.psName.trim()) {
    showActionFailure(new Error('请填写产品/服务名称'));
    return;
  }
  saving.value = true;
  try {
    if (editing.value)
      await updateEnterpriseWorkspaceProductServiceApi(
        enterpriseId(),
        editing.value.id,
        form,
      );
    else await createEnterpriseWorkspaceProductServiceApi(enterpriseId(), form);
    editorOpen.value = false;
    await load();
    showActionSuccess(editing.value ? '产品服务已更新' : '产品服务已新增');
  } catch (error) {
    showActionFailure(error);
  } finally {
    saving.value = false;
  }
}
async function remove(item: EnterpriseWorkspaceProductService) {
  try {
    await confirmAction(`确认删除“${item.psName ?? ''}”吗？`, '删除产品服务');
    await deleteEnterpriseWorkspaceProductServiceApi(enterpriseId(), item.id);
    await load();
    showActionSuccess('产品服务已删除');
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') return;
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
  <Page auto-content-height
    ><Spin :spinning="loading"
      ><div class="product-services">
        <Card title="PS 产品服务"
          ><template #extra
            ><div class="product-services__actions">
              <Button @click="generationOpen = true"
                ><IconifyIcon class="size-4" icon="lucide:sparkles" />AI
                生成产品服务草稿</Button
              ><EnterpriseMaterialTemplateActions
                :enterprise-id="enterpriseId()"
                template-id="ps-info"
                @imported="load"
              /><Button type="primary" @click="openEditor()"
                >新增产品服务</Button
              >
            </div></template
          ><Table
            v-if="rows.length"
            :columns="columns"
            :data-source="rows"
            :pagination="false"
            :row-key="(item: EnterpriseWorkspaceProductService) => item.id"
            :scroll="{ x: 820 }"
            ><template #bodyCell="{ column, record }"
              ><template v-if="column.key === 'actions'"
                ><Button size="small" type="link" @click="openEditor(record)"
                  >编辑</Button
                ><Button danger size="small" type="link" @click="remove(record)"
                  >删除</Button
                ></template
              ></template
            ></Table
          ><Empty v-else description="暂无产品服务" /></Card
        ><Modal
          v-model:open="editorOpen"
          :confirm-loading="saving"
          :title="editing ? '编辑产品服务' : '新增产品服务'"
          width="860px"
          @ok="save"
          ><Form :model="form" layout="vertical"
            ><div class="product-services__form-grid">
              <FormItem label="PS编号"
                ><Input v-model:value="form.psCode" /></FormItem
              ><FormItem label="产品/服务名称" required
                ><Input v-model:value="form.psName" /></FormItem
              ><FormItem label="技术领域"
                ><Input v-model:value="form.techField" /></FormItem
              ><FormItem label="技术来源"
                ><Input v-model:value="form.techSource" /></FormItem
              ><FormItem label="上年度收入"
                ><Input v-model:value="form.lastYearIncome" /></FormItem
              ><FormItem label="高新收入"
                ><Input v-model:value="form.highTechIncome"
              /></FormItem>
            </div>
            <FormItem label="关联知识产权"
              ><Select
                v-model:value="form.relatedIpIds"
                :options="intellectualPropertyOptions"
                mode="multiple" /></FormItem
            ><FormItem label="关联研发项目"
              ><Select
                v-model:value="form.relatedRdIds"
                :options="researchProjectOptions"
                mode="multiple" /></FormItem
            ><FormItem label="关联成果转化"
              ><Select
                v-model:value="form.relatedTransformationIds"
                :options="transformationOptions"
                mode="multiple" /></FormItem
            ><FormItem label="关联合同"
              ><Select
                v-model:value="form.relatedContractIds"
                :options="contractOptions"
                mode="multiple" /></FormItem
            ><FormItem label="关联发票"
              ><Select
                v-model:value="form.relatedInvoiceIds"
                :options="invoiceOptions"
                mode="multiple" /></FormItem
            ><FormItem label="关键技术"
              ><Input v-model:value="form.techDescription" /></FormItem
            ><FormItem label="技术指标"
              ><Input v-model:value="form.techIndex" /></FormItem
            ><FormItem label="竞争优势"
              ><Input v-model:value="form.competitiveAdvantage" /></FormItem
            ><FormItem label="证明材料"
              ><Input
                v-model:value="form.proofFiles"
                placeholder="材料台账中的文件说明或路径" /></FormItem
            ><FormItem label="备注"
              ><Input v-model:value="form.remark" /></FormItem></Form></Modal
        ><EnterpriseProductServiceGenerationModal
          v-model:open="generationOpen"
          :enterprise-id="enterpriseId()"
          @approved="load"
        /></div></Spin
  ></Page>
</template>
<style scoped>
.product-services {
  display: grid;
  gap: 16px;
}
.product-services__actions {
  display: flex;
  gap: 8px;
}
.product-services__form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}
</style>
