<script setup lang="ts">
import type { EnterpriseUserItem } from '#/api';
import type { DescriptionsItemType } from '@vben/common-ui';

import { computed, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';

import { useDescriptionItems } from '../data';

const detailData = ref<EnterpriseUserItem>();
const items = computed<DescriptionsItemType[]>(() =>
  useDescriptionItems(detailData.value),
);

const [Drawer, drawerApi] = useVbenDrawer({
  onOpenChange(isOpen) {
    if (isOpen) {
      detailData.value = drawerApi.getData<EnterpriseUserItem>();
    }
  },
});
</script>

<template>
  <Drawer :footer="false" title="企业用户详情">
    <VbenDescriptions bordered :column="1" :items="items" />
  </Drawer>
</template>
