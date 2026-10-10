<script lang="ts" setup>
import type { DescriptionsItemType } from '@vben/common-ui';
import type { SystemDeptApi } from '#/api/system/dept';

import { computed, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';

import { h } from 'vue';

import { Tag } from 'antdv-next';

import { $t } from '#/locales';

const detailData = ref<SystemDeptApi.SystemDept>();

const items = computed<DescriptionsItemType[]>(() => {
  const enabled = detailData.value?.status === 1;
  return [
    { label: $t('system.dept.deptName'), content: detailData.value?.name },
    { label: $t('system.dept.name'), content: detailData.value?.id },
    {
      label: $t('system.dept.status'),
      content: () =>
        h(
          Tag,
          {
            color: enabled ? 'success' : 'error',
          },
          {
            default: () =>
              enabled ? $t('common.enabled') : $t('common.disabled'),
          },
        ),
    },
    { label: $t('system.dept.parentDept'), content: detailData.value?.parentId ?? '-' },
    { label: $t('system.dept.remark'), content: detailData.value?.remark ?? '-' },
    { label: $t('system.dept.createTime'), content: detailData.value?.createTime },
  ];
});

const [Drawer, drawerApi] = useVbenDrawer({
  onOpenChange(isOpen) {
    if (isOpen) {
      detailData.value = drawerApi.getData<SystemDeptApi.SystemDept>();
    }
  },
});
</script>

<template>
  <Drawer :footer="false" :title="$t('common.detail')">
    <VbenDescriptions bordered :column="1" :items="items" />
  </Drawer>
</template>
