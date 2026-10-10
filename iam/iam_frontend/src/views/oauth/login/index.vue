<script setup lang="ts">
import { reactive, shallowRef, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { Button, Form, FormItem, Input, InputPassword, message } from 'antdv-next';

import { createSsoSessionApi } from '#/api';

const route = useRoute();
const loading = shallowRef(false);
const loginTypes = [
  { key: 'enterprise', label: '企业负责人' },
  { key: 'overall', label: '总负责人' },
] as const;
const loginType = ref<(typeof loginTypes)[number]['key']>('enterprise');
const returnTo = Array.isArray(route.query.return_to) ? route.query.return_to[0] : route.query.return_to;
if (returnTo) {
  try {
    const callback = new URL(returnTo, window.location.origin);
    const requestedType = callback.searchParams.get('login_type');
    if (loginTypes.some((item) => item.key === requestedType)) {
      loginType.value = requestedType as (typeof loginTypes)[number]['key'];
    }
  } catch {
    // Keep the default persona for an invalid return URL.
  }
}
const form = reactive({ password: '', username: '' });

function resolveReturnTo(): string {
  const value = Array.isArray(route.query.return_to) ? route.query.return_to[0] : route.query.return_to;
  if (!value?.startsWith('/oauth/authorize?')) return '/iam/overview';
  const issuer = String(import.meta.env.VITE_IAM_ISSUER || window.location.origin).replace(/\/$/, '');
  const target = new URL(`${issuer}${value}`);
  target.searchParams.set('login_type', loginType.value);
  return target.toString();
}

async function login() {
  if (!form.username.trim() || !form.password) { message.error('请输入账号和密码'); return; }
  loading.value = true;
  try {
    await createSsoSessionApi({ password: form.password, username: form.username.trim() });
    window.location.assign(resolveReturnTo());
  } finally { loading.value = false; }
}
</script>
<template><Page auto-content-height><main class="oauth-login"><section class="oauth-login__panel"><div><div class="oauth-login__eyebrow">企业服务平台</div><h1>统一登录</h1><p>请选择登录身份，使用对应账号进入工作台。</p></div><nav class="oauth-login__tabs" aria-label="登录身份" role="tablist"><button v-for="item in loginTypes" :key="item.key" type="button" role="tab" :aria-selected="loginType === item.key" :class="{ 'is-active': loginType === item.key }" @click="loginType = item.key">{{ item.label }}</button></nav><Form layout="vertical"><FormItem label="账号" required><Input v-model:value="form.username" autocomplete="username" /></FormItem><FormItem label="密码" required><InputPassword v-model:value="form.password" autocomplete="current-password" /></FormItem><Button block html-type="button" @click="login" :loading="loading" type="primary">登录</Button></Form></section></main></Page></template>
<style scoped>.oauth-login{display:grid;min-height:100%;place-items:center;padding:24px;background:#f6f8fb}.oauth-login__panel{display:grid;gap:24px;width:min(100%,520px);padding:32px;background:#fff;border:1px solid #d9e1e8;border-radius:8px}.oauth-login__tabs{display:grid;grid-template-columns:repeat(2,1fr);border-bottom:1px solid #e5e7eb}.oauth-login__tabs button{position:relative;min-height:48px;border:0;background:transparent;color:#667085;font-size:16px;cursor:pointer}.oauth-login__tabs button.is-active{color:#182230;font-weight:600}.oauth-login__tabs button.is-active:after{position:absolute;right:8px;bottom:-1px;left:8px;height:4px;border-radius:4px;background:#4285f4;content:''}.oauth-login__eyebrow{color:#0f766e;font-size:14px;font-weight:600}.oauth-login h1{margin:8px 0 0;color:#172033;font-size:24px;font-weight:600}.oauth-login p{margin:8px 0 0;color:#667085;font-size:14px;line-height:1.6}</style>
