import type { VbenFormSchema } from '#/adapter/form';
import type { DescriptionsItemType } from '@vben/common-ui';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemRoleApi } from '#/api';
import type { SystemMenuApi } from '#/api/system/menu';

import { h } from 'vue';

import { Tag } from 'antdv-next';

import { $t } from '#/locales';

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.role.roleName'),
      rules: 'required',
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
      label: $t('system.role.status'),
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('system.role.remark'),
    },
    {
      component: 'Input',
      fieldName: 'permissions',
      formItemClass: 'items-start',
      label: $t('system.role.setPermissions'),
      modelPropName: 'modelValue',
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.role.roleName'),
    },
    { component: 'Input', fieldName: 'id', label: $t('system.role.id') },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
      fieldName: 'status',
      label: $t('system.role.status'),
    },
    {
      component: 'Input',
      fieldName: 'remark',
      label: $t('system.role.remark'),
    },
    {
      component: 'RangePicker',
      fieldName: 'createTime',
      label: $t('system.role.createTime'),
    },
  ];
}

export function useColumns<T = SystemRoleApi.SystemRole>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns {
  return [
    {
      field: 'name',
      title: $t('system.role.roleName'),
      width: 200,
    },
    {
      field: 'id',
      title: $t('system.role.id'),
      width: 200,
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('system.role.status'),
      width: 100,
    },
    {
      field: 'remark',
      minWidth: 100,
      title: $t('system.role.remark'),
    },
    {
      field: 'createTime',
      title: $t('system.role.createTime'),
      width: 200,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: $t('system.role.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
      },
      field: 'operation',
      fixed: 'right',
      title: $t('system.role.operation'),
      width: 130,
    },
  ];
}

export function useDescriptionItems(
  row?: SystemRoleApi.SystemRole,
  menus: SystemMenuApi.SystemMenu[] = [],
): DescriptionsItemType[] {
  const enabled = row?.status === 1;
  const permissionIds = row?.permissions ?? [];
  const permissionNames = menus
    .filter((item) => permissionIds.includes(item.id))
    .map((item) => item.meta?.title ?? item.name);

  return [
    { label: $t('system.role.roleName'), content: row?.name },
    { label: $t('system.role.id'), content: row?.id },
    {
      label: $t('system.role.status'),
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
    {
      label: $t('system.role.permissions'),
      content:
        permissionNames.length > 0
          ? () =>
              h(
                'div',
                { class: 'flex flex-wrap gap-2' },
                permissionNames.map((name) =>
                  h(Tag, { key: name }, { default: () => name }),
                ),
              )
          : '-',
    },
    { label: $t('system.role.createTime'), content: row?.createTime },
    { label: $t('system.role.remark'), content: row?.remark },
    { label: $t('system.role.updateTime'), content: row?.updateTime },
  ];
}
