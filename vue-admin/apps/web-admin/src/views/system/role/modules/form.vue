<script lang="ts" setup>
import type { Recordable } from '@vben/types';

import type { SystemMenuApi } from '#/api/system/menu';
import type { PortalType } from '#/api/system/portal-type';
import type { SystemRoleApi } from '#/api/system/role';

import { computed, nextTick, ref } from 'vue';

import { Tree, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Spin } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { getMenuList } from '#/api/system/menu';
import { createRole, updateRole } from '#/api/system/role';
import { $t } from '#/locales';
import { showActionFailure, showActionSuccess } from '../../shared/action-feedback';

import { useFormSchema } from '../data';

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

const formData = ref<SystemRoleApi.SystemRole>();
const permissions = ref<SystemMenuApi.SystemMenu[]>([]);
const loadingPermissions = ref(false);
const id = ref<string>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    const values = await formApi.getValues();
    const payload = { ...values, portalType: props.portalType };
    drawerApi.lock();
    try {
      await (id.value ? updateRole(id.value, payload) : createRole(payload));
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

    const data = drawerApi.getData<SystemRoleApi.SystemRole>();
    formApi.resetForm();
    formData.value = data;
    id.value = data?.id;

    if (permissions.value.length === 0) {
      await loadPermissions();
    }

    await nextTick();
    if (data) {
      formApi.setValues(data);
    }
  },
});

async function loadPermissions() {
  loadingPermissions.value = true;
  try {
    permissions.value = await getMenuList({ portalType: props.portalType });
  } finally {
    loadingPermissions.value = false;
  }
}

const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t('common.edit', [$t('system.role.name')])
    : $t('common.create', [$t('system.role.name')]),
);

function getNodeClass(node: Recordable<any>) {
  return node.value?.type === 'button' ? 'inline-flex' : '';
}
</script>

<template>
  <Drawer :title="getDrawerTitle">
    <Form>
      <template #permissions="slotProps">
        <Spin :spinning="loadingPermissions" :classes="{ root: 'w-full' }">
          <Tree
            v-bind="slotProps"
            :tree-data="permissions"
            multiple
            bordered
            :default-expanded-level="2"
            :get-node-class="getNodeClass"
            label-field="meta.title"
            value-field="id"
            icon-field="meta.icon"
          >
            <template #node="{ value }">
              <IconifyIcon v-if="value.meta?.icon" :icon="value.meta.icon" />
              {{ $t(value.meta?.title ?? '') }}
            </template>
          </Tree>
        </Spin>
      </template>
    </Form>
  </Drawer>
</template>
