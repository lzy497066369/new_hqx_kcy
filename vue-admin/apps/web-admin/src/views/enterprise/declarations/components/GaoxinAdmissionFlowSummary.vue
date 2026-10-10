<script setup lang="ts">
import type { EnterpriseWorkspaceDeclarationDetail } from '#/api';

import { Empty, Tag } from 'antdv-next';

defineOptions({ name: 'GaoxinAdmissionFlowSummary' });

defineProps<Pick<EnterpriseWorkspaceDeclarationDetail, 'flowTemplate' | 'qualification'>>();

function roleLabel(role?: string) {
  return role === 'consultant' ? '顾问' : role === 'enterprise' ? '企业' : '系统';
}

function formatDateRange(timeRule?: { endDate?: string; startDate?: string }) {
  if (!timeRule?.startDate && !timeRule?.endDate) return '以属地当年度申报通知为准';
  return `${timeRule.startDate?.slice(0, 10) ?? '-'} 至 ${timeRule.endDate?.slice(0, 10) ?? '-'}`;
}

const executionMeta = {
  in_progress: { color: 'blue', label: '进行中' },
  overdue: { color: 'red', label: '已超期' },
  pending: { color: 'default', label: '待开始' },
  unconfigured: { color: 'orange', label: '未配置时间' },
} as const;

const operatorLabelMap: Record<string, string> = {
  eq: '=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

function formatRuleValue(value: null | number, valueType: 'boolean' | 'number', unit: string) {
  if (value === null) return '未提供';
  if (valueType === 'boolean') return value === 1 ? '是' : '否';
  return `${value}${unit}`;
}
</script>

<template>
  <div class="gaoxin-admission-flow-summary">
    <div v-if="qualification" class="gaoxin-admission-flow-summary__qualification">
      <Tag :color="qualification.status === 'eligible' ? 'green' : 'orange'">
        {{ qualification.status === 'eligible' ? '准入条件已满足' : '存在准入缺口' }}
      </Tag>
      <ul v-if="qualification.missing.length">
        <li v-for="item in qualification.missing" :key="item">{{ item }}</li>
      </ul>
    </div>
    <Empty v-else description="暂无准入预设快照" />

    <div v-if="flowTemplate?.nodes.length" class="gaoxin-admission-flow-summary__nodes">
      <article v-for="(node, index) in flowTemplate.nodes" :key="node.code" class="gaoxin-admission-flow-summary__node">
        <div class="gaoxin-admission-flow-summary__node-index">{{ index + 1 }}</div>
        <div class="gaoxin-admission-flow-summary__node-content">
          <div class="gaoxin-admission-flow-summary__node-head">
            <strong>{{ node.name }}</strong>
            <div class="gaoxin-admission-flow-summary__node-tags">
              <Tag :color="node.type === 'end' ? 'green' : 'blue'">{{ roleLabel(node.role) }}</Tag>
              <Tag :color="executionMeta[node.executionStatus ?? 'pending'].color">
                {{ executionMeta[node.executionStatus ?? 'pending'].label }}
              </Tag>
            </div>
          </div>
          <p>{{ formatDateRange(node.timeRule) }}</p>
          <p v-if="node.description">{{ node.description }}</p>
          <div v-if="node.preconditions?.length" class="gaoxin-admission-flow-summary__preconditions">
            <article v-for="preset in node.preconditions" :key="preset.id">
              <div class="gaoxin-admission-flow-summary__precondition-head">
                <strong>{{ preset.name }}</strong>
                <Tag :color="preset.status === 'eligible' ? 'green' : 'orange'">
                  {{ preset.status === 'eligible' ? '已满足' : '待补齐' }}
                </Tag>
              </div>
              <p v-if="preset.description">{{ preset.description }}</p>
              <ul>
                <li v-for="rule in preset.rules" :key="`${preset.id}-${rule.key}`">
                  {{ rule.label }}：要求 {{ operatorLabelMap[rule.operator] ?? rule.operator }}
                  {{ formatRuleValue(rule.expected, rule.valueType, rule.unit) }}，实际
                  {{ formatRuleValue(rule.actual, rule.valueType, rule.unit) }}
                  <Tag :color="rule.passed ? 'green' : 'orange'">{{ rule.passed ? '满足' : '缺口' }}</Tag>
                </li>
              </ul>
            </article>
          </div>
        </div>
      </article>
    </div>
    <Empty v-else description="暂无流程模板快照" />
  </div>
</template>

<style scoped>
.gaoxin-admission-flow-summary,
.gaoxin-admission-flow-summary__nodes {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gaoxin-admission-flow-summary__qualification ul {
  margin: 10px 0 0;
  padding-left: 20px;
  color: #b45309;
}

.gaoxin-admission-flow-summary__node {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
}

.gaoxin-admission-flow-summary__node-index {
  display: grid;
  flex: 0 0 24px;
  place-items: center;
  height: 24px;
  color: #fff;
  background: #1677ff;
  border-radius: 50%;
}

.gaoxin-admission-flow-summary__node-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.gaoxin-admission-flow-summary__node-head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.gaoxin-admission-flow-summary__node-tags,
.gaoxin-admission-flow-summary__precondition-head {
  display: flex;
  gap: 6px;
  align-items: center;
}

.gaoxin-admission-flow-summary__preconditions {
  display: grid;
  gap: 8px;
  margin-top: 4px;
}

.gaoxin-admission-flow-summary__preconditions article {
  padding: 8px;
  border-left: 3px solid #dbeafe;
  background: #f8fafc;
}

.gaoxin-admission-flow-summary__precondition-head {
  justify-content: space-between;
}

.gaoxin-admission-flow-summary__preconditions ul {
  display: grid;
  gap: 4px;
  margin: 6px 0 0;
  padding-left: 18px;
  color: #475569;
  font-size: 13px;
}

.gaoxin-admission-flow-summary__node-content p {
  margin: 0;
  color: #64748b;
  font-size: 13px;
}

@media (max-width: 640px) {
  .gaoxin-admission-flow-summary__node-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
