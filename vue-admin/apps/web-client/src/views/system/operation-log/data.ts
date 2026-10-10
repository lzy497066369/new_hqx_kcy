import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemOperationLogApi } from '#/api';

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
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
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

export function useColumns(): VxeTableGridColumns<SystemOperationLogApi.SystemOperationLog> {
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
