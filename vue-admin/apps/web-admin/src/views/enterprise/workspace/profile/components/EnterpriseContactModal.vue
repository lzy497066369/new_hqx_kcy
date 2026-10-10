<script setup lang="ts">
import type { EnterpriseWorkspaceContact, EnterpriseWorkspaceContactInput } from '#/api';

import { reactive, watch } from 'vue';

import { Form, FormItem, Input, Modal, Switch, TextArea } from 'antdv-next';

interface Props {
  contact?: EnterpriseWorkspaceContact;
  saving: boolean;
}

const props = defineProps<Props>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ save: [data: EnterpriseWorkspaceContactInput] }>();
const formData = reactive<EnterpriseWorkspaceContactInput>({
  isDefault: false,
  name: '',
});

function resetFormData() {
  Object.assign(formData, {
    email: props.contact?.email ?? null,
    isDefault: props.contact?.isDefault ?? false,
    name: props.contact?.name ?? '',
    phone: props.contact?.phone ?? null,
    position: props.contact?.position ?? null,
    remark: props.contact?.remark ?? null,
    roleName: props.contact?.roleName ?? null,
  });
}

function submit() {
  emit('save', { ...formData });
}

watch([open, () => props.contact], resetFormData, { immediate: true });
</script>

<template>
  <Modal
    v-model:open="open"
    :confirm-loading="saving"
    :title="contact ? '编辑联系人' : '新增联系人'"
    @ok="submit"
  >
    <Form :model="formData" layout="vertical">
      <FormItem label="姓名" name="name" required><Input v-model:value="formData.name" :maxlength="64" /></FormItem>
      <FormItem label="角色" name="roleName"><Input v-model:value="formData.roleName" :maxlength="64" placeholder="例如：申报经办人" /></FormItem>
      <FormItem label="职位" name="position"><Input v-model:value="formData.position" :maxlength="64" /></FormItem>
      <FormItem label="联系电话" name="phone"><Input v-model:value="formData.phone" :maxlength="32" /></FormItem>
      <FormItem label="邮箱" name="email"><Input v-model:value="formData.email" :maxlength="128" /></FormItem>
      <FormItem label="默认联系人" name="isDefault"><Switch v-model:checked="formData.isDefault" /></FormItem>
      <FormItem label="备注" name="remark"><TextArea v-model:value="formData.remark" :maxlength="255" :rows="3" /></FormItem>
    </Form>
  </Modal>
</template>
