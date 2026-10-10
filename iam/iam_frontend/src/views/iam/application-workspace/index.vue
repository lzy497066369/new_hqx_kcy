<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { Button, Card, Empty, Tag } from 'antdv-next';
import { useRoute, useRouter } from 'vue-router';

import { listAppsApi, type IamApp } from '#/api';
import ApplicationContextHeader from './ApplicationContextHeader.vue';

const route = useRoute();
const router = useRouter();
const apps = shallowRef<IamApp[]>([]);
const loading = shallowRef(false);

const selectedAppCode = computed(() => String(route.params.appCode ?? ''));
const selectedApp = computed(() => apps.value.find((item) => item.appCode === selectedAppCode.value));

async function reload() {
  loading.value = true;
  try {
    apps.value = (await listAppsApi()).items.filter((item) => item.status);
  } finally {
    loading.value = false;
  }
}

function openWorkspace(appCode: string) {
  void router.push({ name: 'IamApplicationWorkspaceDetail', params: { appCode } });
}

function openAppPage(name: 'IamApplicationAccess' | 'IamApplicationCompanyAccess' | 'IamApplicationMenus') {
  if (!selectedAppCode.value) return;
  void router.push({ name, params: { appCode: selectedAppCode.value } });
}

function openClients() {
  if (!selectedAppCode.value) return;
  void router.push({ name: 'IamApps', query: { clientApp: selectedAppCode.value } });
}

onMounted(() => void reload());
</script>

<template>
  <Page auto-content-height>
    <main class="application-workspace">
      <header class="application-workspace__header">
        <div>
          <h1 class="application-workspace__title">应用授权工作台</h1>
          <p class="application-workspace__summary">角色、权限码、业务菜单和 SSO Client 始终按应用隔离管理。</p>
        </div>
      </header>

      <template v-if="selectedAppCode && selectedApp">
        <ApplicationContextHeader active="overview" />
        <section class="application-workspace__selected">
          <div class="application-workspace__selected-heading">
            <div>
              <span class="application-workspace__eyebrow">{{ selectedApp.appCode }}</span>
              <h2 class="application-workspace__selected-title">{{ selectedApp.appName }}</h2>
              <p class="application-workspace__selected-summary">用户访问授权和公司数据范围在全局目录中维护，应用内资源在此处维护。</p>
            </div>
            <Tag color="green">已启用</Tag>
          </div>
          <div class="application-workspace__actions">
            <Card class="application-workspace__action"><IconifyIcon icon="lucide:badge-check" /><h3>角色与权限</h3><p>维护角色、权限码及角色授权关系。</p><Button type="link" @click="openAppPage('IamApplicationAccess')">进入管理</Button></Card>
            <Card class="application-workspace__action"><IconifyIcon icon="lucide:menu" /><h3>业务菜单</h3><p>维护该应用自己的目录、路由和按钮资源。</p><Button type="link" @click="openAppPage('IamApplicationMenus')">进入管理</Button></Card>
            <Card class="application-workspace__action"><IconifyIcon icon="lucide:log-in" /><h3>SSO Client</h3><p>维护回调地址、授权方式和令牌有效期。</p><Button type="link" @click="openClients">进入配置</Button></Card>
            <Card class="application-workspace__action"><IconifyIcon icon="lucide:building-2" /><h3>公司访问授权</h3><p>绑定公司负责人、成员、数据范围和默认公司。</p><Button type="link" @click="openAppPage('IamApplicationCompanyAccess')">进入管理</Button></Card>
          </div>
        </section>
      </template>

      <section v-else class="application-workspace__list">
        <Empty v-if="!loading && !apps.length" description="暂无已启用应用" />
        <Card v-for="app in apps" :key="app.id" class="application-workspace__app-card">
          <div>
            <span class="application-workspace__eyebrow">{{ app.appCode }}</span>
            <h2 class="application-workspace__app-name">{{ app.appName }}</h2>
            <p class="application-workspace__app-meta">{{ app.portalType }} 门户 · {{ app.appType }} 应用</p>
          </div>
          <Button type="primary" @click="openWorkspace(app.appCode)">进入授权工作台</Button>
        </Card>
      </section>
    </main>
  </Page>
</template>

<style scoped>
.application-workspace { min-height: 100%; padding: 24px; background: #f6f8fb; }
.application-workspace__header, .application-workspace__selected-heading, .application-workspace__app-card :deep(.ant-card-body) { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.application-workspace__header { align-items: flex-start; margin-bottom: 16px; }
.application-workspace__title, .application-workspace__selected-title, .application-workspace__app-name { margin: 0; color: #172033; font-weight: 600; }
.application-workspace__title { font-size: 20px; }
.application-workspace__selected-title { font-size: 20px; }
.application-workspace__app-name { margin-top: 4px; font-size: 17px; }
.application-workspace__summary, .application-workspace__selected-summary, .application-workspace__app-meta, .application-workspace__action p { margin: 6px 0 0; color: #667085; font-size: 14px; }
.application-workspace__selected { margin-top: 16px; padding: 20px; background: #fff; border: 1px solid #d9e1e8; border-radius: 8px; }
.application-workspace__eyebrow { color: #0f766e; font-size: 13px; font-weight: 600; }
.application-workspace__actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 20px; }
.application-workspace__action :deep(.ant-card-body) { min-height: 190px; display: flex; flex-direction: column; align-items: flex-start; }
.application-workspace__action :deep(svg) { color: #0f766e; width: 22px; height: 22px; }
.application-workspace__action h3 { margin: 14px 0 0; color: #172033; font-size: 16px; font-weight: 600; }
.application-workspace__action :deep(.ant-btn) { margin-top: auto; padding-left: 0; }
.application-workspace__list { display: grid; gap: 12px; }
.application-workspace__app-card :deep(.ant-card-body) { min-height: 104px; }
@media (max-width: 1100px) { .application-workspace__actions { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .application-workspace { padding: 16px; } .application-workspace__header, .application-workspace__selected-heading, .application-workspace__app-card :deep(.ant-card-body) { align-items: flex-start; flex-direction: column; } .application-workspace__actions { grid-template-columns: 1fr; } }
</style>
