<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';

import { computed } from 'vue';

import { ProfilePasswordSetting, z } from '@vben/common-ui';

import { message } from 'antdv-next';
import { $t } from '#/locales';
import { updatePasswordApi } from '#/api';

const formSchema = computed((): VbenFormSchema[] => [
  {
    fieldName: 'oldPassword',
    label: $t('page.auth.oldPassword'),
    component: 'VbenInputPassword',
    componentProps: {
      placeholder: $t('page.auth.oldPasswordPlaceholder'),
    },
  },
  {
    fieldName: 'newPassword',
    label: $t('page.auth.newPassword'),
    component: 'VbenInputPassword',
    componentProps: {
      passwordStrength: true,
      placeholder: $t('page.auth.newPasswordPlaceholder'),
    },
  },
  {
    fieldName: 'confirmPassword',
    label: $t('page.auth.confirmPassword'),
    component: 'VbenInputPassword',
    componentProps: {
      passwordStrength: true,
      placeholder: $t('page.auth.confirmPasswordPlaceholder'),
    },
    dependencies: {
      rules(values) {
        const { newPassword } = values;
        return z
          .string({ required_error: $t('page.auth.confirmPasswordPlaceholder') })
          .min(1, { message: $t('page.auth.confirmPasswordPlaceholder') })
          .refine((value) => value === newPassword, {
            message: $t('page.auth.passwordMismatch'),
          });
      },
      triggerFields: ['newPassword'],
    },
  },
]);

async function handleSubmit(values: Record<string, any>) {
  await updatePasswordApi({
    newPassword: values.newPassword,
    oldPassword: values.oldPassword,
  });
  message.success($t('page.auth.passwordUpdateSuccess'));
}
</script>

<template>
  <ProfilePasswordSetting
    class="w-1/3"
    :form-schema="formSchema"
    @submit="handleSubmit"
  />
</template>
