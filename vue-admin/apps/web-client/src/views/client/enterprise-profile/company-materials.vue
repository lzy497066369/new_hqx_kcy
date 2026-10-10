<script setup lang="ts">
import ClientJourneyTrail from '#/views/client/components/ClientJourneyTrail.vue';

import type {
  EnterpriseMediaGalleryCard,
  EnterpriseMediaPreviewPayload,
  EnterpriseMediaUploadPayload,
} from './enterprise-media/types';

import { onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Card,
  Empty,
  message,
  Modal,
  Skeleton,
} from 'antdv-next';

import { useClientEnterpriseStore } from '#/store';

import EnterpriseMediaGallery from './enterprise-media/components/EnterpriseMediaGallery.vue';
import EnterpriseMediaPreviewModal from './enterprise-media/components/EnterpriseMediaPreviewModal.vue';
import EnterpriseMediaUploadModal from './enterprise-media/components/EnterpriseMediaUploadModal.vue';
import { useEnterpriseMedia } from './enterprise-media/use-enterprise-media';

defineOptions({ name: 'ClientEnterpriseProfileMaterials' });

const store = useClientEnterpriseStore();
const route = useRoute();
const {
  activeCertificateCategory,
  activeModule,
  activePhotoCategory,
  batchDeleteCertificates,
  certificateCards,
  certificateCategorySummary,
  certificateHint,
  closePreview,
  closeUpload,
  currentCertificateCards,
  currentPhotoCards,
  deleteCertificate,
  deletePhoto,
  downloadCard,
  loadingCertificates,
  loadingPhotos,
  openCertificatePreview,
  openPhotoPreview,
  openUpload,
  photoCards,
  photoCategorySummary,
  photoHint,
  previewKey,
  previewOpen,
  previewPayload,
  refreshAll,
  resetCertificateSelection,
  resolvedPhotoStats,
  selectedCertificateIds,
  submitUpload,
  submittingUpload,
  toggleCertificateSelection,
  uploadKey,
  uploadMode,
  uploadOpen,
} = useEnterpriseMedia();

function syncActiveModuleFromRoute() {
  if (route.path.includes('/photos')) {
    activeModule.value = 'photo';
    return;
  }

  if (
    route.path.includes('/certificates') ||
    route.path.includes('/materials')
  ) {
    activeModule.value = 'certificate';
  }
}

onMounted(async () => {
  syncActiveModuleFromRoute();
  if (!store.initialized) {
    await store.refreshContext().catch(() => {});
  }
  await refreshAll().catch(() => {});
});

watch(
  () => route.path,
  () => {
    syncActiveModuleFromRoute();
  },
);

watch(
  () => store.currentCompanyId,
  async (companyId, previousCompanyId) => {
    if (!store.initialized || companyId === previousCompanyId) {
      return;
    }

    resetCertificateSelection();
    closePreview();
    await refreshAll().catch(() => {});
  },
);

function handleGalleryPreview(item: EnterpriseMediaGalleryCard) {
  if (item.mode === 'certificate') {
    openCertificatePreview(item);
    return;
  }

  openPhotoPreview(item);
}

function confirmDeleteCertificate(
  item: Pick<EnterpriseMediaGalleryCard, 'id' | 'title'>,
) {
  Modal.confirm({
    content: `确认删除证书“${item.title}”吗？删除后不可恢复。`,
    okText: '删除',
    okType: 'danger',
    title: '删除企业证书',
    async onOk() {
      await deleteCertificate(item.id);
    },
  });
}

function confirmDeletePhoto(
  item: Pick<EnterpriseMediaGalleryCard, 'id' | 'title'>,
) {
  Modal.confirm({
    content: `确认删除照片“${item.title}”吗？删除后不可恢复。`,
    okText: '删除',
    okType: 'danger',
    title: '删除企业照片',
    async onOk() {
      await deletePhoto(item.id);
    },
  });
}

function handleGalleryDelete(item: EnterpriseMediaGalleryCard) {
  if (item.mode === 'certificate') {
    confirmDeleteCertificate(item);
    return;
  }

  confirmDeletePhoto(item);
}

function handlePreviewDelete(payload: EnterpriseMediaPreviewPayload) {
  if (payload.mode === 'certificate') {
    confirmDeleteCertificate(payload);
    return;
  }

  confirmDeletePhoto(payload);
}

function handleBatchDeleteCertificates() {
  if (!selectedCertificateIds.value.length) {
    message.warning('请先选择需要删除的企业证书');
    return;
  }

  Modal.confirm({
    content: `确认删除已选中的 ${selectedCertificateIds.value.length} 项证书吗？`,
    okText: '批量删除',
    okType: 'danger',
    title: '批量删除企业证书',
    async onOk() {
      await batchDeleteCertificates([...selectedCertificateIds.value]);
    },
  });
}

function handleUploadSubmit(payload: EnterpriseMediaUploadPayload) {
  submitUpload(payload).catch(() => {});
}
</script>

<template>
  <Page auto-content-height>
    <ClientJourneyTrail />
    <div class="space-y-5 p-5">
      <Alert
        v-if="store.errorMessage"
        show-icon
        type="warning"
        :message="store.errorMessage"
      />

      <div class="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div
          class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div>
            <div
              class="text-sm font-medium tracking-[0.18em] text-foreground/45"
            >
              ENTERPRISE MEDIA
            </div>
            <div class="mt-2 text-3xl font-semibold">企业资料图库</div>
            <div class="mt-2 max-w-3xl text-sm leading-7 text-foreground/60">
              维护企业证书和企业照片图库，支持分类查看、上传、预览、下载、删除，以及企业证书批量删除。
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button
              v-if="activeModule === 'certificate'"
              type="primary"
              @click="openUpload('certificate', activeCertificateCategory)"
            >
              <IconifyIcon icon="lucide:award" class="size-4" />
              上传证书
            </Button>
            <Button
              v-else
              type="primary"
              @click="openUpload('photo', activePhotoCategory)"
            >
              <IconifyIcon icon="lucide:image-plus" class="size-4" />
              上传照片
            </Button>
          </div>
        </div>
      </div>

      <Skeleton v-if="store.loading && !store.initialized" active />

      <Empty v-else-if="!store.currentCompany" description="请先选择当前企业" />

      <template v-else>
        <Card variant="borderless">
          <div class="mb-5 flex flex-wrap gap-2">
            <button
              class="rounded-full px-4 py-2 text-sm font-medium transition"
              :class="
                activeModule === 'certificate'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-foreground/70 hover:bg-muted/80'
              "
              type="button"
              @click="activeModule = 'certificate'"
            >
              企业证书 ({{ certificateCards.length }})
            </button>
            <button
              class="rounded-full px-4 py-2 text-sm font-medium transition"
              :class="
                activeModule === 'photo'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-foreground/70 hover:bg-muted/80'
              "
              type="button"
              @click="activeModule = 'photo'"
            >
              企业照片 ({{ photoCards.length }})
            </button>
          </div>

          <div v-if="activeModule === 'certificate'" class="space-y-5">
            <Alert
              v-if="certificateHint"
              show-icon
              type="info"
              :message="certificateHint"
            />

            <div class="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <div class="rounded-2xl border border-border bg-muted/25 p-4">
                <div class="text-base font-semibold">证书分类图库</div>
                <div class="mt-2 text-sm text-foreground/60">
                  按行业资质、安全许可、质量体系、荣誉证书、营业执照和其他分类管理企业证书。
                </div>
              </div>

              <Button
                type="primary"
                @click="openUpload('certificate', activeCertificateCategory)"
              >
                <IconifyIcon icon="lucide:upload" class="size-4" />
                上传证书
              </Button>

              <Button
                danger
                :disabled="!selectedCertificateIds.length"
                @click="handleBatchDeleteCertificates"
              >
                <IconifyIcon icon="lucide:trash-2" class="size-4" />
                批量删除
              </Button>
            </div>

            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div
                v-for="category in certificateCategorySummary"
                :key="category.key"
                class="rounded-2xl border border-border bg-card p-4"
              >
                <div class="text-sm text-foreground/50">
                  {{ category.label }}
                </div>
                <div class="mt-2 text-3xl font-semibold">
                  {{ category.count }}
                </div>
                <div class="mt-2 text-sm leading-6 text-foreground/60">
                  {{ category.description }}
                </div>
              </div>
            </div>

            <Card variant="borderless">
              <div class="mb-4 flex flex-wrap gap-2">
                <button
                  v-for="category in certificateCategorySummary"
                  :key="category.key"
                  class="rounded-full px-3 py-2 text-sm font-medium transition"
                  :class="
                    activeCertificateCategory === category.key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-foreground/70 hover:bg-muted/80'
                  "
                  type="button"
                  @click="activeCertificateCategory = category.key"
                >
                  {{ category.label }} ({{ category.count }})
                </button>
              </div>

              <div
                v-for="category in certificateCategorySummary"
                v-show="activeCertificateCategory === category.key"
                :key="category.key"
              >
                <div
                  class="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <div class="text-lg font-semibold">
                      {{ category.label }}
                    </div>
                    <div class="text-sm text-foreground/60">
                      {{ category.description }}
                    </div>
                  </div>
                  <div class="text-sm text-foreground/50">
                    已选 {{ selectedCertificateIds.length }} 项
                  </div>
                </div>

                <EnterpriseMediaGallery
                  empty-description="当前分类下还没有企业证书，上传后即可作为图库资料展示。"
                  empty-title="暂无企业证书"
                  :items="currentCertificateCards"
                  :loading="loadingCertificates"
                  mode="certificate"
                  :selected-ids="selectedCertificateIds"
                  upload-text="上传证书"
                  @delete="handleGalleryDelete"
                  @download="downloadCard"
                  @preview="handleGalleryPreview"
                  @toggle-select="toggleCertificateSelection"
                  @upload="openUpload('certificate', activeCertificateCategory)"
                />
              </div>
            </Card>
          </div>

          <div v-else class="space-y-5">
            <Alert
              v-if="photoHint"
              show-icon
              type="info"
              :message="photoHint"
            />

            <div class="grid gap-3 lg:grid-cols-[1fr_auto]">
              <div class="rounded-2xl border border-border bg-muted/25 p-4">
                <div class="text-base font-semibold">照片分类图库</div>
                <div class="mt-2 text-sm text-foreground/60">
                  按场地、培训、设备、产品分类管理企业照片，支持多图预览和资料沉淀。
                </div>
              </div>

              <Button
                type="primary"
                @click="openUpload('photo', activePhotoCategory)"
              >
                <IconifyIcon icon="lucide:image-plus" class="size-4" />
                上传照片
              </Button>
            </div>

            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div class="rounded-2xl border border-border bg-card p-4">
                <div class="text-sm text-foreground/50">场地照片</div>
                <div class="mt-2 text-3xl font-semibold">
                  {{ resolvedPhotoStats.site }}
                </div>
              </div>
              <div class="rounded-2xl border border-border bg-card p-4">
                <div class="text-sm text-foreground/50">培训照片</div>
                <div class="mt-2 text-3xl font-semibold">
                  {{ resolvedPhotoStats.training }}
                </div>
              </div>
              <div class="rounded-2xl border border-border bg-card p-4">
                <div class="text-sm text-foreground/50">设备照片</div>
                <div class="mt-2 text-3xl font-semibold">
                  {{ resolvedPhotoStats.equipment }}
                </div>
              </div>
              <div class="rounded-2xl border border-border bg-card p-4">
                <div class="text-sm text-foreground/50">产品照片</div>
                <div class="mt-2 text-3xl font-semibold">
                  {{ resolvedPhotoStats.product }}
                </div>
              </div>
            </div>

            <Card variant="borderless">
              <div class="mb-4 flex flex-wrap gap-2">
                <button
                  v-for="category in photoCategorySummary"
                  :key="category.key"
                  class="rounded-full px-3 py-2 text-sm font-medium transition"
                  :class="
                    activePhotoCategory === category.key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-foreground/70 hover:bg-muted/80'
                  "
                  type="button"
                  @click="activePhotoCategory = category.key"
                >
                  {{ category.label }} ({{ category.count }})
                </button>
              </div>

              <div
                v-for="category in photoCategorySummary"
                v-show="activePhotoCategory === category.key"
                :key="category.key"
              >
                <div class="mb-4">
                  <div class="text-lg font-semibold">{{ category.label }}</div>
                  <div class="mt-1 text-sm text-foreground/60">
                    {{ category.description }}
                  </div>
                </div>

                <EnterpriseMediaGallery
                  empty-description="当前分类下还没有企业照片，上传后可用于多图预览与展示。"
                  empty-title="暂无企业照片"
                  :items="currentPhotoCards"
                  :loading="loadingPhotos"
                  mode="photo"
                  upload-text="上传照片"
                  @delete="handleGalleryDelete"
                  @download="downloadCard"
                  @preview="handleGalleryPreview"
                  @upload="openUpload('photo', activePhotoCategory)"
                />
              </div>
            </Card>
          </div>
        </Card>
      </template>
    </div>

    <EnterpriseMediaUploadModal
      :key="uploadKey"
      :default-certificate-category="activeCertificateCategory"
      :default-photo-category="activePhotoCategory"
      :mode="uploadMode"
      :open="uploadOpen"
      :submitting="submittingUpload"
      @close="closeUpload"
      @submit="handleUploadSubmit"
    />

    <EnterpriseMediaPreviewModal
      :key="previewKey"
      :open="previewOpen"
      :payload="previewPayload"
      @close="closePreview"
      @delete="handlePreviewDelete"
    />
  </Page>
</template>
