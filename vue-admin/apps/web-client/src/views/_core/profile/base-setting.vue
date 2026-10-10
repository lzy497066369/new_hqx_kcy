<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, onMounted, ref } from 'vue';

import { ProfileBaseSetting } from '@vben/common-ui';

import { $t } from '#/locales';
import { getUserInfoApi, updateProfileApi } from '#/api';
import { message } from 'antdv-next';

const profileBaseSettingRef = ref();

const formSchema = computed((): VbenFormSchema[] => [
  {
    fieldName: 'realName',
    component: 'Input',
    label: $t('system.user.userName'),
  },
  {
    fieldName: 'username',
    component: 'Input',
    label: $t('system.user.name'),
  },
  {
    fieldName: 'roleNames',
    component: 'Input',
    componentProps: {
      disabled: true,
    },
    label: $t('system.role.name'),
  },
  {
    fieldName: 'introduction',
    component: 'Textarea',
    label: $t('page.auth.personalIntroduction'),
  },
]);

async function loadUserInfo() {
  const data = await getUserInfoApi();
  profileBaseSettingRef.value?.getFormApi().setValues({
    introduction: data.introduction ?? '',
    realName: data.realName,
    roleNames: (data.roleNames ?? []).join(', '),
    username: data.username,
  });
}

async function handleSubmit(values: Record<string, any>) {
  await updateProfileApi({
    introduction: values.introduction,
    realName: values.realName,
    username: values.username,
  });
  message.success($t('common.updateSuccess'));
  await loadUserInfo();
}

onMounted(loadUserInfo);
</script>

<template>
  <ProfileBaseSetting
    ref="profileBaseSettingRef"
    :form-schema="formSchema"
    @submit="handleSubmit"
  />
</template>
