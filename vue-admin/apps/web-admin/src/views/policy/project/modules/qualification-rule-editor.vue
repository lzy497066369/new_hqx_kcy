<script setup lang="ts">
import type {
  EnterpriseMetricKey,
  EnterpriseMetricOperator,
  QualificationMode,
  QualificationRule,
  QualificationRuleConfig,
} from './declaration-scheme-types';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, InputNumber, RadioButton, RadioGroup, Select, Tooltip } from 'antdv-next';

import {
  getEnterpriseMetricCatalogItem,
} from './enterprise-metric-catalog';
import { enterpriseMetricOptions } from './enterprise-metric-options';

const props = defineProps<{ modelValue: QualificationRuleConfig }>();
const emit = defineEmits<{ 'update:modelValue': [value: QualificationRuleConfig] }>();

const rules = computed(() => props.modelValue.rules ?? []);
const metricOptions = enterpriseMetricOptions;
const certificateOptions = [
  { label: '省级科技型中小企业', value: 'PROVINCIAL_TECH_SME' },
  { label: '国家科技型中小企业', value: 'NATIONAL_TECH_SME' },
  { label: '省级创新型中小企业', value: 'PROVINCIAL_INNOVATIVE_SME' },
  { label: '省级专精特新中小企业', value: 'PROVINCIAL_SPECIALIZED_SME' },
  { label: '专精特新“小巨人”企业', value: 'SPECIALIZED_LITTLE_GIANT' },
  { label: '重点“小巨人”企业', value: 'KEY_LITTLE_GIANT' },
  { label: '国家高新技术企业', value: 'NATIONAL_HIGH_TECH' },
  { label: '其他', value: 'OTHER' },
];
const operatorOptions = [
  { label: '大于等于', value: 'gte' },
  { label: '大于', value: 'gt' },
  { label: '等于', value: 'eq' },
  { label: '小于等于', value: 'lte' },
  { label: '小于', value: 'lt' },
];
const booleanOperatorOptions = [{ label: '为', value: 'eq' }];
const booleanValueOptions = [
  { label: '是', value: 1 },
  { label: '否', value: 0 },
];

function getMetric(key: EnterpriseMetricKey) {
  return getEnterpriseMetricCatalogItem(key);
}

function isBooleanMetric(key: EnterpriseMetricKey) {
  return getMetric(key)?.valueType === 'boolean';
}

function update(next: Partial<QualificationRuleConfig>) {
  emit('update:modelValue', {
    mode: props.modelValue.mode ?? 'all',
    rules: rules.value.map((item) => ({ ...item })),
    ...next,
  });
}

function updateRule(index: number, rule: QualificationRule) {
  update({ rules: rules.value.map((item, itemIndex) => itemIndex === index ? rule : item) });
}

function updateMetric(index: number, key: EnterpriseMetricKey) {
  const rule = rules.value[index];
  if (!rule || rule.type !== 'metric') return;
  const metric = getMetric(key);
  updateRule(index, {
    ...rule,
    key,
    operator: metric?.valueType === 'boolean' ? 'eq' : rule.operator,
    value: metric?.valueType === 'boolean' ? 1 : rule.value,
  });
}

function addMetricRule() {
  update({
    rules: [...rules.value, { key: 'enterprise_age_days', operator: 'gte', type: 'metric', value: 365 }],
  });
}

function addCertificateRule() {
  update({
    rules: [...rules.value, { certificateType: 'NATIONAL_TECH_SME', type: 'certificate_exists' }],
  });
}

function removeRule(index: number) {
  update({ rules: rules.value.filter((_, itemIndex) => itemIndex !== index) });
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="font-medium text-gray-900">准入条件</div>
        <p class="mt-1 text-xs text-gray-500">支持固定企业指标比较和有效证书存在判断；只做申报诊断，不阻断创建和节点推进。</p>
      </div>
      <RadioGroup :value="modelValue.mode" button-style="solid" size="small" @update:value="update({ mode: $event as QualificationMode })">
        <RadioButton value="all">全部满足</RadioButton>
        <RadioButton value="any">满足任一项</RadioButton>
      </RadioGroup>
    </div>

    <div v-if="rules.length" class="space-y-2">
      <div v-for="(rule, index) in rules" :key="`${index}-${rule.type}`" class="grid items-center gap-2 border-b border-gray-100 pb-2 md:grid-cols-[minmax(0,1fr)_120px_140px_32px]">
        <template v-if="rule.type === 'metric'">
          <Select :options="metricOptions" :value="rule.key" @update:value="updateMetric(index, $event as EnterpriseMetricKey)" />
          <Select :options="isBooleanMetric(rule.key) ? booleanOperatorOptions : operatorOptions" :value="isBooleanMetric(rule.key) ? 'eq' : rule.operator" @update:value="updateRule(index, { ...rule, operator: $event as EnterpriseMetricOperator })" />
          <Select
            v-if="isBooleanMetric(rule.key)"
            :options="booleanValueOptions"
            :value="rule.value"
            @update:value="updateRule(index, { ...rule, value: Number($event ?? 1) })"
          />
          <div v-else class="flex min-w-0 items-center gap-2">
            <InputNumber class="min-w-0 flex-1" :min="0" :value="rule.value" @update:value="updateRule(index, { ...rule, value: Number($event ?? 0) })" />
            <span class="shrink-0 text-xs text-gray-500">{{ getMetric(rule.key)?.unit }}</span>
          </div>
        </template>
        <template v-else>
          <Select class="md:col-span-3" :options="certificateOptions" :value="rule.certificateType" @update:value="updateRule(index, { ...rule, certificateType: String($event) })" />
        </template>
        <Tooltip title="删除条件">
          <Button danger shape="circle" size="small" @click="removeRule(index)">
            <IconifyIcon icon="lucide:trash-2" />
          </Button>
        </Tooltip>
      </div>
    </div>

    <div v-else class="border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-500">未配置准入条件，企业创建申报后不会展示准入风险提示。</div>

    <div class="flex gap-2">
      <Button size="small" type="dashed" @click="addMetricRule"><IconifyIcon icon="lucide:plus" class="mr-1" />添加指标条件</Button>
      <Button size="small" type="dashed" @click="addCertificateRule"><IconifyIcon icon="lucide:award" class="mr-1" />添加证书条件</Button>
    </div>
  </div>
</template>
