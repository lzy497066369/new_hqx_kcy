<script setup lang="ts">
import { computed } from 'vue';

import { ProfileSecuritySetting } from '@vben/common-ui';

import { $t } from '#/locales';

const formSchema = computed(() => [
  {
    value: true,
    fieldName: 'accountPassword',
    label: $t('page.auth.accountPassword'),
    description: $t('page.auth.passwordSetting'),
  },
  {
    value: true,
    fieldName: 'securityPhone',
    label: $t('page.auth.securityPhone'),
    description: $t('page.auth.securityPhone'),
  },
  {
    value: true,
    fieldName: 'securityEmail',
    label: $t('page.auth.securityEmail'),
    description: $t('page.auth.securityEmail'),
  },
]);
</script>

<template>
  <ProfileSecuritySetting :form-schema="formSchema" />
</template>
