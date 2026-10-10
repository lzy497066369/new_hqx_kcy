<script setup lang="ts">
import type { DescriptionsItemType } from '@vben/common-ui';
import type { PolicyRegionItem } from '#/api';

import { computed, h, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';

import { Tag } from 'antdv-next';

import { $t } from '#/locales';

import { getRegionLevelLabel } from '../data';

const detailData = ref<PolicyRegionItem>();

const items = computed<DescriptionsItemType[]>(() => {
  const enabled = detailData.value?.status === 1;
  return [
    { label: '区域名称', content: detailData.value?.name },
    { label: '区域ID', content: detailData.value?.id },
    { label: '区域编码', content: detailData.value?.remark ?? '-' },
    {
      label: '层级',
      content: getRegionLevelLabel(String(detailData.value?.level ?? '')),
    },
    { label: '上级区域ID', content: detailData.value?.parentId ?? '-' },
    {
      label: '状态',
      content: () =>
        h(
          Tag,
          { color: enabled ? 'success' : 'error' },
          {
            default: () =>
              enabled ? $t('common.enabled') : $t('common.disabled'),
          },
        ),
    },
    { label: '排序', content: detailData.value?.sortNum ?? 0 },
    { label: '创建时间', content: detailData.value?.createTime },
    { label: '更新时间', content: detailData.value?.updateTime },
  ];
});

const [Drawer, drawerApi] = useVbenDrawer({
  onOpenChange(isOpen) {
    if (isOpen) {
      detailData.value = drawerApi.getData<PolicyRegionItem>();
    }
  },
});
</script>

<template>
  <Drawer :footer="false" :title="$t('common.detail')">
    <VbenDescriptions bordered :column="1" :items="items" />
  </Drawer>
</template>
