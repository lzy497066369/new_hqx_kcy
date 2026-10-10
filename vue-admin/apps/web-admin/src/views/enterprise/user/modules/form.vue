<script setup lang="ts">
import type { EnterpriseUserForm, EnterpriseUserItem } from '#/api';

import { computed, nextTick, ref, unref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createEnterpriseUserApi, updateEnterpriseUserApi } from '#/api';
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

const formData = ref<EnterpriseUserItem>();

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
      const values = await formApi.getValues<EnterpriseUserForm>();
      const payload = {
        ...values,
        enterpriseId: unref(props.fixedEnterpriseId) ?? values.enterpriseId,
      };
      await (formData.value?.id
        ? updateEnterpriseUserApi(formData.value.id, payload)
        : createEnterpriseUserApi(payload));
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

    const data = modalApi.getData<EnterpriseUserItem>();
    formApi.resetForm();
    formData.value = data?.id ? data : undefined;
    formApi.updateSchema(schema.value);

    await nextTick();
    if (data?.id) {
      formApi.setValues({ ...data, password: undefined });
    } else {
      formApi.setValues({
        enterpriseId: unref(props.fixedEnterpriseId) ?? data?.enterpriseId,
        isDefault: 0,
        status: 1,
      });
    }
  },
});

const getTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', ['企业用户'])
    : $t('ui.actionTitle.create', ['企业用户']),
);
</script>

<template>
  <Modal :title="getTitle">
    <Form class="mx-4" />
  </Modal>
</template>
