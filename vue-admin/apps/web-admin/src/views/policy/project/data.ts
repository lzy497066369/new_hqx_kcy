import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { PolicyProjectItem } from '#/api';

import { $t } from '#/locales';

const statusOptions = [
  { label: $t('common.enabled'), value: 1 },
  { label: $t('common.disabled'), value: 0 },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'name', label: '项目名称' },
    { component: 'Input', fieldName: 'policyType', label: '政策类型' },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: statusOptions,
      },
      fieldName: 'enabled',
      label: '状态',
    },
  ];
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: '项目名称',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'policyType',
      label: '政策类型',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'applicableObjects',
      label: '适用对象',
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
      fieldName: 'enabled',
      label: '状态',
    },
    {
      component: 'Textarea',
      fieldName: 'basicDescription',
      label: '基础说明',
    },
  ];
}

export function useColumns(
  onStatusChange?: (
    newStatus: number,
    row: PolicyProjectItem,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<PolicyProjectItem> {
  return [
    { field: 'name', title: '项目名称', width: 220 },
    { field: 'policyType', title: '政策类型', width: 180 },
    { field: 'applicableObjects', title: '适用对象', minWidth: 220 },
    {
      field: 'basicDescription',
      minWidth: 260,
      title: '基础说明',
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'enabled',
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
      width: 160,
    },
  ];
}
