<script lang="ts" setup>
import type { DescriptionsItemType } from '@vben/common-ui';
import type { SystemOperationLogApi } from '#/api';

import { computed, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';

import { h } from 'vue';

import { Tag } from 'antdv-next';

import { $t } from '#/locales';

const detailData = ref<SystemOperationLogApi.SystemOperationLog>();

const items = computed<DescriptionsItemType[]>(() => {
  const row = detailData.value;
  const enabled = row?.success === 1;

  return [
    { label: $t('system.operationLog.id'), content: row?.id },
    { label: $t('system.operationLog.userName'), content: row?.userName ?? '-' },
    { label: $t('system.operationLog.realName'), content: row?.realName ?? '-' },
    { label: $t('system.operationLog.module'), content: row?.module },
    { label: $t('system.operationLog.action'), content: row?.action },
    { label: $t('system.operationLog.requestPath'), content: row?.requestPath ?? '-' },
    { label: $t('system.operationLog.bizId'), content: row?.bizId ?? '-' },
    {
      label: $t('system.operationLog.success'),
      content: () =>
        h(
          Tag,
          { color: enabled ? 'success' : 'error' },
          {
            default: () =>
              enabled
                ? $t('system.operationLog.successLabel')
                : $t('system.operationLog.failLabel'),
          },
        ),
    },
    { label: $t('system.operationLog.cost'), content: `${row?.cost ?? 0} ms` },
    { label: $t('system.operationLog.createTime'), content: row?.createTime },
    { label: $t('system.operationLog.ip'), content: row?.ip ?? '-' },
    { label: $t('system.operationLog.method'), content: row?.method ?? '-' },
    { label: $t('system.operationLog.userAgent'), content: row?.userAgent ?? '-' },
    { label: $t('system.operationLog.errorMessage'), content: row?.errorMessage ?? '-' },
    { label: $t('system.operationLog.paramsText'), content: row?.paramsText ?? '-' },
    { label: $t('system.operationLog.resultText'), content: row?.resultText ?? '-' },
  ];
});

const [Drawer, drawerApi] = useVbenDrawer({
  onOpenChange(isOpen) {
    if (isOpen) {
      detailData.value = drawerApi.getData<SystemOperationLogApi.SystemOperationLog>();
    }
  },
});
</script>

<template>
  <Drawer :footer="false" :title="$t('common.detail')" width="720">
    <VbenDescriptions bordered :column="1" :items="items" />
  </Drawer>
</template>
