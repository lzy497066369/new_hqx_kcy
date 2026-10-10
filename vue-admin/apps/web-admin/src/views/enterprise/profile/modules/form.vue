<script setup lang="ts">
import type { EnterpriseProfileForm, EnterpriseProfileItem } from '#/api';

import { computed, nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import {
  createEnterpriseProfileApi,
  updateEnterpriseProfileApi,
} from '#/api';
import { $t } from '#/locales';
import {
  showActionFailure,
  showActionSuccess,
} from '../../../system/shared/action-feedback';

import { useFormSchema } from '../data';

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<EnterpriseProfileItem>();

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    modalApi.lock();
    try {
      const values = await formApi.getValues<EnterpriseProfileForm>();
      await (formData.value?.id
        ? updateEnterpriseProfileApi(formData.value.id, values)
        : createEnterpriseProfileApi(values));
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

    const data = modalApi.getData<EnterpriseProfileItem>();
    formApi.resetForm();
    formData.value = data;

    await nextTick();
    if (data) {
      formApi.setValues(data);
    } else {
      formApi.setValues({
        profileStatus: 'draft',
        status: 1,
      });
    }
  },
});

const getTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', ['企业资料'])
    : $t('ui.actionTitle.create', ['企业资料']),
);
</script>

<template>
  <Modal :title="getTitle">
    <Form class="mx-4" />
  </Modal>
</template>
