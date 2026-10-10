<script setup lang="ts">
import { computed } from 'vue';

import { Button, Empty, Progress, Space, Tag, TypographyParagraph } from 'antdv-next';

import type { ClientDeclareProjectApi } from '#/api/client';

defineOptions({ name: 'GaoxinScorePanel' });

interface Props {
  loading?: boolean;
  score: ClientDeclareProjectApi.GaoxinScoreResult | null;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<{
  openProfile: [payload: { moduleKey: string; tabKey: string }];
  refresh: [];
}>();

const riskMetaMap: Record<
  ClientDeclareProjectApi.GaoxinScoreRiskLevel,
  { color: string; label: string; progressStatus: 'exception' | 'normal' | 'success' }
> = {
  high: { color: 'red', label: '高风险', progressStatus: 'exception' },
  low: { color: 'green', label: '低风险', progressStatus: 'success' },
  medium: { color: 'orange', label: '中风险', progressStatus: 'normal' },
};

const scoreGap = computed(() => {
  if (!props.score) {
    return 0;
  }
  return Math.max(props.score.passScore - props.score.totalScore, 0);
});

const sourceCountItems = computed(() => {
  if (!props.score) {
    return [];
  }

  const labelMap: Record<string, string> = {
    contract: '合同',
    document: '制度文件',
    employee: '人员',
    finance: '财税',
    intellectualProperty: '知识产权',
    invoice: '发票',
    productService: 'PS',
    researchProject: 'RD',
    transformation: '成果转化',
  };

  return Object.entries(props.score.sourceCounts).map(([key, value]) => ({
    key,
    label: labelMap[key] ?? key,
    value,
  }));
});

function openProfile(payload: { moduleKey: string; tabKey: string }) {
  emit('openProfile', payload);
}
</script>

<template>
  <div class="gaoxin-score-panel">
    <div v-if="loading" class="gaoxin-score-panel__loading">
      正在测算高企评分...
    </div>
    <Empty v-else-if="!score" description="暂无高企评分测算数据">
      <Button @click="emit('refresh')">立即测算</Button>
    </Empty>
    <template v-else>
      <div class="gaoxin-score-panel__hero">
        <div>
          <p class="gaoxin-score-panel__eyebrow">
            规则版本：{{ score.ruleVersion }}
          </p>
          <h3 class="gaoxin-score-panel__title">
            高企评分测算
          </h3>
          <TypographyParagraph class="gaoxin-score-panel__text">
            {{ score.summary }}
          </TypographyParagraph>
        </div>
        <Button @click="emit('refresh')">重新测算</Button>
      </div>

      <div class="gaoxin-score-panel__score-card">
        <div>
          <span>预估总分</span>
          <strong>{{ score.totalScore }}</strong>
        </div>
        <div>
          <span>建议达标线</span>
          <strong>{{ score.passScore }}</strong>
        </div>
        <div>
          <span>风险等级</span>
          <Tag :color="riskMetaMap[score.riskLevel].color">
            {{ riskMetaMap[score.riskLevel].label }}
          </Tag>
        </div>
        <Progress
          :percent="score.totalScore"
          :status="riskMetaMap[score.riskLevel].progressStatus"
        />
        <p v-if="scoreGap > 0" class="gaoxin-score-panel__warning">
          距建议达标线还差 {{ scoreGap }} 分。
        </p>
      </div>

      <div class="gaoxin-score-panel__source-counts">
        <Tag v-for="item in sourceCountItems" :key="item.key">
          {{ item.label }} {{ item.value }}
        </Tag>
      </div>

      <div class="gaoxin-score-panel__categories">
        <div
          v-for="category in score.categories"
          :key="category.key"
          class="gaoxin-score-panel__category"
        >
          <div class="gaoxin-score-panel__category-head">
            <div>
              <strong>{{ category.label }}</strong>
              <span>{{ category.score }}/{{ category.maxScore }}</span>
            </div>
            <Tag :color="riskMetaMap[category.riskLevel].color">
              {{ riskMetaMap[category.riskLevel].label }}
            </Tag>
          </div>
          <Progress
            :percent="Math.round((category.score / category.maxScore) * 100)"
            :status="riskMetaMap[category.riskLevel].progressStatus"
          />
          <div class="gaoxin-score-panel__section">
            <span>评分规则</span>
            <Space wrap>
              <Tag v-for="item in category.ruleItems" :key="item" color="blue">
                {{ item }}
              </Tag>
            </Space>
          </div>
          <div class="gaoxin-score-panel__section">
            <span>评分依据</span>
            <Space wrap>
              <Tag v-for="item in category.evidence" :key="item">
                {{ item }}
              </Tag>
            </Space>
          </div>
          <div class="gaoxin-score-panel__section">
            <span>证据链状态</span>
            <div class="gaoxin-score-panel__evidence-chain">
              <Tag :color="category.evidenceChain.complete ? 'green' : 'orange'">
                {{ category.evidenceChain.complete ? '完整' : '待补齐' }}
              </Tag>
              <p>{{ category.evidenceChain.summary }}</p>
            </div>
            <Space v-if="category.evidenceChain.missing.length > 0" wrap>
              <Tag
                v-for="item in category.evidenceChain.missing"
                :key="item"
                color="orange"
              >
                {{ item }}
              </Tag>
            </Space>
          </div>
          <div v-if="category.deductions.length" class="gaoxin-score-panel__section">
            <span>扣分原因</span>
            <ul>
              <li v-for="item in category.deductions" :key="item">
                {{ item }}
              </li>
            </ul>
          </div>
          <div v-if="category.suggestions.length" class="gaoxin-score-panel__section">
            <span>补齐建议</span>
            <div class="gaoxin-score-panel__suggestions">
              <div
                v-for="item in category.suggestions"
                :key="`${item.moduleKey}-${item.tabKey}-${item.text}`"
                class="gaoxin-score-panel__suggestion"
              >
                <p>{{ item.text }}</p>
                <Button size="small" type="link" @click="openProfile(item)">
                  去补齐
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.gaoxin-score-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.gaoxin-score-panel__loading {
  padding: 32px 0;
  color: rgb(0 0 0 / 45%);
  text-align: center;
}

.gaoxin-score-panel__hero,
.gaoxin-score-panel__category-head,
.gaoxin-score-panel__evidence-chain,
.gaoxin-score-panel__suggestion {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.gaoxin-score-panel__eyebrow,
.gaoxin-score-panel__text,
.gaoxin-score-panel__warning,
.gaoxin-score-panel__evidence-chain p,
.gaoxin-score-panel__section span,
.gaoxin-score-panel__category-head span,
.gaoxin-score-panel__suggestion p {
  margin: 0;
  color: rgb(0 0 0 / 45%);
}

.gaoxin-score-panel__title {
  margin: 4px 0;
  font-size: 16px;
  font-weight: 600;
}

.gaoxin-score-panel__score-card,
.gaoxin-score-panel__category {
  padding: 16px;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  background: #fafafa;
}

.gaoxin-score-panel__score-card {
  display: grid;
  gap: 12px;
}

.gaoxin-score-panel__score-card span {
  display: block;
  margin-bottom: 4px;
  color: rgb(0 0 0 / 45%);
}

.gaoxin-score-panel__score-card strong {
  font-size: 28px;
}

.gaoxin-score-panel__categories,
.gaoxin-score-panel__source-counts,
.gaoxin-score-panel__suggestions {
  display: flex;
  gap: 12px;
}

.gaoxin-score-panel__categories,
.gaoxin-score-panel__suggestions {
  flex-direction: column;
}

.gaoxin-score-panel__source-counts {
  flex-wrap: wrap;
}

.gaoxin-score-panel__category {
  background: #fff;
}

.gaoxin-score-panel__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.gaoxin-score-panel__section ul {
  padding-left: 18px;
  margin: 0;
}

.gaoxin-score-panel__suggestion {
  padding: 10px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fafafa;
}

@media (max-width: 900px) {
  .gaoxin-score-panel__hero,
  .gaoxin-score-panel__category-head,
  .gaoxin-score-panel__evidence-chain,
  .gaoxin-score-panel__suggestion {
    flex-direction: column;
  }
}
</style>
