import type { DescriptionsItemType } from '@vben/common-ui';

import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemUserApi } from '#/api';
import type { PortalType } from '#/api/system/portal-type';

import { h } from 'vue';

import { Tag } from 'antdv-next';

import { getDeptList, getEnterpriseProfilesApi } from '#/api';
import { getRoleList } from '#/api/system/role';
import { $t } from '#/locales';

export function useFormSchema(portalType: PortalType = 'admin'): VbenFormSchema[] {
  const isClientPortal = portalType === 'client';
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.user.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'username',
      label: $t('system.user.username'),
      rules: 'required',
    },
    {
      component: 'VbenInputPassword' as const,
      componentProps: {
        passwordStrength: true,
        placeholder: $t('system.user.passwordPlaceholder'),
      },
      fieldName: 'password',
      label: $t('system.user.password'),
    },
    {
      component: 'ApiTreeSelect',
      componentProps: {
        allowClear: true,
        api: getDeptList,
        class: 'w-full',
        childrenField: 'children',
        labelField: 'name',
        valueField: 'id',
      },
      fieldName: 'deptId',
      hide: isClientPortal,
      label: $t('system.user.dept'),
      rules: isClientPortal ? undefined : 'required',
    },
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
        class: 'w-full',
        showSearch: true,
      },
      fieldName: 'enterpriseId',
      hide: !isClientPortal,
      label: '关联公司',
      rules: isClientPortal ? 'required' : undefined,
    },
    {
      component: 'Input',
      fieldName: 'homePath',
      label: $t('system.user.homePath'),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        api: async () => {
          const result = await getRoleList({ page: 1, pageSize: 1000, portalType });
          return result.items.map((item) => ({
            label: item.name,
            value: item.id,
          }));
        },
        allowClear: true,
        mode: 'multiple',
      },
      fieldName: 'roleIds',
      label: $t('system.user.role'),
      rules: isClientPortal ? 'required' : undefined,
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
      label: $t('system.user.status'),
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('system.user.remark'),
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.user.name'),
    },
    {
      component: 'Input',
      fieldName: 'id',
      label: $t('system.user.id'),
    },
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
      label: $t('system.user.status'),
    },
    {
      component: 'Input',
      fieldName: 'remark',
      label: $t('system.user.remark'),
    },
    {
      component: 'RangePicker',
      fieldName: 'createTime',
      label: $t('system.user.createTime'),
    },
  ];
}

export function useDescriptionItems(
  row?: SystemUserApi.SystemUser,
): DescriptionsItemType[] {
  const enabled = row?.status === 1;
  return [
    { label: $t('system.user.name'), content: row?.name },
    { label: $t('system.user.id'), content: row?.id },
    { label: $t('system.user.username'), content: row?.username ?? '-' },
    {
      label: row?.portalType === 'client' ? '关联公司' : $t('system.user.dept'),
      content:
        row?.portalType === 'client'
          ? row?.enterpriseName ?? '-'
          : row?.deptName ?? row?.deptId,
    },
    { label: $t('system.user.homePath'), content: row?.homePath ?? '-' },
    {
      label: $t('system.user.role'),
      content:
        row?.roleNames && row.roleNames.length > 0
          ? row.roleNames.join(', ')
          : '-',
    },
    {
      label: $t('system.user.status'),
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
    { label: $t('system.user.createTime'), content: row?.createTime },
    { label: $t('system.user.remark'), content: row?.remark },
  ];
}

export function useColumns<T = SystemUserApi.SystemUser>(
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
  portalType: PortalType = 'admin',
): VxeTableGridColumns {
  const orgColumn =
    portalType === 'client'
      ? {
          field: 'enterpriseName',
          title: '关联公司',
          width: 220,
        }
      : {
          field: 'deptName',
          title: $t('system.user.dept'),
          width: 180,
        };

  return [
    {
      field: 'name',
      title: $t('system.user.name'),
      width: 180,
    },
    {
      field: 'id',
      title: $t('system.user.id'),
      width: 120,
    },
    {
      field: 'username',
      title: $t('system.user.username'),
      width: 160,
    },
    orgColumn,
    {
      field: 'roleNames',
      minWidth: 220,
      title: $t('system.user.role'),
      slots: {
        default: ({ row }) =>
          row.roleNames?.length > 0 ? row.roleNames.join(', ') : '-',
      },
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('system.user.status'),
      width: 100,
    },
    {
      field: 'remark',
      minWidth: 120,
      title: $t('system.user.remark'),
    },
    {
      field: 'homePath',
      title: $t('system.user.homePath'),
      width: 180,
    },
    {
      field: 'createTime',
      title: $t('system.user.createTime'),
      width: 180,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('system.user.operation'),
      width: 180,
    },
  ];
}
