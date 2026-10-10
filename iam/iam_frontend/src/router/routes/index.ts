import type { RouteRecordRaw } from 'vue-router';

import { traverseTreeValues } from '@vben/utils';

import { coreRoutes, fallbackNotFoundRoute } from './core';
import iamRoutes from './modules/iam';

const routes: RouteRecordRaw[] = [...coreRoutes, fallbackNotFoundRoute];
const coreRouteNames = traverseTreeValues(coreRoutes, (route) => route.name);
const accessRoutes = iamRoutes;
const componentKeys: string[] = [];

export { accessRoutes, componentKeys, coreRouteNames, routes };
