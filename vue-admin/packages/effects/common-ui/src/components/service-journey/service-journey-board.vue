<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { declarationStatusLabel, journeyStatusLabels } from './journey';
import type { JourneyStageKey, JourneyTarget, ServiceJourney } from './journey';

const props = defineProps<{
  model?: ServiceJourney;
  loading?: boolean;
  error?: string;
  detailLoading?: boolean;
  detailError?: string;
  audience?: 'enterprise' | 'staff';
}>();
const emit = defineEmits<{
  navigate: [target: JourneyTarget];
  selectDeclaration: [id: string];
  retry: [];
  retryDetail: [];
}>();
const id = useId();
const selectedStage = ref<JourneyStageKey>('profile');
watch(
  () => [props.model?.declaration?.id, props.model?.current.key],
  () => {
    selectedStage.value = props.model?.current.key ?? 'profile';
  },
  { immediate: true },
);
const selected = computed(() =>
  props.model?.stages.find((stage) => stage.key === selectedStage.value),
);
const firstReturned = computed(() =>
  props.model?.declarations.find((item) => item.status === 'rejected'),
);
function changeDeclaration(event: Event) {
  emit('selectDeclaration', (event.target as HTMLSelectElement).value);
}
</script>

<template>
  <section
    class="journey rounded-xl border border-border bg-card p-4 text-foreground md:p-6"
    :aria-labelledby="`${id}-title`"
    :aria-busy="loading || detailLoading"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="mb-1 text-xs font-medium tracking-widest text-primary">
          企业服务 · 一步一步办
        </p>
        <h2 :id="`${id}-title`" class="text-xl font-semibold">服务进度</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          企业档案长期复用，每条申报独立推进。先看当前任务，再进入对应功能。
        </p>
      </div>
    </div>

    <div
      v-if="loading"
      class="mt-5 rounded-lg bg-muted p-6 text-sm text-muted-foreground"
      role="status"
    >
      正在读取企业资料、候选项目和申报记录…
    </div>
    <div
      v-else-if="error"
      class="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
      role="alert"
    >
      <p class="font-medium">暂时无法确认服务进度</p>
      <p class="mt-1 break-words text-sm">{{ error }}</p>
      <button
        type="button"
        class="journey-button mt-3 border border-border"
        @click="emit('retry')"
      >
        重新加载
      </button>
    </div>
    <template v-else-if="model">
      <div
        class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-3 text-sm"
      >
        <span>企业资料：{{ model.profileProgress }}</span>
        <div
          v-if="model.declarations.length"
          class="flex min-w-0 flex-wrap items-center gap-2"
        >
          <label :for="`${id}-declaration`" class="shrink-0">当前申报</label>
          <select
            :id="`${id}-declaration`"
            class="journey-select min-w-0 max-w-full rounded-md border border-border bg-background px-3 py-2"
            :value="model.declaration?.id"
            @change="changeDeclaration"
          >
            <option
              v-for="item in model.declarations"
              :key="item.id"
              :value="item.id"
            >
              {{ item.projectName }} ·
              {{ declarationStatusLabel(item.status) }} · #{{ item.id }}
            </option>
          </select>
        </div>
        <span v-else>尚未创建申报 · 可先完善资料或浏览政策</span>
      </div>
      <div
        v-if="model.returnedCount && model.declaration?.status !== 'rejected'"
        class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 p-3 text-sm"
        role="status"
      >
        <span
          >另有 {{ model.returnedCount }} 条退回申报需要补正，请优先处理。</span
        >
        <button
          v-if="firstReturned"
          type="button"
          class="journey-button border border-border"
          @click="emit('selectDeclaration', firstReturned.id)"
        >
          切换至退回申报
        </button>
      </div>

      <ol class="journey-steps mt-5" aria-label="企业服务七阶段">
        <li
          v-for="(stage, index) in model.stages"
          :key="stage.key"
          class="min-w-0"
        >
          <button
            type="button"
            class="journey-step w-full rounded-lg border p-3 text-left"
            :class="[
              stage.key === selectedStage
                ? 'border-primary bg-primary/5'
                : 'border-border bg-background',
            ]"
            :aria-current="stage.key === model.current.key ? 'step' : undefined"
            :aria-expanded="stage.key === selectedStage"
            :aria-controls="`${id}-stage`"
            @click="selectedStage = stage.key"
          >
            <span class="flex items-center justify-between gap-1">
              <span
                class="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                :class="
                  stage.key === model.current.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                "
                >{{ index + 1 }}</span
              >
              <span
                class="text-xs"
                :class="
                  stage.status === 'attention'
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                "
                >{{ journeyStatusLabels[stage.status] }}</span
              >
            </span>
            <span class="mt-2 block text-sm font-semibold">{{
              stage.title
            }}</span>
            <span
              v-if="stage.key === model.current.key"
              class="mt-1 block text-xs text-primary"
              >正在这里办理</span
            >
          </button>
        </li>
      </ol>

      <div
        class="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-4 md:p-5"
        aria-live="polite"
      >
        <p class="text-xs font-medium text-primary">
          {{
            model.declaration?.status === 'rejected' ? '优先待办' : '建议下一步'
          }}
          · {{ model.current.title }}
        </p>
        <h3 class="mt-2 text-lg font-semibold">{{ model.current.summary }}</h3>
        <p
          v-if="model.declaration"
          class="mt-1 break-words text-sm text-muted-foreground"
        >
          {{ model.declaration.projectName }} ·
          {{ declarationStatusLabel(model.declaration.status) }}
        </p>
        <p v-if="model.deadlineText" class="mt-2 text-sm font-medium">
          {{ model.deadlineText }}
        </p>
        <p
          v-if="model.declaration?.status === 'rejected'"
          class="mt-2 break-words text-sm"
        >
          退回原因：{{
            model.declaration.rejectedReason || '请在申报详情查看审核意见'
          }}
        </p>
        <p class="mt-2 text-sm text-muted-foreground">
          {{
            audience === 'staff'
              ? '工作人员协助维护资料、跟进材料与审核；处理权限以详情页为准。'
              : '经办人准备与补正材料；审核由有权限的服务人员处理。'
          }}
        </p>
        <button
          type="button"
          class="journey-button mt-4 bg-primary text-primary-foreground"
          @click="emit('navigate', model.current.target)"
        >
          {{ model.current.actionLabel }} <span aria-hidden="true">→</span>
        </button>
      </div>

      <div
        v-if="selected"
        :id="`${id}-stage`"
        class="mt-5 rounded-lg border border-border p-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="font-semibold">
            {{ selected.title }} · {{ journeyStatusLabels[selected.status] }}
          </h3>
          <button
            type="button"
            class="journey-button border border-border"
            @click="emit('navigate', selected.target)"
          >
            {{ selected.actionLabel }}
          </button>
        </div>
        <p class="mt-2 text-sm text-muted-foreground">
          {{ selected.description }}
        </p>
        <p class="mt-2 text-sm">{{ selected.summary }}</p>
        <div
          v-if="detailLoading && ['materials', 'review'].includes(selected.key)"
          class="mt-3 text-sm text-muted-foreground"
          role="status"
        >
          正在核验本条申报材料，暂不判断材料是否齐备…
        </div>
        <div
          v-if="detailError && ['materials', 'review'].includes(selected.key)"
          class="mt-3 rounded-md border border-destructive/30 p-3 text-sm"
          role="alert"
        >
          <p>材料核验未成功，不能据此判断已齐备：{{ detailError }}</p>
          <button
            type="button"
            class="journey-button mt-2 border border-border"
            @click="emit('retryDetail')"
          >
            重试材料核验
          </button>
        </div>
        <ul
          v-if="selected.gaps.length"
          class="mt-3 grid gap-2 md:grid-cols-2"
          aria-label="本阶段待处理项"
        >
          <li v-for="(gap, index) in selected.gaps.slice(0, 6)" :key="index">
            <button
              type="button"
              class="journey-gap w-full rounded-md border border-border bg-background p-3 text-left"
              @click="emit('navigate', gap.target)"
            >
              <span
                class="flex items-center justify-between gap-2 text-sm font-medium"
                ><span>{{ gap.title }}</span
                ><span class="shrink-0 text-xs text-primary"
                  >去处理 →</span
                ></span
              >
              <span
                class="mt-1 block break-words text-sm text-muted-foreground"
                >{{ gap.description }}</span
              >
            </button>
          </li>
        </ul>
        <p
          v-if="selected.gaps.length > 6"
          class="mt-2 text-sm text-muted-foreground"
        >
          还有 {{ selected.gaps.length - 6 }} 项，请进入本阶段查看完整清单。
        </p>
      </div>
      <p class="mt-3 text-xs leading-relaxed text-muted-foreground">
        所有阶段均可查看，不强制锁定政策浏览。资料完整度和材料核验分数不代表政府审批结果，也不代表结果已经归档。
      </p>
    </template>
    <p v-else class="mt-5 text-sm text-muted-foreground">
      选择企业后显示服务进度。
    </p>
  </section>
</template>

<style scoped>
.journey-steps {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}
.journey-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 14px;
}
.journey-step {
  min-height: 106px;
  height: 100%;
}
.journey-select {
  width: min(420px, 100%);
  min-height: 44px;
}
.journey button,
.journey select {
  transition: box-shadow 160ms ease;
}
.journey button:hover:not(:disabled) {
  box-shadow: 0 0 0 1px hsl(var(--primary) / 0.4);
}
.journey button:focus-visible,
.journey select:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 3px;
}
.journey button:disabled {
  cursor: wait;
  opacity: 0.6;
}
@media (max-width: 1100px) {
  .journey-steps {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .journey-steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .journey-step {
    min-height: 98px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .journey button,
  .journey select {
    transition: none;
  }
}
</style>
