<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { SystemMenuApi } from '#/api/system/menu';
import type { PortalType } from '#/api/system/portal-type';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm, z } from '#/adapter/form';
import {
  createMenu,
  getMenuList,
  isMenuNameExists,
  isMenuPathExists,
  updateMenu,
} from '#/api/system/menu';
import { $t } from '#/locales';
import { showActionFailure, showActionSuccess } from '../../shared/action-feedback';

import { getMenuTypeOptions } from '../data';

const emit = defineEmits<{
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

const formData = ref<SystemMenuApi.SystemMenu>();
const schema: VbenFormSchema[] = [
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: getMenuTypeOptions(),
      optionType: 'button',
    },
    defaultValue: 'menu',
    fieldName: 'type',
    label: $t('system.menu.type'),
  },
  {
    component: 'Input',
    fieldName: 'name',
    label: $t('system.menu.menuName'),
    rules: z
      .string()
      .min(2, $t('ui.formRules.minLength', [$t('system.menu.menuName'), 2]))
      .max(30, $t('ui.formRules.maxLength', [$t('system.menu.menuName'), 30]))
      .refine(
        async (value: string) =>
          !(await isMenuNameExists(value, formData.value?.id, props.portalType)),
        (value) => ({
          message: $t('ui.formRules.alreadyExists', [
            $t('system.menu.menuName'),
            value,
          ]),
        }),
      ),
  },
  {
    component: 'ApiTreeSelect',
    componentProps: {
      api: () => getMenuList({ portalType: props.portalType }),
      allowClear: true,
      class: 'w-full',
      childrenField: 'children',
      labelField: 'meta.title',
      treeDefaultExpandAll: false,
      valueField: 'id',
    },
    fieldName: 'parentId',
    label: $t('system.menu.parent'),
  },
  {
    component: 'Input',
    fieldName: 'meta.title',
    label: $t('system.menu.menuTitle'),
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'meta.icon',
    label: $t('system.menu.icon'),
  },
  {
    component: 'Input',
    dependencies: {
      show: (values) => ['catalog', 'menu'].includes(values.type),
      triggerFields: ['type'],
    },
    fieldName: 'path',
    label: $t('system.menu.path'),
    rules: z
      .string()
      .min(2, $t('ui.formRules.minLength', [$t('system.menu.path'), 2]))
      .max(100, $t('ui.formRules.maxLength', [$t('system.menu.path'), 100]))
      .refine(
        async (value: string) =>
          !(await isMenuPathExists(value, formData.value?.id, props.portalType)),
        (value) => ({
          message: $t('ui.formRules.alreadyExists', [
            $t('system.menu.path'),
            value,
          ]),
        }),
      ),
  },
  {
    component: 'Input',
    dependencies: {
      show: (values) => ['catalog', 'menu'].includes(values.type),
      triggerFields: ['type'],
    },
    fieldName: 'redirect',
    label: $t('system.menu.redirect'),
  },
  {
    component: 'Input',
    dependencies: {
      show: (values) => values.type === 'menu',
      triggerFields: ['type'],
    },
    fieldName: 'component',
    label: $t('system.menu.component'),
  },
  {
    component: 'Input',
    fieldName: 'authCode',
    label: $t('system.menu.authCode'),
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: [
        { label: $t('common.enabled'), value: 1 },
        { label: $t('common.disabled'), value: 0 },
      ],
      optionType: 'button',
    },
    defaultValue: 1,
    fieldName: 'status',
    label: $t('system.menu.status'),
  },
  {
    component: 'InputNumber',
    defaultValue: 0,
    fieldName: 'orderNum',
    label: $t('system.menu.orderNum'),
  },
];

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-2 md:col-span-1',
  },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2 gap-x-4',
});

const formId = ref<string>();
const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    drawerApi.lock();
    try {
      const values =
        await formApi.getValues<
          Omit<SystemMenuApi.SystemMenu, 'children' | 'id'>
        >();
      const payload = { ...values, portalType: props.portalType };
      await (formId.value
        ? updateMenu(formId.value, payload)
        : createMenu(payload));
      showActionSuccess(
        formId.value ? $t('common.updateSuccess') : $t('common.createSuccess'),
      );
      emit('success');
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

    const data = drawerApi.getData<SystemMenuApi.SystemMenu>();
    formApi.resetForm();
    formId.value = data?.id;
    formData.value = data;

    await nextTick();
    if (data) {
      formApi.setValues(data);
    }
  },
});

const getDrawerTitle = computed(() =>
  formId.value
    ? $t('ui.actionTitle.edit', [$t('system.menu.name')])
    : $t('ui.actionTitle.create', [$t('system.menu.name')]),
);
</script>

<template>
  <Drawer class="w-full max-w-200" :title="getDrawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
