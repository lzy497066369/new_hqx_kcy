import {
  appCopyrightPreferences,
  defineOverridesPreferences,
} from '@vben/preferences';

import { IAM_OVERVIEW_PATH } from '#/router/home-path';

export const overridesPreferences = defineOverridesPreferences({
  app: {
    accessMode: 'frontend',
    defaultHomePath: IAM_OVERVIEW_PATH,
    enableRefreshToken: false,
    name: import.meta.env.VITE_APP_TITLE,
  },
  // 仅保留文字品牌，不显示品牌图标
  logo: {
    source: '',
    sourceDark: '',
  },
  copyright: appCopyrightPreferences,
});
