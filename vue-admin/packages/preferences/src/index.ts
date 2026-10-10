import type {
  CustomPreferencesRecord,
  Preferences,
  PreferencesExtension,
} from '@vben-core/preferences';
import type { DeepPartial } from '@vben-core/typings';

import { updatePreferences } from '@vben-core/preferences';

/**
 * 如果你想所有的app都使用相同的默认偏好设置，你可以在这里定义
 * 而不是去修改 @vben-core/preferences 中的默认偏好设置
 * @param preferences
 * @returns
 */

function defineOverridesPreferences(preferences: DeepPartial<Preferences>) {
  return preferences;
}

function definePreferencesExtension<
  TCustomPreferences extends object = CustomPreferencesRecord,
>(extension: PreferencesExtension<TCustomPreferences>) {
  return extension;
}

/** 应用级版权与 ICP 备案配置，供各 app 的 preferences 覆盖使用 */
const appCopyrightPreferences = {
  companyName: '企业一站式服务平台',
  icp: '浙ICP备20029391号-2',
  icpLink: 'https://beian.miit.gov.cn/',
} satisfies DeepPartial<Preferences>['copyright'];

/** 在加载缓存之后同步品牌，不重置用户的主题、布局和其他偏好设置。 */
function applyAppBranding(appName: string) {
  updatePreferences({
    app: { name: appName },
    copyright: appCopyrightPreferences,
    logo: { source: '', sourceDark: '' },
  });
}

export {
  appCopyrightPreferences,
  applyAppBranding,
  defineOverridesPreferences,
  definePreferencesExtension,
};

export * from '@vben-core/preferences';
