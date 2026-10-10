<script setup lang="ts">
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PolicyRegionItem } from '#/api';

import { computed, onMounted, ref, watch } from 'vue';

import { Page, Tree, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, Card, InputSearch } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deletePolicyRegionApi,
  getPolicyRegionsApi,
  getPolicyRegionTreeApi,
  updatePolicyRegionApi,
} from '#/api';
import { $t } from '#/locales';

import {
  confirmAction,
  showActionFailure,
  showActionLoading,
  showActionSuccess,
} from '../../system/shared/action-feedback';
import { useColumns, useGridFormSchema } from './data';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';

defineOptions({ name: 'PolicyRegionList' });

const enabledRegionTree = ref<PolicyRegionItem[]>([]);
const regionTree = ref<PolicyRegionItem[]>([]);
const regionDescendantIds = ref<Map<string, Set<string>>>(new Map());
const treeSearch = ref('');
const selectedRegionId = ref('');

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (_params, formValues) => {
          const rows = await getPolicyRegionsApi(formValues);
          const items = filterByTree(rows, selectedRegionId.value);
          return { items, total: items.length };
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<PolicyRegionItem>,
});

const filteredTree = computed(() => filterTree(regionTree.value, treeSearch.value));

onMounted(async () => {
  await refreshTree();
});

watch(selectedRegionId, () => {
  gridApi.query();
});

async function onStatusChange(newStatus: number, row: PolicyRegionItem) {
  const statusLabel: Record<number, string> = {
    0: $t('common.disabled'),
    1: $t('common.enabled'),
  };

  try {
    await confirmAction(
      $t('ui.actionMessage.updateConfirm', [
        row.name,
        statusLabel[newStatus] ?? '',
      ]),
      $t('ui.actionMessage.updateTitle'),
    );
    await updatePolicyRegionApi(row.id, { status: newStatus });
    await refreshAll();
    showActionSuccess($t('common.updateSuccess'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') {
      return false;
    }
    showActionFailure(error);
    return false;
  }
}

function openCreate(data: Partial<PolicyRegionItem> = {}) {
  formModalApi.setData(data).open();
}

function openCreateChild(row: PolicyRegionItem) {
  const nextLevel = row.level === 'province' ? 'city' : 'district';
  openCreate({
    level: nextLevel,
    parentId: row.id,
    status: 1,
  });
}

function onEdit(row: PolicyRegionItem) {
  formModalApi.setData(row).open();
}

function onDetail(row: PolicyRegionItem) {
  detailDrawerApi.setData(row).open();
}

function onSetOwner(row: PolicyRegionItem) {
  formModalApi.setData(row).open();
}

function onDelete(row: PolicyRegionItem) {
  showActionLoading($t('ui.actionMessage.deleting', [row.name]));
  deletePolicyRegionApi(row.id)
    .then(async () => {
      await refreshAll();
      showActionSuccess($t('ui.actionMessage.deleteSuccess', [row.name]));
    })
    .catch((error) => {
      showActionFailure(error);
    });
}

async function refreshAll() {
  await refreshTree();
  gridApi.query();
}

async function refreshTree() {
  enabledRegionTree.value = await getPolicyRegionTreeApi({ status: 1 });
  regionTree.value = buildSidebarTree(enabledRegionTree.value);
  regionDescendantIds.value = buildRegionDescendantIds(enabledRegionTree.value);

  const nextSelectedId =
    selectedRegionId.value && containsRegionId(regionTree.value, selectedRegionId.value)
      ? selectedRegionId.value
      : getFirstSelectableId(regionTree.value);

  if (nextSelectedId !== selectedRegionId.value) {
    selectedRegionId.value = nextSelectedId;
  }
}

function buildSidebarTree(items: PolicyRegionItem[]): PolicyRegionItem[] {
  return items.map((item) => ({
    ...item,
    children: (item.children ?? []).map((child) => ({
      ...child,
      children: [],
    })),
  }));
}

function buildRegionDescendantIds(items: PolicyRegionItem[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  const visit = (item: PolicyRegionItem): Set<string> => {
    const ids = new Set<string>([item.id]);
    (item.children ?? []).forEach((child) => {
      const childIds = visit(child);
      childIds.forEach((id) => ids.add(id));
    });
    map.set(item.id, ids);
    return ids;
  };

  items.forEach((item) => visit(item));
  return map;
}

function getFirstSelectableId(items: PolicyRegionItem[]): string {
  return items[0]?.id ?? '';
}

function selectRegion(node: any) {
  selectedRegionId.value = node?.value?.id ?? '';
}

function clearRegionFilter() {
  selectedRegionId.value = '';
}

function containsRegionId(items: PolicyRegionItem[], targetId: string): boolean {
  return items.some((item) => item.id === targetId || containsRegionId(item.children ?? [], targetId));
}

function filterTree(items: PolicyRegionItem[], keyword: string): PolicyRegionItem[] {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return items;
  }

  return items.reduce<PolicyRegionItem[]>((result, item) => {
    const children = item.children ? filterTree(item.children, normalizedKeyword) : [];
    const matched =
      item.name.includes(normalizedKeyword) ||
      (item.remark ?? '').includes(normalizedKeyword) ||
      children.length > 0;

    if (matched) {
      result.push({ ...item, children });
    }

    return result;
  }, []);
}

function filterByTree(items: PolicyRegionItem[], selectedId: string): PolicyRegionItem[] {
  if (!selectedId) {
    return items;
  }

  const selectedIds = regionDescendantIds.value.get(selectedId);
  if (!selectedIds) {
    return items;
  }

  return items.filter((item) => selectedIds.has(item.id));
}
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="refreshAll" />
    <DetailDrawer />
    <div class="flex size-full">
      <Card class="w-1/6">
        <InputSearch v-model:value="treeSearch" placeholder="搜索区域" />
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm text-gray-500">区域树</span>
          <Button size="small" type="link" @click="clearRegionFilter">
            {{ $t('common.all') }}
          </Button>
        </div>
        <Tree
          :tree-data="filteredTree"
          label-field="name"
          value-field="id"
          @select="selectRegion"
        />
      </Card>

      <div class="ml-4 w-5/6">
        <Grid table-title="区域管理">
          <template #toolbar-tools>
            <Button type="primary" @click="openCreate()">
              <Plus class="size-5" />
              {{ $t('ui.actionTitle.create', ['区域']) }}
            </Button>
          </template>
          <template #action="{ row }">
            <VbenTableAction
              :actions="[
                {
                  text: $t('common.detail'),
                  icon: 'lucide:eye',
                  onClick: () => onDetail(row),
                },
                {
                  text: $t('common.edit'),
                  icon: 'lucide:edit',
                  onClick: () => onEdit(row),
                },
                {
                  text: '新增下级',
                  icon: 'lucide:plus',
                  ifShow: () => row.level !== 'district',
                  onClick: () => openCreateChild(row),
                },
              ]"
              :dropdown-actions="[
                {
                  text: '设置负责人',
                  icon: 'lucide:user-cog',
                  onClick: () => onSetOwner(row),
                },
                {
                  text: $t('common.delete'),
                  icon: 'lucide:trash-2',
                  danger: true,
                  popConfirm: {
                    title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                    confirm: () => onDelete(row),
                  },
                },
              ]"
              align="center"
            />
          </template>
        </Grid>
      </div>
    </div>
  </Page>
</template>
