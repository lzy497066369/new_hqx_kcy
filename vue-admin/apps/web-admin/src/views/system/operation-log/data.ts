import type { DescriptionsItemType } from '@vben/common-ui';
import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemOperationLogApi } from '#/api';

import { h } from 'vue';

import { Tag } from 'antdv-next';

import { $t } from '#/locales';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'module',
      label: $t('system.operationLog.module'),
    },
    {
      component: 'Input',
      fieldName: 'action',
      label: $t('system.operationLog.action'),
    },
    {
      component: 'Input',
      fieldName: 'userName',
      label: $t('system.operationLog.userName'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('system.operationLog.successLabel'), value: 1 },
          { label: $t('system.operationLog.failLabel'), value: 0 },
        ],
      },
      fieldName: 'success',
      label: $t('system.operationLog.success'),
    },
    {
      component: 'RangePicker',
      fieldName: 'createTime',
      label: $t('system.operationLog.createTime'),
    },
  ];
}

export function useColumns(
  onActionClick?: OnActionClickFn<SystemOperationLogApi.SystemOperationLog>,
): VxeTableGridColumns<SystemOperationLogApi.SystemOperationLog> {
  return [
    {
      field: 'createTime',
      title: $t('system.operationLog.createTime'),
      width: 180,
    },
    {
      field: 'userName',
      title: $t('system.operationLog.userName'),
      width: 140,
    },
    {
      field: 'realName',
      title: $t('system.operationLog.realName'),
      width: 140,
    },
    {
      field: 'module',
      title: $t('system.operationLog.module'),
      width: 140,
    },
    {
      field: 'action',
      title: $t('system.operationLog.action'),
      width: 140,
    },
    {
      field: 'requestPath',
      minWidth: 200,
      title: $t('system.operationLog.requestPath'),
    },
    {
      field: 'bizId',
      title: $t('system.operationLog.bizId'),
      width: 120,
    },
    {
      cellRender: {
        options: [
          {
            color: 'success',
            label: $t('system.operationLog.successLabel'),
            value: 1,
          },
          {
            color: 'error',
            label: $t('system.operationLog.failLabel'),
            value: 0,
          },
        ],
        name: 'CellTag',
      },
      field: 'success',
      title: $t('system.operationLog.success'),
      width: 100,
    },
    {
      field: 'cost',
      title: $t('system.operationLog.cost'),
      width: 100,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'id',
          nameTitle: $t('system.operationLog.id'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'detail',
            text: $t('common.detail'),
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('system.operationLog.operation'),
      width: 120,
    },
  ];
}

export function useDescriptionItems(
  row?: SystemOperationLogApi.SystemOperationLog,
): DescriptionsItemType[] {
  const enabled = row?.success === 1;

  return [
    { label: $t('system.operationLog.id'), content: row?.id },
    { label: $t('system.operationLog.userName'), content: row?.userName ?? '-' },
    { label: $t('system.operationLog.realName'), content: row?.realName ?? '-' },
    { label: $t('system.operationLog.module'), content: row?.module },
    { label: $t('system.operationLog.action'), content: row?.action },
    { label: $t('system.operationLog.requestPath'), content: row?.requestPath ?? '-' },
    { label: $t('system.operationLog.bizId'), content: row?.bizId ?? '-' },
    {
      label: $t('system.operationLog.success'),
      content: () =>
        h(
          Tag,
          { color: enabled ? 'success' : 'error' },
          {
            default: () =>
              enabled
                ? $t('system.operationLog.successLabel')
                : $t('system.operationLog.failLabel'),
          },
        ),
    },
    { label: $t('system.operationLog.cost'), content: `${row?.cost ?? 0} ms` },
    { label: $t('system.operationLog.createTime'), content: row?.createTime },
    { label: $t('system.operationLog.ip'), content: row?.ip ?? '-' },
    { label: $t('system.operationLog.method'), content: row?.method ?? '-' },
    { label: $t('system.operationLog.userAgent'), content: row?.userAgent ?? '-' },
    { label: $t('system.operationLog.errorMessage'), content: row?.errorMessage ?? '-' },
    { label: $t('system.operationLog.paramsText'), content: row?.paramsText ?? '-' },
    { label: $t('system.operationLog.resultText'), content: row?.resultText ?? '-' },
  ];
}
