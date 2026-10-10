import { appCopyrightPreferences, defineOverridesPreferences } from '@vben/preferences';

/** 客户端固定浅色布局，管理身份仅保留顶部总览入口，不提供主题与布局切换。 */
export const overridesPreferences = defineOverridesPreferences({
  app: {
    accessMode: 'frontend',
    authPageLayout: 'panel-center',
    contentPadding: 0,
    defaultHomePath: '/client/company',
    dynamicTitle: true,
    enableCheckUpdates: false,
    enableCopyPreferences: false,
    enablePreferences: false,
    locale: 'zh-CN',
    name: import.meta.env.VITE_APP_TITLE,
  },
  // 仅保留文字品牌，不显示品牌图标
  logo: {
    enable: false,
    source: '',
    sourceDark: '',
  },
  breadcrumb: {
    enable: false,
  },
  footer: {
    enable: false,
  },
  header: {
    enable: true,
    height: 56,
    mode: 'static',
  },
  navigation: {
    accordion: true,
    split: false,
    styleType: 'rounded',
  },
  shortcutKeys: {
    enable: false,
    globalEscape: false,
    globalLockScreen: false,
    globalLogout: false,
    globalPreferences: false,
    globalSearch: false,
  },
  sidebar: {
    collapseWidth: 56,
    collapsed: true,
    collapsedButton: false,
    draggable: false,
    expandOnHover: true,
    fixedButton: false,
    hidden: false,
    width: 56,
  },
  tabbar: {
    enable: false,
  },
  theme: {
    mode: 'light',
  },
  transition: {
    progress: false,
  },
  widget: {
    fullscreen: false,
    globalSearch: false,
    languageToggle: false,
    lockScreen: false,
    notification: false,
    sidebarToggle: false,
    themeToggle: false,
    timezone: false,
  },
  copyright: appCopyrightPreferences,
});
