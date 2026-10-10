<script setup lang="ts">
import type { AttachmentKey, HighTechAttachment } from '#/api/client/high-tech';
const props = defineProps<{
  title: string;
  category: AttachmentKey;
  reference?: string;
  files: HighTechAttachment[];
  disabled: boolean;
}>();
const emit = defineEmits<{
  upload: [category: AttachmentKey, reference: string, files: File[]];
  preview: [file: HighTechAttachment];
  download: [file: HighTechAttachment];
  remove: [file: HighTechAttachment];
  move: [file: HighTechAttachment, direction: number];
}>();
function select(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = '';
  if (files.length)
    emit('upload', props.category, props.reference || '', files);
}
</script>
<template>
  <section class="mw-evidence" :aria-label="title">
    <div class="mw-row">
      <strong>{{ title }}</strong
      ><label class="mw-upload" :class="{ 'is-disabled': disabled }"
        >上传 PDF / 图片<input
          :aria-label="`上传${title}`"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          multiple
          :disabled="disabled"
          @change="select"
      /></label>
    </div>
    <p v-if="!files.length" class="mw-hint">
      尚未上传，支持 PDF、PNG、JPG，单份不超过 20MB。
    </p>
    <ul v-else class="mw-file-list">
      <li v-for="(file, index) in files" :key="file.id">
        <div>
          <strong>{{ file.name }}</strong
          ><small
            >{{ (file.size / 1024).toFixed(1) }} KB ·
            {{ file.createdAt.slice(0, 10) }}</small
          >
        </div>
        <div class="mw-actions">
          <button
            type="button"
            :disabled="disabled"
            @click="emit('preview', file)"
          >
            预览</button
          ><button
            type="button"
            :disabled="disabled"
            @click="emit('download', file)"
          >
            下载</button
          ><button
            type="button"
            :disabled="disabled || index === 0"
            aria-label="上移附件"
            @click="emit('move', file, -1)"
          >
            ↑</button
          ><button
            type="button"
            :disabled="disabled || index === files.length - 1"
            aria-label="下移附件"
            @click="emit('move', file, 1)"
          >
            ↓</button
          ><button
            type="button"
            class="mw-danger"
            :disabled="disabled"
            @click="emit('remove', file)"
          >
            删除
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
