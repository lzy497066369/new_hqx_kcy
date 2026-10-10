import type { VNode } from 'vue';
import type {
  RouteLocationNormalizedLoaded,
  RouteLocationNormalizedLoadedGeneric,
} from 'vue-router';

import { cloneVNode, computed } from 'vue';

import { preferences, usePreferences } from '@vben/preferences';

/**
 * Transform a route component and align its component name with route.name.
 * @param component
 * @param route
 */
export function transformComponent(
  component: VNode,
  route: RouteLocationNormalizedLoadedGeneric,
) {
  if (!component) {
    console.error(
      'Component view not found, please check the route configuration',
    );
    return undefined;
  }

  const routeName = route.name as string;
  if (!routeName) {
    return component;
  }

  const componentName = (component?.type as any)?.name;
  if (componentName === routeName) {
    return component;
  }

  const routeComponent = cloneVNode(component);
  const componentType = routeComponent.type;

  if (
    componentType &&
    typeof componentType === 'object' &&
    !Array.isArray(componentType)
  ) {
    (routeComponent as any).type = {
      ...componentType,
      name: routeName,
    };
    return routeComponent;
  }

  return routeComponent;
}

/**
 * Layout hooks.
 */
export function useLayoutHook() {
  const { keepAlive } = usePreferences();

  const getEnabledTransition = computed(() => {
    const { transition } = preferences;
    const transitionName = transition.name;
    return transitionName && transition.enable;
  });

  function getTransitionName(_route: RouteLocationNormalizedLoaded) {
    const { tabbar, transition } = preferences;
    const transitionName = transition.name;
    if (!transitionName || !transition.enable) {
      return;
    }

    if (!tabbar.enable || !keepAlive) {
      return transitionName;
    }

    return transitionName;
  }

  return {
    getEnabledTransition,
    getTransitionName,
  };
}
