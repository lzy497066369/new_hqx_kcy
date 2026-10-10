<script setup lang="ts">
import type { PolicyRegionForm, PolicyRegionItem } from '#/api';

import { computed, nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createPolicyRegionApi, updatePolicyRegionApi } from '#/api';
import { $t } from '#/locales';

import {
  showActionFailure,
  showActionSuccess,
} from '../../../system/shared/action-feedback';
import { useFormSchema } from '../data';

type RegionModalData = Partial<PolicyRegionItem>;

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<RegionModalData>();

const [Form, formApi] = useVbenForm({
  commonConfig: {
    formItemClass: 'col-span-2 md:col-span-1',
  },
  layout: 'vertical',
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
      const values = await formApi.getValues<PolicyRegionForm>();
      await (formData.value?.id
        ? updatePolicyRegionApi(formData.value.id, values)
        : createPolicyRegionApi(values));
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

    const data = modalApi.getData<RegionModalData>() ?? {};
    formApi.resetForm();
    formData.value = data;

    await nextTick();
    formApi.setValues({
      level: 'province',
      sortNum: 0,
      status: 1,
      ...data,
    });
  },
});

const getTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', ['区域'])
    : $t('ui.actionTitle.create', ['区域']),
);
</script>

<template>
  <Modal :title="getTitle">
    <Form class="region-form mx-4" />
  </Modal>
</template>

<style scoped>
.region-form :deep(.ant-select),
.region-form :deep(.ant-tree-select),
.region-form :deep(.ant-cascader) {
  width: 100%;
}
</style>
