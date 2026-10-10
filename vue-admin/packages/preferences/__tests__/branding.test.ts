import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vben-core/preferences', () => import('../../@core/preferences/src/index'));

import {
  applyAppBranding,
  preferences,
  updatePreferences,
} from '../src/index';

describe('application branding', () => {
  beforeEach(() => {
    updatePreferences({
      app: { name: '旧平台名称', layout: 'header-nav', locale: 'en-US' },
      copyright: { companyName: '旧版权名称' },
      logo: { enable: true, source: '/logo.png', sourceDark: '/dark-logo.png' },
      sidebar: { width: 280, collapsed: true },
      theme: { mode: 'dark' },
    });
  });

  it('replaces cached names and removes both brand images while keeping the text enabled', () => {
    applyAppBranding('企业一站式服务平台');

    expect(preferences.app.name).toBe('企业一站式服务平台');
    expect(preferences.copyright.companyName).toBe('企业一站式服务平台');
    expect(preferences.logo).toMatchObject({
      enable: true,
      source: '',
      sourceDark: '',
    });
  });

  it('preserves user layout, locale, sidebar and theme preferences', () => {
    applyAppBranding('企业一站式服务平台');

    expect(preferences.app.layout).toBe('header-nav');
    expect(preferences.app.locale).toBe('en-US');
    expect(preferences.sidebar).toMatchObject({ width: 280, collapsed: true });
    expect(preferences.theme.mode).toBe('dark');
  });

  it('preserves the separate IAM application name', () => {
    applyAppBranding('统一身份与访问管理中心');

    expect(preferences.app.name).toBe('统一身份与访问管理中心');
    expect(preferences.copyright.companyName).toBe('企业一站式服务平台');
  });
});
