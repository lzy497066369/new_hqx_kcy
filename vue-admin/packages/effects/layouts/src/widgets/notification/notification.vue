<script lang="ts" setup>
import type { NotificationItem } from './types';

import { Bell, CircleCheckBig, CircleX, MailCheck } from '@vben/icons';
import { $t } from '@vben/locales';

import {
  VbenButton,
  VbenIconButton,
  VbenPopover,
  VbenScrollbar,
} from '@vben-core/shadcn-ui';

import { useToggle } from '@vueuse/core';

defineOptions({ name: 'NotificationPopup' });

const props = withDefaults(
  defineProps<{
    dot?: boolean;
    notifications?: NotificationItem[];
    summary?: string;
    unreadCount?: number;
  }>(),
  {
    dot: false,
    notifications: () => [],
    summary: '',
    unreadCount: 0,
  },
);

const emit = defineEmits<{
  clear: [];
  makeAll: [];
  onClick: [NotificationItem];
  read: [NotificationItem];
  remove: [NotificationItem];
  viewAll: [];
}>();

const [open, toggle] = useToggle();

function close() {
  open.value = false;
}

function handleViewAll() {
  emit('viewAll');
  close();
}

function handleMakeAll() {
  emit('makeAll');
}

function handleClear() {
  emit('clear');
}

function levelClass(level?: NotificationItem['level']) {
  if (level === 'high') return 'notification-level notification-level--high';
  if (level === 'medium') return 'notification-level notification-level--medium';
  if (level === 'low') return 'notification-level notification-level--low';
  return 'notification-level notification-level--default';
}

function levelLabel(level?: NotificationItem['level']) {
  if (level === 'high') return '高优先级';
  if (level === 'medium') return '中优先级';
  if (level === 'low') return '低优先级';
  return '提醒';
}
</script>

<template>
  <VbenPopover
    v-model:open="open"
    content-class="relative right-2 w-[26rem] max-w-[calc(100vw-2rem)] p-0"
  >
    <template #trigger>
      <div class="mr-2 flex-center h-full" @click.stop="toggle()">
        <VbenIconButton class="bell-button relative text-foreground">
          <span
            v-if="dot"
            class="absolute top-0.5 right-0.5 size-2 rounded-sm bg-primary"
          ></span>
          <Bell class="size-4" />
        </VbenIconButton>
      </div>
    </template>

    <div class="relative">
      <div class="flex items-center justify-between px-4 py-3">
        <div class="flex items-center gap-2">
          <div class="text-foreground">{{ $t('ui.widgets.notifications') }}</div>
          <span v-if="unreadCount > 0" class="notification-count">
            {{ unreadCount }} 未读
          </span>
        </div>
        <VbenIconButton
          :disabled="notifications.length <= 0"
          :tooltip="$t('ui.widgets.markAllAsRead')"
          @click="handleMakeAll"
        >
          <MailCheck class="size-4" />
        </VbenIconButton>
      </div>

      <div
        v-if="summary || unreadCount > 0"
        class="notification-summary"
      >
        <span>{{ summary || $t('ui.widgets.notifications') }}</span>
      </div>

      <VbenScrollbar v-if="notifications.length > 0">
        <ul class="flex! max-h-90 w-full flex-col p-2">
          <li
            v-for="item in notifications"
            :key="item.id ?? item.title"
            class="notification-item"
            @click="emit('onClick', item)"
          >
            <slot name="content" :item="item">
              <span
                v-if="!item.isRead"
                class="absolute top-3 right-3 size-2 rounded-sm bg-primary"
              ></span>

              <span class="relative flex size-10 shrink-0 overflow-hidden rounded-full">
                <img
                  :src="item.avatar"
                  class="aspect-square size-full object-cover"
                />
              </span>

              <div class="notification-item__body">
                <div class="notification-item__title-row">
                  <p class="notification-item__title">{{ item.title }}</p>
                  <span v-if="item.level" :class="levelClass(item.level)">
                    {{ levelLabel(item.level) }}
                  </span>
                </div>

                <p class="notification-item__message">
                  {{ item.message }}
                </p>

                <div
                  v-if="item.metaText || item.actionText"
                  class="notification-item__meta-row"
                >
                  <span v-if="item.metaText">{{ item.metaText }}</span>
                  <span
                    v-if="item.actionText"
                    class="notification-item__action-text"
                  >
                    {{ item.actionText }}
                  </span>
                </div>

                <p v-if="item.date" class="notification-item__time">
                  {{ item.date }}
                </p>
              </div>

              <div class="notification-item__actions">
                <slot name="action" :item="item">
                  <slot name="action-prepend" :item="item"></slot>
                  <VbenIconButton
                    v-if="!item.isRead"
                    size="xs"
                    variant="ghost"
                    class="h-6 px-2"
                    :tooltip="$t('common.confirm')"
                    @click.stop="emit('read', item)"
                  >
                    <CircleCheckBig class="size-4" />
                  </VbenIconButton>
                  <VbenIconButton
                    v-else
                    size="xs"
                    variant="ghost"
                    class="h-6 px-2 text-destructive"
                    :tooltip="$t('common.delete')"
                    @click.stop="emit('remove', item)"
                  >
                    <CircleX class="size-4" />
                  </VbenIconButton>
                  <slot name="action-append" :item="item"></slot>
                </slot>
              </div>
            </slot>
          </li>
        </ul>
      </VbenScrollbar>

      <template v-else>
        <div class="flex-center min-h-37.5 w-full text-muted-foreground">
          {{ $t('common.noData') }}
        </div>
      </template>

      <div class="flex items-center justify-between border-t border-border px-4 py-3">
        <VbenButton
          :disabled="notifications.length <= 0"
          size="sm"
          variant="ghost"
          @click="handleClear"
        >
          {{ $t('ui.widgets.clearNotifications') }}
        </VbenButton>
        <VbenButton size="sm" @click="handleViewAll">
          {{ $t('ui.widgets.viewAll') }}
        </VbenButton>
      </div>
    </div>
  </VbenPopover>
</template>

<style scoped>
.notification-summary {
  padding: 0 16px 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.notification-count {
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  color: #1d4ed8;
  background: #dbeafe;
  border-radius: 999px;
}

.notification-item {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 48px 14px 14px;
  cursor: pointer;
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
}

.notification-item + .notification-item {
  margin-top: 8px;
}

.notification-item:hover {
  background: hsl(var(--accent) / 0.45);
}

.notification-item__body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.notification-item__title-row {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.notification-item__title {
  min-width: 0;
  font-weight: 600;
  line-height: 1.2;
}

.notification-item__message {
  font-size: 12px;
  line-height: 1.55;
  color: hsl(var(--muted-foreground));
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notification-item__meta-row {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.notification-item__action-text {
  color: #2563eb;
}

.notification-item__time {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.notification-item__actions {
  position: absolute;
  top: 10px;
  right: 10px;
}

.notification-level {
  flex-shrink: 0;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
}

.notification-level--high {
  color: #991b1b;
  background: #fee2e2;
}

.notification-level--medium {
  color: #92400e;
  background: #fef3c7;
}

.notification-level--low {
  color: #1d4ed8;
  background: #dbeafe;
}

.notification-level--default {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

:deep(.bell-button) {
  &:hover {
    svg {
      animation: bell-ring 1s both;
    }
  }
}

@keyframes bell-ring {
  0%,
  100% {
    transform-origin: top;
  }

  15% {
    transform: rotateZ(10deg);
  }

  30% {
    transform: rotateZ(-10deg);
  }

  45% {
    transform: rotateZ(5deg);
  }

  60% {
    transform: rotateZ(-5deg);
  }

  75% {
    transform: rotateZ(2deg);
  }
}
</style>
