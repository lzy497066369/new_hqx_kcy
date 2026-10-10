<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemUserApi, SystemDeptApi } from '#/api';
import type { PortalType } from '#/api/system/portal-type';

import { computed, onMounted, ref, watch } from 'vue';

import { Page, Tree, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, Card, InputSearch, Select } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteUser,
  getDeptList,
  getEnterpriseProfilesApi,
  getUserList,
  updateUser,
} from '#/api';
import { $t } from '#/locales';
import {
  confirmAction,
  showActionFailure,
  showActionLoading,
  showActionSuccess,
} from '../shared/action-feedback';
import PortalTypeSwitch from '../shared/PortalTypeSwitch.vue';
import { DEFAULT_PORTAL_TYPE } from '../shared/portal-type';

import { useColumns, useGridFormSchema } from './data';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';

const allDeptList = ref<SystemDeptApi.SystemDept[]>([]);
const enterpriseOptions = ref<Array<{ label: string; value: string }>>([]);
const inputSearchValue = ref('');
const selectedDeptId = ref('');
const selectedEnterpriseId = ref<string>();
const activePortalType = ref<PortalType>(DEFAULT_PORTAL_TYPE);
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

const isClientPortal = computed(() => activePortalType.value === 'client');

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
    columns: useColumns(onStatusChange, activePortalType.value),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getUserList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            deptId: isClientPortal.value ? undefined : selectedDeptId.value,
            enterpriseId: isClientPortal.value
              ? selectedEnterpriseId.value
              : undefined,
            portalType: activePortalType.value,
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
    await updateUser(row.id, {
      portalType: row.portalType ?? activePortalType.value,
      status: newStatus,
    });
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
  formDrawerApi.setData({ ...row, portalType: activePortalType.value }).open();
}

function onDetail(row: SystemUserApi.SystemUser) {
  detailDrawerApi.setData(row).open();
}

function onDelete(row: SystemUserApi.SystemUser) {
  showActionLoading($t('ui.actionMessage.deleting', [row.name]));
  deleteUser(row.id, activePortalType.value)
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
  formDrawerApi.setData({ portalType: activePortalType.value }).open();
}

function onPortalTypeChange() {
  selectedDeptId.value = '';
  selectedEnterpriseId.value = undefined;
  gridApi.setGridOptions({
    columns: useColumns(onStatusChange, activePortalType.value),
  });
  gridApi.query();
}

async function loadDeptList() {
  allDeptList.value = await getDeptList();
}

async function loadEnterpriseList() {
  const result = await getEnterpriseProfilesApi({ page: 1, pageSize: 1000 });
  enterpriseOptions.value = result.items.map((item) => ({
    label: item.name,
    value: item.id,
  }));
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

function onEnterpriseChange() {
  gridApi.query();
}

function clearEnterpriseFilter() {
  selectedEnterpriseId.value = undefined;
  gridApi.query();
}

onMounted(() => {
  loadDeptList();
  loadEnterpriseList();
});

watch(inputSearchValue, (value) => {
  if (!value) {
    loadDeptList();
  }
});
</script>

<template>
  <Page auto-content-height>
    <FormDrawer :portal-type="activePortalType" @success="onRefresh" />
    <DetailDrawer @success="onRefresh" />
    <PortalTypeSwitch v-model="activePortalType" @update:model-value="onPortalTypeChange" />
    <div class="flex size-full">
      <Card v-if="!isClientPortal" class="w-1/6">
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
      <Card v-else class="w-1/6">
        <div class="mb-2 text-sm text-gray-500">关联公司</div>
        <Select
          v-model:value="selectedEnterpriseId"
          allow-clear
          class="w-full"
          option-filter-prop="label"
          :options="enterpriseOptions"
          placeholder="选择公司"
          show-search
          @change="onEnterpriseChange"
        />
        <Button class="mt-3 px-0" size="small" type="link" @click="clearEnterpriseFilter">
          查看全部公司
        </Button>
        <div class="mt-4 rounded-xl bg-sky-50 p-3 text-xs leading-5 text-sky-800">
          客户端用户不再按部门维护，请通过关联公司筛选和绑定账号。
        </div>
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
