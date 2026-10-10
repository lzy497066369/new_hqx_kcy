<script setup lang="ts">
import { computed } from 'vue';

import { Button, Empty, Progress, Space, Tag, TypographyParagraph } from 'antdv-next';

import type { ClientDeclareProjectApi } from '#/api/client';

defineOptions({ name: 'ProjectMaterialReadinessPanel' });

interface Props {
  loading?: boolean;
  readiness: ClientDeclareProjectApi.MaterialReadiness | null;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<{
  openProfile: [payload: { moduleKey: string; tabKey: string }];
  recheck: [];
}>();

const statusMetaMap: Record<
  ClientDeclareProjectApi.MaterialCheckStatus,
  { color: string; label: string }
> = {
  missing: { color: 'red', label: '缺失' },
  partial: { color: 'orange', label: '部分满足' },
  passed: { color: 'green', label: '已满足' },
};

const riskMetaMap: Record<
  ClientDeclareProjectApi.MaterialRiskLevel,
  { color: string; label: string }
> = {
  high: { color: 'red', label: '高风险' },
  low: { color: 'green', label: '低风险' },
  medium: { color: 'orange', label: '中风险' },
};

const summaryItems = computed(() => {
  if (!props.readiness) {
    return [];
  }

  return [
    {
      label: '总项数',
      value: props.readiness.totalItems,
    },
    {
      label: '已满足',
      value: props.readiness.passedItems,
    },
    {
      label: '缺失项',
      value: props.readiness.missingItems,
    },
    {
      label: '版本',
      value: props.readiness.version,
    },
  ];
});

const groupedItems = computed(() => {
  const items = props.readiness?.items ?? [];
  return {
    missing: items.filter((item) => item.checkStatus === 'missing'),
    partial: items.filter((item) => item.checkStatus === 'partial'),
    passed: items.filter((item) => item.checkStatus === 'passed'),
  };
});

const materialGroups = computed(() => [
  { key: 'passed' as const, items: groupedItems.value.passed, title: '已满足' },
  {
    key: 'partial' as const,
    items: groupedItems.value.partial,
    title: '部分满足',
  },
  { key: 'missing' as const, items: groupedItems.value.missing, title: '缺失材料' },
]);

const relationMetaMap: Record<string, string> = {
  contract: '合同',
  invoice: '发票',
  ip: 'IP',
  ps: 'PS',
  rd: 'RD',
  transformation: '成果',
};

function formatSuggestion(item: ClientDeclareProjectApi.MaterialCheckItem) {
  return item.suggestion || '建议尽快补齐对应材料。';
}

function formatMissingFields(item: ClientDeclareProjectApi.MaterialCheckItem) {
  return item.missingFields.length > 0 ? item.missingFields.join('、') : '无';
}

function formatRelationSummary(item: ClientDeclareProjectApi.MaterialCheckItem) {
  return Object.entries(item.relationSummary ?? {})
    .filter(([, ids]) => ids.length > 0)
    .map(([key, ids]) => ({
      ids,
      key,
      label: relationMetaMap[key] ?? key,
    }));
}

function openProfileModule(item: ClientDeclareProjectApi.MaterialCheckItem) {
  emit('openProfile', {
    moduleKey: item.moduleKey,
    tabKey: item.tabKey,
  });
}
</script>

<template>
  <div class="project-material-readiness-panel">
    <div v-if="loading" class="project-material-readiness-panel__loading">
      正在检查材料准备度...
    </div>
    <Empty v-else-if="!readiness" description="暂无材料准备度数据" />
    <div v-else class="project-material-readiness-panel__content">
      <div class="project-material-readiness-panel__header">
        <div>
          <p class="project-material-readiness-panel__eyebrow">
            {{ readiness.requirementName }}
          </p>
          <h3 class="project-material-readiness-panel__title">
            材料准备度
          </h3>
        </div>
        <Button @click="emit('recheck')">重新检查</Button>
      </div>

      <div class="project-material-readiness-panel__score-card">
        <div>
          <span>准备度分数</span>
          <strong>{{ readiness.readinessScore }}</strong>
        </div>
        <div>
          <span>风险等级</span>
          <Tag :color="riskMetaMap[readiness.riskLevel].color">
            {{ riskMetaMap[readiness.riskLevel].label }}
          </Tag>
        </div>
        <Progress
          :percent="readiness.readinessScore"
          :status="readiness.riskLevel === 'high' ? 'exception' : 'success'"
        />
      </div>

      <div class="project-material-readiness-panel__summary">
        <div
          v-for="item in summaryItems"
          :key="item.label"
          class="project-material-readiness-panel__summary-item"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>

      <div class="project-material-readiness-panel__section">
        <h4>材料状态</h4>
        <div class="project-material-readiness-panel__groups">
          <div
            v-for="group in materialGroups"
            :key="group.key"
            class="project-material-readiness-panel__group"
          >
            <div class="project-material-readiness-panel__group-title">
              <span>{{ group.title }}</span>
              <Tag :color="statusMetaMap[group.key].color">
                {{ group.items.length }}
              </Tag>
            </div>
            <div v-if="group.items.length === 0" class="project-material-readiness-panel__empty-group">
              暂无
            </div>
            <div v-else class="project-material-readiness-panel__items">
              <div
                v-for="item in group.items"
                :key="`${item.moduleKey}-${item.tabKey}-${item.itemName}`"
                class="project-material-readiness-panel__item"
              >
                <div class="project-material-readiness-panel__item-head">
                  <strong>{{ item.itemName }}</strong>
                  <Tag :color="statusMetaMap[item.checkStatus].color">
                    {{ statusMetaMap[item.checkStatus].label }}
                  </Tag>
                </div>
                <Space wrap>
                  <Tag>{{ item.moduleKey }}</Tag>
                  <Tag>{{ item.tabKey }}</Tag>
                  <Tag>
                    {{ item.matchedCount }}/{{ item.requiredCount }}
                  </Tag>
                  <Tag v-if="item.attachmentMissing" color="orange">
                    缺附件
                  </Tag>
                </Space>
                <TypographyParagraph class="project-material-readiness-panel__item-text">
                  缺失字段：{{ formatMissingFields(item) }}
                </TypographyParagraph>
                <div
                  v-if="formatRelationSummary(item).length > 0"
                  class="project-material-readiness-panel__relations"
                >
                  <span>关联证据链：</span>
                  <Space wrap>
                    <Tag
                      v-for="relation in formatRelationSummary(item)"
                      :key="relation.key"
                      color="blue"
                    >
                      {{ relation.label }} {{ relation.ids.join('、') }}
                    </Tag>
                  </Space>
                </div>
                <TypographyParagraph class="project-material-readiness-panel__item-text">
                  建议：{{ formatSuggestion(item) }}
                </TypographyParagraph>
                <Button
                  v-if="item.checkStatus !== 'passed'"
                  size="small"
                  type="link"
                  @click="openProfileModule(item)"
                >
                  去企业资料补齐
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="project-material-readiness-panel__section">
        <h4>检查信息</h4>
        <p class="project-material-readiness-panel__text">
          检查编号：{{ readiness.checkId }} · 检查时间：{{ readiness.checkedAt }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.project-material-readiness-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.project-material-readiness-panel__loading {
  padding: 32px 0;
  color: rgb(0 0 0 / 45%);
  text-align: center;
}

.project-material-readiness-panel__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.project-material-readiness-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.project-material-readiness-panel__eyebrow,
.project-material-readiness-panel__text,
.project-material-readiness-panel__item-text {
  margin: 0;
  color: rgb(0 0 0 / 45%);
}

.project-material-readiness-panel__title {
  margin: 4px 0 0;
  font-size: 16px;
  font-weight: 600;
}

.project-material-readiness-panel__score-card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  background: #fafafa;
}

.project-material-readiness-panel__score-card span {
  display: block;
  margin-bottom: 4px;
  color: rgb(0 0 0 / 45%);
}

.project-material-readiness-panel__score-card strong {
  font-size: 28px;
}

.project-material-readiness-panel__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.project-material-readiness-panel__summary-item {
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  background: #fff;
}

.project-material-readiness-panel__summary-item span {
  display: block;
  margin-bottom: 4px;
  color: rgb(0 0 0 / 45%);
}

.project-material-readiness-panel__section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}

.project-material-readiness-panel__groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-material-readiness-panel__group {
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  background: #fff;
}

.project-material-readiness-panel__group-title,
.project-material-readiness-panel__item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.project-material-readiness-panel__empty-group {
  padding: 10px 0 0;
  color: rgb(0 0 0 / 45%);
}

.project-material-readiness-panel__items {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.project-material-readiness-panel__item {
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fafafa;
}

.project-material-readiness-panel__relations {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 8px 0;
  color: rgb(0 0 0 / 45%);
}

.project-material-readiness-panel__relations span {
  flex: 0 0 auto;
  line-height: 22px;
}

@media (max-width: 900px) {
  .project-material-readiness-panel__header,
  .project-material-readiness-panel__group-title,
  .project-material-readiness-panel__item-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .project-material-readiness-panel__summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .project-material-readiness-panel__relations {
    flex-direction: column;
  }
}
</style>
