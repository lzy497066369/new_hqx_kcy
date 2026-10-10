<script setup lang="ts">
import type {
  EnterpriseCertificateCategoryKey,
  EnterpriseCertificateQualificationCode,
  EnterpriseMediaMode,
  EnterpriseMediaUploadPayload,
  EnterprisePhotoCategoryKey,
} from '../types';

import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';

import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

import { DatePicker, Input, Modal, Select, message } from 'antdv-next';

import { CERTIFICATE_CATEGORIES, PHOTO_CATEGORIES } from '../constants';

const props = defineProps<{
  defaultCertificateCategory: EnterpriseCertificateCategoryKey;
  defaultPhotoCategory: EnterprisePhotoCategoryKey;
  mode: EnterpriseMediaMode;
  open: boolean;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  submit: [payload: EnterpriseMediaUploadPayload];
}>();

const certificateName = ref('');
const certificateCategory = shallowRef<EnterpriseCertificateCategoryKey>('industry');
const certificateQualificationCode =
  shallowRef<EnterpriseCertificateQualificationCode>('NATIONAL_TECH_SME');
const certificateValidUntil = ref<Dayjs | null>(null);

const photoTitle = ref('');
const photoCategory = shallowRef<EnterprisePhotoCategoryKey>('site');
const photoDate = ref<Dayjs | null>(dayjs());
const photoDescription = ref('');

const files = ref<File[]>([]);
const previewUrls = ref<string[]>([]);

const certificateOptions = computed(() =>
  CERTIFICATE_CATEGORIES.map((item) => ({
    label: item.label,
    value: item.key,
  })),
);

// Compatibility note: existing certificate records may use the previous codes.
const _legacyQualificationOptions = [
  { label: '科技型中小企业', value: 'TECH_SME' },
  { label: '国家高新技术企业', value: 'HIGH_TECH' },
  { label: '专精特新企业', value: 'SPECIALIZED_INNOVATIVE' },
];

const qualificationOptions: Array<{
  label: string;
  value: EnterpriseCertificateQualificationCode;
}> = [
  { label: '省级科技型中小企业', value: 'PROVINCIAL_TECH_SME' },
  { label: '国家科技型中小企业', value: 'NATIONAL_TECH_SME' },
  { label: '省级创新型中小企业', value: 'PROVINCIAL_INNOVATIVE_SME' },
  { label: '省级专精特新中小企业', value: 'PROVINCIAL_SPECIALIZED_SME' },
  { label: '专精特新“小巨人”企业', value: 'SPECIALIZED_LITTLE_GIANT' },
  { label: '重点“小巨人”企业', value: 'KEY_LITTLE_GIANT' },
  { label: '国家高新技术企业', value: 'NATIONAL_HIGH_TECH' },
  { label: '其他', value: 'OTHER' },
];

void _legacyQualificationOptions;

const photoOptions = computed(() =>
  PHOTO_CATEGORIES.map((item) => ({
    label: item.label,
    value: item.key,
  })),
);

function cleanupPreviewUrls() {
  previewUrls.value.forEach((url) => URL.revokeObjectURL(url));
  previewUrls.value = [];
}

function resetForm() {
  certificateName.value = '';
  certificateCategory.value = props.defaultCertificateCategory;
  certificateQualificationCode.value = 'NATIONAL_TECH_SME';
  certificateValidUntil.value = null;

  photoTitle.value = '';
  photoCategory.value = props.defaultPhotoCategory;
  photoDate.value = dayjs();
  photoDescription.value = '';

  files.value = [];
  cleanupPreviewUrls();
}

watch(
  () =>
    [
      props.open,
      props.mode,
      props.defaultCertificateCategory,
      props.defaultPhotoCategory,
    ] as const,
  ([isOpen]) => {
    if (isOpen) {
      resetForm();
      return;
    }

    cleanupPreviewUrls();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  cleanupPreviewUrls();
});

function setFiles(nextFiles: File[]) {
  cleanupPreviewUrls();
  files.value = props.mode === 'certificate' ? nextFiles.slice(0, 1) : nextFiles;
  previewUrls.value = files.value.map((file) => URL.createObjectURL(file));
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  setFiles(Array.from(input.files ?? []));
  input.value = '';
}

function removeFile(index: number) {
  const nextFiles = files.value.filter((_, currentIndex) => currentIndex !== index);
  setFiles(nextFiles);
}

function handleSubmit() {
  if (!files.value.length) {
    message.warning(props.mode === 'certificate' ? '请先选择证书图片' : '请先选择照片文件');
    return;
  }

  if (props.mode === 'certificate') {
    if (!certificateName.value.trim()) {
      message.warning('请输入证书名称');
      return;
    }

    emit('submit', {
      certificateCategoryKey: certificateCategory.value,
      files: files.value,
      mode: 'certificate',
      name: certificateName.value.trim(),
      qualificationCode: certificateQualificationCode.value,
      validUntil: certificateValidUntil.value?.format('YYYY-MM-DD'),
    });
    return;
  }

  if (!photoTitle.value.trim()) {
    message.warning('请输入照片标题');
    return;
  }

  emit('submit', {
    description: photoDescription.value.trim(),
    files: files.value,
    mode: 'photo',
    photoCategoryKey: photoCategory.value,
    photoDate: (photoDate.value ?? dayjs()).format('YYYY-MM-DD'),
    title: photoTitle.value.trim(),
  });
}
</script>

<template>
  <Modal
    :confirm-loading="submitting"
    :open="open"
    :title="mode === 'certificate' ? '上传企业证书' : '上传企业照片'"
    :width="760"
    destroy-on-hidden
    @cancel="emit('close')"
    @ok="handleSubmit"
  >
    <div class="upload-modal">
      <div v-if="mode === 'certificate'" class="upload-modal__grid">
        <label class="upload-modal__field">
          <span class="upload-modal__label">证书名称</span>
          <Input
            v-model:value="certificateName"
            placeholder="请输入证书名称"
          />
        </label>

        <label class="upload-modal__field">
          <span class="upload-modal__label">申报资质</span>
          <Select
            v-model:value="certificateQualificationCode"
            :options="qualificationOptions"
            placeholder="非申报资质可不选"
          />
        </label>

        <label class="upload-modal__field">
          <span class="upload-modal__label">有效期至</span>
          <DatePicker
            v-model:value="certificateValidUntil"
            class="w-full"
            placeholder="长期有效可不填"
          />
        </label>

        <label class="upload-modal__field">
          <span class="upload-modal__label">证书分类</span>
          <Select
            v-model:value="certificateCategory"
            :options="certificateOptions"
            placeholder="请选择证书分类"
          />
        </label>
      </div>

      <div v-else class="upload-modal__grid">
        <label class="upload-modal__field">
          <span class="upload-modal__label">照片标题</span>
          <Input
            v-model:value="photoTitle"
            placeholder="请输入照片标题"
          />
        </label>

        <label class="upload-modal__field">
          <span class="upload-modal__label">照片分类</span>
          <Select
            v-model:value="photoCategory"
            :options="photoOptions"
            placeholder="请选择照片分类"
          />
        </label>

        <label class="upload-modal__field">
          <span class="upload-modal__label">拍摄日期</span>
          <DatePicker
            v-model:value="photoDate"
            class="w-full"
          />
        </label>

        <label class="upload-modal__field upload-modal__field--full">
          <span class="upload-modal__label">照片描述</span>
          <textarea
            v-model="photoDescription"
            class="upload-modal__textarea"
            placeholder="请输入照片说明"
            rows="4"
          />
        </label>
      </div>

      <div class="upload-modal__field upload-modal__field--full">
        <span class="upload-modal__label">
          {{ mode === 'certificate' ? '证书文件' : '照片文件' }}
        </span>
        <label class="upload-modal__picker">
          <input
            accept="image/*"
            class="upload-modal__input"
            :multiple="mode === 'photo'"
            type="file"
            @change="handleFileChange"
          />
          <span class="upload-modal__picker-title">
            {{ mode === 'certificate' ? '选择证书图片' : '选择一组照片' }}
          </span>
          <span class="upload-modal__picker-tip">
            {{ mode === 'certificate' ? '单张图片' : '支持多张图片' }}
          </span>
        </label>
      </div>

      <div v-if="previewUrls.length" class="upload-modal__preview">
        <div
          v-for="(url, index) in previewUrls"
          :key="`${url}-${index}`"
          class="upload-modal__preview-card"
        >
          <img :src="url" :alt="`preview-${index + 1}`" />
          <button
            class="upload-modal__remove"
            type="button"
            @click="removeFile(index)"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.upload-modal {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.upload-modal__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.upload-modal__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upload-modal__field--full {
  grid-column: 1 / -1;
}

.upload-modal__label {
  font-size: 13px;
  font-weight: 600;
  color: rgb(51 65 85);
}

.upload-modal__textarea {
  width: 100%;
  padding: 10px 12px;
  color: rgb(15 23 42);
  resize: vertical;
  background: #fff;
  border: 1px solid rgb(203 213 225);
  border-radius: 10px;
  outline: none;
}

.upload-modal__textarea:focus {
  border-color: rgb(22 119 255 / 60%);
  box-shadow: 0 0 0 3px rgb(22 119 255 / 12%);
}

.upload-modal__picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px;
  cursor: pointer;
  background:
    linear-gradient(135deg, rgb(248 250 252 / 96%), rgb(236 245 240 / 92%)),
    repeating-linear-gradient(
      135deg,
      rgb(56 94 82 / 6%) 0,
      rgb(56 94 82 / 6%) 1px,
      transparent 1px,
      transparent 16px
    );
  border: 1px dashed rgb(148 163 184 / 46%);
  border-radius: 18px;
}

.upload-modal__input {
  display: none;
}

.upload-modal__picker-title {
  font-size: 15px;
  font-weight: 700;
}

.upload-modal__picker-tip {
  color: rgb(100 116 139);
  font-size: 12px;
}

.upload-modal__preview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.upload-modal__preview-card {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
  background: rgb(241 245 249);
}

.upload-modal__preview-card img {
  display: block;
  width: 100%;
  height: 112px;
  object-fit: cover;
}

.upload-modal__remove {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 4px 10px;
  color: #fff;
  cursor: pointer;
  background: rgb(15 23 42 / 72%);
  border: none;
  border-radius: 999px;
}

@media (max-width: 640px) {
  .upload-modal__grid {
    grid-template-columns: 1fr;
  }
}
</style>
