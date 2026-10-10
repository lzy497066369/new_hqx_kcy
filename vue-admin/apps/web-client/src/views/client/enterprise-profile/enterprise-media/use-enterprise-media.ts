import type { ClientEnterpriseMediaApi } from '#/api/client';

import { computed, ref, shallowRef } from 'vue';

import { message } from 'antdv-next';
import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import {
  batchDeleteClientEnterpriseCertificatesApi,
  createClientEnterpriseCertificateApi,
  createClientEnterprisePhotoApi,
  deleteClientEnterpriseCertificateApi,
  deleteClientEnterprisePhotoApi,
  getClientEnterpriseCertificatesApi,
  getClientEnterprisePhotosApi,
  getClientEnterprisePhotoStatsApi,
  uploadClientEnterpriseMediaApi,
} from '#/api/client';

import {
  CERTIFICATE_CATEGORIES,
  PHOTO_CATEGORIES,
  getCertificateCategoryByValue,
  getCertificateCategoryValue,
  getPhotoCategoryByValue,
  getPhotoCategoryValue,
} from './constants';
import type {
  EnterpriseCertificateCategoryKey,
  EnterpriseMediaGalleryCard,
  EnterpriseMediaMode,
  EnterpriseMediaPreviewPayload,
  EnterpriseMediaUploadPayload,
  EnterprisePhotoCategoryKey,
} from './types';
import {
  extractListData,
  formatMediaDate,
  normalizeMediaUrls,
  triggerDownload,
} from './utils';

type CertificateRecord = ClientEnterpriseMediaApi.ClientEnterpriseCertificate;
type PhotoRecord = ClientEnterpriseMediaApi.ClientEnterprisePhoto;

function toCertificateCard(
  record: CertificateRecord,
  buildMediaFileUrl: (type: EnterpriseMediaMode, id: string, path: string) => string,
) {
  const category = getCertificateCategoryByValue(record.zs_class);
  const files = normalizeMediaUrls(record.zs_path).map((path) =>
    buildMediaFileUrl('certificate', String(record.id), path),
  );
  const coverUrl = files[0];

  if (!coverUrl) {
    return null;
  }

  return {
    categoryKey: category.key,
    categoryLabel: category.label,
    coverUrl,
    createdAt: formatMediaDate(record.create_time),
    files,
    id: String(record.id),
    imageCount: files.length,
    mode: 'certificate',
    rawId: record.id,
    title: record.zs_name || '未命名证书',
  } satisfies EnterpriseMediaGalleryCard;
}

function toPhotoCard(
  record: PhotoRecord,
  buildMediaFileUrl: (type: EnterpriseMediaMode, id: string, path: string) => string,
) {
  const category = getPhotoCategoryByValue(record.photo_status);
  const files = normalizeMediaUrls(record.photo_files).map((path) =>
    buildMediaFileUrl('photo', String(record.id), path),
  );
  const coverUrl = files[0];

  if (!coverUrl) {
    return null;
  }

  return {
    categoryKey: category.key,
    categoryLabel: category.label,
    coverUrl,
    createdAt: formatMediaDate(record.ps_date || record.create_time),
    description: record.photo_des ?? '',
    files,
    id: String(record.id),
    imageCount: files.length,
    mode: 'photo',
    rawId: record.id,
    title: record.photo_title || '未命名照片',
  } satisfies EnterpriseMediaGalleryCard;
}

export function useEnterpriseMedia() {
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  const accessStore = useAccessStore();
  const activeModule = shallowRef<EnterpriseMediaMode>('certificate');
  const activeCertificateCategory =
    shallowRef<EnterpriseCertificateCategoryKey>('industry');
  const activePhotoCategory = shallowRef<EnterprisePhotoCategoryKey>('site');

  const loadingCertificates = shallowRef(false);
  const loadingPhotos = shallowRef(false);
  const submittingUpload = shallowRef(false);

  const certificateHint = shallowRef('');
  const photoHint = shallowRef('');

  const certificates = ref<CertificateRecord[]>([]);
  const photos = ref<PhotoRecord[]>([]);
  const photoStats = ref<Partial<ClientEnterpriseMediaApi.ClientEnterprisePhotoStats>>(
    {},
  );

  const selectedCertificateIds = ref<string[]>([]);
  const uploadOpen = shallowRef(false);
  const uploadKey = shallowRef(0);
  const uploadMode = shallowRef<EnterpriseMediaMode>('certificate');

  const previewOpen = shallowRef(false);
  const previewKey = shallowRef(0);
  const previewPayload = ref<EnterpriseMediaPreviewPayload | null>(null);

  const certificateCards = computed(() =>
    certificates.value.reduce<EnterpriseMediaGalleryCard[]>((items, record) => {
      const card = toCertificateCard(record, buildMediaFileUrl);
      if (card) {
        items.push(card);
      }
      return items;
    }, []),
  );

  const photoCards = computed(() =>
    photos.value.reduce<EnterpriseMediaGalleryCard[]>((items, record) => {
      const card = toPhotoCard(record, buildMediaFileUrl);
      if (card) {
        items.push(card);
      }
      return items;
    }, []),
  );

  const certificateCategorySummary = computed(() =>
    CERTIFICATE_CATEGORIES.map((category) => ({
      ...category,
      count: certificateCards.value.filter(
        (item) => item.categoryKey === category.key,
      ).length,
    })),
  );

  const photoCategorySummary = computed(() =>
    PHOTO_CATEGORIES.map((category) => ({
      ...category,
      count: photoCards.value.filter((item) => item.categoryKey === category.key)
        .length,
    })),
  );

  const currentCertificateCards = computed(() =>
    certificateCards.value.filter(
      (item) => item.categoryKey === activeCertificateCategory.value,
    ),
  );

  const currentPhotoCards = computed(() =>
    photoCards.value.filter((item) => item.categoryKey === activePhotoCategory.value),
  );

  const resolvedPhotoStats = computed(() => {
    const getCount = (key: EnterprisePhotoCategoryKey) =>
      photoCards.value.filter((item) => item.categoryKey === key).length;

    return {
      equipment: Number(photoStats.value.equipment ?? getCount('equipment')),
      product: Number(photoStats.value.product ?? getCount('product')),
      site: Number(photoStats.value.site ?? getCount('site')),
      total: Number(photoStats.value.total ?? photoCards.value.length),
      training: Number(photoStats.value.training ?? getCount('training')),
    };
  });

  async function uploadFiles(files: File[]) {
    return (await uploadClientEnterpriseMediaApi(files)).map((item) => item.path);
  }

  function buildMediaFileUrl(
    type: EnterpriseMediaMode,
    id: string,
    path: string,
  ) {
    const normalizedApiUrl = apiURL.replace(/\/+$/u, '');
    const requestPath = `/client/enterprise-media/${type}/${encodeURIComponent(id)}/file`;
    const url = new URL(
      normalizedApiUrl
        ? `${normalizedApiUrl}${requestPath}`
        : requestPath,
      window.location.origin,
    );
    url.searchParams.set('path', path);
    if (accessStore.accessToken) {
      url.searchParams.set('access_token', accessStore.accessToken);
    }
    return url.toString();
  }

  async function loadCertificates() {
    loadingCertificates.value = true;
    try {
      const response = await getClientEnterpriseCertificatesApi();
      certificates.value = extractListData(response);
      certificateHint.value = '';
    } catch (error) {
      certificates.value = [];
      selectedCertificateIds.value = [];
      certificateHint.value =
        error instanceof Error && error.message
          ? error.message
          : '企业证书加载失败，请稍后重试。';
    } finally {
      loadingCertificates.value = false;
    }
  }

  async function loadPhotos() {
    loadingPhotos.value = true;
    try {
      const [photoResponse, statsResponse] = await Promise.all([
        getClientEnterprisePhotosApi(),
        getClientEnterprisePhotoStatsApi().catch(() => ({})),
      ]);

      photos.value = extractListData(photoResponse);
      photoStats.value = statsResponse;
      photoHint.value = '';
    } catch (error) {
      photos.value = [];
      photoStats.value = {};
      photoHint.value =
        error instanceof Error && error.message
          ? error.message
          : '企业照片加载失败，请稍后重试。';
    } finally {
      loadingPhotos.value = false;
    }
  }

  async function refreshAll() {
    await Promise.all([loadCertificates(), loadPhotos()]);
  }

  function toggleCertificateSelection(id: string) {
    if (selectedCertificateIds.value.includes(id)) {
      selectedCertificateIds.value = selectedCertificateIds.value.filter(
        (item) => item !== id,
      );
      return;
    }

    selectedCertificateIds.value = [...selectedCertificateIds.value, id];
  }

  function resetCertificateSelection() {
    selectedCertificateIds.value = [];
  }

  function openUpload(
    mode: EnterpriseMediaMode,
    categoryKey?: EnterpriseCertificateCategoryKey | EnterprisePhotoCategoryKey,
  ) {
    uploadMode.value = mode;
    uploadKey.value += 1;
    uploadOpen.value = true;

    if (mode === 'certificate' && categoryKey) {
      activeCertificateCategory.value =
        categoryKey as EnterpriseCertificateCategoryKey;
    }

    if (mode === 'photo' && categoryKey) {
      activePhotoCategory.value = categoryKey as EnterprisePhotoCategoryKey;
    }
  }

  function closeUpload() {
    uploadOpen.value = false;
  }

  function openCertificatePreview(card: EnterpriseMediaGalleryCard) {
    previewPayload.value = {
      categoryLabel: card.categoryLabel,
      createdAt: card.createdAt,
      id: card.id,
      images: card.files,
      mode: 'certificate',
      title: card.title,
    };
    previewKey.value += 1;
    previewOpen.value = true;
  }

  function openPhotoPreview(card: EnterpriseMediaGalleryCard, initialIndex = 0) {
    previewPayload.value = {
      categoryLabel: card.categoryLabel,
      createdAt: card.createdAt,
      description: card.description,
      id: card.id,
      images: card.files,
      initialIndex,
      mode: 'photo',
      title: card.title,
    };
    previewKey.value += 1;
    previewOpen.value = true;
  }

  function closePreview() {
    previewOpen.value = false;
    previewPayload.value = null;
  }

  async function submitUpload(payload: EnterpriseMediaUploadPayload) {
    submittingUpload.value = true;
    try {
      const urls = await uploadFiles(payload.files);

      if (payload.mode === 'certificate') {
        await createClientEnterpriseCertificateApi({
          qualification_code: payload.qualificationCode || undefined,
          valid_until: payload.validUntil || undefined,
          zs_class: getCertificateCategoryValue(payload.certificateCategoryKey),
          zs_name: payload.name,
          zs_path: urls[0] || '',
        });
        message.success('企业证书已上传');
        await loadCertificates();
      } else {
        await createClientEnterprisePhotoApi({
          photo_des: payload.description,
          photo_files: urls.join(','),
          photo_status: getPhotoCategoryValue(payload.photoCategoryKey),
          photo_title: payload.title,
          ps_date: payload.photoDate,
        });
        message.success('企业照片已上传');
        await loadPhotos();
      }

      closeUpload();
    } finally {
      submittingUpload.value = false;
    }
  }

  async function deleteCertificate(id: string) {
    await deleteClientEnterpriseCertificateApi(id);
    selectedCertificateIds.value = selectedCertificateIds.value.filter(
      (item) => item !== id,
    );
    if (previewPayload.value?.id === id) {
      closePreview();
    }
    message.success('企业证书已删除');
    await loadCertificates();
  }

  async function batchDeleteCertificates(ids: string[]) {
    await batchDeleteClientEnterpriseCertificatesApi({ ids });
    resetCertificateSelection();
    if (previewPayload.value && ids.includes(previewPayload.value.id)) {
      closePreview();
    }
    message.success('所选证书已删除');
    await loadCertificates();
  }

  async function deletePhoto(id: string) {
    await deleteClientEnterprisePhotoApi(id);
    if (previewPayload.value?.id === id) {
      closePreview();
    }
    message.success('企业照片已删除');
    await loadPhotos();
  }

  function downloadCard(card: EnterpriseMediaGalleryCard, imageIndex = 0) {
    const targetUrl = card.files[imageIndex] || card.coverUrl;
    const suffix =
      card.mode === 'photo' && card.imageCount > 1 ? `-${imageIndex + 1}` : '';
    triggerDownload(targetUrl, `${card.title}${suffix}`);
  }

  return {
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
    loadCertificates,
    loadPhotos,
    loadingCertificates,
    loadingPhotos,
    openCertificatePreview,
    openPhotoPreview,
    openUpload,
    photoCards,
    photoCategorySummary,
    photoHint,
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
    previewKey,
  };
}
