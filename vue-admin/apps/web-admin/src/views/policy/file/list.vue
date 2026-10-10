<script setup lang="ts">
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PolicyFileItem, PolicyRegionItem } from '#/api';

import { computed, onMounted, ref, watch } from 'vue';

import { Page, Tree, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, Card, InputSearch } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  archivePolicyFileApi,
  deletePolicyFileApi,
  expirePolicyFileApi,
  getPolicyFilesApi,
  getPolicyRegionTreeApi,
  markPolicyFileIncompleteApi,
  publishPolicyFileApi,
} from '#/api';
import { $t } from '#/locales';
import {
  showActionFailure,
  showActionLoading,
  showActionSuccess,
} from '../../system/shared/action-feedback';

import { useColumns, useGridFormSchema } from './data';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';

defineOptions({ name: 'PolicyFileList' });

const regionTree = ref<PolicyRegionItem[]>([]);
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
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getPolicyFilesApi({
            ...formValues,
            page: page.currentPage,
            pageSize: page.pageSize,
            regionId: selectedRegionId.value || undefined,
          });
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
  } as VxeTableGridOptions<PolicyFileItem>,
});

const filteredTree = computed(() => filterTree(regionTree.value, treeSearch.value));

onMounted(async () => {
  await refreshRegionTree();
});

watch(selectedRegionId, () => {
  gridApi.query();
});

function openCreate() {
  formModalApi.setData(
    selectedRegionId.value ? { regionId: selectedRegionId.value } : {},
  ).open();
}

function onDetail(row: PolicyFileItem) {
  detailDrawerApi.setData(row).open();
}

function onEdit(row: PolicyFileItem) {
  formModalApi.setData(row).open();
}

function onDelete(row: PolicyFileItem) {
  showActionLoading($t('ui.actionMessage.deleting', [row.title]));
  deletePolicyFileApi(row.id)
    .then(() => {
      showActionSuccess($t('ui.actionMessage.deleteSuccess', [row.title]));
      gridApi.query();
    })
    .catch((error) => {
      showActionFailure(error);
    });
}

async function onPatchStatus(
  row: PolicyFileItem,
  action: 'archive' | 'expire' | 'incomplete' | 'publish',
) {
  try {
    if (action === 'publish') {
      await publishPolicyFileApi(row.id);
    } else if (action === 'archive') {
      await archivePolicyFileApi(row.id);
    } else if (action === 'expire') {
      await expirePolicyFileApi(row.id);
    } else {
      await markPolicyFileIncompleteApi(row.id);
    }
    showActionSuccess($t('common.updateSuccess'));
    gridApi.query();
  } catch (error) {
    showActionFailure(error);
  }
}

async function refreshRegionTree() {
  regionTree.value = await getPolicyRegionTreeApi({ status: 1 });
}

function selectRegion(node: any) {
  selectedRegionId.value = node?.value?.id ?? '';
}

function clearRegionFilter() {
  selectedRegionId.value = '';
}

function filterTree(items: PolicyRegionItem[], keyword: string): PolicyRegionItem[] {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return items;
  }

  return items.reduce<PolicyRegionItem[]>((result, item) => {
    const children = item.children ? filterTree(item.children, normalizedKeyword) : [];
    const matched = item.name.includes(normalizedKeyword) || children.length > 0;

    if (matched) {
      result.push({ ...item, children });
    }

    return result;
  }, []);
}
</script>

<template>
  <Page auto-content-height>
    <DetailDrawer />
    <FormModal @success="gridApi.query()" />

    <div class="flex size-full gap-4">
      <Card class="w-64 shrink-0">
        <InputSearch
          v-model:value="treeSearch"
          class="mb-3"
          placeholder="搜索区域"
        />
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm text-gray-500">区域筛选</span>
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

      <div class="min-w-0 flex-1">
        <Grid table-title="区域政策文件">
          <template #toolbar-tools>
            <Button type="primary" @click="openCreate">
              <Plus class="size-5" />
              {{ $t('ui.actionTitle.create', ['区域政策文件']) }}
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
              ]"
              :dropdown-actions="[
                {
                  text: '发布',
                  icon: 'lucide:send',
                  onClick: () => onPatchStatus(row, 'publish'),
                },
                {
                  text: '标记未完善',
                  icon: 'lucide:circle-dashed',
                  onClick: () => onPatchStatus(row, 'incomplete'),
                },
                {
                  text: '标记过期',
                  icon: 'lucide:clock-3',
                  onClick: () => onPatchStatus(row, 'expire'),
                },
                {
                  text: '归档',
                  icon: 'lucide:archive',
                  onClick: () => onPatchStatus(row, 'archive'),
                },
                {
                  text: $t('common.delete'),
                  icon: 'lucide:trash-2',
                  danger: true,
                  popConfirm: {
                    title: $t('ui.actionMessage.deleteConfirm', [row.title]),
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
