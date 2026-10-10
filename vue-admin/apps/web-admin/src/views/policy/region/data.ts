import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { PolicyRegionItem } from '#/api';

import { getPolicyRegionTreeApi } from '#/api';
import { $t } from '#/locales';

const levelOptions = [
  { label: '省级', value: 'province' },
  { label: '市级', value: 'city' },
  { label: '区级', value: 'district' },
] as const;

const statusOptions = [
  { label: $t('common.enabled'), value: 1 },
  { label: $t('common.disabled'), value: 0 },
];

export function getRegionLevelLabel(level: string) {
  const map: Record<string, string> = {
    city: '市级',
    district: '区级',
    province: '省级',
  };
  return map[level] ?? level;
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'name', label: '区域名称' },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: levelOptions,
      },
      fieldName: 'level',
      label: '层级',
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

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: '区域名称',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'remark',
      label: '区域编码',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: levelOptions,
        optionType: 'button',
      },
      defaultValue: 'province',
      fieldName: 'level',
      label: '层级',
      rules: 'required',
    },
    {
      component: 'ApiTreeSelect',
      componentProps: {
        allowClear: true,
        api: getPolicyRegionTreeApi,
        childrenField: 'children',
        class: 'w-full',
        labelField: 'name',
        treeDefaultExpandAll: false,
        valueField: 'id',
      },
      dependencies: {
        show: (values) => values.level !== 'province',
        triggerFields: ['level'],
      },
      fieldName: 'parentId',
      label: '上级区域',
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
    {
      component: 'InputNumber',
      defaultValue: 0,
      fieldName: 'sortNum',
      label: '排序',
    },
  ];
}

export function useColumns(
  onStatusChange?: (
    newStatus: number,
    row: PolicyRegionItem,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<PolicyRegionItem> {
  return [
    { field: 'name', title: '区域名称', width: 180 },
    { field: 'remark', minWidth: 140, title: '区域编码' },
    {
      field: 'level',
      slots: {
        default: ({ row }) => getRegionLevelLabel(String(row.level)),
      },
      title: '层级',
      width: 120,
    },
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
      width: 220,
    },
  ];
}
