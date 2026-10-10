<script lang="ts" setup>
import type { SystemUserApi } from '#/api/system/user';
import type { SystemRoleApi } from '#/api/system/role';
import type { VbenFormSchema } from '#/adapter/form';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createUser, updateUser } from '#/api/system/user';
import { getRoleList } from '#/api/system/role';
import { $t } from '#/locales';
import { showActionFailure, showActionSuccess } from '../../shared/action-feedback';

import { useFormSchema } from '../data';

const emits = defineEmits<{
  success: [];
}>();

const formData = ref<SystemUserApi.SystemUser>();
const roleOptions = ref<Array<{ label: string; value: string }>>([]);
const id = ref<string>();

const schema = useFormSchema();
const formSchema = computed<VbenFormSchema[]>(() =>
  schema.map((item) =>
    item.fieldName === 'roleIds'
      ? {
          ...item,
          componentProps: {
            ...(item.componentProps ?? {}),
            options: roleOptions.value,
          },
        }
      : item,
  ),
);

const [Form, formApi] = useVbenForm({
  schema: formSchema.value,
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    const values = await formApi.getValues();
    drawerApi.lock();
    try {
      await (id.value ? updateUser(id.value, values) : createUser(values));
      showActionSuccess(
        id.value ? $t('common.updateSuccess') : $t('common.createSuccess'),
      );
      emits('success');
      drawerApi.close();
    } catch (error) {
      showActionFailure(error);
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }

    const data = drawerApi.getData<SystemUserApi.SystemUser>();
    formApi.resetForm();
    formData.value = data;
    id.value = data?.id;

    if (roleOptions.value.length === 0) {
      const result = await getRoleList({ page: 1, pageSize: 1000 });
      roleOptions.value = result.items.map((item: SystemRoleApi.SystemRole) => ({
        label: item.name,
        value: item.id,
      }));
    }

    await nextTick();
    if (data) {
      formApi.setValues(data);
    }
  },
});

const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t('common.edit', [$t('system.user.name')])
    : $t('common.create', [$t('system.user.name')]),
);
</script>

<template>
  <Drawer :title="getDrawerTitle">
    <Form />
  </Drawer>
</template>
