import type { VbenFormSchema } from '#/adapter/form';
import type { MaybeRef } from 'vue';

import { unref } from 'vue';

import {
  getEnterpriseProfilesApi,
  getEnterpriseTeacherCandidatesApi,
} from '#/api';
import { $t } from '#/locales';

const statusOptions = [
  { label: $t('common.enabled'), value: 1 },
  { label: $t('common.disabled'), value: 0 },
];

export function useFormSchema(
  options: { fixedEnterpriseId?: MaybeRef<string | undefined> } = {},
): VbenFormSchema[] {
  return [
    {
      component: 'ApiSelect',
      componentProps: {
        api: async () => {
          const result = await getEnterpriseProfilesApi({
            page: 1,
            pageSize: 1000,
          });
          return result.items.map((item) => ({
            label: item.name,
            value: item.id,
          }));
        },
        class: 'w-full',
        showSearch: true,
      },
      hide: Boolean(unref(options.fixedEnterpriseId)),
      fieldName: 'enterpriseId',
      label: '所属企业',
      rules: 'required',
    },
    {
      component: 'ApiSelect',
      componentProps: {
        api: async () => {
          const result = await getEnterpriseTeacherCandidatesApi();
          return result.map((item) => ({
            label: `${item.name} (${item.username})`,
            value: item.id,
          }));
        },
        class: 'w-full',
        showSearch: true,
      },
      fieldName: 'teacherUserId',
      label: '项目老师',
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: statusOptions,
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: '状态',
    },
    { component: 'Textarea', fieldName: 'remark', label: '备注' },
  ];
}
