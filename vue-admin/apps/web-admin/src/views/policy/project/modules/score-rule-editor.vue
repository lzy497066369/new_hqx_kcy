<script setup lang="ts">
import type {
  ScoreLadderStep,
  ScoreMethod,
  ScoreRule,
  ScoreRuleConfig,
} from './declaration-scheme-types';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Input, InputNumber, Select, Tooltip } from 'antdv-next';

import { enterpriseMetricOptions } from './enterprise-metric-options';

const props = defineProps<{
  modelValue: ScoreRuleConfig;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: ScoreRuleConfig];
}>();

const rules = computed(() => props.modelValue.items ?? []);

const sourceOptions = [
  { label: '资质是否满足', value: 'qualification' },
  { label: '材料准备度', value: 'material_readiness' },
  { label: '证书数量', value: 'certificate_count' },
  { label: '科技人员占比', value: 'tech_employee_ratio' },
  { label: '研发项目数量', value: 'property.rd_count' },
  { label: 'PS 数量', value: 'property.ps_count' },
  { label: '成果转化数量', value: 'property.transformation_count' },
  { label: '研发费用占比', value: 'finance.rd_expense_ratio' },
  { label: '高新收入占比', value: 'finance.high_tech_income_ratio' },
  ...enterpriseMetricOptions,
];

const methodOptions = [
  { label: '达标得分', value: 'threshold' },
  { label: '按比例得分', value: 'ratio' },
  { label: '阶梯得分', value: 'ladder' },
  { label: '存在即得分', value: 'fixed' },
];

function update(next: Partial<ScoreRuleConfig>) {
  emit('update:modelValue', {
    items: rules.value.map((item) => ({
      ...item,
      ladder: item.ladder?.map((step) => ({ ...step })),
    })),
    passScore: Number(props.modelValue.passScore ?? 0),
    ...next,
  });
}

function addRule() {
  update({
    items: [
      ...rules.value,
      {
        label: '',
        maxScore: 10,
        method: 'threshold',
        source: 'material_readiness',
        threshold: 100,
      },
    ],
  });
}

function removeRule(index: number) {
  update({ items: rules.value.filter((_, itemIndex) => itemIndex !== index) });
}

function updateRule<K extends keyof ScoreRule>(index: number, field: K, value: ScoreRule[K]) {
  update({
    items: rules.value.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item,
    ),
  });
}

function addStep(ruleIndex: number) {
  const rule = rules.value[ruleIndex];
  if (!rule) return;
  updateRule(ruleIndex, 'ladder', [...(rule.ladder ?? []), { min: 1, score: 0 }]);
}

function removeStep(ruleIndex: number, stepIndex: number) {
  const rule = rules.value[ruleIndex];
  if (!rule) return;
  updateRule(ruleIndex, 'ladder', (rule.ladder ?? []).filter((_, index) => index !== stepIndex));
}

function updateStep(ruleIndex: number, stepIndex: number, field: keyof ScoreLadderStep, value: number) {
  const rule = rules.value[ruleIndex];
  if (!rule) return;
  updateRule(ruleIndex, 'ladder', (rule.ladder ?? []).map((step, index) =>
    index === stepIndex ? { ...step, [field]: value } : step,
  ));
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="font-medium text-gray-900">评分规则</div>
        <p class="mt-1 text-xs text-gray-500">企业资料变更后，系统按这里的指标与阈值自动重新计算。</p>
      </div>
      <div class="flex items-center gap-2 text-sm text-gray-600">
        通过分
        <InputNumber
          :min="0"
          :value="modelValue.passScore"
          @update:value="update({ passScore: Number($event ?? 0) })"
        />
      </div>
    </div>

    <div v-if="rules.length" class="space-y-3">
      <div v-for="(rule, index) in rules" :key="`${index}-${rule.label}`" class="border-b border-gray-100 pb-3">
        <div class="grid items-center gap-2 lg:grid-cols-[minmax(120px,1fr)_170px_130px_92px_92px_32px]">
          <Input
            :value="rule.label"
            placeholder="评分项名称"
            @update:value="updateRule(index, 'label', $event)"
          />
          <Select
            :options="sourceOptions"
            :value="rule.source"
            @update:value="updateRule(index, 'source', String($event ?? 'material_readiness'))"
          />
          <Select
            :options="methodOptions"
            :value="rule.method"
            @update:value="updateRule(index, 'method', $event as ScoreMethod)"
          />
          <InputNumber
            :min="0"
            :value="rule.maxScore"
            class="w-full"
            @update:value="updateRule(index, 'maxScore', Number($event ?? 0))"
          />
          <InputNumber
            v-if="rule.method !== 'fixed' && rule.method !== 'ladder'"
            :min="0"
            :value="rule.threshold"
            class="w-full"
            placeholder="阈值"
            @update:value="updateRule(index, 'threshold', Number($event ?? 0))"
          />
          <InputNumber
            v-else-if="rule.method === 'fixed'"
            :min="0"
            :value="rule.score ?? rule.maxScore"
            class="w-full"
            placeholder="得分"
            @update:value="updateRule(index, 'score', Number($event ?? 0))"
          />
          <span v-else class="text-center text-xs text-gray-400">配置阶梯</span>
          <Tooltip title="移除评分项">
            <Button danger shape="circle" size="small" @click="removeRule(index)">
              <IconifyIcon icon="lucide:trash-2" />
            </Button>
          </Tooltip>
        </div>

        <div v-if="rule.method === 'ladder'" class="mt-2 flex flex-wrap items-center gap-2 pl-2">
          <span class="text-xs text-gray-500">达到</span>
          <template v-for="(step, stepIndex) in rule.ladder ?? []" :key="`${stepIndex}-${step.min}`">
            <InputNumber
              :min="0"
              :value="step.min"
              size="small"
              @update:value="updateStep(index, stepIndex, 'min', Number($event ?? 0))"
            />
            <span class="text-xs text-gray-500">得</span>
            <InputNumber
              :min="0"
              :max="rule.maxScore"
              :value="step.score"
              size="small"
              @update:value="updateStep(index, stepIndex, 'score', Number($event ?? 0))"
            />
            <Tooltip title="移除阶梯">
              <Button danger shape="circle" size="small" @click="removeStep(index, stepIndex)">
                <IconifyIcon icon="lucide:x" />
              </Button>
            </Tooltip>
          </template>
          <Button size="small" type="link" @click="addStep(index)">添加阶梯</Button>
        </div>
      </div>
    </div>

    <div v-else class="border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-500">
      未配置评分项，申报将不因评分被拦截。
    </div>

    <Button size="small" type="dashed" @click="addRule">
      <IconifyIcon icon="lucide:plus" class="mr-1" />
      添加评分项
    </Button>
  </div>
</template>
