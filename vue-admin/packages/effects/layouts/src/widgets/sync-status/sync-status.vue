<script lang="ts" setup>
import type { SyncStatusItem } from './types';

import { computed } from 'vue';

import { CircleAlert, CircleCheckBig, RotateCw } from '@vben/icons';

import {
  VbenButton,
  VbenIconButton,
  VbenPopover,
  VbenScrollbar,
} from '@vben-core/shadcn-ui';

import { useToggle } from '@vueuse/core';

defineOptions({ name: 'SyncStatusPopup' });

const props = withDefaults(
  defineProps<{
    description?: string;
    emptyText?: string;
    failed?: number;
    items?: SyncStatusItem[];
    running?: number;
    title?: string;
    viewAllText?: string;
  }>(),
  {
    description: '',
    emptyText: '暂无同步任务',
    failed: 0,
    items: () => [],
    running: 0,
    title: '同步中心',
    viewAllText: '查看全部',
  },
);

const emit = defineEmits<{
  onClick: [SyncStatusItem];
  viewAll: [];
}>();

const [open, toggle] = useToggle();

const badgeText = computed(() => {
  if (props.failed > 0) {
    return String(Math.min(props.failed, 99));
  }
  if (props.running > 0) {
    return String(Math.min(props.running, 99));
  }
  return '';
});

const totalCount = computed(() => props.items.length);

const summaryCards = computed(() => [
  {
    label: '进行中',
    tone: 'running',
    value: props.running,
  },
  {
    label: '失败',
    tone: 'failed',
    value: props.failed,
  },
  {
    label: '最近记录',
    tone: 'neutral',
    value: totalCount.value,
  },
]);

function close() {
  open.value = false;
}

function handleViewAll() {
  emit('viewAll');
  close();
}

function statusLabel(status: string) {
  if (status === 'failed') return '失败';
  if (status === 'running') return '进行中';
  if (status === 'success') return '已完成';
  if (status === 'queued') return '排队中';
  if (status === 'partial_success') return '部分完成';
  if (status === 'cancelled') return '已取消';
  return status || '未知';
}

function statusClass(status: string) {
  if (status === 'failed') return 'status-badge status-badge--failed';
  if (status === 'running') return 'status-badge status-badge--running';
  if (status === 'success') return 'status-badge status-badge--success';
  return 'status-badge status-badge--default';
}

function indicatorClass() {
  if (props.failed > 0) {
    return 'trigger-badge trigger-badge--failed';
  }
  if (props.running > 0) {
    return 'trigger-badge trigger-badge--running';
  }
  return 'trigger-badge trigger-badge--idle';
}

function progressStyle(progress?: number) {
  const percent = Math.min(100, Math.max(0, Math.round(progress ?? 0)));
  return { width: `${percent}%` };
}

function summaryCardClass(tone: string) {
  if (tone === 'failed') return 'summary-card summary-card--failed';
  if (tone === 'running') return 'summary-card summary-card--running';
  return 'summary-card summary-card--neutral';
}
</script>

<template>
  <VbenPopover
    v-model:open="open"
    content-class="relative right-2 w-[26rem] max-w-[calc(100vw-2rem)] p-0"
  >
    <template #trigger>
      <div class="mr-2 flex-center h-full" @click.stop="toggle()">
        <VbenIconButton class="sync-button relative text-foreground">
          <span v-if="badgeText" :class="indicatorClass()">
            {{ badgeText }}
          </span>
          <RotateCw class="size-4" />
        </VbenIconButton>
      </div>
    </template>

    <div class="relative">
      <div class="flex items-center justify-between px-4 py-3">
        <div class="text-foreground">{{ title }}</div>
      </div>

      <div class="sync-summary">
        <p v-if="description" class="sync-summary__description">
          {{ description }}
        </p>
        <div class="sync-summary__cards">
          <div
            v-for="card in summaryCards"
            :key="card.label"
            :class="summaryCardClass(card.tone)"
          >
            <span class="summary-card__label">{{ card.label }}</span>
            <span class="summary-card__value">{{ card.value }}</span>
          </div>
        </div>
      </div>

      <VbenScrollbar v-if="items.length > 0">
        <ul class="flex! max-h-90 w-full flex-col p-2">
          <li
            v-for="item in items"
            :key="item.id"
            class="sync-item"
            @click="emit('onClick', item)"
          >
            <div class="sync-item__header">
              <div class="sync-item__title-wrap">
                <CircleAlert
                  v-if="item.status === 'failed'"
                  class="size-4 text-[#dc2626]"
                />
                <RotateCw
                  v-else-if="item.status === 'running'"
                  class="size-4 text-[#2563eb]"
                />
                <CircleCheckBig
                  v-else
                  class="size-4 text-[#16a34a]"
                />
                <span class="sync-item__title">{{ item.title }}</span>
              </div>
              <span :class="statusClass(item.status)">
                {{ statusLabel(item.status) }}
              </span>
            </div>

            <p class="sync-item__description">
              {{ item.description }}
            </p>

            <div class="sync-item__meta">
              <span>{{ item.currentStep || '等待处理' }}</span>
              <span>{{ item.time }}</span>
            </div>

            <div v-if="item.status === 'running'" class="sync-progress">
              <div class="sync-progress__bar" :style="progressStyle(item.progress)"></div>
            </div>
          </li>
        </ul>
      </VbenScrollbar>

      <template v-else>
        <div class="sync-empty">
          <div class="sync-empty__icon">
            <CircleCheckBig class="size-5 text-[#16a34a]" />
          </div>
          <p class="sync-empty__title">{{ emptyText }}</p>
          <p v-if="description" class="sync-empty__description">
            {{ description }}
          </p>
        </div>
      </template>

      <div class="flex justify-end border-t border-border px-4 py-3">
        <VbenButton size="sm" @click="handleViewAll">
          {{ viewAllText }}
        </VbenButton>
      </div>
    </div>
  </VbenPopover>
</template>

<style scoped>
.sync-summary {
  padding: 0 16px 12px;
}

.sync-summary__description {
  margin-bottom: 10px;
  font-size: 12px;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

.sync-summary__cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 14px;
}

.summary-card--running {
  background: #eff6ff;
  color: #1d4ed8;
}

.summary-card--failed {
  background: #fef2f2;
  color: #b91c1c;
}

.summary-card--neutral {
  background: hsl(var(--accent) / 0.5);
  color: hsl(var(--foreground));
}

.summary-card__label {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.summary-card__value {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.sync-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  cursor: pointer;
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
}

.sync-item + .sync-item {
  margin-top: 8px;
}

.sync-item:hover {
  background: hsl(var(--accent) / 0.45);
}

.sync-item__header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.sync-item__title-wrap {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.sync-item__title {
  font-weight: 600;
  line-height: 1.2;
}

.sync-item__description {
  font-size: 12px;
  line-height: 1.55;
  color: hsl(var(--muted-foreground));
  word-break: break-word;
}

.sync-item__meta {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.sync-progress {
  overflow: hidden;
  width: 100%;
  height: 6px;
  background: hsl(var(--muted));
  border-radius: 999px;
}

.sync-progress__bar {
  height: 100%;
  background: linear-gradient(90deg, #0f766e 0%, #2563eb 100%);
  border-radius: 999px;
}

.sync-empty {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  padding: 24px;
  text-align: center;
}

.sync-empty__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: #dcfce7;
  border-radius: 999px;
}

.sync-empty__title {
  font-size: 16px;
  font-weight: 600;
}

.sync-empty__description {
  max-width: 280px;
  font-size: 12px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.status-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 999px;
}

.status-badge--failed {
  color: #991b1b;
  background: #fee2e2;
}

.status-badge--running {
  color: #1d4ed8;
  background: #dbeafe;
}

.status-badge--success {
  color: #166534;
  background: #dcfce7;
}

.status-badge--default {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

.trigger-badge {
  position: absolute;
  top: 1px;
  right: 1px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  color: white;
  text-align: center;
  border-radius: 999px;
}

.trigger-badge--failed {
  background: #dc2626;
}

.trigger-badge--running {
  background: #2563eb;
}

.trigger-badge--idle {
  background: hsl(var(--muted));
}

:deep(.sync-button) {
  &:hover {
    svg {
      transform: rotate(90deg);
      transition: transform 0.25s ease;
    }
  }
}
</style>
