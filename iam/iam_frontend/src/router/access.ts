import type { GenerateMenuAndRoutesOptions } from '@vben/types';

import { generateAccessible } from '@vben/access';
import { preferences } from '@vben/preferences';

import { BasicLayout, IFrameView } from '#/layouts';

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  return await generateAccessible(preferences.app.accessMode, {
    ...options,
    forbiddenComponent,
    layoutMap: { BasicLayout, IFrameView },
    pageMap: import.meta.glob('../views/**/*.vue'),
  });
}

export { generateAccess };
