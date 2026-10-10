<script setup lang="ts">
import type { ToolbarType } from './types';

import { computed } from 'vue';

import { preferences, usePreferences } from '@vben/preferences';

import { Copyright } from '../basic/copyright';
import AuthenticationFormView from './form.vue';
import SloganIcon from './icons/slogan.vue';
import Toolbar from './toolbar.vue';

interface Props {
  appearance?: 'default' | 'glass';
  appName?: string;
  logo?: string;
  logoDark?: string;
  pageTitle?: string;
  pageDescription?: string;
  sloganImage?: string;
  toolbar?: boolean;
  copyright?: boolean;
  toolbarList?: ToolbarType[];
  clickLogo?: () => void;
}

const props = withDefaults(defineProps<Props>(), {
  appearance: 'default',
  appName: '',
  copyright: true,
  logo: '',
  logoDark: '',
  pageDescription: '',
  pageTitle: '',
  sloganImage: '',
  toolbar: true,
  toolbarList: () => ['color', 'language', 'layout', 'theme'],
  clickLogo: () => {},
});

const { authPanelCenter, authPanelLeft, authPanelRight, isDark } =
  usePreferences();

const isGlass = computed(() => props.appearance === 'glass');
const isCentered = computed(() => isGlass.value || authPanelCenter.value);
const visibleToolbarList = computed(() =>
  isGlass.value
    ? props.toolbarList.filter((item) => item !== 'layout')
    : props.toolbarList,
);

/**
 * @zh_CN 根据主题选择合适的 logo 图标
 */
const logoSrc = computed(() => {
  // 如果是暗色主题且提供了 logoDark，则使用暗色主题的 logo
  if (isDark.value && props.logoDark) {
    return props.logoDark;
  }
  // 否则使用默认的 logo
  return props.logo;
});
</script>

<template>
  <div
    :class="[isDark ? 'dark' : '', { 'auth-glass': isGlass }]"
    class="flex min-h-full flex-1 overflow-x-hidden select-none"
  >
    <div v-if="isGlass" class="auth-photo" aria-hidden="true"></div>
    <template v-if="toolbar">
      <slot name="toolbar">
        <Toolbar :toolbar-list="visibleToolbarList" />
      </slot>
    </template>
    <!-- 左侧认证面板 -->
    <AuthenticationFormView
      v-if="authPanelLeft && !isGlass"
      class="min-h-full w-2/5 flex-1"
      data-side="left"
    >
      <template v-if="copyright" #copyright>
        <slot name="copyright">
          <Copyright
            v-if="preferences.copyright.enable"
            v-bind="preferences.copyright"
          />
        </slot>
      </template>
    </AuthenticationFormView>

    <slot name="logo">
      <!-- 头部 Logo 和应用名称 -->
      <div
        v-if="logoSrc || appName"
        class="auth-brand absolute top-0 left-0 z-10 flex flex-1"
        @click="clickLogo"
      >
        <div
          class="mt-4 ml-4 flex flex-1 items-center text-foreground sm:top-6 sm:left-6 lg:text-foreground"
        >
          <img
            v-if="logoSrc"
            :key="logoSrc"
            :alt="appName"
            :src="logoSrc"
            class="mr-2"
            width="42"
          />
          <p v-if="appName" class="m-0 text-xl font-medium">
            {{ appName }}
          </p>
        </div>
      </div>
    </slot>

    <!-- 系统介绍 -->
    <div v-if="!isCentered" class="relative hidden w-0 flex-1 lg:block">
      <div
        class="absolute inset-0 size-full bg-background-deep dark:bg-[#070709]"
      >
        <div class="login-background absolute top-0 left-0 size-full"></div>
        <div
          :key="authPanelLeft ? 'left' : authPanelRight ? 'right' : 'center'"
          class="mr-20 flex-col-center h-full"
          :class="{
            'enter-x': authPanelLeft,
            '-enter-x': authPanelRight,
          }"
        >
          <template v-if="sloganImage">
            <img
              :alt="appName"
              :src="sloganImage"
              class="h-64 w-2/5 animate-float"
            />
          </template>
          <SloganIcon v-else :alt="appName" class="h-64 w-2/5 animate-float" />
          <div class="text-1xl mt-6 font-sans text-foreground lg:text-2xl">
            {{ pageTitle }}
          </div>
          <div class="mt-2 dark:text-muted-foreground">
            {{ pageDescription }}
          </div>
        </div>
      </div>
    </div>

    <!-- 中心认证面板 -->
    <div v-if="isCentered" class="auth-center relative flex-center w-full">
      <div
        v-if="!isGlass"
        class="login-background absolute top-0 left-0 size-full"
      ></div>
      <AuthenticationFormView
        :class="{ 'auth-glass-panel': isGlass }"
        class="w-full rounded-3xl pb-20 shadow-float shadow-primary/5 md:w-2/3 md:bg-background lg:w-1/2 xl:w-[36%]"
        data-side="bottom"
      >
        <template v-if="copyright" #copyright>
          <slot name="copyright">
            <Copyright
              v-if="preferences.copyright.enable"
              v-bind="preferences.copyright"
            />
          </slot>
        </template>
      </AuthenticationFormView>
    </div>

    <!-- 右侧认证面板 -->
    <AuthenticationFormView
      v-if="authPanelRight && !isGlass"
      class="min-h-full w-2/5 flex-1"
      data-side="right"
    >
      <template v-if="copyright" #copyright>
        <slot name="copyright">
          <Copyright
            v-if="preferences.copyright.enable"
            v-bind="preferences.copyright"
          />
        </slot>
      </template>
    </AuthenticationFormView>
  </div>
</template>

<style scoped>
.auth-glass {
  --glass-ink: #182230;
  --glass-muted: #475467;
  --glass-link: #124cc1;
  --glass-surface: rgb(255 255 255 / 52%);
  --glass-input: rgb(255 255 255 / 68%);
  --glass-border: rgb(255 255 255 / 70%);

  position: relative;
  isolation: isolate;
  min-height: 100svh;
  background: #a3bcc2;
  color: var(--glass-ink);
}

.auth-photo {
  position: fixed;
  z-index: -2;
  inset: -20px;
  pointer-events: none;
  background: url('./assets/golden-gate.webp') center / cover no-repeat;
  filter: blur(6px);
}

.auth-glass::before {
  position: fixed;
  z-index: -1;
  inset: 0;
  pointer-events: none;
  background: rgb(12 26 32 / 18%);
  content: '';
}

.auth-glass .auth-brand > div {
  margin: 24px;
  color: #fff;
  text-shadow: 0 1px 8px rgb(0 0 0 / 45%);
}

.auth-glass .auth-center {
  padding: 104px 24px 64px;
}

.auth-glass .auth-glass-panel {
  position: relative;
  width: min(100%, 480px);
  padding: 36px 40px 24px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background:
    linear-gradient(
      135deg,
      rgb(255 255 255 / 26%),
      rgb(255 255 255 / 3%) 50%,
      rgb(255 255 255 / 14%)
    ),
    var(--glass-surface);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 80%),
    inset 0 -1px 0 rgb(255 255 255 / 24%),
    0 24px 64px rgb(11 30 36 / 24%);
  -webkit-backdrop-filter: blur(24px) saturate(145%);
  backdrop-filter: blur(24px) saturate(145%);
}

.auth-glass-panel :deep(.side-content) {
  margin-top: 0;
}

.auth-glass-panel :deep(.auth-copyright) {
  position: static;
  margin-top: 32px;
  color: var(--glass-muted);
  line-height: 1.8;
}

.auth-glass-panel :deep(.auth-copyright > div) {
  flex-wrap: wrap;
}

.auth-glass-panel :deep(.vben-link),
.auth-glass-panel :deep(.auth-copyright a) {
  color: var(--glass-link);
}

.auth-glass-panel :deep(input:not([type='checkbox'])) {
  height: 46px;
  border-color: rgb(100 116 139 / 28%);
  background: var(--glass-input);
  color: var(--glass-ink);
  box-shadow: inset 0 1px 2px rgb(16 24 40 / 4%);
}

.auth-glass-panel :deep(input::placeholder) {
  color: var(--glass-muted);
  opacity: 1;
}

.auth-glass-panel :deep(input:focus-visible),
.auth-glass-panel :deep(button:focus-visible),
.auth-glass-panel :deep(a:focus-visible) {
  outline: 2px solid var(--glass-link);
  outline-offset: 3px;
}

.auth-glass-panel :deep(button[aria-label='login']) {
  min-height: 46px;
  box-shadow: 0 4px 12px hsl(var(--primary) / 20%);
}

.auth-glass-panel :deep(.login-persona-tabs) {
  margin-bottom: 24px;
  border-color: rgb(100 116 139 / 28%);
}

.auth-glass-panel :deep(.login-persona-tabs button) {
  color: var(--glass-muted);
}

.auth-glass-panel :deep(.login-persona-tabs button.is-active) {
  color: var(--glass-ink);
}

.auth-glass.dark {
  --glass-ink: #f3f4f6;
  --glass-muted: #d0d5dd;
  --glass-link: #b5d0ff;
  --glass-surface: rgb(20 28 34 / 76%);
  --glass-input: rgb(20 28 34 / 68%);
  --glass-border: rgb(255 255 255 / 28%);
}

.auth-glass.dark::before {
  background: rgb(12 26 32 / 38%);
}

@supports not (
  (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))
) {
  .auth-glass .auth-glass-panel {
    background: rgb(245 248 250 / 95%);
  }

  .auth-glass.dark .auth-glass-panel {
    background: rgb(20 28 34 / 96%);
  }
}

@media (max-width: 639px) {
  .auth-glass .auth-brand > div {
    margin: 20px;
    max-width: calc(100vw - 40px);
  }

  .auth-glass .auth-brand p {
    font-size: 18px;
    line-height: 1.5;
  }

  .auth-glass .auth-center {
    padding: 132px 16px 40px;
  }

  .auth-glass .auth-glass-panel {
    padding: 28px 24px 20px;
  }

  .auth-photo {
    background-position: 43% center;
    filter: blur(4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-glass-panel :deep(.slide-right-enter-active),
  .auth-glass-panel :deep(.slide-right-leave-active) {
    transition: none;
    animation: none;
  }
}

.login-background {
  background: linear-gradient(
    154deg,
    #07070915 30%,
    hsl(var(--primary) / 30%) 48%,
    #07070915 64%
  );
  filter: blur(100px);
}

.dark {
  .login-background {
    background: linear-gradient(
      154deg,
      #07070915 30%,
      hsl(var(--primary) / 20%) 48%,
      #07070915 64%
    );
    filter: blur(100px);
  }
}
</style>
