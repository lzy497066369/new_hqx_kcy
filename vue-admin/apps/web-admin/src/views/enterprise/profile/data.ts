import type { DescriptionsItemType } from '@vben/common-ui';

import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { EnterpriseProfileItem } from '#/api';

import { h } from 'vue';

import { Tag } from 'antdv-next';

import { $t } from '#/locales';

const statusOptions = [
  { label: $t('common.enabled'), value: 1 },
  { label: $t('common.disabled'), value: 0 },
];

const profileStatusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '待审核', value: 'pending_review' },
  { label: '已通过', value: 'approved' },
  { label: '已驳回', value: 'rejected' },
  { label: '待重提', value: 'need_resubmit' },
];

function getProfileStatusLabel(value?: string) {
  return (
    profileStatusOptions.find((item) => item.value === value)?.label ??
    value ??
    '-'
  );
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'name', label: '企业名称' },
    { component: 'Input', fieldName: 'creditCode', label: '统一社会信用代码' },
    { component: 'Input', fieldName: 'industry', label: '行业' },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: profileStatusOptions,
      },
      fieldName: 'profileStatus',
      label: '资料状态',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: statusOptions,
      },
      fieldName: 'status',
      label: '启用状态',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [{ label: '待完善', value: '1' }],
      },
      fieldName: 'incomplete',
      label: '资料完整度',
    },
  ];
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: '企业名称',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'shortName',
      label: '企业简称',
    },
    {
      component: 'Input',
      fieldName: 'creditCode',
      label: '统一社会信用代码',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'legalPerson',
      label: '法人',
    },
    {
      component: 'Input',
      fieldName: 'contactName',
      label: '联系人',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'contactPhone',
      label: '联系电话',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'contactEmail',
      label: '联系邮箱',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'industry',
      label: '行业',
    },
    {
      component: 'Input',
      fieldName: 'enterpriseType',
      label: '企业类型',
    },
    {
      component: 'Input',
      fieldName: 'province',
      label: '省份',
    },
    {
      component: 'Input',
      fieldName: 'city',
      label: '城市',
    },
    {
      component: 'Input',
      fieldName: 'district',
      label: '区县',
    },
    {
      component: 'Textarea',
      fieldName: 'address',
      label: '详细地址',
    },
    {
      component: 'Select',
      componentProps: {
        options: profileStatusOptions,
      },
      defaultValue: 'draft',
      fieldName: 'profileStatus',
      label: '资料状态',
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
      label: '启用状态',
    },
    {
      component: 'Input',
      fieldName: 'source',
      label: '来源',
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('system.user.remark'),
    },
  ];
}

export function useDescriptionItems(
  row?: EnterpriseProfileItem,
): DescriptionsItemType[] {
  const enabled = row?.status === 1;

  return [
    { label: '企业名称', content: row?.name ?? '-' },
    { label: '企业简称', content: row?.shortName ?? '-' },
    { label: '统一社会信用代码', content: row?.creditCode ?? '-' },
    { label: '法人', content: row?.legalPerson ?? '-' },
    { label: '联系人', content: row?.contactName ?? '-' },
    { label: '联系电话', content: row?.contactPhone ?? '-' },
    { label: '联系邮箱', content: row?.contactEmail ?? '-' },
    { label: '行业', content: row?.industry ?? '-' },
    { label: '企业类型', content: row?.enterpriseType ?? '-' },
    {
      label: '地区',
      content:
        [row?.province, row?.city, row?.district].filter(Boolean).join(' / ') ||
        '-',
    },
    { label: '详细地址', content: row?.address ?? '-' },
    { label: '资料状态', content: getProfileStatusLabel(row?.profileStatus) },
    {
      label: '启用状态',
      content: () =>
        h(
          Tag,
          {
            color: enabled ? 'success' : 'error',
          },
          {
            default: () =>
              enabled ? $t('common.enabled') : $t('common.disabled'),
          },
        ),
    },
    { label: '来源', content: row?.source ?? '-' },
    { label: $t('system.user.remark'), content: row?.remark ?? '-' },
    { label: $t('system.user.createTime'), content: row?.createTime ?? '-' },
    { label: '更新时间', content: row?.updateTime ?? '-' },
  ];
}

export function useColumns(
  onStatusChange?: (
    newStatus: number,
    row: EnterpriseProfileItem,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<EnterpriseProfileItem> {
  return [
    { field: 'name', title: '企业名称', minWidth: 220 },
    { field: 'creditCode', title: '统一社会信用代码', width: 200 },
    { field: 'contactName', title: '联系人', width: 120 },
    { field: 'contactPhone', title: '联系电话', width: 140 },
    { field: 'industry', title: '行业', width: 140 },
    {
      field: 'profileStatus',
      title: '资料状态',
      width: 110,
      slots: {
        default: ({ row }) => getProfileStatusLabel(row.profileStatus),
      },
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: '启用状态',
      width: 100,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('system.user.operation'),
      width: 350,
    },
  ];
}
