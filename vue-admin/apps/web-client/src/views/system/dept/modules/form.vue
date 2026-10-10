<script lang="ts" setup>
import type { SystemDeptApi } from '#/api/system/dept';

import { computed, nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { createDept, updateDept } from '#/api/system/dept';
import { $t } from '#/locales';
import { showActionFailure, showActionSuccess } from '../../shared/action-feedback';

import { useSchema } from '../data';

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<SystemDeptApi.SystemDept>();

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useSchema(),
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
      const data = await formApi.getValues();
      await (formData.value?.id
        ? updateDept(formData.value.id, data)
        : createDept(data));
      showActionSuccess(
        formData.value?.id
          ? $t('common.updateSuccess')
          : $t('common.createSuccess'),
      );
      modalApi.close();
      emit('success');
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

    const data = modalApi.getData<SystemDeptApi.SystemDept>();
    formApi.resetForm();
    formData.value = data;

    await nextTick();
    if (data) {
      formApi.setValues(data);
    }
  },
});

function resetForm() {
  formApi.resetForm();
  formApi.setValues(formData.value || {});
}

const getTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('system.dept.name')])
    : $t('ui.actionTitle.create', [$t('system.dept.name')]),
);
</script>

<template>
  <Modal :title="getTitle">
    <Form class="mx-4" />
    <template #prepend-footer>
      <div class="flex-auto">
        <Button type="primary" danger @click="resetForm">
          {{ $t('common.reset') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
