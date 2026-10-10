<script setup lang="ts">
import { computed, ref } from 'vue';

import { Profile } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';
import { $t } from '#/locales';

import ProfileBase from './base-setting.vue';
import ProfilePasswordSetting from './password-setting.vue';
import ProfileSecuritySetting from './security-setting.vue';

const userStore = useUserStore();

const tabsValue = ref<string>('basic');

const tabs = computed(() => [
  {
    label: $t('page.auth.basicSetting'),
    value: 'basic',
  },
  {
    label: $t('page.auth.securitySetting'),
    value: 'security',
  },
  {
    label: $t('page.auth.passwordSetting'),
    value: 'password',
  },
]);
</script>

<template>
  <Profile
    v-model:model-value="tabsValue"
    :title="$t('page.auth.profile')"
    :user-info="userStore.userInfo"
    :tabs="tabs"
  >
    <template #content>
      <ProfileBase v-if="tabsValue === 'basic'" />
      <ProfileSecuritySetting v-if="tabsValue === 'security'" />
      <ProfilePasswordSetting v-if="tabsValue === 'password'" />
    </template>
  </Profile>
</template>
