<script setup lang="ts">
import { computed } from 'vue';

import { Button, Empty, Progress, Space, Tag, TypographyParagraph } from 'antdv-next';

import type { ClientDeclarationApi } from '#/api/client';

defineOptions({ name: 'GaoxinExportReadinessPanel' });

interface Props {
  exporting?: boolean;
  loading?: boolean;
  readiness: ClientDeclarationApi.GaoxinExportReadiness | null;
}

const props = withDefaults(defineProps<Props>(), {
  exporting: false,
  loading: false,
});

const emit = defineEmits<{
  exportPackage: [];
  openBookDraft: [];
  openProfile: [payload: { moduleKey: string; tabKey: string }];
  refresh: [];
}>();

const statusMetaMap: Record<
  ClientDeclarationApi.GaoxinExportReadinessStatus,
  { color: string; label: string; progressStatus: 'exception' | 'normal' | 'success' }
> = {
  high_risk: { color: 'red', label: '高风险', progressStatus: 'exception' },
  needs_completion: { color: 'orange', label: '需补齐', progressStatus: 'normal' },
  ready: { color: 'green', label: '可导出', progressStatus: 'success' },
};

const issueLevelMetaMap: Record<
  ClientDeclarationApi.GaoxinExportReadinessIssueLevel,
  { color: string; label: string }
> = {
  error: { color: 'red', label: '阻断项' },
  info: { color: 'blue', label: '提示' },
  warning: { color: 'orange', label: '提醒项' },
};

const sourceLabelMap: Record<ClientDeclarationApi.GaoxinExportReadinessIssue['source'], string> = {
  book: '申报书草稿',
  enterprise_profile: '企业资料',
  evidence_chain: '证据链',
  material: '材料准备度',
  score: '评分测算',
};

const summaryItems = computed(() => {
  if (!props.readiness) {
    return [];
  }

  return [
    { label: '材料准备度', value: props.readiness.materialReadinessScore },
    ...(props.readiness.hasGaoxinContent
      ? [
          { label: '草稿完整度', value: props.readiness.bookCompletionRate },
          { label: '高企测算分', value: props.readiness.gaoxinScore },
        ]
      : []),
    { label: '阻断项', value: props.readiness.issueCounts.error },
  ];
});

const groupedIssues = computed(() => {
  const issues = props.readiness?.issues ?? [];
  return [
    { key: 'error' as const, items: issues.filter((item) => item.level === 'error') },
    { key: 'warning' as const, items: issues.filter((item) => item.level === 'warning') },
    { key: 'info' as const, items: issues.filter((item) => item.level === 'info') },
  ].filter((group) => group.items.length > 0);
});

const exportProgress = computed(() => {
  if (!props.readiness) {
    return 0;
  }

  const values = [
    props.readiness.materialReadinessScore,
    props.readiness.bookCompletionRate,
    props.readiness.gaoxinScore,
  ].filter((value): value is number => typeof value === 'number');
  return Math.min(
    Math.round(values.reduce((total, value) => total + Math.min(value, 100), 0) / values.length),
    100,
  );
});

function handleIssueAction(issue: ClientDeclarationApi.GaoxinExportReadinessIssue) {
  if (issue.moduleKey && issue.tabKey) {
    emit('openProfile', {
      moduleKey: issue.moduleKey,
      tabKey: issue.tabKey,
    });
    return;
  }

  emit('openBookDraft');
}
</script>

<template>
  <div class="gaoxin-export-readiness-panel">
    <div v-if="loading" class="gaoxin-export-readiness-panel__loading">
      正在检查导出准备情况...
    </div>
    <Empty v-else-if="!readiness" description="暂无导出准备检查结果">
      <Button @click="emit('refresh')">立即检查</Button>
    </Empty>
    <template v-else>
      <div class="gaoxin-export-readiness-panel__hero">
        <div>
          <p class="gaoxin-export-readiness-panel__eyebrow">
            检查时间：{{ readiness.generatedAt }}
          </p>
          <h3 class="gaoxin-export-readiness-panel__title">
            申报材料包导出准备
          </h3>
          <TypographyParagraph class="gaoxin-export-readiness-panel__text">
            {{ readiness.summary }}
          </TypographyParagraph>
        </div>
        <Space wrap>
          <Tag :color="statusMetaMap[readiness.status].color">
            {{ statusMetaMap[readiness.status].label }}
          </Tag>
          <Button
            :disabled="!readiness.canExport"
            :loading="exporting"
            type="primary"
            @click="emit('exportPackage')"
          >
            导出数据包
          </Button>
          <Button @click="emit('refresh')">重新检查</Button>
        </Space>
      </div>

      <div class="gaoxin-export-readiness-panel__score-card">
        <div>
          <span>导出准备度</span>
          <strong>{{ exportProgress }}</strong>
        </div>
        <div>
          <span>当前状态</span>
          <Tag :color="statusMetaMap[readiness.status].color">
            {{ statusMetaMap[readiness.status].label }}
          </Tag>
        </div>
        <Progress
          :percent="exportProgress"
          :status="statusMetaMap[readiness.status].progressStatus"
        />
      </div>

      <div class="gaoxin-export-readiness-panel__summary">
        <div
          v-for="item in summaryItems"
          :key="item.label"
          class="gaoxin-export-readiness-panel__summary-item"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>

      <div v-if="groupedIssues.length > 0" class="gaoxin-export-readiness-panel__groups">
        <div
          v-for="group in groupedIssues"
          :key="group.key"
          class="gaoxin-export-readiness-panel__group"
        >
          <div class="gaoxin-export-readiness-panel__group-title">
            <strong>{{ issueLevelMetaMap[group.key].label }}</strong>
            <Tag :color="issueLevelMetaMap[group.key].color">
              {{ group.items.length }}
            </Tag>
          </div>
          <div class="gaoxin-export-readiness-panel__items">
            <div
              v-for="issue in group.items"
              :key="issue.key"
              class="gaoxin-export-readiness-panel__issue"
            >
              <div class="gaoxin-export-readiness-panel__issue-head">
                <strong>{{ issue.title }}</strong>
                <Space wrap>
                  <Tag>{{ sourceLabelMap[issue.source] }}</Tag>
                  <Tag v-if="issue.blockingExport" color="red">阻断导出</Tag>
                </Space>
              </div>
              <TypographyParagraph class="gaoxin-export-readiness-panel__text">
                {{ issue.description }}
              </TypographyParagraph>
              <Button size="small" type="link" @click="handleIssueAction(issue)">
                {{ issue.actionText }}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="gaoxin-export-readiness-panel__ready">
        当前没有发现阻断项，可以进入后续正式导出开发或导出操作。
      </div>
    </template>
  </div>
</template>

<style scoped>
.gaoxin-export-readiness-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.gaoxin-export-readiness-panel__loading {
  padding: 32px 0;
  color: rgb(0 0 0 / 45%);
  text-align: center;
}

.gaoxin-export-readiness-panel__hero,
.gaoxin-export-readiness-panel__issue-head,
.gaoxin-export-readiness-panel__group-title {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.gaoxin-export-readiness-panel__eyebrow,
.gaoxin-export-readiness-panel__text,
.gaoxin-export-readiness-panel__score-card span,
.gaoxin-export-readiness-panel__summary-item span {
  margin: 0;
  color: rgb(0 0 0 / 45%);
}

.gaoxin-export-readiness-panel__title {
  margin: 4px 0;
  font-size: 16px;
  font-weight: 600;
}

.gaoxin-export-readiness-panel__score-card,
.gaoxin-export-readiness-panel__summary-item,
.gaoxin-export-readiness-panel__group,
.gaoxin-export-readiness-panel__issue,
.gaoxin-export-readiness-panel__ready {
  padding: 16px;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  background: #fff;
}

.gaoxin-export-readiness-panel__score-card {
  display: grid;
  gap: 12px;
  background: #fafafa;
}

.gaoxin-export-readiness-panel__score-card strong {
  font-size: 28px;
}

.gaoxin-export-readiness-panel__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.gaoxin-export-readiness-panel__groups,
.gaoxin-export-readiness-panel__items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gaoxin-export-readiness-panel__issue {
  background: #fafafa;
}

.gaoxin-export-readiness-panel__ready {
  color: #389e0d;
  background: #f6ffed;
  border-color: #b7eb8f;
}

@media (max-width: 900px) {
  .gaoxin-export-readiness-panel__hero,
  .gaoxin-export-readiness-panel__issue-head,
  .gaoxin-export-readiness-panel__group-title {
    flex-direction: column;
  }

  .gaoxin-export-readiness-panel__summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
