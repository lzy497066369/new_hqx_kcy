<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed, ref } from 'vue';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { preferences } from '@vben/preferences';
import { isIamAuthEnabled } from '#/auth/iam-sso';
import { $t } from '#/locales';

import { useAuthStore } from '#/store';
import { CLIENT_PERSONA_LABELS, type ClientPersona, setActiveClientPersona } from '#/auth/client-persona';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
const selectedPersona = ref<ClientPersona>('enterprise');
const personaTabs = (['enterprise', 'overall'] as const).map((key) => ({
  key,
  label: CLIENT_PERSONA_LABELS[key],
}));

function submitLogin(values: Record<string, unknown>) {
  setActiveClientPersona(selectedPersona.value);
  return authStore.authLogin(values);
}

const pageTitle = computed(() => `${preferences.app.name} ${$t('page.auth.clientPlatform')}`);
const pageDescription = computed(() => $t('page.auth.loginDesc'));

const formSchema = computed((): VbenFormSchema[] => {
  if (isIamAuthEnabled()) {
    return [];
  }

  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('page.auth.usernamePlaceholder'),
      },
      fieldName: 'username',
      label: $t('page.auth.username'),
      rules: z.string().min(1, { message: $t('page.auth.usernamePlaceholder') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('page.auth.passwordPlaceholder'),
      },
      fieldName: 'password',
      label: $t('page.auth.password'),
      rules: z.string().min(1, { message: $t('page.auth.passwordPlaceholder') }),
    },
  ];
});
</script>

<template>
  <div class="login-shell">
    <nav class="login-persona-tabs" aria-label="登录身份" role="tablist">
      <button
        v-for="item in personaTabs"
        :key="item.key"
        type="button"
        role="tab"
        :aria-selected="selectedPersona === item.key"
        :class="{ 'is-active': selectedPersona === item.key }"
        @click="selectedPersona = item.key"
      >{{ item.label }}</button>
    </nav>
    <AuthenticationLogin
    :page-description="pageDescription"
    :page-title="pageTitle"
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    :show-code-login="false"
    :show-header="false"
    :show-qrcode-login="false"
    :show-register="false"
    :show-third-party-login="false"
    @submit="submitLogin"
    />
  </div>
</template>

<style scoped>
.login-shell { width: min(100%, 420px); margin: 0 auto; }
.login-persona-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0 auto 12px; border-bottom: 1px solid #e5e7eb; }
.login-persona-tabs button { position: relative; min-height: 48px; border: 0; background: transparent; color: #667085; font-size: 16px; cursor: pointer; }
.login-persona-tabs button.is-active { color: #182230; font-weight: 600; }
.login-persona-tabs button.is-active::after { position: absolute; right: 8px; bottom: -1px; left: 8px; height: 4px; border-radius: 4px; background: #4285f4; content: ''; }
</style>
