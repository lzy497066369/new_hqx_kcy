<script lang="ts" setup>
import { computed, watch } from 'vue';

import { useAntdDesignTokens } from '@vben/hooks';

import { App, ConfigProvider, theme } from 'antdv-next';

import { antdLocale } from '#/locales';

defineOptions({ name: 'App' });

const { tokens } = useAntdDesignTokens();

/** 客户端固定使用浅色算法，不再响应黑白主题切换。 */
const tokenTheme = computed(() => ({
  algorithm: [theme.defaultAlgorithm],
  token: tokens,
}));

watch(
  tokenTheme,
  (themeConfig) => {
    ConfigProvider.config({ theme: themeConfig });
  },
  { immediate: true },
);
</script>

<template>
  <ConfigProvider :locale="antdLocale" :theme="tokenTheme">
    <App>
      <RouterView />
    </App>
  </ConfigProvider>
</template>

<style>
/* 第一个菜单项（主页）往上挪 */
.vben-menu.is-vertical:not(.vben-menu.is-collapse) > .vben-menu-item:first-child,
.vben-menu.is-vertical:not(.vben-menu.is-collapse) > .vben-sub-menu:first-child {
  margin-top: -16px !important;
}
</style>
