import type { DescriptionsItemType } from '@vben/common-ui';

import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { PolicyFileItem } from '#/api';

import { h } from 'vue';

import { getPolicyProjectsApi, getPolicyRegionTreeApi, streamUploadFile } from '#/api';

type PolicyFileStatus =
  | 'archived'
  | 'draft'
  | 'expired'
  | 'incomplete'
  | 'published';

type PolicyFileStatusOption = {
  label: string;
  value: PolicyFileStatus;
};

type PolicyFileStatusTagOption = PolicyFileStatusOption & {
  color: string;
};

export const policyCategoryOptions = [
  { label: '奖补情况', value: 'reward' },
  { label: '公示情况', value: 'publicity' },
  { label: '申报通知', value: 'notice' },
  { label: '其他', value: 'other' },
];

export const statusOptions: PolicyFileStatusOption[] = [
  { label: '未完善', value: 'incomplete' },
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已过期', value: 'expired' },
  { label: '已归档', value: 'archived' },
];

const statusTagOptions: PolicyFileStatusTagOption[] = [
  { color: 'warning', label: '未完善', value: 'incomplete' },
  { color: 'default', label: '草稿', value: 'draft' },
  { color: 'success', label: '已发布', value: 'published' },
  { color: 'error', label: '已过期', value: 'expired' },
  { color: 'processing', label: '已归档', value: 'archived' },
];

export function getPolicyFileStatusLabel(status: string) {
  return statusOptions.find((item) => item.value === status)?.label ?? status;
}

export function getPolicyCategoryLabel(value?: null | string) {
  return policyCategoryOptions.find((item) => item.value === value)?.label ?? value ?? '-';
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'title', label: '政策标题' },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: policyCategoryOptions,
      },
      fieldName: 'policyCategory',
      label: '政策分类',
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
      fieldName: 'title',
      label: '政策标题',
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
      fieldName: 'regionId',
      label: '所属区域',
      rules: 'selectRequired',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: policyCategoryOptions,
        optionType: 'button',
      },
      defaultValue: 'notice',
      fieldName: 'policyCategory',
      formItemClass: 'col-span-2',
      label: '政策分类',
    },
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: async () => {
          const result = await getPolicyProjectsApi({
            enabled: 1,
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
      fieldName: 'projectId',
      formItemClass: 'col-span-2',
      label: '统一政策项目',
      rules: 'selectRequired',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: statusOptions,
        optionType: 'button',
      },
      defaultValue: 'incomplete',
      fieldName: 'status',
      label: '状态',
    },
    {
      component: 'Input',
      fieldName: 'officialFileUrl',
      formItemClass: 'col-span-2',
      label: '该政策正式文件地址',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '例如：省级、市级、区县级',
      },
      fieldName: 'applicationLevel',
      label: '申报级别',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: 'YYYY-MM-DD',
      },
      fieldName: 'startDate',
      label: '申报开始时间',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: 'YYYY-MM-DD',
      },
      fieldName: 'endDate',
      label: '申报截止时间',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '最小奖补金额',
      },
      fieldName: 'subsidyAmountMin',
      label: '最小奖补金额',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '最大奖补金额',
      },
      fieldName: 'subsidyAmountMax',
      label: '最大奖补金额',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '例如：最高 50 万元、按投入比例补贴',
      },
      fieldName: 'subsidyText',
      formItemClass: 'col-span-2',
      label: '奖补说明',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '例如：科技型中小企业、高新技术企业',
      },
      fieldName: 'targetObjects',
      formItemClass: 'col-span-2',
      label: '适用对象',
    },
    {
      component: 'Textarea',
      componentProps: {
        rows: 4,
      },
      fieldName: 'conditionText',
      formItemClass: 'col-span-2',
      label: '前置条件',
    },
    {
      component: 'Textarea',
      componentProps: {
        rows: 4,
      },
      fieldName: 'materialText',
      formItemClass: 'col-span-2',
      label: '材料要求',
    },
    {
      component: 'Textarea',
      componentProps: {
        rows: 8,
      },
      fieldName: 'content',
      formItemClass: 'col-span-2',
      label: '政策文件内容',
    },
    {
      component: 'Upload',
      componentProps: {
        customRequest: streamUploadFile,
        maxCount: 1,
        multiple: false,
        showUploadList: true,
      },
      fieldName: 'attachmentFiles',
      formItemClass: 'col-span-2',
      label: '上传文件',
      renderComponentContent: () => ({
        default: () => '上传附件',
      }),
    },
    {
      component: 'Textarea',
      componentProps: {
        rows: 3,
      },
      fieldName: 'remark',
      formItemClass: 'col-span-2',
      label: '备注',
    },
  ];
}

function renderLink(url?: null | string, text?: null | string) {
  if (!url) {
    return '-';
  }

  return h(
    'a',
    {
      href: url,
      rel: 'noopener noreferrer',
      target: '_blank',
    },
    text || url,
  );
}

export function useDescriptionItems(row?: PolicyFileItem): DescriptionsItemType[] {
  return [
    { label: '政策标题', content: row?.title ?? '-' },
    { label: '所属区域', content: row?.regionName ?? '-' },
    { label: '统一政策项目', content: row?.projectName ?? '-' },
    { label: '政策分类', content: getPolicyCategoryLabel(row?.policyCategory) },
    { label: '政策文件负责人', content: row?.ownerName ?? '-' },
    { label: '状态', content: getPolicyFileStatusLabel(row?.status ?? '-') },
    { label: 'AI 识别导入', content: row?.importedByAi === 1 ? '是' : '否' },
    { label: 'AI 可信度', content: row?.aiConfidence ?? '-' },
    { label: '发文机关', content: row?.issuingAgency ?? '-' },
    { label: '文号', content: row?.documentNo ?? '-' },
    { label: '官方发布日期', content: row?.officialPublishDate ?? '-' },
    { label: '申报级别', content: row?.applicationLevel ?? '-' },
    { label: '申报开始时间', content: row?.startDate ?? '-' },
    { label: '申报截止时间', content: row?.endDate ?? '-' },
    { label: '奖补金额下限', content: row?.subsidyAmountMin ?? '-' },
    { label: '奖补金额上限', content: row?.subsidyAmountMax ?? '-' },
    { label: '奖补说明', content: row?.subsidyText ?? '-' },
    { label: '适用对象', content: row?.targetObjects ?? '-' },
    {
      label: '前置条件',
      content: () =>
        h(
          'div',
          { class: 'whitespace-pre-wrap break-all leading-6' },
          row?.conditionText || '-',
        ),
    },
    {
      label: '材料要求',
      content: () =>
        h(
          'div',
          { class: 'whitespace-pre-wrap break-all leading-6' },
          row?.materialText || '-',
        ),
    },
    {
      label: '附件',
      content: () => renderLink(row?.fileUrl, row?.fileName),
    },
    {
      label: '该政策正式文件地址',
      content: () => renderLink(row?.officialFileUrl),
    },
    {
      label: '政策文件内容',
      content: () =>
        h(
          'div',
          { class: 'whitespace-pre-wrap break-all leading-6' },
          row?.content || '-',
        ),
    },
    { label: '备注', content: row?.remark ?? '-' },
    { label: '创建时间', content: row?.createTime ?? '-' },
    { label: '更新时间', content: row?.updateTime ?? '-' },
  ];
}

export function useColumns(): VxeTableGridColumns<PolicyFileItem> {
  return [
    { field: 'title', minWidth: 240, title: '政策标题' },
    {
      field: 'policyCategoryName',
      minWidth: 110,
      title: '政策分类',
    },
    { field: 'regionName', minWidth: 140, title: '区域' },
    { field: 'projectName', minWidth: 180, title: '统一政策项目' },
    { field: 'applicationLevel', minWidth: 120, title: '申报级别' },
    { field: 'endDate', minWidth: 130, title: '截止时间' },
    { field: 'subsidyText', minWidth: 180, title: '奖补说明' },
    {
      cellRender: {
        name: 'CellTag',
        options: statusTagOptions,
      },
      field: 'status',
      title: '状态',
      width: 100,
    },
    { field: 'ownerName', minWidth: 120, title: '负责人' },
    { field: 'updateTime', minWidth: 170, title: '更新时间' },
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
