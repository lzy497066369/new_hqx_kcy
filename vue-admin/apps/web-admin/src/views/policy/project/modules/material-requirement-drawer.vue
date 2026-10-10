<script setup lang="ts">
import type {
  ProjectMaterialRequirement,
  ProjectMaterialRequirementItem,
} from '#/api';

import { computed, h, nextTick, ref } from 'vue';

import { useVbenDrawer, useVbenForm, useVbenModal, VbenDescriptions } from '@vben/common-ui';

import { Button, Divider, Popconfirm, Tag } from 'antdv-next';

import {
  createProjectMaterialRequirementItemApi,
  deleteProjectMaterialRequirementItemApi,
  getProjectMaterialRequirementApi,
  saveProjectMaterialRequirementApi,
  updateProjectMaterialRequirementItemApi,
} from '#/api';
import { $t } from '#/locales';
import {
  confirmAction,
  showActionFailure,
  showActionSuccess,
} from '../../../system/shared/action-feedback';

import {
  useRequirementFormSchema,
  useRequirementItemFormSchema,
} from './material-requirement-data';

type DrawerProject = {
  id: string;
  name: string;
};

const project = ref<DrawerProject>();
const requirement = ref<null | ProjectMaterialRequirement>(null);
const items = ref<ProjectMaterialRequirementItem[]>([]);
const formData = ref<Partial<ProjectMaterialRequirement>>({});
const itemData = ref<Partial<ProjectMaterialRequirementItem>>({});

const requirementItems = computed(() =>
  [...items.value].sort((a, b) => a.sortOrder - b.sortOrder),
);

const requirementMeta = computed(() => [
  { label: '项目名称', content: project.value?.name ?? '-' },
  {
    label: '要求名称',
    content: requirement.value?.requirementName ?? formData.value.requirementName ?? '-',
  },
  { label: '版本', content: requirement.value?.version ?? formData.value.version ?? '-' },
  { label: '说明', content: requirement.value?.description ?? formData.value.description ?? '-' },
  {
    label: '状态',
    content: () =>
      h(
        Tag,
        {
          color:
            (requirement.value?.enabled ?? formData.value.enabled ?? 1) === 1
              ? 'success'
              : 'error',
        },
        {
          default: () =>
            (requirement.value?.enabled ?? formData.value.enabled ?? 1) === 1
              ? $t('common.enabled')
              : $t('common.disabled'),
        },
      ),
  },
]);

const [RequirementForm, requirementFormApi] = useVbenForm({
  layout: 'vertical',
  schema: useRequirementFormSchema(),
  showDefaultActions: false,
});

const [RequirementItemForm, requirementItemFormApi] = useVbenForm({
  layout: 'vertical',
  schema: useRequirementItemFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2 gap-x-4',
});

const [ItemModal, itemModalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await requirementItemFormApi.validate();
    if (!valid) {
      return;
    }

    itemModalApi.lock();
    try {
      const values = await requirementItemFormApi.getValues<ProjectMaterialRequirementItem>();
      const payload = {
        ...values,
        attachmentRequired: Number(values.attachmentRequired ?? 0),
        enabled: Number(values.enabled ?? 1),
        isRequired: Number(values.isRequired ?? 0),
        requirementId:
          values.requirementId ?? itemData.value.requirementId ?? requirement.value?.id ?? '',
        requiredCount: Number(values.requiredCount ?? 0),
        scoreWeight: Number(values.scoreWeight ?? 0),
        sortOrder: Number(values.sortOrder ?? 0),
      };
      await (itemData.value.id
        ? updateProjectMaterialRequirementItemApi(itemData.value.id, payload)
        : createProjectMaterialRequirementItemApi(payload));
      showActionSuccess(
        itemData.value.id ? $t('common.updateSuccess') : $t('common.createSuccess'),
      );
      itemModalApi.close();
      await refreshRequirement();
    } catch (error) {
      showActionFailure(error);
    } finally {
      itemModalApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }

    const data = itemModalApi.getData<Partial<ProjectMaterialRequirementItem>>() ?? {};
    itemData.value = data;
    requirementItemFormApi.resetForm();
    await nextTick();
    requirementItemFormApi.setValues({
      attachmentRequired: 1,
      enabled: 1,
      isRequired: 1,
      requiredCount: 1,
      requiredFields: '[]',
      requiredYears: '[]',
      scoreWeight: 100,
      sortOrder: 0,
      ...data,
    });
  },
});

const [Drawer, drawerApi] = useVbenDrawer({
  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }

    const data = drawerApi.getData<DrawerProject>();
    project.value = data?.id ? data : undefined;
    await refreshRequirement();
    requirementFormApi.resetForm();
    await nextTick();
    requirementFormApi.setValues({
      description: requirement.value?.description ?? '',
      enabled: requirement.value?.enabled ?? 1,
      requirementName:
        requirement.value?.requirementName ?? `${project.value?.name ?? ''} 材料要求`,
      version: requirement.value?.version ?? 'v1',
    });
    formData.value = {
      description: requirement.value?.description ?? '',
      enabled: requirement.value?.enabled ?? 1,
      requirementName:
        requirement.value?.requirementName ?? `${project.value?.name ?? ''} 材料要求`,
      version: requirement.value?.version ?? 'v1',
    };
  },
});

function openCreateItem() {
  if (!requirement.value?.id) {
    return;
  }

  itemData.value = {
    attachmentRequired: 1,
    enabled: 1,
    isRequired: 1,
    requirementId: requirement.value.id,
    requiredCount: 1,
    requiredFields: '[]',
    requiredYears: '[]',
    scoreWeight: 100,
    sortOrder: items.value.length,
  };
  itemModalApi.setData(itemData.value).open();
}

function openEditItem(row: ProjectMaterialRequirementItem) {
  itemData.value = row;
  itemModalApi.setData(row).open();
}

async function onDeleteItem(row: ProjectMaterialRequirementItem) {
  try {
    await confirmAction(
      $t('ui.actionMessage.deleteConfirm', [row.itemName]),
      $t('ui.actionMessage.deleteTitle'),
    );
    await deleteProjectMaterialRequirementItemApi(row.id);
    showActionSuccess($t('ui.actionMessage.deleteSuccess', [row.itemName]));
    await refreshRequirement();
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') {
      return;
    }
    showActionFailure(error);
  }
}

async function onSaveRequirement() {
  if (!project.value?.id) {
    return;
  }

  try {
    const values = await requirementFormApi.getValues<Partial<ProjectMaterialRequirement>>();
    const result = await saveProjectMaterialRequirementApi(project.value.id, {
      description: values.description ?? undefined,
      enabled: Number(values.enabled ?? 1),
      requirementName:
        values.requirementName ?? `${project.value.name} 材料要求`,
      version: values.version ?? 'v1',
    });
    requirement.value = result.requirement;
    items.value = result.items;
    formData.value = {
      description: result.requirement?.description ?? '',
      enabled: result.requirement?.enabled ?? 1,
      requirementName: result.requirement?.requirementName ?? '',
      version: result.requirement?.version ?? 'v1',
    };
    requirementFormApi.setValues(formData.value);
    showActionSuccess($t('common.updateSuccess'));
  } catch (error) {
    showActionFailure(error);
  }
}

async function refreshRequirement() {
  if (!project.value?.id) {
    requirement.value = null;
    items.value = [];
    return;
  }

  try {
    const result = await getProjectMaterialRequirementApi(project.value.id);
    requirement.value = result.requirement;
    items.value = result.items;
    formData.value = {
      description: result.requirement?.description ?? '',
      enabled: result.requirement?.enabled ?? 1,
      requirementName: result.requirement?.requirementName ?? '',
      version: result.requirement?.version ?? 'v1',
    };
  } catch (error) {
    requirement.value = null;
    items.value = [];
    showActionFailure(error);
  }
}
</script>

<template>
  <Drawer class="w-[50vw] max-w-[50vw]" :title="project?.name ?? '材料要求配置'">
    <ItemModal
      :title="itemData.id ? '编辑材料要求项' : '新增材料要求项'"
    >
      <RequirementItemForm class="mx-4" />
    </ItemModal>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="text-sm text-gray-500">
        配置当前项目的申报材料要求，字段名按接口约定直接保存。
      </div>
      <div class="flex gap-2">
        <Button :disabled="!project?.id" type="primary" @click="onSaveRequirement">
          保存主表
        </Button>
        <Button :disabled="!requirement?.id" type="primary" @click="openCreateItem">
          新增条目
        </Button>
      </div>
    </div>

    <div class="rounded-lg border border-gray-200 p-4">
      <RequirementForm />
    </div>

    <VbenDescriptions bordered class="mt-4" :column="2" :items="requirementMeta" />

    <Divider>材料要求明细</Divider>

    <div v-if="requirementItems.length" class="space-y-3">
      <div
        v-for="row in requirementItems"
        :key="row.id"
        class="rounded-lg border border-gray-200 p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-medium">
              {{ row.itemName }}
              <span class="ml-2 text-xs text-gray-400">
                {{ row.moduleKey }} / {{ row.tabKey }}
              </span>
            </div>
            <div class="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
              <Tag>{{ row.requiredCount }} 条</Tag>
              <Tag>{{ row.isRequired === 1 ? '必交' : '选交' }}</Tag>
              <Tag>{{ row.attachmentRequired === 1 ? '需附件' : '无附件要求' }}</Tag>
              <Tag>{{ row.enabled === 1 ? '启用' : '停用' }}</Tag>
            </div>
            <div class="mt-2 text-sm text-gray-500">
              权重 {{ row.scoreWeight }}，排序 {{ row.sortOrder }}
            </div>
          </div>
          <div class="flex shrink-0 gap-2">
            <Button size="small" @click="openEditItem(row)">编辑</Button>
            <Popconfirm
              :title="$t('ui.actionMessage.deleteConfirm', [row.itemName])"
              @confirm="onDeleteItem(row)"
            >
              <Button danger size="small">
                {{ $t('common.delete') }}
              </Button>
            </Popconfirm>
          </div>
        </div>

        <div class="mt-3 grid gap-2 text-xs text-gray-500 md:grid-cols-2">
          <div>required_years: {{ row.requiredYears || '[]' }}</div>
          <div>required_fields: {{ row.requiredFields || '[]' }}</div>
        </div>
      </div>
    </div>

    <div v-else class="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">
      还没有材料要求条目，先保存主表后再新增明细项。
    </div>
  </Drawer>
</template>
