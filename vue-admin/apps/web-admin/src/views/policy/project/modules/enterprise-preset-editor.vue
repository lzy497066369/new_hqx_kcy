<script setup lang="ts">
import type {
  EnterpriseMetricKey,
  EnterpriseMetricOperator,
  EnterpriseMetricRule,
  EnterprisePresetConfig,
  QualificationMode,
} from './declaration-scheme-types';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { Button, InputNumber, RadioButton, RadioGroup, Select, Tooltip } from 'antdv-next';

import { enterpriseMetricOptions } from './enterprise-metric-options';

const props = defineProps<{ modelValue: EnterprisePresetConfig }>();
const emit = defineEmits<{ 'update:modelValue': [value: EnterprisePresetConfig] }>();

const rules = computed(() => props.modelValue.rules ?? []);
const metricOptions = enterpriseMetricOptions;
const operatorOptions = [
  { label: '不少于', value: 'gte' },
  { label: '大于', value: 'gt' },
  { label: '等于', value: 'eq' },
  { label: '不超过', value: 'lte' },
  { label: '小于', value: 'lt' },
];

function labelFor(key: EnterpriseMetricKey) {
  return metricOptions.find((item) => item.value === key)?.label ?? key;
}

function update(next: Partial<EnterprisePresetConfig>) {
  emit('update:modelValue', {
    mode: props.modelValue.mode ?? 'all',
    rules: rules.value.map((item) => ({ ...item })),
    ...next,
  });
}

function addRule() {
  update({
    rules: [
      ...rules.value,
      { key: 'enterprise_age_days', label: '企业成立天数', operator: 'gte', value: 365 },
    ],
  });
}

function updateRule<K extends keyof EnterpriseMetricRule>(index: number, field: K, value: EnterpriseMetricRule[K]) {
  update({
    rules: rules.value.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
  });
}

function updateMetric(index: number, key: EnterpriseMetricKey) {
  update({
    rules: rules.value.map((item, itemIndex) => itemIndex === index ? { ...item, key, label: labelFor(key) } : item),
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
        <div class="font-medium text-gray-900">企业指标准入</div>
        <p class="mt-1 text-xs text-gray-500">系统按指标 key 自动读取企业资料。阈值由预设配置，例如企业成立天数不少于 365 天。</p>
      </div>
      <RadioGroup :value="modelValue.mode" button-style="solid" size="small" @update:value="update({ mode: $event as QualificationMode })">
        <RadioButton value="all">全部满足</RadioButton>
        <RadioButton value="any">满足其一</RadioButton>
      </RadioGroup>
    </div>

    <div v-if="rules.length" class="space-y-2">
      <div v-for="(rule, index) in rules" :key="`${index}-${rule.key}`" class="grid items-center gap-2 border-b border-gray-100 pb-3 md:grid-cols-[minmax(180px,1fr)_120px_140px_32px]">
        <Select class="w-full" :options="metricOptions" :value="rule.key" @update:value="updateMetric(index, $event as EnterpriseMetricKey)" />
        <Select class="w-full" :options="operatorOptions" :value="rule.operator" @update:value="updateRule(index, 'operator', $event as EnterpriseMetricOperator)" />
        <InputNumber class="w-full" :min="0" :value="rule.value" @update:value="updateRule(index, 'value', Number($event ?? 0))" />
        <Tooltip title="删除指标条件">
          <Button danger shape="circle" size="small" @click="removeRule(index)">
            <IconifyIcon icon="lucide:trash-2" />
          </Button>
        </Tooltip>
      </div>
    </div>

    <div v-else class="border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-500">未配置企业指标，不会按成立年限、员工、收入或知识产权自动拦截。</div>

    <Button size="small" type="dashed" @click="addRule">
      <IconifyIcon icon="lucide:plus" class="mr-1" />
      添加企业指标
    </Button>
  </div>
</template>
