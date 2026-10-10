import { applyAppBranding, initPreferences, resetPreferences } from '@vben/preferences';
import { unmountGlobalLoading } from '@vben/utils';

import { overridesPreferences } from './preferences';

async function initApplication() {
  const env = import.meta.env.PROD ? 'prod' : 'dev';
  const appVersion = import.meta.env.VITE_APP_VERSION;
  const namespace = `${import.meta.env.VITE_APP_NAMESPACE}-${appVersion}-${env}`;

  await initPreferences({
    namespace,
    overrides: overridesPreferences,
  });

  // 客户端布局是固定的，清理旧版本缓存中遗留的工具栏和布局开关。
  await resetPreferences();

  applyAppBranding(import.meta.env.VITE_APP_TITLE);

  const { bootstrap } = await import('./bootstrap');
  await bootstrap(namespace);

  unmountGlobalLoading();
}

initApplication();
