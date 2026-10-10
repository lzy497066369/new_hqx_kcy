<script setup lang="ts">
import { Tooltip } from 'antdv-next';
import { RouterLink } from 'vue-router';

import { isHighTechProject } from '../high-tech-application/model';

defineProps<{ projects?: null | string[]; expanded?: boolean; companyId?: string }>();
</script>

<template>
  <ul v-if="expanded && projects?.length" class="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="申报项目">
    <li v-for="project in projects" :key="project">
      <RouterLink
        v-if="companyId && isHighTechProject(project)"
        :to="{ name: 'ClientHighTechApplication', params: { companyId } }"
        class="inline-flex min-h-11 items-center rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        {{ project }}<span aria-hidden="true" class="ml-2">→</span>
      </RouterLink>
      <span v-else class="inline-flex min-h-11 items-center rounded-md bg-muted px-3 py-2">{{ project }}</span>
    </li>
  </ul>
  <Tooltip v-else-if="projects?.length" placement="topLeft" :trigger="['hover', 'focus', 'click']">
    <template #title>
      <ul class="m-0 list-inside list-disc space-y-1">
        <li v-for="project in projects" :key="project">{{ project }}</li>
      </ul>
    </template>
    <button
      type="button"
      class="cursor-pointer whitespace-nowrap border-b border-dashed border-primary/50 py-1 text-primary focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      :aria-label="`申报项目：${projects.join('、')}`"
    >
      {{ projects.length }} 个项目
    </button>
  </Tooltip>
  <span v-else class="text-muted-foreground">未选择</span>
</template>
