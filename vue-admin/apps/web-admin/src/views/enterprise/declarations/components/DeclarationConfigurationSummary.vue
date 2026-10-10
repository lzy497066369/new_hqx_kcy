<script setup lang="ts">
import type { EnterpriseWorkspaceDeclarationConfiguration } from '#/api';

import { Empty, Tag } from 'antdv-next';

defineOptions({ name: 'DeclarationConfigurationSummary' });

defineProps<{
  configuration: EnterpriseWorkspaceDeclarationConfiguration;
  matchedScheme: EnterpriseWorkspaceDeclarationConfiguration['scheme'];
}>();

const operatorLabelMap: Record<string, string> = {
  eq: '=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

function formatValue(value: null | number, valueType: 'boolean' | 'number', unit: string) {
  if (value === null) return '未提供';
  if (valueType === 'boolean') return value === 1 ? '是' : '否';
  return `${value}${unit}`;
}

function presetLabel(preset: EnterpriseWorkspaceDeclarationConfiguration['qualification']['preset']) {
  return preset ? `${preset.name} ${preset.version}` : '方案内置规则';
}
</script>

<template>
  <div class="declaration-configuration-summary">
    <template v-if="configuration.scheme">
      <div class="declaration-configuration-summary__scheme">
        <div>
          <span>已应用方案</span>
          <strong>{{ configuration.scheme.name }}</strong>
        </div>
        <Tag color="blue">{{ configuration.scheme.version }}</Tag>
      </div>

      <div class="declaration-configuration-summary__head">
        <div>
          <strong>准入规则</strong>
          <p>{{ presetLabel(configuration.qualification.preset) }}</p>
        </div>
        <Tag :color="configuration.qualification.status === 'eligible' ? 'green' : 'orange'">
          {{ configuration.qualification.status === 'eligible' ? '已满足' : '存在缺口' }}
        </Tag>
      </div>

      <div class="declaration-configuration-summary__rules">
        <article
          v-for="rule in configuration.qualification.rules"
          :key="`${rule.type}-${rule.key}`"
          class="declaration-configuration-summary__rule"
        >
          <div>
            <strong>{{ rule.label }}</strong>
            <p>{{ rule.source }}</p>
          </div>
          <div class="declaration-configuration-summary__values">
            <span>要求 {{ operatorLabelMap[rule.operator] ?? rule.operator }} {{ formatValue(rule.expected, rule.valueType, rule.unit) }}</span>
            <span>实际 {{ formatValue(rule.actual, rule.valueType, rule.unit) }}</span>
          </div>
          <Tag :color="rule.passed ? 'green' : 'orange'">
            {{ rule.passed ? '满足' : '待补齐' }}
          </Tag>
        </article>
      </div>
    </template>
    <Empty v-else description="该申报尚未应用申报方案" />
    <div v-if="!configuration.scheme && matchedScheme" class="declaration-configuration-summary__matched">
      <span>当前可命中方案</span>
      <strong>{{ matchedScheme.name }}</strong>
      <Tag color="blue">{{ matchedScheme.version }}</Tag>
    </div>
  </div>
</template>

<style scoped>
.declaration-configuration-summary,
.declaration-configuration-summary__rules {
  display: grid;
  gap: 12px;
}

.declaration-configuration-summary__scheme,
.declaration-configuration-summary__head,
.declaration-configuration-summary__rule,
.declaration-configuration-summary__matched,
.declaration-configuration-summary__values {
  display: flex;
  gap: 12px;
  align-items: center;
}

.declaration-configuration-summary__scheme,
.declaration-configuration-summary__head,
.declaration-configuration-summary__rule,
.declaration-configuration-summary__matched {
  justify-content: space-between;
}

.declaration-configuration-summary__scheme,
.declaration-configuration-summary__rule,
.declaration-configuration-summary__matched {
  padding: 12px;
  border: 1px solid #e5e7eb;
}

.declaration-configuration-summary__scheme span,
.declaration-configuration-summary__matched span,
.declaration-configuration-summary__head p,
.declaration-configuration-summary__rule p,
.declaration-configuration-summary__values {
  margin: 0;
  color: #64748b;
  font-size: 13px;
}

.declaration-configuration-summary__scheme strong {
  display: block;
  margin-top: 2px;
}

.declaration-configuration-summary__matched strong {
  flex: 1;
}

.declaration-configuration-summary__values {
  flex: 1;
  justify-content: flex-end;
}

@media (max-width: 760px) {
  .declaration-configuration-summary__rule,
  .declaration-configuration-summary__head,
  .declaration-configuration-summary__scheme,
  .declaration-configuration-summary__matched {
    align-items: flex-start;
    flex-direction: column;
  }

  .declaration-configuration-summary__values {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
