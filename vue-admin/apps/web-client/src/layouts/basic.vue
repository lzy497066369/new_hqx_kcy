<script lang="ts" setup>
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  AuthenticationLoginExpiredModal,
  useVbenDrawer,
  VbenAvatar,
  VbenButton,
} from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import { BasicLayout } from '@vben/layouts';
import { LogOut, Settings } from '@vben/icons';
import { preferences, updatePreferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

import { useAuthStore } from '#/store';
import { getActiveClientPersona, getPersonaHomePath } from '#/auth/client-persona';
import LoginForm from '#/views/_core/authentication/login.vue';

const route = useRoute();
const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const [SettingsDrawer, settingsDrawerApi] = useVbenDrawer();
const { destroyWatermark, updateWatermark } = useWatermark();
watch(() => userStore.userInfo?.roles, () => {
  const persona = getActiveClientPersona();
  updatePreferences({
    app: { defaultHomePath: getPersonaHomePath(persona), layout: 'sidebar-nav' },
    sidebar: {
      collapseWidth: 56,
      collapsed: true,
      enable: true,
      expandOnHover: true,
      hidden: false,
      width: 56,
    },
  });
}, { immediate: true });
const avatar = computed(() => userStore.userInfo?.avatar ?? preferences.app.defaultAvatar);
const displayName = computed(
  () => userStore.userInfo?.realName || userStore.userInfo?.username || '用户',
);

async function handleLogout() {
  await authStore.logout(false);
}

watch(
  () => ({ enable: preferences.app.watermark, content: preferences.app.watermarkContent }),
  async ({ enable, content }) => {
    if (enable) {
      await updateWatermark({
        advancedStyle: {
          colorStops: [
            { color: 'rgba(0, 0, 0, 0.12)', offset: 0 },
            { color: 'rgba(0, 0, 0, 0.12)', offset: 1 },
          ],
          type: 'linear',
        },
        content: content || `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
      });
    } else {
      destroyWatermark();
    }
  },
  { immediate: true },
);
</script>

<template>
  <BasicLayout
    class="client-layout"
    :header-visible="route.name !== 'ClientHighTechApplication' && preferences.header.enable"
    :show-header-tools="false"
    :show-lock-screen="false"
    :show-preferences-panel="false"
    @clear-preferences-and-logout="handleLogout"
  >
    <template #sidebar-bottom>
      <button
        aria-label="设置"
        class="flex h-9 w-full items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        type="button"
        title="设置"
        @click="settingsDrawerApi.open()"
      >
        <Settings class="size-4 shrink-0" />
      </button>
    </template>
    <template #extra>
      <SettingsDrawer class="sm:w-80" :footer="false" title="设置">
        <div class="p-5">
          <div class="flex min-w-0 items-center gap-3">
            <VbenAvatar :alt="displayName" :src="avatar" class="size-10 shrink-0" dot />
            <div class="min-w-0">
              <div class="truncate text-sm font-medium text-foreground">
                {{ displayName }}
              </div>
              <div
                v-if="userStore.userInfo?.username && userStore.userInfo.username !== displayName"
                class="truncate text-xs text-muted-foreground"
              >
                {{ userStore.userInfo.username }}
              </div>
            </div>
          </div>
          <VbenButton class="mt-5 w-full" size="sm" variant="outline" @click="handleLogout">
            <LogOut class="mr-2 size-4" />
            退出登录
          </VbenButton>
        </div>
      </SettingsDrawer>
      <AuthenticationLoginExpiredModal v-model:open="accessStore.loginExpired" :avatar>
        <LoginForm />
      </AuthenticationLoginExpiredModal>
    </template>
  </BasicLayout>
</template>

<style scoped>
.client-layout {
  background-color: hsl(var(--background-deep));
}

.client-layout :deep(header.bg-header) {
  border-bottom: 0;
  background-color: transparent;
}

/* 强制隐藏侧边栏 logo 区域 */
.client-layout :deep(.vben-admin-layout-sidebar-logo) {
  display: none !important;
  height: 0 !important;
}

/* 移除菜单容器的上边距和内边距 */
.client-layout :deep(.vben-scrollbar) {
  padding-top: 0 !important;
}

/* 菜单区域上移 20px，弹性布局保持底部设置按钮的位置不变。 */
.client-layout :deep(aside .vben-scrollbar.flex-1) {
  margin-top: -20px;
}

/* 移除菜单本身的上边距 */
.client-layout :deep(.vben-menu) {
  margin-top: 0 !important;
  padding-top: 0 !important;
}

/* 首页入口保持黑色图标，默认、选中和悬停时均不显示背景色块。 */
.client-layout :deep(aside .vben-menu-item[href='/governance/overview']),
.client-layout :deep(aside .vben-menu-item[href='/client/enterprise-receipts']) {
  --menu-item-color: #000;
  --menu-item-hover-color: #000;
  --menu-item-active-color: #000;
  --menu-item-background-color: transparent;
  --menu-item-hover-background-color: transparent;
  --menu-item-active-background-color: transparent;
}

/* 第一个菜单项紧贴顶部 */
.client-layout :deep(.vben-menu > .vben-menu-item:first-child),
.client-layout :deep(.vben-menu > .vben-sub-menu:first-child) {
  margin-top: 0 !important;
  padding-top: 12px !important;
}
</style>
