<script setup lang="ts">
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PolicyProjectItem } from '#/api';

import { shallowRef } from 'vue';

import { Page } from '@vben/common-ui';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { getPolicyProjectsApi } from '#/api';

import { useGridFormSchema } from './data';
import DeclarationSchemeWorkspace from './modules/declaration-scheme-drawer.vue';

defineOptions({ name: 'PolicyDeclarationSchemeList' });

const selectedProject = shallowRef<PolicyProjectItem>();

const [Grid] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: [
      { field: 'name', minWidth: 220, title: '统一政策项目' },
      { field: 'policyType', minWidth: 160, title: '政策类型' },
      { field: 'applicableObjects', minWidth: 220, title: '适用对象' },
      { field: 'updateTime', title: '更新时间', width: 180 },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 130,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => await getPolicyProjectsApi({
          ...formValues,
          page: page.currentPage,
          pageSize: page.pageSize,
        }),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<PolicyProjectItem>,
});

function openDeclarationScheme(row: PolicyProjectItem) {
  selectedProject.value = row;
}

function closeWorkspace() {
  selectedProject.value = undefined;
}
</script>

<template>
  <Page auto-content-height>
    <DeclarationSchemeWorkspace
      v-if="selectedProject"
      :project="selectedProject"
      @close="closeWorkspace"
    />
    <Grid v-else table-title="地区申报方案">
      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: '配置方案',
              icon: 'lucide:workflow',
              onClick: () => openDeclarationScheme(row),
            },
          ]"
          align="center"
        />
      </template>
    </Grid>
  </Page>
</template>
