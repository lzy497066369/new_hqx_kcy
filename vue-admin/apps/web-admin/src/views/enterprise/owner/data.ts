import type { DescriptionsItemType } from '@vben/common-ui';

import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { EnterpriseOwnerItem } from '#/api';

import type { MaybeRef } from 'vue';

import { h, unref } from 'vue';

import { Tag } from 'antdv-next';

import { getEnterpriseProfilesApi } from '#/api';
import { $t } from '#/locales';

const statusOptions = [
  { label: $t('common.enabled'), value: 1 },
  { label: $t('common.disabled'), value: 0 },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'name', label: '姓名' },
    { component: 'Input', fieldName: 'username', label: '账号' },
    {
      component: 'ApiSelect',
      componentProps: {
        api: async () => {
          const result = await getEnterpriseProfilesApi({ page: 1, pageSize: 1000 });
          return result.items.map((item) => ({
            label: item.name,
            value: item.id,
          }));
        },
        allowClear: true,
      },
      fieldName: 'enterpriseId',
      label: '所属企业',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: statusOptions,
      },
      fieldName: 'status',
      label: '状态',
    },
  ];
}

export function useFormSchema(options: { fixedEnterpriseId?: MaybeRef<string | undefined> } = {}): VbenFormSchema[] {
  return [
    {
      component: 'ApiSelect',
      componentProps: {
        api: async () => {
          const result = await getEnterpriseProfilesApi({ page: 1, pageSize: 1000 });
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
    { component: 'Input', fieldName: 'name', label: '姓名', rules: 'required' },
    { component: 'Input', fieldName: 'username', label: '账号', rules: 'required' },
    {
      component: 'VbenInputPassword' as const,
      componentProps: {
        placeholder: '编辑时留空则不修改密码',
      },
      fieldName: 'password',
      label: '密码',
    },
    { component: 'Input', fieldName: 'phone', label: '手机号' },
    { component: 'Input', fieldName: 'email', label: '邮箱' },
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

export function useDescriptionItems(row?: EnterpriseOwnerItem): DescriptionsItemType[] {
  const enabled = row?.status === 1;
  return [
    { label: '所属企业', content: row?.enterpriseName ?? '-' },
    { label: '姓名', content: row?.name ?? '-' },
    { label: '账号', content: row?.username ?? '-' },
    { label: '手机号', content: row?.phone ?? '-' },
    { label: '邮箱', content: row?.email ?? '-' },
    {
      label: '状态',
      content: () =>
        h(
          Tag,
          { color: enabled ? 'success' : 'error' },
          { default: () => (enabled ? $t('common.enabled') : $t('common.disabled')) },
        ),
    },
    { label: '备注', content: row?.remark ?? '-' },
    { label: '创建时间', content: row?.createTime ?? '-' },
    { label: '更新时间', content: row?.updateTime ?? '-' },
  ];
}

export function useColumns(
  onStatusChange?: (
    newStatus: number,
    row: EnterpriseOwnerItem,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<EnterpriseOwnerItem> {
  return [
    { field: 'enterpriseName', title: '所属企业', minWidth: 220 },
    { field: 'name', title: '姓名', width: 140 },
    { field: 'username', title: '账号', width: 160 },
    { field: 'phone', title: '手机号', width: 160 },
    { field: 'email', title: '邮箱', width: 200 },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: '状态',
      width: 100,
    },
    { field: 'updateTime', title: '更新时间', width: 180 },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      slots: { default: 'action' },
      title: '操作',
      width: 200,
    },
  ];
}
