import type { VbenFormSchema } from '#/adapter/form';

import { $t } from '#/locales';

export const moduleKeyOptions = [
  { label: '基本信息', value: 'basic' },
  { label: '财税资料', value: 'finance' },
  { label: '员工资料', value: 'employee' },
  { label: '知识产权', value: 'property' },
  { label: '合同发票', value: 'contract' },
  { label: '制度文件', value: 'document' },
  { label: '企业证书', value: 'certificate' },
  { label: '照片', value: 'photo' },
  { label: '企业账号', value: 'account' },
];

export const tabKeyOptions = [
  { label: '基本信息', value: 'info' },
  { label: '财税资料', value: 'financial' },
  { label: '税务审计', value: 'taxAudit' },
  { label: '员工资料', value: 'employees' },
  { label: '知识产权', value: 'intellectualProperty' },
  { label: '研发项目', value: 'researchProject' },
  { label: '合同', value: 'contracts' },
  { label: '发票', value: 'invoices' },
  { label: '制度文件', value: 'documents' },
  { label: '企业证书', value: 'certificates' },
  { label: '照片', value: 'photos' },
  { label: '企业账号', value: 'accounts' },
];

export function useRequirementItemFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: {
        allowClear: false,
        options: moduleKeyOptions,
      },
      fieldName: 'moduleKey',
      label: '模块键',
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: false,
        options: tabKeyOptions,
      },
      fieldName: 'tabKey',
      label: '子模块键',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'itemName',
      label: '材料名称',
      rules: 'required',
    },
    {
      component: 'InputNumber',
      defaultValue: 1,
      fieldName: 'requiredCount',
      label: 'required_count',
      rules: 'required',
    },
    {
      component: 'Textarea',
      fieldName: 'requiredYears',
      help: '按 JSON 文本填写，例如 ["2022","2023"]。为空表示不限制年份。',
      label: 'required_years',
    },
    {
      component: 'Textarea',
      fieldName: 'requiredFields',
      help: '按 JSON 文本填写字段名数组或对象，后端按 LONGTEXT JSON 解析。',
      label: 'required_fields',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [
          { label: $t('common.yes'), value: 1 },
          { label: $t('common.no'), value: 0 },
        ],
      },
      defaultValue: 1,
      fieldName: 'attachmentRequired',
      label: 'attachment_required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [
          { label: $t('common.yes'), value: 1 },
          { label: $t('common.no'), value: 0 },
        ],
      },
      defaultValue: 1,
      fieldName: 'isRequired',
      label: 'is_required',
    },
    {
      component: 'InputNumber',
      defaultValue: 100,
      fieldName: 'scoreWeight',
      label: 'score_weight',
    },
    {
      component: 'InputNumber',
      defaultValue: 0,
      fieldName: 'sortOrder',
      label: 'sort_order',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
      defaultValue: 1,
      fieldName: 'enabled',
      label: 'enabled',
    },
  ];
}

export function useRequirementFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'requirementName',
      label: '要求名称',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'version',
      label: '版本',
    },
    {
      component: 'Textarea',
      fieldName: 'description',
      label: '说明',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
      defaultValue: 1,
      fieldName: 'enabled',
      label: '状态',
    },
  ];
}
