<script setup lang="ts">
import type { Directive } from 'vue';
import type {
  EnterpriseWorkspacePhoto,
  EnterpriseWorkspacePhotoInput,
} from '#/api';

import { computed, onBeforeUnmount, onMounted, reactive, shallowRef, watch } from 'vue';

import { IconifyIcon, ImagePlus } from '@vben/icons';
import { Button, Empty, Input, Modal, Radio, RadioGroup, Select, Spin, Tag } from 'antdv-next';

import {
  createEnterpriseWorkspacePhotoApi,
  deleteEnterpriseWorkspacePhotoApi,
  getEnterpriseWorkspacePhotosApi,
  previewEnterpriseWorkspaceAttachmentApi,
  updateEnterpriseWorkspacePhotoApi,
  uploadEnterpriseWorkspaceArchiveAttachmentApi,
} from '#/api';
import { useEnterpriseContextStore } from '#/store';

import { confirmAction, showActionFailure, showActionSuccess } from '../../../../system/shared/action-feedback';

defineOptions({ name: 'EnterprisePhotoGallery' });

const photoCategoryOptions = [
  { label: '场地', value: 1 },
  { label: '培训', value: 2 },
  { label: '设备', value: 3 },
  { label: '产品', value: 4 },
];
const categories = [{ label: '全部', value: undefined }, ...photoCategoryOptions];
const enterpriseContextStore = useEnterpriseContextStore();
const photos = shallowRef<EnterpriseWorkspacePhoto[]>([]);
const loading = shallowRef(false);
const saving = shallowRef(false);
const previewLoading = shallowRef(false);
const previewOpen = shallowRef(false);
const previewTitle = shallowRef('');
const previewUrl = shallowRef('');
const previewPhoto = shallowRef<EnterpriseWorkspacePhoto>();
const previewPath = shallowRef('');
const thumbnails = shallowRef<Record<string, string>>({});
const editorOpen = shallowRef(false);
const editing = shallowRef<EnterpriseWorkspacePhoto>();
const selectedFiles = shallowRef<File[]>([]);
const activeCategory = shallowRef<number>();
const attachmentMode = shallowRef<'append' | 'replace'>('append');
const observer = shallowRef<IntersectionObserver>();
const loadVersion = shallowRef(0);
const thumbnailTargets = new Map<HTMLElement, EnterpriseWorkspacePhoto>();
const loadingThumbnails = new Set<string>();
const form = reactive<EnterpriseWorkspacePhotoInput>(emptyForm());

const visible = computed(() =>
  activeCategory.value === undefined
    ? photos.value
    : photos.value.filter((item) => item.photoStatus === activeCategory.value),
);

function emptyForm(): EnterpriseWorkspacePhotoInput {
  return { photoDes: null, photoFiles: '', photoStatus: 1, photoTitle: '', psDate: null };
}

function enterpriseId() {
  return enterpriseContextStore.currentEnterpriseId ?? '';
}

function paths(photo: EnterpriseWorkspacePhoto) {
  return splitPaths(photo.photoFiles);
}

function splitPaths(photoFiles: null | string | undefined) {
  return (photoFiles ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function primaryPath(photo: EnterpriseWorkspacePhoto) {
  return paths(photo)[0] ?? null;
}

function clearThumbnails() {
  Object.values(thumbnails.value).forEach(URL.revokeObjectURL);
  thumbnails.value = {};
  loadingThumbnails.clear();
}

async function loadThumbnail(photo: EnterpriseWorkspacePhoto, version = loadVersion.value) {
  const path = primaryPath(photo);
  if (!path || thumbnails.value[photo.id] || loadingThumbnails.has(photo.id)) return;

  const id = enterpriseId();
  loadingThumbnails.add(photo.id);
  try {
    const blob = await previewEnterpriseWorkspaceAttachmentApi(id, 'photo', photo.id, path);
    const url = URL.createObjectURL(blob);
    if (version !== loadVersion.value || id !== enterpriseId()) {
      URL.revokeObjectURL(url);
      return;
    }
    thumbnails.value = { ...thumbnails.value, [photo.id]: url };
  } catch {
    // A missing thumbnail must not prevent other records from being displayed.
  } finally {
    loadingThumbnails.delete(photo.id);
  }
}

function observeThumbnail(element: HTMLElement, photo: EnterpriseWorkspacePhoto) {
  thumbnailTargets.set(element, photo);
  observer.value?.observe(element);
}

const vLazyThumbnail: Directive<HTMLElement, EnterpriseWorkspacePhoto> = {
  mounted(element, binding) {
    observeThumbnail(element, binding.value);
  },
  unmounted(element) {
    observer.value?.unobserve(element);
    thumbnailTargets.delete(element);
  },
  updated(element, binding) {
    thumbnailTargets.set(element, binding.value);
    observer.value?.observe(element);
  },
};

async function load() {
  const id = enterpriseId();
  const version = loadVersion.value + 1;
  loadVersion.value = version;
  if (!id) {
    photos.value = [];
    clearThumbnails();
    return;
  }

  loading.value = true;
  try {
    const result = await getEnterpriseWorkspacePhotosApi(id);
    if (version === loadVersion.value && id === enterpriseId()) {
      photos.value = result;
      clearThumbnails();
    }
  } catch (error) {
    if (version === loadVersion.value) showActionFailure(error);
  } finally {
    if (version === loadVersion.value) loading.value = false;
  }
}

function closePreview() {
  previewOpen.value = false;
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  previewPhoto.value = undefined;
  previewPath.value = '';
}

async function openPreview(photo: EnterpriseWorkspacePhoto, path: string) {
  previewOpen.value = true;
  previewLoading.value = true;
  previewTitle.value = photo.photoTitle || '企业照片';
  previewPhoto.value = photo;
  previewPath.value = path;
  try {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = URL.createObjectURL(
      await previewEnterpriseWorkspaceAttachmentApi(enterpriseId(), 'photo', photo.id, path),
    );
  } catch (error) {
    closePreview();
    showActionFailure(error);
  } finally {
    previewLoading.value = false;
  }
}

async function previous() {
  const photo = previewPhoto.value;
  if (!photo) return;
  const list = paths(photo);
  const index = list.indexOf(previewPath.value);
  const target = list[(index - 1 + list.length) % list.length];
  if (target) await openPreview(photo, target);
}

async function next() {
  const photo = previewPhoto.value;
  if (!photo) return;
  const list = paths(photo);
  const index = list.indexOf(previewPath.value);
  const target = list[(index + 1) % list.length];
  if (target) await openPreview(photo, target);
}

async function download(photo: EnterpriseWorkspacePhoto, path: string) {
  try {
    const blob = await previewEnterpriseWorkspaceAttachmentApi(enterpriseId(), 'photo', photo.id, path);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = path.split('/').pop() || photo.photoTitle || '企业照片';
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    showActionFailure(error);
  }
}

function openEditor(item?: EnterpriseWorkspacePhoto) {
  editing.value = item;
  selectedFiles.value = [];
  attachmentMode.value = 'append';
  Object.assign(form, emptyForm(), item ?? {});
  editorOpen.value = true;
}

function chooseFiles(event: Event) {
  selectedFiles.value = Array.from((event.target as HTMLInputElement).files ?? []);
}

async function uploadFiles() {
  if (!selectedFiles.value.length) return form.photoFiles;
  const uploaded = await Promise.all(
    selectedFiles.value.map(async (file) =>
      (await uploadEnterpriseWorkspaceArchiveAttachmentApi(enterpriseId(), file)).path,
    ),
  );
  const existing = attachmentMode.value === 'append' ? splitPaths(form.photoFiles) : [];
  return [...new Set([...existing, ...uploaded])].join(',');
}

async function save() {
  if (!form.photoTitle.trim()) {
    showActionFailure(new Error('请填写照片标题'));
    return;
  }

  saving.value = true;
  try {
    const payload = {
      ...form,
      photoFiles: await uploadFiles(),
      photoTitle: form.photoTitle.trim(),
    };
    if (editing.value) {
      await updateEnterpriseWorkspacePhotoApi(enterpriseId(), editing.value.id, payload);
    } else {
      await createEnterpriseWorkspacePhotoApi(enterpriseId(), payload);
    }
    editorOpen.value = false;
    await load();
    showActionSuccess(editing.value ? '企业照片已更新' : '企业照片已上传');
  } catch (error) {
    showActionFailure(error);
  } finally {
    saving.value = false;
  }
}

async function remove(photo: EnterpriseWorkspacePhoto) {
  try {
    await confirmAction(`确认删除“${photo.photoTitle ?? ''}”吗？`, '删除企业照片');
    await deleteEnterpriseWorkspacePhotoApi(enterpriseId(), photo.id);
    await load();
    showActionSuccess('企业照片已删除');
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') return;
    showActionFailure(error);
  }
}

onMounted(() => {
  observer.value = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const photo = thumbnailTargets.get(entry.target as HTMLElement);
      if (photo) void loadThumbnail(photo);
      observer.value?.unobserve(entry.target);
    });
  }, { rootMargin: '160px' });
  thumbnailTargets.forEach((_photo, element) => observer.value?.observe(element));
});

watch(() => enterpriseContextStore.currentEnterpriseId, () => void load(), { immediate: true });
onBeforeUnmount(() => {
  observer.value?.disconnect();
  closePreview();
  clearThumbnails();
});
</script>

<template>
  <Spin :spinning="loading">
    <div class="enterprise-photo-gallery">
      <div class="enterprise-photo-gallery__toolbar">
        <div class="enterprise-photo-gallery__filters">
          <Button
            v-for="category in categories"
            :key="String(category.value)"
            :type="activeCategory === category.value ? 'primary' : 'default'"
            size="small"
            @click="activeCategory = category.value"
          >
            {{ category.label }}
          </Button>
        </div>
        <Button type="primary" @click="openEditor()"><ImagePlus class="size-4" />上传照片</Button>
      </div>

      <div v-if="visible.length" class="enterprise-photo-gallery__grid">
        <article v-for="photo in visible" :key="photo.id" v-lazy-thumbnail="photo" class="enterprise-photo-gallery__item">
          <button v-if="thumbnails[photo.id]" type="button" @click="openPreview(photo, primaryPath(photo)!)">
            <img :alt="photo.photoTitle || '企业照片'" :src="thumbnails[photo.id]" />
          </button>
          <button v-else-if="primaryPath(photo)" class="enterprise-photo-gallery__file" type="button" @click="openPreview(photo, primaryPath(photo)!)">查看照片文件</button>
          <div v-else class="enterprise-photo-gallery__file">无图片</div>
          <div class="enterprise-photo-gallery__meta">
            <strong>{{ photo.photoTitle || '未命名照片' }}</strong>
            <span>{{ photo.psDate || '-' }}</span>
            <Tag>{{ photoCategoryOptions.find((category) => category.value === photo.photoStatus)?.label || '未分类' }}</Tag>
            <p>{{ photo.photoDes || '暂无说明' }}</p>
            <span v-if="paths(photo).length > 1">共 {{ paths(photo).length }} 张照片</span>
          </div>
          <div class="enterprise-photo-gallery__actions">
            <Button v-if="primaryPath(photo)" size="small" type="text" @click="download(photo, primaryPath(photo)!)"><IconifyIcon icon="lucide:download" class="size-4" /></Button>
            <Button size="small" type="text" @click="openEditor(photo)"><IconifyIcon icon="lucide:pencil" class="size-4" /></Button>
            <Button danger size="small" type="text" @click="remove(photo)"><IconifyIcon icon="lucide:trash-2" class="size-4" /></Button>
          </div>
        </article>
      </div>
      <Empty v-else description="暂无企业照片" />

      <Modal v-model:open="editorOpen" :confirm-loading="saving" :title="editing ? '编辑企业照片' : '上传企业照片'" @ok="save">
        <div class="enterprise-photo-gallery__form">
          <label>照片标题<Input v-model:value="form.photoTitle" /></label>
          <label>分类<Select v-model:value="form.photoStatus" :options="photoCategoryOptions" /></label>
          <label>拍摄日期<Input v-model:value="form.psDate" placeholder="例如 2026-07-14" /></label>
          <label>说明<Input v-model:value="form.photoDes" /></label>
          <label>图片文件<input accept="image/*" multiple type="file" @change="chooseFiles" /></label>
          <RadioGroup v-if="editing && selectedFiles.length" v-model:value="attachmentMode">
            <Radio value="append">追加到现有照片</Radio>
            <Radio value="replace">替换全部现有照片</Radio>
          </RadioGroup>
          <div v-if="selectedFiles.length">已选择 {{ selectedFiles.length }} 个文件</div>
        </div>
      </Modal>

      <Modal :open="previewOpen" :footer="null" :title="previewTitle || '照片预览'" width="960px" @cancel="closePreview" @update:open="(value) => !value && closePreview()">
        <Spin :spinning="previewLoading">
          <img v-if="previewUrl" :src="previewUrl" class="enterprise-photo-gallery__preview" :alt="previewTitle" />
          <Empty v-else-if="!previewLoading" description="暂无可预览照片" />
          <div v-if="previewPhoto && paths(previewPhoto).length > 1" class="enterprise-photo-gallery__preview-actions">
            <Button @click="previous">上一张</Button>
            <span>{{ paths(previewPhoto).indexOf(previewPath) + 1 }} / {{ paths(previewPhoto).length }}</span>
            <Button @click="next">下一张</Button>
            <Button @click="download(previewPhoto, previewPath)">下载当前照片</Button>
          </div>
        </Spin>
      </Modal>
    </div>
  </Spin>
</template>

<style scoped>
.enterprise-photo-gallery, .enterprise-photo-gallery__form { display: grid; gap: 16px; }
.enterprise-photo-gallery__toolbar, .enterprise-photo-gallery__filters, .enterprise-photo-gallery__actions, .enterprise-photo-gallery__preview-actions { display: flex; gap: 8px; align-items: center; }
.enterprise-photo-gallery__toolbar { justify-content: space-between; }
.enterprise-photo-gallery__filters { flex-wrap: wrap; }
.enterprise-photo-gallery__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px; }
.enterprise-photo-gallery__item { position: relative; overflow: hidden; border: 1px solid #e5e7eb; }
.enterprise-photo-gallery__item > button:first-child { display: block; width: 100%; padding: 0; border: 0; cursor: pointer; }
.enterprise-photo-gallery__item img, .enterprise-photo-gallery__file { display: block; width: 100%; height: 148px; object-fit: cover; background: #f8fafc; }
.enterprise-photo-gallery__file { display: grid; place-items: center; color: #6b7280; border: 0; cursor: pointer; }
.enterprise-photo-gallery__meta { display: grid; gap: 6px; padding: 12px; }
.enterprise-photo-gallery__meta span, .enterprise-photo-gallery__meta p { margin: 0; color: #6b7280; font-size: 12px; }
.enterprise-photo-gallery__actions { position: absolute; top: 8px; right: 8px; padding: 2px; background: rgb(255 255 255 / 92%); }
.enterprise-photo-gallery__form label { display: grid; gap: 6px; color: #4b5563; font-size: 13px; }
.enterprise-photo-gallery__preview { display: block; max-width: 100%; max-height: 72vh; margin: auto; }
.enterprise-photo-gallery__preview-actions { justify-content: center; margin-top: 14px; }
.enterprise-photo-gallery__preview-actions span { color: #6b7280; font-size: 13px; }
@media (max-width: 640px) { .enterprise-photo-gallery__toolbar { align-items: stretch; flex-direction: column; }.enterprise-photo-gallery__preview-actions { flex-wrap: wrap; } }
</style>
