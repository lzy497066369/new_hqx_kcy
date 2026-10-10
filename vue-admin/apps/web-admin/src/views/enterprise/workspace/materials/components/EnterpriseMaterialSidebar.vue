<script setup lang="ts">
import { IconifyIcon } from '@vben/icons';

interface MaterialModule {
  icon: string;
  key: string;
  title: string;
}

const props = defineProps<{
  activeKey: string;
  items: readonly MaterialModule[];
}>();

const emit = defineEmits<{ select: [key: string] }>();
</script>

<template>
  <nav class="enterprise-material-sidebar" aria-label="企业资料模块">
    <button
      v-for="item in props.items"
      :key="item.key"
      class="enterprise-material-sidebar__item"
      :class="{
        'enterprise-material-sidebar__item--active':
          props.activeKey === item.key,
      }"
      type="button"
      @click="emit('select', item.key)"
    >
      <IconifyIcon :icon="item.icon" class="enterprise-material-sidebar__icon" />
      {{ item.title }}
    </button>
  </nav>
</template>

<style scoped>
.enterprise-material-sidebar { display: grid; gap: 4px; align-content: start; padding: 8px; border-right: 1px solid #e5e7eb; }
.enterprise-material-sidebar__item { min-height: 36px; padding: 0 12px; color: #4b5563; text-align: left; cursor: pointer; background: transparent; border: 0; border-radius: 4px; }
.enterprise-material-sidebar__item:hover { background: #f3f4f6; }
.enterprise-material-sidebar__item--active { font-weight: 600; color: #0369a1; background: #e0f2fe; }
.enterprise-material-sidebar__icon { width: 16px; margin-right: 8px; }
@media (max-width: 760px) { .enterprise-material-sidebar { grid-template-columns: repeat(3, minmax(0, 1fr)); overflow-x: auto; border-right: 0; border-bottom: 1px solid #e5e7eb; } }
</style>
