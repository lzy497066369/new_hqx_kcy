<script lang="ts" setup>
import type { SystemRoleApi } from '#/api/system/role';
import type { SystemMenuApi } from '#/api/system/menu';

import { computed, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';

import { getMenuList } from '#/api/system/menu';
import { $t } from '#/locales';

import { useDescriptionItems } from '../data';

const detailData = ref<SystemRoleApi.SystemRole>();
const menuList = ref<SystemMenuApi.SystemMenu[]>([]);

const items = computed(() => useDescriptionItems(detailData.value, menuList.value));

const [Drawer, drawerApi] = useVbenDrawer({
  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }

    detailData.value = drawerApi.getData<SystemRoleApi.SystemRole>();
    if (menuList.value.length === 0) {
      menuList.value = await getMenuList();
    }
  },
});
</script>

<template>
  <Drawer :footer="false" :title="$t('common.detail')">
    <VbenDescriptions bordered :column="1" :items="items" />
  </Drawer>
</template>
