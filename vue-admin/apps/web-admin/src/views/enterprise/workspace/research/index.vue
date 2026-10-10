<script setup lang="ts">
import type {
  EnterpriseWorkspaceResearchProject,
  EnterpriseWorkspaceResearchProjectInput,
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
  InputNumber,
  Modal,
  Select,
  Spin,
  Table,
  Tag,
} from 'antdv-next';

import {
  createEnterpriseWorkspaceResearchProjectApi,
  deleteEnterpriseWorkspaceResearchProjectApi,
  getEnterpriseWorkspaceIntellectualPropertiesApi,
  getEnterpriseWorkspaceProductServicesApi,
  getEnterpriseWorkspaceResearchProjectsApi,
  getEnterpriseWorkspaceTransformationsApi,
  updateEnterpriseWorkspaceResearchProjectApi,
} from '#/api';
import { useEnterpriseContextStore } from '#/store';
import {
  confirmAction,
  showActionFailure,
  showActionSuccess,
} from '../../../system/shared/action-feedback';
import EnterpriseMaterialTemplateActions from '../materials/components/EnterpriseMaterialTemplateActions.vue';
import EnterpriseResearchGenerationModal from './components/EnterpriseResearchGenerationModal.vue';

defineOptions({ name: 'EnterpriseWorkspaceResearch' });
const enterpriseContextStore = useEnterpriseContextStore();
const loading = shallowRef(false);
const saving = shallowRef(false);
const rows = shallowRef<EnterpriseWorkspaceResearchProject[]>([]);
const ipOptions = shallowRef<{ label: string; value: string }[]>([]);
const productServiceOptions = shallowRef<{ label: string; value: string }[]>(
  [],
);
const transformationOptions = shallowRef<{ label: string; value: string }[]>(
  [],
);
const editorOpen = shallowRef(false);
const generationOpen = shallowRef(false);
const editing = shallowRef<EnterpriseWorkspaceResearchProject>();
const form =
  reactive<EnterpriseWorkspaceResearchProjectInput>(createEmptyForm());
const columns = [
  { dataIndex: 'kyProjectName', key: 'kyProjectName', title: '项目名称' },
  { dataIndex: 'kyProjectNum', key: 'kyProjectNum', title: '项目编号' },
  { dataIndex: 'kyProjectStatus', key: 'kyProjectStatus', title: '状态' },
  { dataIndex: 'kyProjectLeader', key: 'kyProjectLeader', title: '负责人' },
  { key: 'actions', title: '操作' },
];
function createEmptyForm(): EnterpriseWorkspaceResearchProjectInput {
  return {
    coreTechnology: null,
    endDate: null,
    fundAmount: null,
    fundSource: null,
    initDate: null,
    innovationPoints: null,
    kyProjectDes: null,
    kyProjectLeader: null,
    kyProjectName: '',
    kyProjectNum: null,
    kyProjectStatus: null,
    lxbgFile: null,
    projectType: null,
    rdBudget: null,
    rdExpenseTotal: null,
    rdOrganizationMethod: null,
    relatedIpIds: [],
    relatedPsIds: [],
    relatedTransformationIds: [],
    remark: null,
    stageResult: null,
  };
}
function enterpriseId() {
  return enterpriseContextStore.currentEnterpriseId ?? '';
}
function statusLabel(value: null | number) {
  return (
    (
      { 1: '立项中', 2: '实施中', 3: '已结题', 4: '已终止' } as Record<
        number,
        string
      >
    )[value ?? 0] ?? '-'
  );
}
async function load() {
  const id = enterpriseId();
  if (!id) {
    rows.value = [];
    ipOptions.value = [];
    productServiceOptions.value = [];
    transformationOptions.value = [];
    return;
  }
  loading.value = true;
  try {
    const [projects, properties, productServices, transformations] =
      await Promise.all([
        getEnterpriseWorkspaceResearchProjectsApi(id),
        getEnterpriseWorkspaceIntellectualPropertiesApi(id),
        getEnterpriseWorkspaceProductServicesApi(id),
        getEnterpriseWorkspaceTransformationsApi(id),
      ]);
    rows.value = projects;
    ipOptions.value = properties.items.map((item) => ({
      label: [item.ipCode, item.softWorkName].filter(Boolean).join(' ') || item.id,
      value: item.id,
    }));
    productServiceOptions.value = productServices.map((item) => ({
      label: [item.psCode, item.psName].filter(Boolean).join(' ') || item.id,
      value: item.id,
    }));
    transformationOptions.value = transformations.map((item) => ({
      label: [item.transformationCode, item.transformationName]
        .filter(Boolean)
        .join(' ') || item.id,
      value: item.id,
    }));
  } finally {
    loading.value = false;
  }
}
function openEditor(item?: EnterpriseWorkspaceResearchProject) {
  editing.value = item;
  Object.assign(form, createEmptyForm(), item ?? {});
  editorOpen.value = true;
}
async function save() {
  if (!form.kyProjectName.trim()) {
    showActionFailure(new Error('请填写项目名称'));
    return;
  }
  saving.value = true;
  try {
    if (editing.value)
      await updateEnterpriseWorkspaceResearchProjectApi(
        enterpriseId(),
        editing.value.id,
        form,
      );
    else
      await createEnterpriseWorkspaceResearchProjectApi(enterpriseId(), form);
    editorOpen.value = false;
    await load();
    showActionSuccess(editing.value ? '研发项目已更新' : '研发项目已新增');
  } catch (error) {
    showActionFailure(error);
  } finally {
    saving.value = false;
  }
}
async function remove(item: EnterpriseWorkspaceResearchProject) {
  try {
    await confirmAction(
      `确认删除“${item.kyProjectName ?? ''}”吗？`,
      '删除研发项目',
    );
    await deleteEnterpriseWorkspaceResearchProjectApi(enterpriseId(), item.id);
    await load();
    showActionSuccess('研发项目已删除');
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
      ><div class="research">
        <Card title="RD 研发项目"
          ><template #extra
            ><div class="research__actions">
              <Button @click="generationOpen = true"
                ><IconifyIcon class="size-4" icon="lucide:sparkles" />AI
                生成研发项目草稿</Button
              ><EnterpriseMaterialTemplateActions
                :enterprise-id="enterpriseId()"
                template-id="rd-info"
                @imported="load"
              /><Button type="primary" @click="openEditor()"
                >新增研发项目</Button
              >
            </div></template
          ><Table
            v-if="rows.length"
            :columns="columns"
            :data-source="rows"
            :pagination="false"
            :row-key="(record: EnterpriseWorkspaceResearchProject) => record.id"
            :scroll="{ x: 900 }"
            ><template #bodyCell="{ column, record }"
              ><template v-if="column.key === 'kyProjectStatus'"
                ><Tag
                  :color="
                    record.kyProjectStatus === 3
                      ? 'green'
                      : record.kyProjectStatus === 4
                        ? 'red'
                        : 'blue'
                  "
                  >{{ statusLabel(record.kyProjectStatus) }}</Tag
                ></template
              ><template v-else-if="column.key === 'actions'"
                ><Button size="small" type="link" @click="openEditor(record)"
                  >编辑</Button
                ><Button danger size="small" type="link" @click="remove(record)"
                  >删除</Button
                ></template
              ></template
            ></Table
          ><Empty v-else description="暂无研发项目" /></Card
        ><Modal
          v-model:open="editorOpen"
          :confirm-loading="saving"
          :title="editing ? '编辑研发项目' : '新增研发项目'"
          width="860px"
          @ok="save"
          ><Form :model="form" layout="vertical"
            ><div class="research__form-grid">
              <FormItem label="项目名称" required
                ><Input v-model:value="form.kyProjectName" /></FormItem
              ><FormItem label="项目编号"
                ><Input v-model:value="form.kyProjectNum" /></FormItem
              ><FormItem label="项目状态"
                ><InputNumber
                  v-model:value="form.kyProjectStatus"
                  :min="1"
                  :max="4"
                  class="w-full" /></FormItem
              ><FormItem label="项目负责人"
                ><Input v-model:value="form.kyProjectLeader" /></FormItem
              ><FormItem label="立项日期"
                ><Input v-model:value="form.initDate" /></FormItem
              ><FormItem label="结题日期"
                ><Input v-model:value="form.endDate" /></FormItem
              ><FormItem label="项目类型"
                ><Input v-model:value="form.projectType" /></FormItem
              ><FormItem label="资金来源"
                ><InputNumber
                  v-model:value="form.fundSource"
                  :min="1"
                  :max="6"
                  class="w-full" /></FormItem
              ><FormItem label="项目经费"
                ><Input v-model:value="form.fundAmount" /></FormItem
              ><FormItem label="研发预算"
                ><Input v-model:value="form.rdBudget" /></FormItem
              ><FormItem label="研发费用"
                ><Input v-model:value="form.rdExpenseTotal" /></FormItem
              ><FormItem label="立项报告文件"
                ><Input
                  v-model:value="form.lxbgFile"
                  placeholder="上传后填写文件路径"
              /></FormItem>
            </div>
            <FormItem label="关联知识产权"
              ><Select
                v-model:value="form.relatedIpIds"
                :options="ipOptions"
                mode="multiple"
                placeholder="选择本项目关联的知识产权" /></FormItem
            ><FormItem label="关联 PS"
              ><Select
                v-model:value="form.relatedPsIds"
                :options="productServiceOptions"
                mode="multiple" /></FormItem
            ><FormItem label="关联成果转化"
              ><Select
                v-model:value="form.relatedTransformationIds"
                :options="transformationOptions"
                mode="multiple" /></FormItem
            ><FormItem label="核心技术"
              ><Input v-model:value="form.coreTechnology" /></FormItem
            ><FormItem label="创新点"
              ><Input v-model:value="form.innovationPoints" /></FormItem
            ><FormItem label="阶段成果"
              ><Input v-model:value="form.stageResult" /></FormItem
            ><FormItem label="组织实施方式"
              ><Input v-model:value="form.rdOrganizationMethod" /></FormItem
            ><FormItem label="研发立项报告正文"
              ><Input v-model:value="form.kyProjectDes" /></FormItem
            ><FormItem label="备注"
              ><Input v-model:value="form.remark" /></FormItem></Form></Modal
        ><EnterpriseResearchGenerationModal
          v-model:open="generationOpen"
          :enterprise-id="enterpriseId()"
          @approved="load"
        /></div></Spin
  ></Page>
</template>
<style scoped>
.research {
  display: grid;
  gap: 16px;
}
.research__actions {
  display: flex;
  gap: 8px;
}
.research__form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}
@media (max-width: 640px) {
  .research__form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
