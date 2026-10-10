<script setup lang="ts">
import type { ArchiveRecordConfig, ArchiveRecordField } from '../archive-record-config';

import { computed, reactive, shallowRef, watch } from 'vue';

import { Button, Form, FormItem, Input, InputNumber, Modal, Select, Upload } from 'antdv-next';
import { IconifyIcon } from '@vben/icons';

import { uploadEnterpriseWorkspaceArchiveAttachmentApi } from '#/api';

interface Props {
  config: ArchiveRecordConfig;
  enterpriseId: string;
  open: boolean;
  record?: null | Record<string, unknown>;
  saving: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  save: [payload: Record<string, unknown>];
  'update:open': [value: boolean];
}>();

const uploading = shallowRef(false);
const form = reactive<Record<string, unknown>>({});
const isEditing = computed(() => Boolean(props.record?.id));
const title = computed(() => `${isEditing.value ? '编辑' : '新增'}${props.config.title}`);

watch(
  () => [props.open, props.record, props.config] as const,
  () => {
    if (!props.open) return;
    Object.keys(form).forEach((key) => delete form[key]);
    props.config.fields.forEach((field) => {
      form[field.key] = props.record?.[field.key] ?? defaultValue(field);
    });
  },
  { immediate: true },
);

function defaultValue(field: ArchiveRecordField) {
  if (field.key === 'zhStatus') return 1;
  if (field.kind === 'select') return undefined;
  return '';
}

function updateOpen(value: boolean) {
  emit('update:open', value);
}

function validate() {
  const required = props.config.fields.find((field) =>
    (field.required || (!isEditing.value && field.requiredOnCreate)) &&
    !String(form[field.key] ?? '').trim(),
  );
  if (required) throw new Error(`请填写${required.label}`);
}

function submit() {
  validate();
  emit('save', { ...form });
}

async function uploadFile(field: ArchiveRecordField, options: { file: File; onError: () => void; onSuccess: () => void }) {
  uploading.value = true;
  try {
    const result = await uploadEnterpriseWorkspaceArchiveAttachmentApi(props.enterpriseId, options.file);
    form[field.key] = result.path;
    options.onSuccess();
  } catch {
    options.onError();
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <Modal
    destroy-on-hidden
    :confirm-loading="saving || uploading"
    :open="open"
    :title="title"
    width="780px"
    @cancel="updateOpen(false)"
    @ok="submit"
  >
    <Form class="archive-record-editor" layout="vertical">
      <FormItem v-for="field in config.fields" :key="field.key" :label="field.label" :required="field.required || (!isEditing && field.requiredOnCreate)">
        <Select v-if="field.kind === 'select'" v-model:value="form[field.key]" :options="field.options" :placeholder="`请选择${field.label}`" />
        <InputNumber v-else-if="field.kind === 'number'" v-model:value="form[field.key]" class="w-full" :min="0" :precision="2" :string-mode="true" :placeholder="`请输入${field.label}`" />
        <Input v-else-if="field.kind === 'date'" v-model:value="form[field.key]" type="date" />
        <Input.TextArea v-else-if="field.kind === 'textarea'" v-model:value="form[field.key]" :maxlength="1000" :rows="3" :placeholder="`请输入${field.label}`" show-count />
        <div v-else-if="field.kind === 'file'" class="archive-record-editor__file">
          <Upload :accept="config.attachment?.field === field.key ? '.pdf,.ofd,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg' : undefined" :custom-request="(options) => uploadFile(field, options as never)" :show-upload-list="false">
            <Button :loading="uploading"><IconifyIcon icon="lucide:upload" class="size-4" />上传文件</Button>
          </Upload>
          <span v-if="form[field.key]" class="archive-record-editor__file-name">{{ form[field.key] }}</span>
        </div>
        <Input v-else v-model:value="form[field.key]" :maxlength="field.key === 'htDes' ? 1000 : 255" :placeholder="field.sensitive && isEditing ? '留空表示不修改现有密码' : `请输入${field.label}`" :type="field.sensitive ? 'password' : 'text'" />
      </FormItem>
    </Form>
  </Modal>
</template>

<style scoped>
.archive-record-editor { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.archive-record-editor :deep(.ant-form-item:has(textarea)), .archive-record-editor :deep(.ant-form-item:has(.archive-record-editor__file)) { grid-column: 1 / -1; }
.archive-record-editor__file { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.archive-record-editor__file-name { max-width: 530px; overflow: hidden; color: hsl(var(--muted-foreground)); text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 720px) { .archive-record-editor { grid-template-columns: 1fr; } }
</style>
