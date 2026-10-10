<script setup lang="ts">
import { computed } from 'vue';
import type { JourneyStageKey } from './journey';
const props = withDefaults(defineProps<{ stage: JourneyStageKey; showProfileStep?: boolean; backLabel?: string }>(), { showProfileStep: true, backLabel: '返回服务进度 →' });
const emit = defineEmits<{ back: [] }>();
const steps: Array<{ key: JourneyStageKey; title: string }> = [
  { key: 'profile', title: '企业建档' },
  { key: 'data', title: '资料补齐' },
  { key: 'policy', title: '政策匹配' },
  { key: 'declaration', title: '创建申报' },
  { key: 'materials', title: '材料准备' },
  { key: 'review', title: '审核补正' },
  { key: 'results', title: '结果留存' },
];
const visibleSteps = computed(() => props.showProfileStep ? steps : steps.filter((step) => step.key !== 'profile'));
</script>
<template>
  <nav
    aria-label="当前办理环节"
    class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2 text-foreground"
  >
    <ol class="flex flex-wrap gap-x-3 gap-y-2 text-sm">
      <li
        v-for="(step, index) in visibleSteps"
        :key="step.key"
        :class="
          step.key === stage
            ? 'font-semibold text-primary'
            : 'hidden text-muted-foreground xl:block'
        "
        :aria-current="step.key === stage ? 'step' : undefined"
      >
        {{ index + 1 }}. {{ step.title }}
      </li>
    </ol>
    <button
      type="button"
      class="min-h-11 rounded-md px-2 text-sm text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      @click="emit('back')"
    >
      {{ backLabel }}
    </button>
  </nav>
</template>
