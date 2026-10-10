<script setup lang="ts">
import type { EnterpriseMediaPreviewPayload } from '../types';

import { computed, shallowRef, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Empty, Modal, Tag } from 'antdv-next';

import { triggerDownload } from '../utils';

const props = defineProps<{
  open: boolean;
  payload: EnterpriseMediaPreviewPayload | null;
}>();

const emit = defineEmits<{
  close: [];
  delete: [payload: EnterpriseMediaPreviewPayload];
}>();

const currentIndex = shallowRef(0);

watch(
  () => [props.open, props.payload] as const,
  ([isOpen, payload]) => {
    if (!isOpen || !payload) {
      currentIndex.value = 0;
      return;
    }

    currentIndex.value = payload.initialIndex ?? 0;
  },
  { immediate: true },
);

const currentImage = computed(
  () => props.payload?.images[currentIndex.value] ?? '',
);

const hasPrevious = computed(() => currentIndex.value > 0);
const hasNext = computed(
  () =>
    currentIndex.value < Math.max((props.payload?.images.length ?? 1) - 1, 0),
);

function handleDownload() {
  if (!props.payload || !currentImage.value) {
    return;
  }

  const suffix =
    props.payload.mode === 'photo' && props.payload.images.length > 1
      ? `-${currentIndex.value + 1}`
      : '';
  triggerDownload(currentImage.value, `${props.payload.title}${suffix}`);
}

function handlePrevious() {
  if (hasPrevious.value) {
    currentIndex.value -= 1;
  }
}

function handleNext() {
  if (hasNext.value) {
    currentIndex.value += 1;
  }
}
</script>

<template>
  <Modal
    :footer="null"
    :open="open"
    :title="payload?.title || '资料预览'"
    :width="960"
    destroy-on-hidden
    @cancel="emit('close')"
  >
    <div v-if="payload && currentImage" class="preview-modal">
      <div class="preview-modal__stage">
        <img
          :src="currentImage"
          :alt="payload.title"
          class="preview-modal__image"
        />
      </div>

      <div class="preview-modal__aside">
        <div class="preview-modal__header">
          <Tag color="processing">{{ payload.categoryLabel }}</Tag>
          <span class="preview-modal__date">{{ payload.createdAt }}</span>
        </div>

        <div class="preview-modal__title">{{ payload.title }}</div>
        <div v-if="payload.description" class="preview-modal__description">
          {{ payload.description }}
        </div>

        <div class="preview-modal__index">
          {{ currentIndex + 1 }} / {{ payload.images.length }}
        </div>

        <div class="preview-modal__actions">
          <Button @click="handleDownload">
            <IconifyIcon icon="lucide:download" class="size-4" />
            下载
          </Button>
          <Button
            v-if="payload.images.length > 1"
            :disabled="!hasPrevious"
            @click="handlePrevious"
          >
            <IconifyIcon icon="lucide:chevron-left" class="size-4" />
            上一张
          </Button>
          <Button
            v-if="payload.images.length > 1"
            :disabled="!hasNext"
            @click="handleNext"
          >
            下一张
            <IconifyIcon icon="lucide:chevron-right" class="size-4" />
          </Button>
          <Button danger @click="emit('delete', payload)">
            <IconifyIcon icon="lucide:trash-2" class="size-4" />
            删除
          </Button>
        </div>

        <div
          v-if="payload.images.length > 1"
          class="preview-modal__thumbs"
        >
          <button
            v-for="(image, index) in payload.images"
            :key="`${image}-${index}`"
            class="preview-modal__thumb"
            :class="{ 'preview-modal__thumb--active': index === currentIndex }"
            type="button"
            @click="currentIndex = index"
          >
            <img :src="image" :alt="`${payload.title}-${index + 1}`" />
          </button>
        </div>
      </div>
    </div>

    <Empty v-else description="暂无可预览内容" />
  </Modal>
</template>

<style scoped>
.preview-modal {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 20px;
}

.preview-modal__stage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 420px;
  padding: 18px;
  background:
    linear-gradient(135deg, rgb(247 250 252 / 96%), rgb(232 241 237 / 92%)),
    repeating-linear-gradient(
      135deg,
      rgb(56 94 82 / 6%) 0,
      rgb(56 94 82 / 6%) 1px,
      transparent 1px,
      transparent 16px
    );
  border-radius: 22px;
}

.preview-modal__image {
  max-width: 100%;
  max-height: 68vh;
  object-fit: contain;
  border-radius: 16px;
}

.preview-modal__aside {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.preview-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.preview-modal__date,
.preview-modal__description,
.preview-modal__index {
  color: rgb(100 116 139);
}

.preview-modal__title {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.4;
}

.preview-modal__description {
  line-height: 1.7;
}

.preview-modal__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preview-modal__thumbs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.preview-modal__thumb {
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  background: transparent;
  border: 2px solid transparent;
  border-radius: 12px;
}

.preview-modal__thumb--active {
  border-color: rgb(22 119 255 / 70%);
}

.preview-modal__thumb img {
  display: block;
  width: 100%;
  height: 64px;
  object-fit: cover;
}

@media (max-width: 900px) {
  .preview-modal {
    grid-template-columns: 1fr;
  }

  .preview-modal__stage {
    min-height: 280px;
  }
}
</style>
