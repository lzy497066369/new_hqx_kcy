<script lang="ts" setup>
import type { SystemUserApi } from '#/api/system/user';
import type { SystemRoleApi } from '#/api/system/role';
import type { VbenFormSchema } from '#/adapter/form';
import type { PortalType } from '#/api/system/portal-type';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createUser, updateUser } from '#/api/system/user';
import { getRoleList } from '#/api/system/role';
import { $t } from '#/locales';
import { CLIENT_HOME_PATH, WORKSPACE_HOME_PATH } from '#/router/home-path';
import { showActionFailure, showActionSuccess } from '../../shared/action-feedback';

import { useFormSchema } from '../data';

type UserFormValues = SystemUserApi.SystemUser & {
  roleIds?: string[];
};

const emits = defineEmits<{
  success: [];
}>();

const props = withDefaults(
  defineProps<{
    portalType?: PortalType;
  }>(),
  {
    portalType: 'admin',
  },
);

const formData = ref<SystemUserApi.SystemUser>();
const roleOptions = ref<Array<{ label: string; value: string }>>([]);
const roleOptionsPortalType = ref<PortalType>();
const id = ref<string>();

const schema = computed(() => useFormSchema(props.portalType));
const formSchema = computed<VbenFormSchema[]>(() =>
  schema.value.map((item) =>
    item.fieldName === 'roleIds'
      ? {
          ...item,
          component: 'Select',
          componentProps: {
            allowClear: true,
            mode: 'multiple',
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

    const values = await formApi.getValues<UserFormValues>();
    drawerApi.lock();
    try {
      const payload = { ...values, portalType: props.portalType };
      if (props.portalType === 'client') {
        payload.deptId = undefined;
      } else {
        payload.enterpriseId = undefined;
      }
      if (id.value) {
        delete payload.password;
      }
      await (id.value ? updateUser(id.value, payload) : createUser(payload));
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

    if (roleOptionsPortalType.value !== props.portalType) {
      const result = await getRoleList({
        page: 1,
        pageSize: 1000,
        portalType: props.portalType,
      });
      roleOptions.value = result.items.map((item: SystemRoleApi.SystemRole) => ({
        label: item.name,
        value: item.id,
      }));
      roleOptionsPortalType.value = props.portalType;
    }

    formApi.updateSchema(formSchema.value);

    await nextTick();
    if (data) {
      formApi.setValues({
        ...data,
        password: undefined,
      });
    } else {
      formApi.setValues({
        homePath:
          props.portalType === 'client' ? CLIENT_HOME_PATH : WORKSPACE_HOME_PATH,
        portalType: props.portalType,
        status: 1,
      });
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
