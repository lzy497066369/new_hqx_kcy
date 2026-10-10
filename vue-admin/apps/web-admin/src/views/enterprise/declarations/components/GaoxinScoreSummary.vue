<script setup lang="ts">
import type {
  EnterpriseWorkspaceDeclarationConfiguration,
  EnterpriseWorkspaceGaoxinScore,
} from '#/api';

import { Empty, Progress, Tag } from 'antdv-next';
import { computed } from 'vue';

defineOptions({ name: 'GaoxinScoreSummary' });

const props = defineProps<{
  configuration: EnterpriseWorkspaceDeclarationConfiguration['score'];
  score: EnterpriseWorkspaceGaoxinScore | null;
}>();

const riskMetaMap = {
  high: { color: 'red', label: '高风险', progressStatus: 'exception' },
  low: { color: 'green', label: '低风险', progressStatus: 'success' },
  medium: { color: 'orange', label: '中风险', progressStatus: 'normal' },
} as const;

const configuredModel = computed(() => {
  const model = props.configuration.rules.model;
  return typeof model === 'string' && model.trim() ? model.trim() : null;
});

const configuredCategories = computed(() => {
  const categories = props.configuration.rules.categories;
  if (!Array.isArray(categories)) return [];
  return categories.flatMap((category) => {
    if (!category || typeof category !== 'object' || Array.isArray(category)) return [];
    const item = category as Record<string, unknown>;
    const key = typeof item.key === 'string' ? item.key : '';
    const label = typeof item.label === 'string' ? item.label : '';
    const maxScore = Number(item.maxScore);
    return key && label && Number.isFinite(maxScore)
      ? [{ key, label, maxScore }]
      : [];
  });
});
</script>

<template>
  <Empty v-if="!score" description="当前申报方案未启用高企评分测算" />
  <div v-else class="gaoxin-score-summary">
    <div class="gaoxin-score-summary__model">
      <span>评分模型</span>
      <strong>{{ configuration.preset?.name ?? configuredModel ?? score.ruleVersion }}</strong>
      <Tag color="blue">{{ configuration.preset?.version ?? score.ruleVersion }}</Tag>
    </div>
    <p v-if="configuredModel" class="gaoxin-score-summary__rule-version">
      规则标识：{{ configuredModel }}
    </p>
    <div v-if="configuredCategories.length" class="gaoxin-score-summary__configured-categories">
      <span>评分项配置</span>
      <Tag v-for="category in configuredCategories" :key="category.key" color="blue">
        {{ category.label }} {{ category.maxScore }} 分
      </Tag>
    </div>
    <div class="gaoxin-score-summary__overview">
      <div>
        <span>系统预估总分</span>
        <strong>{{ score.totalScore }} / 100</strong>
      </div>
      <div>
        <span>建议达标线</span>
        <strong>{{ score.passScore }}</strong>
      </div>
      <Tag :color="riskMetaMap[score.riskLevel].color">
        {{ riskMetaMap[score.riskLevel].label }}
      </Tag>
    </div>
    <Progress
      :percent="score.totalScore"
      :status="riskMetaMap[score.riskLevel].progressStatus"
    />
    <p class="gaoxin-score-summary__summary">{{ score.summary }}</p>

    <section
      v-for="category in score.categories"
      :key="category.key"
      class="gaoxin-score-summary__category"
    >
      <div class="gaoxin-score-summary__category-head">
        <strong>{{ category.label }}</strong>
        <span>{{ category.score }} / {{ category.maxScore }}</span>
      </div>
      <div class="gaoxin-score-summary__sub-items">
        <article v-for="item in category.subItems" :key="item.key" class="gaoxin-score-summary__sub-item">
          <div class="gaoxin-score-summary__sub-item-head">
            <strong>{{ item.label }}</strong>
            <span>{{ item.score }} / {{ item.maxScore }}</span>
          </div>
          <div class="gaoxin-score-summary__tags">
            <Tag color="blue">{{ item.grade }}</Tag>
            <Tag v-if="item.expertReviewRequired" color="orange">需专家确认</Tag>
          </div>
          <p>档位：{{ item.scoreRange }}</p>
          <p>依据：{{ item.basis }}</p>
        </article>
      </div>
      <ul v-if="category.deductions.length" class="gaoxin-score-summary__deductions">
        <li v-for="item in category.deductions" :key="item">{{ item }}</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.gaoxin-score-summary,
.gaoxin-score-summary__sub-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gaoxin-score-summary__overview,
.gaoxin-score-summary__model,
.gaoxin-score-summary__configured-categories,
.gaoxin-score-summary__category-head,
.gaoxin-score-summary__sub-item-head,
.gaoxin-score-summary__tags {
  display: flex;
  gap: 12px;
  align-items: center;
}

.gaoxin-score-summary__overview {
  justify-content: space-between;
}

.gaoxin-score-summary__model {
  justify-content: flex-end;
}

.gaoxin-score-summary__model span {
  color: #64748b;
  font-size: 13px;
}

.gaoxin-score-summary__overview span,
.gaoxin-score-summary__summary,
.gaoxin-score-summary__rule-version,
.gaoxin-score-summary__sub-item p {
  margin: 0;
  color: #64748b;
  font-size: 13px;
}

.gaoxin-score-summary__configured-categories span {
  color: #64748b;
  font-size: 13px;
}

.gaoxin-score-summary__overview strong {
  display: block;
  font-size: 20px;
}

.gaoxin-score-summary__category {
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.gaoxin-score-summary__category-head,
.gaoxin-score-summary__sub-item-head {
  justify-content: space-between;
}

.gaoxin-score-summary__sub-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-left: 3px solid #1677ff;
  background: #f8fafc;
}

.gaoxin-score-summary__deductions {
  margin: 10px 0 0;
  padding-left: 18px;
  color: #b45309;
}

@media (max-width: 640px) {
  .gaoxin-score-summary__overview {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
