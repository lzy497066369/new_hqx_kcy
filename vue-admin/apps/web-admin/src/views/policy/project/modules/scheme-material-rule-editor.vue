<script setup lang="ts">
import type { SchemeMaterialRule } from './declaration-scheme-types';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { Button, Input, InputNumber, Select, Switch, Tooltip } from 'antdv-next';

const props = defineProps<{ modelValue: SchemeMaterialRule[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: SchemeMaterialRule[]] }>();

const rules = computed(() => props.modelValue ?? []);
const moduleOptions = [
  { label: '企业基础信息', value: 'basic' },
  { label: '企业证书', value: 'certificate' },
  { label: '员工与人员', value: 'employee' },
  { label: '知识产权与研发', value: 'property' },
  { label: '财务税务', value: 'finance' },
  { label: '合同与发票', value: 'contract' },
  { label: '制度文件', value: 'document' },
];

const tabOptions: Record<string, Array<{ label: string; value: string }>> = {
  basic: [{ label: '基本资料', value: 'info' }],
  certificate: [{ label: '企业证书', value: 'certificates' }],
  contract: [{ label: '合同', value: 'contracts' }, { label: '发票', value: 'invoices' }],
  document: [{ label: '制度文件', value: 'documents' }],
  employee: [{ label: '员工信息', value: 'employees' }],
  finance: [{ label: '财务数据', value: 'financial' }, { label: '税审资料', value: 'taxAudit' }],
  property: [
    { label: '知识产权', value: 'intellectualProperty' },
    { label: '研发项目', value: 'researchProject' },
    { label: '产品服务', value: 'productService' },
    { label: '成果转化', value: 'transformation' },
  ],
};

function update(next: SchemeMaterialRule[]) {
  emit('update:modelValue', next.map((item) => ({ ...item })));
}

function addRule() {
  update([
    ...rules.value,
    {
      attachmentRequired: 0,
      isRequired: 1,
      itemName: '',
      moduleKey: 'basic',
      requiredCount: 1,
      requiredFields: [],
      requiredYears: [],
      requirementDesc: '',
      scoreWeight: 1,
      sortOrder: rules.value.length + 1,
      tabKey: 'info',
    },
  ]);
}

function removeRule(index: number) {
  update(rules.value.filter((_, itemIndex) => itemIndex !== index));
}

function updateRule<K extends keyof SchemeMaterialRule>(index: number, field: K, value: SchemeMaterialRule[K]) {
  update(rules.value.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
}

function updateModule(index: number, moduleKey: string) {
  const tabKey = tabOptions[moduleKey]?.[0]?.value ?? 'info';
  update(rules.value.map((item, itemIndex) => itemIndex === index ? { ...item, moduleKey, tabKey } : item));
}

function updateList(index: number, field: 'requiredFields' | 'requiredYears', value: string) {
  updateRule(index, field, value.split(/[,，\n]/u).map((item) => item.trim()).filter(Boolean));
}

function displayList(value?: string[]) {
  return value?.join('、') ?? '';
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div class="font-medium text-gray-900">材料清单</div>
        <p class="mt-1 text-xs text-gray-500">配置材料是否必需、适用年度、必填字段和材料说明，企业端会按这些规则检查准备度。</p>
      </div>
      <Button size="small" type="dashed" @click="addRule">
        <IconifyIcon icon="lucide:plus" class="mr-1" />
        添加材料项
      </Button>
    </div>

    <div v-if="rules.length" class="space-y-3">
      <div v-for="(rule, index) in rules" :key="`${index}-${rule.itemName}`" class="space-y-3 border-b border-gray-100 pb-4">
        <div class="grid items-end gap-3 md:grid-cols-[minmax(160px,1fr)_160px_130px_100px_100px_40px]">
          <div>
            <div class="mb-1 text-xs text-gray-500">材料名称</div>
            <Input :value="rule.itemName" placeholder="例如：近三年财务审计报告" @update:value="updateRule(index, 'itemName', $event)" />
          </div>
          <div>
            <div class="mb-1 text-xs text-gray-500">资料模块</div>
            <Select class="w-full" :options="moduleOptions" :value="rule.moduleKey" @update:value="updateModule(index, String($event ?? 'basic'))" />
          </div>
          <div>
            <div class="mb-1 text-xs text-gray-500">资料页签</div>
            <Select class="w-full" :options="tabOptions[rule.moduleKey] ?? []" :value="rule.tabKey" @update:value="updateRule(index, 'tabKey', String($event ?? ''))" />
          </div>
          <div>
            <div class="mb-1 text-xs text-gray-500">所需数量</div>
            <InputNumber class="w-full" :min="1" :value="rule.requiredCount" @update:value="updateRule(index, 'requiredCount', Number($event ?? 1))" />
          </div>
          <div>
            <div class="mb-1 text-xs text-gray-500">评分权重</div>
            <InputNumber class="w-full" :min="0" :value="rule.scoreWeight ?? 1" @update:value="updateRule(index, 'scoreWeight', Number($event ?? 0))" />
          </div>
          <Tooltip title="删除材料项">
            <Button danger shape="circle" size="small" @click="removeRule(index)">
              <IconifyIcon icon="lucide:trash-2" />
            </Button>
          </Tooltip>
        </div>

        <div class="grid gap-3 rounded bg-gray-50 p-3 md:grid-cols-2">
          <div>
            <div class="mb-1 text-xs text-gray-500">适用年度</div>
            <Input :value="displayList(rule.requiredYears)" placeholder="例如：2023、2024、2025；留空表示不限制" @update:value="updateList(index, 'requiredYears', $event)" />
          </div>
          <div>
            <div class="mb-1 text-xs text-gray-500">必填字段</div>
            <Input :value="displayList(rule.requiredFields)" placeholder="例如：year、amount、fileUrl" @update:value="updateList(index, 'requiredFields', $event)" />
          </div>
          <div class="flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <span class="flex items-center gap-2">
              <Switch :checked="rule.isRequired !== 0" size="small" @update:checked="updateRule(index, 'isRequired', $event ? 1 : 0)" />
              必需材料
            </span>
            <span class="flex items-center gap-2">
              <Switch :checked="rule.attachmentRequired === 1" size="small" @update:checked="updateRule(index, 'attachmentRequired', $event ? 1 : 0)" />
              必须上传附件
            </span>
          </div>
          <div class="flex w-full gap-2">
            <InputNumber class="w-28" :min="0" :value="rule.sortOrder ?? index + 1" @update:value="updateRule(index, 'sortOrder', Number($event ?? index + 1))" />
            <Input :value="rule.requirementDesc" placeholder="材料要求说明" @update:value="updateRule(index, 'requirementDesc', $event)" />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500">尚未配置材料要求。</div>
  </div>
</template>
