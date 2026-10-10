<script setup lang="ts">
import type { EnterpriseMediaGalleryCard, EnterpriseMediaMode } from '../types';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Card, Checkbox, Empty, Skeleton, Tag } from 'antdv-next';

const props = withDefaults(
  defineProps<{
    emptyDescription: string;
    emptyTitle: string;
    items: EnterpriseMediaGalleryCard[];
    loading?: boolean;
    mode: EnterpriseMediaMode;
    selectedIds?: string[];
    uploadText?: string;
  }>(),
  {
    loading: false,
    selectedIds: () => [],
    uploadText: '立即上传',
  },
);

const emit = defineEmits<{
  delete: [item: EnterpriseMediaGalleryCard];
  download: [item: EnterpriseMediaGalleryCard];
  preview: [item: EnterpriseMediaGalleryCard];
  toggleSelect: [id: string];
  upload: [];
}>();

const skeletonCount = computed(() => Array.from({ length: 6 }, (_, index) => index));

function isSelected(id: string) {
  return props.selectedIds.includes(id);
}
</script>

<template>
  <div class="media-gallery">
    <div
      v-if="loading && !items.length"
      class="media-gallery__grid"
    >
      <Card
        v-for="item in skeletonCount"
        :key="item"
        class="media-gallery__card"
        variant="borderless"
      >
        <Skeleton active :paragraph="{ rows: 2 }" />
      </Card>
    </div>

    <div v-else-if="!items.length" class="media-gallery__empty">
      <Empty>
        <template #description>
          <div class="media-gallery__empty-title">{{ emptyTitle }}</div>
          <div class="media-gallery__empty-description">{{ emptyDescription }}</div>
        </template>
        <Button type="primary" @click="emit('upload')">
          <IconifyIcon icon="lucide:upload" class="size-4" />
          {{ uploadText }}
        </Button>
      </Empty>
    </div>

    <div v-else class="media-gallery__grid">
      <Card
        v-for="item in items"
        :key="item.id"
        class="media-gallery__card"
        variant="borderless"
      >
        <div
          class="media-gallery__cover"
          :class="{
            'media-gallery__cover--selected': mode === 'certificate' && isSelected(item.id),
          }"
        >
          <img
            :src="item.coverUrl"
            :alt="item.title"
            class="media-gallery__image"
            @click="emit('preview', item)"
          />
          <div v-if="mode === 'certificate'" class="media-gallery__checkbox">
            <Checkbox
              :checked="isSelected(item.id)"
              @change="emit('toggleSelect', item.id)"
            />
          </div>
          <div v-if="mode === 'photo' && item.imageCount > 1" class="media-gallery__badge">
            {{ item.imageCount }} 张
          </div>
        </div>

        <div class="media-gallery__content">
          <div class="media-gallery__meta">
            <Tag color="processing">{{ item.categoryLabel }}</Tag>
            <span class="media-gallery__date">{{ item.createdAt }}</span>
          </div>
          <div class="media-gallery__title" :title="item.title">{{ item.title }}</div>
          <div v-if="item.description" class="media-gallery__description">
            {{ item.description }}
          </div>

          <div class="media-gallery__actions">
            <Button size="small" @click="emit('preview', item)">
              <IconifyIcon icon="lucide:eye" class="size-4" />
              预览
            </Button>
            <Button size="small" @click="emit('download', item)">
              <IconifyIcon icon="lucide:download" class="size-4" />
              下载
            </Button>
            <Button danger size="small" @click="emit('delete', item)">
              <IconifyIcon icon="lucide:trash-2" class="size-4" />
              删除
            </Button>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.media-gallery {
  min-height: 180px;
}

.media-gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.media-gallery__card {
  overflow: hidden;
  border-radius: 18px;
  box-shadow: 0 12px 30px rgb(15 23 42 / 8%);
}

.media-gallery__cover {
  position: relative;
  height: 180px;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgb(245 248 252 / 96%), rgb(232 241 237 / 92%)),
    repeating-linear-gradient(
      135deg,
      rgb(56 94 82 / 7%) 0,
      rgb(56 94 82 / 7%) 1px,
      transparent 1px,
      transparent 16px
    );
  border: 2px solid transparent;
  border-radius: 16px;
}

.media-gallery__cover--selected {
  border-color: rgb(22 119 255 / 70%);
  box-shadow: 0 0 0 3px rgb(22 119 255 / 12%);
}

.media-gallery__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.media-gallery__image:hover {
  transform: scale(1.03);
}

.media-gallery__checkbox {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 4px 6px;
  background: rgb(255 255 255 / 92%);
  border-radius: 999px;
}

.media-gallery__badge {
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 4px 10px;
  color: #fff;
  font-size: 12px;
  background: rgb(15 23 42 / 76%);
  border-radius: 999px;
}

.media-gallery__content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 4px 2px;
}

.media-gallery__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.media-gallery__date {
  color: rgb(100 116 139);
  font-size: 12px;
}

.media-gallery__title {
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-gallery__description {
  min-height: 40px;
  color: rgb(71 85 105);
  font-size: 13px;
  line-height: 1.6;
}

.media-gallery__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.media-gallery__empty {
  padding: 28px 0 12px;
  border: 1px dashed rgb(148 163 184 / 40%);
  border-radius: 20px;
  background: linear-gradient(180deg, #fbfcfe 0%, #f7faf8 100%);
}

.media-gallery__empty-title {
  font-size: 16px;
  font-weight: 600;
}

.media-gallery__empty-description {
  margin-top: 6px;
  color: rgb(100 116 139);
  font-size: 13px;
}

@media (max-width: 640px) {
  .media-gallery__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .media-gallery__cover {
    height: 140px;
  }

  .media-gallery__actions {
    gap: 6px;
  }
}
</style>
