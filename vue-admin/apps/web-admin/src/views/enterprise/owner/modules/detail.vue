<script setup lang="ts">
import type { EnterpriseOwnerItem } from '#/api';
import type { DescriptionsItemType } from '@vben/common-ui';

import { computed, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';

import { useDescriptionItems } from '../data';

const detailData = ref<EnterpriseOwnerItem>();

const items = computed<DescriptionsItemType[]>(() =>
  useDescriptionItems(detailData.value),
);

const [Drawer, drawerApi] = useVbenDrawer({
  onOpenChange(isOpen) {
    if (isOpen) {
      detailData.value = drawerApi.getData<EnterpriseOwnerItem>();
    }
  },
});
</script>

<template>
  <Drawer :footer="false" title="企业负责人详情">
    <VbenDescriptions bordered :column="1" :items="items" />
  </Drawer>
</template>
