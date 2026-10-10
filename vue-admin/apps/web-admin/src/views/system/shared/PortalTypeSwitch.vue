<script lang="ts" setup>
import type { PortalType } from '#/api/system/portal-type';

import { computed } from 'vue';

import { Segmented } from 'antdv-next';

import { portalTypeOptions } from './portal-type';

const activePortalType = defineModel<PortalType>({ required: true });

const props = withDefaults(
  defineProps<{
    description?: string;
    title?: string;
  }>(),
  {
    description: '只展示并维护对应端的数据',
    title: '管理范围',
  },
);

const portalMeta: Record<PortalType, { label: string; tone: string }> = {
  admin: {
    label: '后台端',
    tone: '后台菜单 / 角色 / 用户',
  },
  client: {
    label: '客户端',
    tone: '客户端菜单 / 角色 / 用户',
  },
};

const segmentedOptions = computed(() =>
  portalTypeOptions.map((item) => ({
    label: item.label,
    value: item.value,
  })),
);

const activeMeta = computed(() => portalMeta[activePortalType.value]);
</script>

<template>
  <section class="portal-switch">
    <div class="portal-switch__main">
      <span class="portal-switch__label">{{ props.title }}</span>
      <span class="portal-switch__desc">{{ props.description }}</span>
    </div>

    <div class="portal-switch__control">
      <Segmented v-model:value="activePortalType" :options="segmentedOptions" />
      <span class="portal-switch__current">
        当前：{{ activeMeta.label }}
        <small>{{ activeMeta.tone }}</small>
      </span>
    </div>
  </section>
</template>

<style scoped>
.portal-switch {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.portal-switch__main {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.portal-switch__label {
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.portal-switch__desc {
  overflow: hidden;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.portal-switch__control {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-shrink: 0;
}

.portal-switch__current {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.portal-switch__current small {
  margin-left: 6px;
  color: hsl(var(--muted-foreground) / 72%);
}

@media (max-width: 900px) {
  .portal-switch {
    align-items: flex-start;
    flex-direction: column;
  }

  .portal-switch__main,
  .portal-switch__control {
    width: 100%;
  }

  .portal-switch__control {
    justify-content: space-between;
  }
}
</style>
