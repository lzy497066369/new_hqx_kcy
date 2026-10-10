<script setup lang="ts">
import type { EnterpriseWorkspaceMaterialRecord } from '#/api';

import { shallowRef } from 'vue';
import { useRouter } from 'vue-router';

import { Button } from 'antdv-next';
import { Download, IconifyIcon } from '@vben/icons';

import {
  downloadEnterpriseWorkspaceMaterialTemplateApi,
  uploadEnterpriseWorkspaceMaterialApi,
} from '#/api';

import { showActionFailure, showActionSuccess } from '../../../../system/shared/action-feedback';
import { getMaterialTemplateConfig } from '../material-template-config';

interface Props {
  enterpriseId: string;
  templateId: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{ imported: [record: EnterpriseWorkspaceMaterialRecord] }>();
const router = useRouter();
const importing = shallowRef(false);
const config = getMaterialTemplateConfig(props.templateId);

async function downloadTemplate() {
  try {
    const blob = await downloadEnterpriseWorkspaceMaterialTemplateApi(props.templateId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = config.fileName;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    showActionFailure(error);
  }
}

async function importTemplate(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  importing.value = true;
  try {
    const record = await uploadEnterpriseWorkspaceMaterialApi(
      props.enterpriseId,
      props.templateId,
      file,
    );
    emit('imported', record);
    if (record.status === 'valid') {
      showActionSuccess('资料已导入');
      return;
    }

    await router.push({
      path: '/enterprise-material-ledger/materials',
      query: {
        enterpriseId: props.enterpriseId,
        materialId: record.id,
      },
    });
    showActionFailure(
      new Error(
        record.status === 'partial'
          ? '资料部分导入成功，请处理错误明细后重新导入。'
          : '资料未导入，请处理错误明细后重新导入。',
      ),
    );
  } catch (error) {
    showActionFailure(error);
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <Button @click="downloadTemplate"><Download class="size-4" />下载模板</Button>
  <label class="enterprise-material-template-actions__upload">
    <Button :loading="importing"><IconifyIcon icon="lucide:upload" class="size-4" />导入资料</Button>
    <input :accept="config.accept" type="file" @change="importTemplate" />
  </label>
</template>

<style scoped>
.enterprise-material-template-actions__upload input { display: none; }
</style>
