<script lang="ts" setup>
import type { DescriptionsItemType } from '@vben/common-ui';
import type { SystemMenuApi } from '#/api/system/menu';

import { computed, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { h } from 'vue';

import { Tag } from 'antdv-next';

import { $t } from '#/locales';

const detailData = ref<SystemMenuApi.SystemMenu>();

const items = computed<DescriptionsItemType[]>(() => {
  const row = detailData.value;
  const enabled = row?.status === 1;
  return [
    {
      label: $t('system.menu.menuTitle'),
      content: () =>
        row?.meta?.icon
          ? h(
              'div',
              { class: 'flex items-center gap-2' },
              [
                h(IconifyIcon, { icon: row.meta?.icon, class: 'size-5' }),
                h('span', row.meta?.title ?? ''),
              ],
            )
          : row?.meta?.title ?? '',
    },
    { label: $t('system.menu.menuName'), content: row?.name },
    {
      label: '所属端',
      content: row?.portalType === 'client' ? '客户端' : '管理端',
    },
    { label: $t('system.menu.type'), content: row?.type },
    { label: $t('system.menu.authCode'), content: row?.authCode ?? '-' },
    { label: $t('system.menu.path'), content: row?.path },
    { label: $t('system.menu.component'), content: row?.component ?? '-' },
    {
      label: $t('system.menu.status'),
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
    { label: $t('system.menu.createTime'), content: row?.createTime },
  ];
});

const [Drawer, drawerApi] = useVbenDrawer({
  onOpenChange(isOpen) {
    if (isOpen) {
      detailData.value = drawerApi.getData<SystemMenuApi.SystemMenu>();
    }
  },
});
</script>

<template>
  <Drawer :footer="false" :title="$t('common.detail')">
    <VbenDescriptions bordered :column="1" :items="items" />
  </Drawer>
</template>
