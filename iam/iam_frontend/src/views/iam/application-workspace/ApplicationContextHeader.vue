<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue';

import { Button, Select } from 'antdv-next';
import { useRoute, useRouter } from 'vue-router';

import { listAppsApi, type IamApp } from '#/api';

const props = defineProps<{
  active: 'access' | 'companies' | 'menus' | 'overview';
}>();

const route = useRoute();
const router = useRouter();
const apps = shallowRef<IamApp[]>([]);
const selectedAppCode = shallowRef('');

const appOptions = computed(() => apps.value.map((app) => ({
  label: `${app.appName} (${app.appCode})`,
  value: app.appCode,
})));
const currentApp = computed(() => apps.value.find((app) => app.appCode === selectedAppCode.value));

function routeNameForActive() {
  return props.active === 'access'
    ? 'IamApplicationAccess'
    : props.active === 'companies'
      ? 'IamApplicationCompanyAccess'
    : props.active === 'menus'
      ? 'IamApplicationMenus'
      : 'IamApplicationWorkspaceDetail';
}

async function loadApps() {
  apps.value = (await listAppsApi()).items.filter((item) => item.status);
  selectedAppCode.value = String(route.params.appCode ?? '');
}

function selectApp(value: unknown) {
  const appCode = String(value ?? '');
  if (!appCode) return;
  void router.push({ name: routeNameForActive(), params: { appCode } });
}

function openClients() {
  void router.push({ name: 'IamApps', query: { clientApp: selectedAppCode.value } });
}

watch(() => route.params.appCode, (appCode) => {
  selectedAppCode.value = String(appCode ?? '');
});
onMounted(() => void loadApps());
</script>

<template>
  <section class="application-context">
    <div class="application-context__identity">
      <span class="application-context__label">当前应用</span>
      <strong class="application-context__name">{{ currentApp?.appName ?? selectedAppCode }}</strong>
    </div>
    <Select
      v-model:value="selectedAppCode"
      class="application-context__select"
      :options="appOptions"
      @update:value="selectApp"
    />
    <nav class="application-context__nav" aria-label="应用授权导航">
      <Button :type="active === 'overview' ? 'primary' : 'default'" @click="selectApp(selectedAppCode)">概览</Button>
      <Button :type="active === 'access' ? 'primary' : 'default'" @click="router.push({ name: 'IamApplicationAccess', params: { appCode: selectedAppCode } })">角色与权限</Button>
      <Button :type="active === 'menus' ? 'primary' : 'default'" @click="router.push({ name: 'IamApplicationMenus', params: { appCode: selectedAppCode } })">业务菜单</Button>
      <Button :type="active === 'companies' ? 'primary' : 'default'" @click="router.push({ name: 'IamApplicationCompanyAccess', params: { appCode: selectedAppCode } })">公司访问授权</Button>
      <Button @click="openClients">SSO Client</Button>
    </nav>
  </section>
</template>

<style scoped>
.application-context { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 16px; padding: 14px 16px; background: #fff; border: 1px solid #d9e1e8; border-radius: 8px; }
.application-context__identity { display: grid; gap: 2px; min-width: 140px; }
.application-context__label { color: #667085; font-size: 12px; }
.application-context__name { color: #172033; font-size: 14px; font-weight: 600; }
.application-context__select { min-width: 240px; }
.application-context__nav { display: flex; flex-wrap: wrap; gap: 8px; margin-left: auto; }
@media (max-width: 800px) { .application-context__nav { margin-left: 0; width: 100%; } .application-context__select { flex: 1; min-width: 200px; } }
</style>
