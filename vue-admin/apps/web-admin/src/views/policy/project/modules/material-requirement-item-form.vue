<script setup lang="ts">
import type {
  ProjectMaterialRequirementItem,
  ProjectMaterialRequirementItemForm,
} from '#/api';

import { computed, nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import {
  createProjectMaterialRequirementItemApi,
  updateProjectMaterialRequirementItemApi,
} from '#/api';
import { $t } from '#/locales';
import {
  showActionFailure,
  showActionSuccess,
} from '../../../system/shared/action-feedback';

import { useRequirementItemFormSchema } from './material-requirement-data';

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<Partial<ProjectMaterialRequirementItem>>();

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useRequirementItemFormSchema(),
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
      const values = await formApi.getValues<ProjectMaterialRequirementItemForm>();
      const payload = {
        ...values,
        attachmentRequired: Number(values.attachmentRequired ?? 0),
        enabled: Number(values.enabled ?? 1),
        isRequired: Number(values.isRequired ?? 0),
        requiredCount: Number(values.requiredCount ?? 0),
        scoreWeight: Number(values.scoreWeight ?? 0),
        sortOrder: Number(values.sortOrder ?? 0),
      };
      await (formData.value?.id
        ? updateProjectMaterialRequirementItemApi(formData.value.id, payload)
        : createProjectMaterialRequirementItemApi(payload));
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

    const data = modalApi.getData<Partial<ProjectMaterialRequirementItem>>() ?? {};
    formApi.resetForm();
    formData.value = data;

    await nextTick();
    formApi.setValues({
      attachmentRequired: 1,
      enabled: 1,
      isRequired: 1,
      requiredCount: 1,
      scoreWeight: 100,
      sortOrder: 0,
      ...data,
      requiredFields: data.requiredFields ?? '[]',
      requiredYears: data.requiredYears ?? '[]',
    });
  },
});

const title = computed(() =>
  formData.value?.id ? '编辑材料要求项' : '新增材料要求项',
);
</script>

<template>
  <Modal :title="title">
    <Form class="mx-4" />
  </Modal>
</template>
