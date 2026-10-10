<script setup lang="ts">
import { computed } from 'vue';

import { Button, Empty, Space, Tag, TypographyParagraph } from 'antdv-next';

import type { ClientDeclareProjectApi } from '#/api/client';

interface Props {
  diagnosis: ClientDeclareProjectApi.GaoxinAiDiagnosis | null;
  loading?: boolean;
}

interface Emits {
  openBookDraft: [];
  openProfile: [payload: { moduleKey: string; tabKey: string }];
  refresh: [];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const riskMetaMap = {
  high: { color: 'red', label: '高风险' },
  low: { color: 'green', label: '低风险' },
  medium: { color: 'orange', label: '中风险' },
} satisfies Record<ClientDeclareProjectApi.MaterialRiskLevel, { color: string; label: string }>;

const conclusionMetaMap = {
  can_try: { color: 'blue', label: '可先建草稿' },
  not_ready: { color: 'red', label: '建议先补齐' },
  recommended: { color: 'green', label: '建议推进' },
} satisfies Record<
  ClientDeclareProjectApi.GaoxinAiDiagnosis['conclusion'],
  { color: string; label: string }
>;

const adapterLabel = computed(() => {
  if (!props.diagnosis) {
    return '';
  }
  if (props.diagnosis.adapterStatus === 'success') {
    return props.diagnosis.aiModel
      ? `AI 诊断 · ${props.diagnosis.aiModel}`
      : 'AI 诊断';
  }
  if (props.diagnosis.adapterStatus === 'fallback_after_error') {
    return '规则诊断 · 待 AI 复核';
  }
  return '规则诊断';
});

function handleAction(action: ClientDeclareProjectApi.GaoxinAiDiagnosisAction) {
  if (action.moduleKey && action.tabKey) {
    emit('openProfile', {
      moduleKey: action.moduleKey,
      tabKey: action.tabKey,
    });
    return;
  }
  if (action.key.includes('book')) {
    emit('openBookDraft');
  }
}
</script>

<template>
  <div class="gaoxin-ai-diagnosis-panel">
    <div v-if="loading" class="gaoxin-ai-diagnosis-panel__loading">
      正在生成申报诊断...
    </div>

    <Empty v-else-if="!diagnosis" description="暂无 AI 诊断结果">
      <Button type="primary" @click="emit('refresh')">生成诊断</Button>
    </Empty>

    <template v-else>
      <div class="gaoxin-ai-diagnosis-panel__hero">
        <div>
          <Space wrap>
            <Tag :color="riskMetaMap[diagnosis.riskLevel].color">
              {{ riskMetaMap[diagnosis.riskLevel].label }}
            </Tag>
            <Tag :color="conclusionMetaMap[diagnosis.conclusion].color">
              {{ conclusionMetaMap[diagnosis.conclusion].label }}
            </Tag>
            <Tag>{{ adapterLabel }}</Tag>
          </Space>
          <TypographyParagraph class="gaoxin-ai-diagnosis-panel__summary">
            {{ diagnosis.summary }}
          </TypographyParagraph>
        </div>
        <div class="gaoxin-ai-diagnosis-panel__score">
          <span>高企测算分</span>
          <strong>{{ diagnosis.totalScore }}</strong>
          <small v-if="diagnosis.scoreGap > 0">差 {{ diagnosis.scoreGap }} 分</small>
          <small v-else>已达建议线</small>
        </div>
      </div>

      <div class="gaoxin-ai-diagnosis-panel__metrics">
        <div class="gaoxin-ai-diagnosis-panel__metric">
          <span>材料准备度</span>
          <strong>{{ diagnosis.materialReadinessScore }}%</strong>
        </div>
        <div
          v-if="diagnosis.bookCompletionRate !== undefined"
          class="gaoxin-ai-diagnosis-panel__metric"
        >
          <span>草稿完整度</span>
          <strong>{{ diagnosis.bookCompletionRate }}%</strong>
        </div>
      </div>

      <div class="gaoxin-ai-diagnosis-panel__columns">
        <section class="gaoxin-ai-diagnosis-panel__section">
          <h4>当前优势</h4>
          <ul>
            <li v-for="item in diagnosis.advantages" :key="item">{{ item }}</li>
          </ul>
        </section>

        <section class="gaoxin-ai-diagnosis-panel__section">
          <h4>主要风险</h4>
          <ul>
            <li v-for="item in diagnosis.risks" :key="item">{{ item }}</li>
          </ul>
        </section>
      </div>

      <section class="gaoxin-ai-diagnosis-panel__section">
        <div class="gaoxin-ai-diagnosis-panel__section-head">
          <h4>优先行动</h4>
          <Button size="small" @click="emit('refresh')">重新诊断</Button>
        </div>
        <div class="gaoxin-ai-diagnosis-panel__actions">
          <div
            v-for="action in diagnosis.priorityActions"
            :key="action.key"
            class="gaoxin-ai-diagnosis-panel__action"
          >
            <div>
              <Space wrap>
                <strong>{{ action.title }}</strong>
                <Tag
                  :color="
                    action.priority === 'high'
                      ? 'red'
                      : action.priority === 'medium'
                        ? 'orange'
                        : 'green'
                  "
                >
                  {{ action.priority === 'high' ? '优先' : action.priority === 'medium' ? '建议' : '可后置' }}
                </Tag>
              </Space>
              <p>{{ action.description }}</p>
            </div>
            <Button
              v-if="action.moduleKey || action.key.includes('book')"
              size="small"
              type="link"
              @click="handleAction(action)"
            >
              {{ action.actionText }}
            </Button>
          </div>
        </div>
      </section>

      <section class="gaoxin-ai-diagnosis-panel__section">
        <h4>下一步</h4>
        <ol>
          <li v-for="item in diagnosis.nextSteps" :key="item">{{ item }}</li>
        </ol>
      </section>

      <p
        v-if="diagnosis.adapterError"
        class="gaoxin-ai-diagnosis-panel__warning"
      >
        AI 诊断暂不可用，当前展示规则诊断结果：{{ diagnosis.adapterError }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.gaoxin-ai-diagnosis-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.gaoxin-ai-diagnosis-panel__loading {
  padding: 28px 0;
  color: rgb(0 0 0 / 45%);
  text-align: center;
}

.gaoxin-ai-diagnosis-panel__hero,
.gaoxin-ai-diagnosis-panel__action,
.gaoxin-ai-diagnosis-panel__section-head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.gaoxin-ai-diagnosis-panel__summary,
.gaoxin-ai-diagnosis-panel__action p,
.gaoxin-ai-diagnosis-panel__warning {
  margin: 8px 0 0;
  color: rgb(0 0 0 / 55%);
}

.gaoxin-ai-diagnosis-panel__score,
.gaoxin-ai-diagnosis-panel__metric,
.gaoxin-ai-diagnosis-panel__section,
.gaoxin-ai-diagnosis-panel__action {
  padding: 14px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fff;
}

.gaoxin-ai-diagnosis-panel__score {
  min-width: 150px;
  text-align: right;
}

.gaoxin-ai-diagnosis-panel__score span,
.gaoxin-ai-diagnosis-panel__score small,
.gaoxin-ai-diagnosis-panel__metric span {
  display: block;
  color: rgb(0 0 0 / 45%);
}

.gaoxin-ai-diagnosis-panel__score strong,
.gaoxin-ai-diagnosis-panel__metric strong {
  display: block;
  font-size: 28px;
  line-height: 1.2;
}

.gaoxin-ai-diagnosis-panel__metrics,
.gaoxin-ai-diagnosis-panel__columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.gaoxin-ai-diagnosis-panel__section h4 {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
}

.gaoxin-ai-diagnosis-panel__section ul,
.gaoxin-ai-diagnosis-panel__section ol {
  padding-left: 18px;
  margin: 0;
}

.gaoxin-ai-diagnosis-panel__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gaoxin-ai-diagnosis-panel__warning {
  padding: 10px 12px;
  border: 1px solid #ffe58f;
  border-radius: 8px;
  background: #fffbe6;
}

@media (max-width: 900px) {
  .gaoxin-ai-diagnosis-panel__hero,
  .gaoxin-ai-diagnosis-panel__action,
  .gaoxin-ai-diagnosis-panel__section-head {
    flex-direction: column;
  }

  .gaoxin-ai-diagnosis-panel__metrics,
  .gaoxin-ai-diagnosis-panel__columns {
    grid-template-columns: 1fr;
  }

  .gaoxin-ai-diagnosis-panel__score {
    width: 100%;
    text-align: left;
  }
}
</style>
