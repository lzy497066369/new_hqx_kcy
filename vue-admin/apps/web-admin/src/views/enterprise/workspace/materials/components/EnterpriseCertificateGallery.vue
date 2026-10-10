<script setup lang="ts">
import type { Directive } from 'vue';
import type {
  EnterpriseWorkspaceCertificate,
  EnterpriseWorkspaceCertificateInput,
} from '#/api';

import { computed, onBeforeUnmount, onMounted, reactive, shallowRef, watch } from 'vue';

import { IconifyIcon, ImagePlus } from '@vben/icons';
import { Button, Checkbox, Empty, Input, Modal, Select, Spin, Tag } from 'antdv-next';

import {
  createEnterpriseWorkspaceArchiveRecordApi,
  deleteEnterpriseWorkspaceArchiveRecordApi,
  deleteEnterpriseWorkspaceCertificatesApi,
  getEnterpriseWorkspaceArchiveRecordsApi,
  previewEnterpriseWorkspaceAttachmentApi,
  updateEnterpriseWorkspaceArchiveRecordApi,
  uploadEnterpriseWorkspaceArchiveAttachmentApi,
} from '#/api';
import { useEnterpriseContextStore } from '#/store';

import { confirmAction, showActionFailure, showActionSuccess } from '../../../../system/shared/action-feedback';

defineOptions({ name: 'EnterpriseCertificateGallery' });

const categories = [
  { label: '行业资质', value: 1 },
  { label: '安全许可', value: 2 },
  { label: '质量体系', value: 3 },
  { label: '荣誉证书', value: 4 },
  { label: '营业执照', value: 5 },
  { label: '其他', value: 6 },
];
const enterpriseContextStore = useEnterpriseContextStore();
const certificates = shallowRef<EnterpriseWorkspaceCertificate[]>([]);
const loading = shallowRef(false);
const saving = shallowRef(false);
const previewLoading = shallowRef(false);
const previewOpen = shallowRef(false);
const previewTitle = shallowRef('');
const previewUrl = shallowRef('');
const thumbnails = shallowRef<Record<string, string>>({});
const editorOpen = shallowRef(false);
const editing = shallowRef<EnterpriseWorkspaceCertificate>();
const selectedFile = shallowRef<File>();
const activeCategory = shallowRef(1);
const observer = shallowRef<IntersectionObserver>();
const loadVersion = shallowRef(0);
const thumbnailTargets = new Map<HTMLElement, EnterpriseWorkspaceCertificate>();
const loadingThumbnails = new Set<string>();
const form = reactive<EnterpriseWorkspaceCertificateInput>(emptyForm());

const visible = computed(() => certificates.value.filter((item) => item.zsClass === activeCategory.value));

function emptyForm(): EnterpriseWorkspaceCertificateInput {
  return { qualificationCode: null, validUntil: null, zsClass: 1, zsName: '', zsPath: null };
}

function enterpriseId() {
  return enterpriseContextStore.currentEnterpriseId ?? '';
}

function isImage(path: null | string) {
  return /\.(?:avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/iu.test(path ?? '');
}

function clearThumbnails() {
  Object.values(thumbnails.value).forEach(URL.revokeObjectURL);
  thumbnails.value = {};
  loadingThumbnails.clear();
}

async function loadThumbnail(item: EnterpriseWorkspaceCertificate, version = loadVersion.value) {
  if (!item.zsPath || !isImage(item.zsPath) || thumbnails.value[item.id] || loadingThumbnails.has(item.id)) return;
  const id = enterpriseId();
  loadingThumbnails.add(item.id);
  try {
    const blob = await previewEnterpriseWorkspaceAttachmentApi(id, 'certificate', item.id, item.zsPath);
    const url = URL.createObjectURL(blob);
    if (version !== loadVersion.value || id !== enterpriseId()) {
      URL.revokeObjectURL(url);
      return;
    }
    thumbnails.value = { ...thumbnails.value, [item.id]: url };
  } catch {
    // Preview failures are isolated to the record.
  } finally {
    loadingThumbnails.delete(item.id);
  }
}

const vLazyThumbnail: Directive<HTMLElement, EnterpriseWorkspaceCertificate> = {
  mounted(element, binding) {
    thumbnailTargets.set(element, binding.value);
    observer.value?.observe(element);
  },
  updated(element, binding) {
    thumbnailTargets.set(element, binding.value);
    observer.value?.observe(element);
  },
  unmounted(element) {
    observer.value?.unobserve(element);
    thumbnailTargets.delete(element);
  },
};

async function load() {
  const id = enterpriseId();
  const version = loadVersion.value + 1;
  loadVersion.value = version;
  if (!id) {
    certificates.value = [];
    clearThumbnails();
    return;
  }

  loading.value = true;
  try {
    const result = await getEnterpriseWorkspaceArchiveRecordsApi(id);
    if (version === loadVersion.value && id === enterpriseId()) {
      certificates.value = result.certificates;
      selectedIds.value = selectedIds.value.filter((certificateId) =>
        result.certificates.some((item) => item.id === certificateId),
      );
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
}

async function openPreview(item: EnterpriseWorkspaceCertificate) {
  if (!item.zsPath) return;
  previewOpen.value = true;
  previewLoading.value = true;
  previewTitle.value = item.zsName || '企业证书';
  try {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = URL.createObjectURL(
      await previewEnterpriseWorkspaceAttachmentApi(enterpriseId(), 'certificate', item.id, item.zsPath),
    );
  } catch (error) {
    closePreview();
    showActionFailure(error);
  } finally {
    previewLoading.value = false;
  }
}

async function download(item: EnterpriseWorkspaceCertificate) {
  if (!item.zsPath) return;
  try {
    const blob = await previewEnterpriseWorkspaceAttachmentApi(enterpriseId(), 'certificate', item.id, item.zsPath);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = item.zsPath.split('/').pop() || item.zsName || '企业证书';
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    showActionFailure(error);
  }
}

function openEditor(item?: EnterpriseWorkspaceCertificate) {
  editing.value = item;
  selectedFile.value = undefined;
  Object.assign(form, emptyForm(), item ?? {});
  editorOpen.value = true;
}

function selectFile(event: Event) {
  selectedFile.value = (event.target as HTMLInputElement).files?.[0];
}

async function save() {
  if (!form.zsName.trim()) {
    showActionFailure(new Error('请填写证书名称'));
    return;
  }
  saving.value = true;
  try {
    const path = selectedFile.value
      ? (await uploadEnterpriseWorkspaceArchiveAttachmentApi(enterpriseId(), selectedFile.value)).path
      : form.zsPath;
    const payload = { ...form, zsName: form.zsName.trim(), zsPath: path };
    if (editing.value) {
      await updateEnterpriseWorkspaceArchiveRecordApi(enterpriseId(), 'certificates', editing.value.id, payload);
    } else {
      await createEnterpriseWorkspaceArchiveRecordApi(enterpriseId(), 'certificates', payload);
    }
    editorOpen.value = false;
    await load();
    showActionSuccess(editing.value ? '企业证书已更新' : '企业证书已上传');
  } catch (error) {
    showActionFailure(error);
  } finally {
    saving.value = false;
  }
}

async function remove(item: EnterpriseWorkspaceCertificate) {
  try {
    await confirmAction(`确认删除“${item.zsName ?? ''}”吗？`, '删除企业证书');
    await deleteEnterpriseWorkspaceArchiveRecordApi(enterpriseId(), 'certificates', item.id);
    await load();
    showActionSuccess('企业证书已删除');
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') return;
    showActionFailure(error);
  }
}

function toggleSelected(id: string, checked: boolean) {
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, id])]
    : selectedIds.value.filter((item) => item !== id);
}

const selectedIds = shallowRef<string[]>([]);

async function batchRemove() {
  if (!selectedIds.value.length) return;
  try {
    await confirmAction(`确认删除选中的 ${selectedIds.value.length} 张企业证书吗？`, '批量删除企业证书');
    const result = await deleteEnterpriseWorkspaceCertificatesApi(enterpriseId(), selectedIds.value);
    selectedIds.value = [];
    await load();
    showActionSuccess(`已删除 ${result.deletedCount} 张企业证书`);
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') return;
    showActionFailure(error);
  }
}

onMounted(() => {
  observer.value = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const item = thumbnailTargets.get(entry.target as HTMLElement);
      if (item) void loadThumbnail(item);
      observer.value?.unobserve(entry.target);
    });
  }, { rootMargin: '160px' });
  thumbnailTargets.forEach((_item, element) => observer.value?.observe(element));
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
    <div class="enterprise-certificate-gallery">
      <div class="enterprise-certificate-gallery__toolbar">
        <div class="enterprise-certificate-gallery__filters">
          <Button v-for="category in categories" :key="category.value" :type="activeCategory === category.value ? 'primary' : 'default'" size="small" @click="activeCategory = category.value">{{ category.label }}</Button>
        </div>
        <div class="enterprise-certificate-gallery__toolbar-actions">
          <Button v-if="selectedIds.length" danger @click="batchRemove">删除选中（{{ selectedIds.length }}）</Button>
          <Button type="primary" @click="openEditor()"><ImagePlus class="size-4" />上传证书</Button>
        </div>
      </div>
      <div v-if="visible.length" class="enterprise-certificate-gallery__grid">
        <article v-for="item in visible" :key="item.id" v-lazy-thumbnail="item" class="enterprise-certificate-gallery__item">
          <Checkbox class="enterprise-certificate-gallery__select" :checked="selectedIds.includes(item.id)" @change="toggleSelected(item.id, $event.target.checked)" />
          <button v-if="thumbnails[item.id]" type="button" @click="openPreview(item)"><img :src="thumbnails[item.id]" :alt="item.zsName || '企业证书'" /></button>
          <button v-else-if="item.zsPath" class="enterprise-certificate-gallery__file" type="button" @click="openPreview(item)">查看证书文件</button>
          <div v-else class="enterprise-certificate-gallery__file">无文件</div>
          <div class="enterprise-certificate-gallery__meta"><strong>{{ item.zsName || '未命名证书' }}</strong><span>{{ item.qualificationCode || '-' }}</span><span>{{ item.validUntil || '长期有效' }}</span><Tag>{{ categories.find((category) => category.value === item.zsClass)?.label || '其他' }}</Tag></div>
          <div class="enterprise-certificate-gallery__actions"><Button v-if="item.zsPath" size="small" type="text" @click="download(item)"><IconifyIcon icon="lucide:download" class="size-4" /></Button><Button size="small" type="text" @click="openEditor(item)"><IconifyIcon icon="lucide:pencil" class="size-4" /></Button><Button danger size="small" type="text" @click="remove(item)"><IconifyIcon icon="lucide:trash-2" class="size-4" /></Button></div>
        </article>
      </div>
      <Empty v-else description="当前分类暂无企业证书" />
      <Modal v-model:open="editorOpen" :confirm-loading="saving" :title="editing ? '编辑企业证书' : '上传企业证书'" @ok="save"><div class="enterprise-certificate-gallery__form"><label>证书名称<Input v-model:value="form.zsName" /></label><label>证书分类<Select v-model:value="form.zsClass" :options="categories" /></label><label>资质编号<Input v-model:value="form.qualificationCode" /></label><label>有效期<Input v-model:value="form.validUntil" placeholder="例如 2027-12-31" /></label><label>证书文件<input accept="image/*,.pdf" type="file" @change="selectFile" /></label></div></Modal>
      <Modal :open="previewOpen" :footer="null" :title="previewTitle || '证书预览'" width="960px" @cancel="closePreview" @update:open="(value) => !value && closePreview()"><Spin :spinning="previewLoading"><iframe v-if="previewUrl" :src="previewUrl" class="enterprise-certificate-gallery__preview" title="证书预览" /><Empty v-else-if="!previewLoading" description="暂无可预览文件" /></Spin></Modal>
    </div>
  </Spin>
</template>

<style scoped>
.enterprise-certificate-gallery, .enterprise-certificate-gallery__form { display: grid; gap: 16px; }
.enterprise-certificate-gallery__toolbar, .enterprise-certificate-gallery__filters, .enterprise-certificate-gallery__actions, .enterprise-certificate-gallery__toolbar-actions { display: flex; gap: 8px; align-items: center; }
.enterprise-certificate-gallery__toolbar { justify-content: space-between; }.enterprise-certificate-gallery__filters, .enterprise-certificate-gallery__toolbar-actions { flex-wrap: wrap; }
.enterprise-certificate-gallery__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px; }.enterprise-certificate-gallery__item { position: relative; overflow: hidden; border: 1px solid #e5e7eb; }.enterprise-certificate-gallery__item > button:first-of-type { display: block; width: 100%; padding: 0; border: 0; cursor: pointer; }.enterprise-certificate-gallery__item img, .enterprise-certificate-gallery__file { display: block; width: 100%; height: 148px; object-fit: cover; background: #f8fafc; }.enterprise-certificate-gallery__file { display: grid; place-items: center; color: #6b7280; border: 0; cursor: pointer; }.enterprise-certificate-gallery__select { position: absolute; z-index: 1; top: 8px; left: 8px; padding: 4px 6px; background: rgb(255 255 255 / 92%); border-radius: 4px; }.enterprise-certificate-gallery__meta { display: grid; gap: 6px; padding: 12px; }.enterprise-certificate-gallery__meta span { color: #6b7280; font-size: 12px; }.enterprise-certificate-gallery__actions { position: absolute; top: 8px; right: 8px; padding: 2px; background: rgb(255 255 255 / 92%); }.enterprise-certificate-gallery__form label { display: grid; gap: 6px; color: #4b5563; font-size: 13px; }.enterprise-certificate-gallery__preview { display: block; width: 100%; min-height: 620px; border: 0; }@media(max-width:640px){.enterprise-certificate-gallery__toolbar{align-items:stretch;flex-direction:column}}
</style>
