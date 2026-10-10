import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridColumns } from '#/adapter/vxe-table';
import type { AiApi } from '#/api';

import { h } from 'vue';

import { Tag } from 'antdv-next';

const statusOptions = [
  { color: 'default', label: '等待中', value: 'pending' },
  { color: 'processing', label: '处理中', value: 'running' },
  { color: 'success', label: '成功', value: 'success' },
  { color: 'error', label: '失败', value: 'failed' },
];

const sceneOptions = [
  { label: 'AI 对话测试', value: 'chat_test' },
  { label: '政策解析', value: 'policy_parse' },
  { label: '政策采集官方搜索', value: 'policy_collect_official_search' },
  { label: '政策采集搜索', value: 'policy_collect_search' },
  { label: '政策项目生成', value: 'policy_project_generate' },
  { label: '企业体检', value: 'enterprise_check' },
  { label: '项目匹配', value: 'project_match' },
  { label: '材料诊断', value: 'material_check' },
  { label: '辅助审核', value: 'review_assist' },
  { label: '高企评分解释', value: 'gaoxin_score_explain' },
];

export function formatJson(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatScene(value?: string | null): string {
  return sceneOptions.find((item) => item.value === value)?.label ?? value ?? '-';
}

export function formatStatus(value?: string | null): string {
  return statusOptions.find((item) => item.value === value)?.label ?? value ?? '-';
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: sceneOptions,
      },
      fieldName: 'scene',
      label: 'AI 场景',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: statusOptions.map(({ label, value }) => ({ label, value })),
      },
      fieldName: 'status',
      label: '状态',
    },
    {
      component: 'Input',
      fieldName: 'taskId',
      label: '任务 ID',
    },
    {
      component: 'Input',
      fieldName: 'bizType',
      label: '业务类型',
    },
    {
      component: 'Input',
      fieldName: 'bizId',
      label: '业务 ID',
    },
  ];
}

export function useColumns(
  onActionClick?: OnActionClickFn<AiApi.AiTask>,
): VxeTableGridColumns<AiApi.AiTask> {
  return [
    {
      field: 'createTime',
      title: '创建时间',
      width: 180,
    },
    {
      field: 'scene',
      formatter: ({ cellValue }) => formatScene(String(cellValue ?? '')),
      title: 'AI 场景',
      width: 140,
    },
    {
      field: 'bizType',
      title: '业务类型',
      width: 140,
    },
    {
      field: 'bizId',
      title: '业务 ID',
      width: 110,
    },
    {
      field: 'status',
      slots: {
        default: ({ row }) => {
          const option = statusOptions.find((item) => item.value === row.status);
          return h(
            Tag,
            { color: option?.color ?? 'default' },
            { default: () => option?.label ?? row.status },
          );
        },
      },
      title: '状态',
      width: 100,
    },
    {
      field: 'result.summary',
      minWidth: 240,
      title: '结果摘要',
    },
    {
      field: 'errorMessage',
      minWidth: 220,
      title: '错误信息',
    },
    {
      field: 'finishedAt',
      title: '完成时间',
      width: 180,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'id',
          nameTitle: 'AI 任务',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'detail',
            text: '详情',
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      title: '操作',
      width: 120,
    },
  ];
}
