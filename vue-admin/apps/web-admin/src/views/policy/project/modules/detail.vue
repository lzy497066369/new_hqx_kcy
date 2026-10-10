<script setup lang="ts">
import type { DescriptionsItemType } from '@vben/common-ui';
import type { PolicyProjectItem } from '#/api';

import { computed, h, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';

import { Tag } from 'antdv-next';

import { $t } from '#/locales';

const detailData = ref<PolicyProjectItem>();

const items = computed<DescriptionsItemType[]>(() => {
  const row = detailData.value;
  const enabled = row?.enabled === 1;

  return [
    { label: '项目名称', content: row?.name ?? '-' },
    { label: '政策类型', content: row?.policyType ?? '-' },
    { label: '适用对象', content: row?.applicableObjects ?? '-' },
    { label: '基础说明', content: row?.basicDescription ?? '-' },
    {
      label: '状态',
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
    { label: '创建时间', content: row?.createTime ?? '-' },
    { label: '更新时间', content: row?.updateTime ?? '-' },
  ];
});

const [Drawer, drawerApi] = useVbenDrawer({
  onOpenChange(isOpen) {
    if (isOpen) {
      detailData.value = drawerApi.getData<PolicyProjectItem>();
    }
  },
});
</script>

<template>
  <Drawer :footer="false" :title="$t('common.detail')">
    <VbenDescriptions bordered :column="1" :items="items" />
  </Drawer>
</template>
