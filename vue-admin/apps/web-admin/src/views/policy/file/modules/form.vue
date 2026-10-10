<script setup lang="ts">
import type { UploadFile } from 'antdv-next';

import type { PolicyFileForm, PolicyFileItem } from '#/api';

import { computed, reactive, ref, shallowRef, toRaw } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createPolicyFileApi,
  getPolicyFileDefaultsApi,
  getPolicyFileDetailApi,
  parsePolicyFileDraftByAiApi,
  updatePolicyFileApi,
} from '#/api';
import { $t } from '#/locales';
import {
  showActionError,
  showActionFailure,
  showActionSuccess,
} from '../../../system/shared/action-feedback';

import { useFormSchema } from '../data';

type UploadResponse = {
  name?: string;
  url?: string;
};

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<PolicyFileItem>();
const aiParsing = shallowRef(false);
const syncingDefaults = shallowRef(false);
const lastAutoValues = reactive({
  content: '',
  title: '',
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    formItemClass: 'col-span-2 md:col-span-1',
  },
  handleValuesChange(values, fieldsChanged) {
    void applyCreateDefaults(values as PolicyFileForm, fieldsChanged);
  },
  schema: useFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2 gap-x-4',
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    modalApi.lock();
    try {
      const values = await formApi.getValues<PolicyFileForm>();
      const payload = normalizeFormValues(values);
      await (formData.value?.id
        ? updatePolicyFileApi(formData.value.id, payload)
        : createPolicyFileApi(payload));
      showActionSuccess(
        formData.value?.id
          ? $t('common.updateSuccess')
          : $t('common.createSuccess'),
      );
      emit('success');
      modalApi.close();
    } catch (error) {
      showActionFailure(error);
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }

    resetAutoValues();
    formApi.resetForm();

    const data = modalApi.getData<Partial<PolicyFileItem>>();
    if (!data?.id) {
      formData.value = undefined;
      await formApi.setValues({
        policyCategory: data?.policyCategory ?? 'notice',
        regionId: data?.regionId,
        status: 'incomplete',
      });
      return;
    }

    modalApi.lock();
    try {
      const detail = await getPolicyFileDetailApi(data.id);
      formData.value = detail;
      await formApi.setValues({
        ...detail,
        attachmentFiles: createAttachmentFiles(detail),
      });
    } catch (error) {
      showActionFailure(error);
      modalApi.close();
    } finally {
      modalApi.unlock();
    }
  },
});

const getTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', ['区域政策文件'])
    : $t('ui.actionTitle.create', ['区域政策文件']),
);

async function applyCreateDefaults(
  values: PolicyFileForm,
  fieldsChanged: string[],
) {
  if (syncingDefaults.value || formData.value?.id) {
    return;
  }

  const needRefresh =
    fieldsChanged.includes('projectId') || fieldsChanged.includes('regionId');
  if (!needRefresh) {
    return;
  }

  const regionId = values.regionId?.trim();
  const projectId = values.projectId?.trim();
  if (!regionId && !projectId) {
    return;
  }

  try {
    const defaults = await getPolicyFileDefaultsApi({ projectId, regionId });
    const nextValues: Partial<PolicyFileForm> = {};

    if (fieldsChanged.includes('projectId')) {
      const nextTitle = defaults.title ?? '';
      const nextContent = defaults.content ?? '';

      if (!values.title || values.title === lastAutoValues.title) {
        nextValues.title = nextTitle;
        lastAutoValues.title = nextTitle;
      }
      if (!values.content || values.content === lastAutoValues.content) {
        nextValues.content = nextContent;
        lastAutoValues.content = nextContent;
      }
    }

    if (Object.keys(nextValues).length === 0) {
      return;
    }

    syncingDefaults.value = true;
    await formApi.setValues(nextValues, false, false);
  } catch (error) {
    showActionFailure(error);
  } finally {
    syncingDefaults.value = false;
  }
}

function createAttachmentFiles(row: PolicyFileItem): UploadFile[] | undefined {
  if (!row.fileUrl) {
    return undefined;
  }

  return [
    {
      name: row.fileName ?? '附件',
      status: 'done',
      uid: row.id,
      url: row.fileUrl,
    },
  ];
}

function getUploadResponse(file: UploadFile): UploadResponse {
  const rawResponse = toRaw(file.response) as { data?: UploadResponse } & UploadResponse;
  return rawResponse?.data ?? rawResponse ?? {};
}

function normalizeFormValues(values: PolicyFileForm): PolicyFileForm {
  const files = (toRaw(values.attachmentFiles) ?? []) as UploadFile[];
  const doneFile = files.find((file) => file.status === 'done' || file.url);
  const response = doneFile ? getUploadResponse(doneFile) : {};

  return {
    ...values,
    attachmentFiles: undefined,
    fileName: doneFile ? response.name ?? doneFile.name : undefined,
    fileUrl: doneFile ? response.url ?? doneFile.url : undefined,
  };
}

async function parseDraftByAi() {
  const values = await formApi.getValues<PolicyFileForm>();
  const payload = normalizeFormValues(values);
  const hasInput = [
    payload.title,
    payload.content,
    payload.officialFileUrl,
    payload.fileUrl,
  ].some((item) => typeof item === 'string' && item.trim());

  if (!hasInput) {
    showActionError('请先填写政策标题、政策内容、正式文件地址或上传附件');
    return;
  }

  aiParsing.value = true;
  try {
    const result = await parsePolicyFileDraftByAiApi(payload);
    const parsed = result.structuredResult;
    const nextValues: Partial<PolicyFileForm> = {
      applicationLevel: parsed.applicationLevel ?? undefined,
      content: result.fetchedContent || payload.content || parsed.summary || undefined,
      conditionText: parsed.conditions?.join('\n') || undefined,
      endDate: parsed.endDate ?? undefined,
      materialText: parsed.materials?.join('\n') || undefined,
      startDate: parsed.startDate ?? undefined,
      subsidyText: parsed.subsidy ?? undefined,
      targetObjects: parsed.targetObjects?.join('、') || undefined,
    };

    if (parsed.policyName) {
      nextValues.title = parsed.policyName;
    }
    if (parsed.summary && !payload.content?.trim()) {
      nextValues.content = parsed.summary;
    }

    await formApi.setValues(nextValues, false, false);
    showActionSuccess('AI 识别解析已完成，并已自动填充表单');
  } catch (error) {
    showActionFailure(error);
  } finally {
    aiParsing.value = false;
  }
}

function resetAutoValues() {
  lastAutoValues.content = '';
  lastAutoValues.title = '';
  syncingDefaults.value = false;
}
</script>

<template>
  <Modal :title="getTitle" class="w-full max-w-240">
    <div class="mx-4 mb-3 flex justify-end">
      <Button :loading="aiParsing" @click="parseDraftByAi">
        <IconifyIcon icon="lucide:sparkles" class="size-4" />
        AI 识别填充
      </Button>
    </div>
    <Form class="mx-4" />
  </Modal>
</template>
