<script setup lang="ts">
import { shallowRef, useTemplateRef } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Modal } from 'antdv-next';
import { message } from 'antdv-next';

defineOptions({ name: 'ClientEmployeeImportUploadModal' });

defineProps<{ loading: boolean }>();

const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{
  submit: [file: File];
}>();

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInput');
const dragging = shallowRef(false);

function openFileDialog() {
  fileInputRef.value?.click();
}

function handleFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  submitFile(file);
}

function handleDrop(event: DragEvent) {
  dragging.value = false;
  submitFile(event.dataTransfer?.files?.[0] ?? null);
}

function submitFile(file: File | null) {
  if (!file) {
    return;
  }
  if (!/\.(xlsx|xlsm|xls)$/iu.test(file.name)) {
    message.warning('请上传 Excel 文件，支持 .xlsx、.xlsm、.xls');
    return;
  }
  emit('submit', file);
}
</script>

<template>
  <Modal
    v-model:open="open"
    destroy-on-hidden
    :footer="null"
    title="上传员工花名册"
    width="640px"
  >
    <div class="employee-import-upload">
      <button
        class="employee-import-upload__dropzone"
        :class="{ 'employee-import-upload__dropzone--dragging': dragging }"
        type="button"
        @click="openFileDialog"
        @dragenter.prevent="dragging = true"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="handleDrop"
      >
        <IconifyIcon icon="lucide:file-up" class="employee-import-upload__drop-icon" />
        <strong>拖拽员工花名册到这里，或点击选择文件</strong>
        <span>
          支持 .xlsx、.xlsm、.xls，上传后会先解析成预览表，不会直接写入。
        </span>
      </button>

      <input
        ref="fileInput"
        accept=".xlsx,.xlsm,.xls"
        class="employee-import-upload__input"
        type="file"
        @change="handleFileInput"
      />
      <div v-if="loading" class="employee-import-upload__hint">
        正在解析员工花名册，请稍候...
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.employee-import-upload {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.employee-import-upload__dropzone {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  min-height: 138px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 35%);
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
}

.employee-import-upload__dropzone--dragging {
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary));
}

.employee-import-upload__drop-icon {
  width: 32px;
  height: 32px;
  color: hsl(var(--primary));
}

.employee-import-upload__dropzone span,
.employee-import-upload__hint {
  color: hsl(var(--muted-foreground));
}

.employee-import-upload__input {
  display: none;
}
</style>
