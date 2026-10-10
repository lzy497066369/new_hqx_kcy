<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { Alert, Spin } from 'antdv-next';

import { useAuthStore } from '#/store';

const authStore = useAuthStore();
const error = shallowRef('');

onMounted(async () => {
  try { await authStore.completeIamLogin(); } catch (reason) { error.value = reason instanceof Error ? reason.message : 'IAM 登录失败'; }
});
</script>
<template><Page auto-content-height><main class="iam-callback"><Alert v-if="error" :message="error" show-icon type="error" /><Spin v-else size="large" /></main></Page></template>
<style scoped>.iam-callback{display:grid;min-height:320px;place-items:center}</style>
