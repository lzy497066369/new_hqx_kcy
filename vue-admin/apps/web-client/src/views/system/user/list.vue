<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemUserApi, SystemDeptApi } from '#/api';

import { computed, onMounted, ref, watch } from 'vue';

import { Page, Tree, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, Card, InputSearch } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { deleteUser, getDeptList, getUserList, updateUser } from '#/api';
import { $t } from '#/locales';
import {
  confirmAction,
  showActionFailure,
  showActionLoading,
  showActionSuccess,
} from '../shared/action-feedback';

import { useColumns, useGridFormSchema } from './data';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';

const allDeptList = ref<SystemDeptApi.SystemDept[]>([]);
const inputSearchValue = ref('');
const selectedDeptId = ref('');
const allDeptNode: SystemDeptApi.SystemDept = {
  id: '__all__',
  name: $t('common.all'),
  status: 1,
};

const deptList = computed<SystemDeptApi.SystemDept[]>(() => {
  if (!inputSearchValue.value) {
    return [allDeptNode, ...allDeptList.value];
  }

  return [
    allDeptNode,
    ...allDeptList.value.filter((dept: SystemDeptApi.SystemDept) =>
      dept.name.toLowerCase().includes(inputSearchValue.value.toLowerCase()),
    ),
  ];
});

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    fieldMappingTime: [['createTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getUserList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            deptId: selectedDeptId.value,
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
  } as VxeTableGridOptions<SystemUserApi.SystemUser>,
});

async function onStatusChange(
  newStatus: number,
  row: SystemUserApi.SystemUser,
) {
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
    await updateUser(row.id, { status: newStatus });
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

function onEdit(row: SystemUserApi.SystemUser) {
  formDrawerApi.setData(row).open();
}

function onDetail(row: SystemUserApi.SystemUser) {
  detailDrawerApi.setData(row).open();
}

function onDelete(row: SystemUserApi.SystemUser) {
  showActionLoading($t('ui.actionMessage.deleting', [row.name]));
  deleteUser(row.id)
    .then(() => {
      showActionSuccess($t('ui.actionMessage.deleteSuccess', [row.name]));
      onRefresh();
    })
    .catch((error) => {
      showActionFailure(error);
    });
}

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  formDrawerApi.setData({}).open();
}

async function loadDeptList() {
  allDeptList.value = await getDeptList();
}

function selectDept(node: any) {
  const selectedId = node?.value?.id ?? '';
  selectedDeptId.value = selectedId === '__all__' ? '' : selectedId;
  gridApi.query();
}

function clearDeptFilter() {
  selectedDeptId.value = '';
  gridApi.query();
}

onMounted(() => {
  loadDeptList();
});

watch(inputSearchValue, (value) => {
  if (!value) {
    loadDeptList();
  }
});
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <DetailDrawer @success="onRefresh" />
    <div class="flex size-full">
      <Card class="w-1/6">
        <InputSearch
          v-model:value="inputSearchValue"
          :placeholder="$t('system.user.placeholder')"
        />
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm text-gray-500">{{ $t('system.user.dept') }}</span>
          <Button size="small" type="link" @click="clearDeptFilter">
            {{ $t('common.all') }}
          </Button>
        </div>
        <Tree
          :tree-data="deptList"
          :default-expanded-level="2"
          label-field="name"
          value-field="id"
          @select="selectDept"
        />
      </Card>

      <div class="ml-4 w-5/6">
        <Grid :table-title="$t('system.user.list')">
          <template #toolbar-tools>
            <Button type="primary" @click="onCreate">
              <Plus class="size-5" />
              {{ $t('ui.actionTitle.create', [$t('system.user.name')]) }}
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
                  text: $t('common.delete'),
                  icon: 'lucide:trash-2',
                  danger: true,
                  popConfirm: {
                    title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                    confirm: () => onDelete(row),
                  },
                  auth: ['AC_100100'],
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
