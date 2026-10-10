<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed } from 'vue';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { preferences } from '@vben/preferences';

import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
const pageTitle = computed(() => `${preferences.app.name} 管理端`);
const pageDescription = computed(() => '统一登录入口，服务于用户、权限、菜单和公司授权管理。');

const formSchema = computed((): VbenFormSchema[] => [
  {
    component: 'VbenInput',
    componentProps: { autocomplete: 'username', placeholder: '请输入账号' },
    fieldName: 'username',
    label: '账号',
    rules: z.string().min(1, { message: '请输入账号' }),
  },
  {
    component: 'VbenInputPassword',
    componentProps: { autocomplete: 'current-password', placeholder: '请输入密码' },
    fieldName: 'password',
    label: '密码',
    rules: z.string().min(1, { message: '请输入密码' }),
  },
]);
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    :page-description="pageDescription"
    :page-title="pageTitle"
    :show-code-login="false"
    :show-header="false"
    :show-qrcode-login="false"
    :show-register="false"
    :show-third-party-login="false"
    @submit="authStore.authLogin"
  />
</template>
