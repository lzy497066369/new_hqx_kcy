<script lang="ts" setup>
import type { RouteLocationNormalizedLoadedGeneric } from 'vue-router';

import { unref } from 'vue';
import { RouterView } from 'vue-router';

import { usePreferences } from '@vben/preferences';
import { getTabKey, storeToRefs, useTabbarStore } from '@vben/stores';

import { transformComponent, useLayoutHook } from '../../hooks';
import { IFrameRouterView } from '../../iframe';
import { RouteCachedPage, RouteCachedView } from '../../route-cached';

defineOptions({ name: 'LayoutContent' });

const tabbarStore = useTabbarStore();
const { keepAlive } = usePreferences();

const { getCachedTabs, getExcludeCachedTabs, renderRouteView } =
  storeToRefs(tabbarStore);

const { getEnabledTransition, getTransitionName } = useLayoutHook();

/**
 * 是否显示component
 * @param route
 */
const showComponent = (route: RouteLocationNormalizedLoadedGeneric) => {
  return !route.meta.domCached && unref(renderRouteView);
};
</script>

<template>
  <div class="relative h-full">
    <IFrameRouterView />
    <RouteCachedView />
    <RouterView v-slot="{ Component, route }">
      <RouteCachedPage
        :component="Component"
        :route="route"
        v-if="route.meta.domCached"
      />
      <Transition
        v-if="getEnabledTransition"
        :name="getTransitionName(route)"
        appear
        mode="out-in"
      >
        <div
          v-if="showComponent(route) && !route.meta.iframeSrc"
          :key="getTabKey(route)"
          class="h-full"
        >
          <KeepAlive
            v-if="keepAlive"
            :exclude="getExcludeCachedTabs"
            :include="getCachedTabs"
          >
            <component
              :is="transformComponent(Component, route)"
              :key="getTabKey(route)"
            />
          </KeepAlive>
          <component
            v-else
            :is="Component"
            :key="getTabKey(route)"
          />
        </div>
      </Transition>
      <template v-else>
        <div
          v-if="showComponent(route) && !route.meta.iframeSrc"
          :key="getTabKey(route)"
          class="h-full"
        >
          <KeepAlive
            v-if="keepAlive"
            :exclude="getExcludeCachedTabs"
            :include="getCachedTabs"
          >
            <component
              :is="transformComponent(Component, route)"
              :key="getTabKey(route)"
            />
          </KeepAlive>
          <component
            v-else
            :is="Component"
            :key="getTabKey(route)"
          />
        </div>
      </template>
    </RouterView>
  </div>
</template>
