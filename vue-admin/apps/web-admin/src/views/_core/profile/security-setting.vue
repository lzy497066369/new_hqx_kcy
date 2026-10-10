<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, onMounted, reactive } from 'vue';

import { message } from 'antdv-next';

import { VbenButton, useVbenForm, z } from '@vben/common-ui';
import { getUserInfoApi, updateProfileApi } from '#/api';
import { $t } from '#/locales';

const formSchema = computed((): VbenFormSchema[] => [
  {
    component: 'Input',
    componentProps: {
      placeholder: $t('page.auth.securityPhonePlaceholder'),
    },
    fieldName: 'phone',
    label: $t('page.auth.securityPhone'),
    rules: z
      .string()
      .trim()
      .refine((value) => value.length === 0 || /^1\d{10}$/.test(value), {
        message: $t('authentication.mobileErrortip'),
      }),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: $t('page.auth.securityEmailPlaceholder'),
    },
    fieldName: 'email',
    label: $t('page.auth.securityEmail'),
    rules: z
      .string()
      .trim()
      .refine((value) => value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
        message: $t('authentication.emailValidErrorTip'),
      }),
  },
]);

const [Form, formApi] = useVbenForm(
  reactive({
    commonConfig: {
      componentProps: {
        class: 'w-full',
      },
    },
    layout: 'horizontal',
    schema: formSchema,
    showDefaultActions: false,
  }),
);

async function loadUserInfo() {
  const data = await getUserInfoApi();
  formApi.setValues({
    email: data.email ?? '',
    phone: data.phone ?? '',
  });
}

async function handleSubmit() {
  const { valid } = await formApi.validate();
  if (!valid) {
    return;
  }

  const values = await formApi.getValues();
  await updateProfileApi({
    email: values.email,
    phone: values.phone,
  });
  message.success($t('common.updateSuccess'));
  await loadUserInfo();
}

onMounted(loadUserInfo);
</script>

<template>
  <div @keydown.enter.prevent="handleSubmit">
    <Form />
    <VbenButton class="mt-4" type="submit" @click="handleSubmit">
      {{ $t('page.auth.updateSecurityInfo') }}
    </VbenButton>
  </div>
</template>
