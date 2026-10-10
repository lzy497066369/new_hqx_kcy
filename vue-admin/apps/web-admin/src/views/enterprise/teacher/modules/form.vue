<script setup lang="ts">
import type { EnterpriseTeacherForm, EnterpriseTeacherItem } from '#/api';

import { computed, nextTick, ref, unref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createEnterpriseTeacherApi, updateEnterpriseTeacherApi } from '#/api';
import { $t } from '#/locales';
import {
  showActionFailure,
  showActionSuccess,
} from '../../../system/shared/action-feedback';

import { useFormSchema } from '../data';

const emit = defineEmits<{ success: [] }>();

const props = defineProps<{
  fixedEnterpriseId?: string;
}>();

const formData = ref<EnterpriseTeacherItem>();

const schema = computed(() =>
  useFormSchema({
    fixedEnterpriseId: props.fixedEnterpriseId,
  }),
);

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: schema.value,
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
      const values = await formApi.getValues<EnterpriseTeacherForm>();
      const payload = {
        ...values,
        enterpriseId: unref(props.fixedEnterpriseId) ?? values.enterpriseId,
      };
      await (formData.value?.id
        ? updateEnterpriseTeacherApi(formData.value.id, payload)
        : createEnterpriseTeacherApi(payload));
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

    const data = modalApi.getData<EnterpriseTeacherItem>();
    formApi.resetForm();
    formData.value = data?.id ? data : undefined;
    formApi.updateSchema(schema.value);

    await nextTick();
    if (data?.id) {
      formApi.setValues(data);
    } else {
      formApi.setValues({
        enterpriseId: unref(props.fixedEnterpriseId) ?? data?.enterpriseId,
        status: 1,
      });
    }
  },
});

const getTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', ['项目老师'])
    : $t('ui.actionTitle.create', ['项目老师']),
);
</script>

<template>
  <Modal :title="getTitle">
    <Form class="mx-4" />
  </Modal>
</template>
