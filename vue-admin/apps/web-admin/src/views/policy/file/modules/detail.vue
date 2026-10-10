<script setup lang="ts">
import type { PolicyFileItem } from '#/api';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Empty, Tag } from 'antdv-next';

import { getPolicyFileDetailApi } from '#/api';

import { useDescriptionItems } from '../data';

const detailData = ref<PolicyFileItem>();
const router = useRouter();

const items = computed(() => useDescriptionItems(detailData.value));
const aiAnalysis = computed(() => detailData.value?.aiAnalysis ?? null);
const analysisView = computed(() => {
  if (aiAnalysis.value) {
    return {
      aiReason: aiAnalysis.value.aiReason,
      aiTaskId: aiAnalysis.value.aiTaskId,
      officialConfidence: aiAnalysis.value.officialConfidence,
      officialVerified: aiAnalysis.value.officialVerified,
      rawText: aiAnalysis.value.rawText,
      sourceLabel: `采集结果 #${aiAnalysis.value.sourceRunItemId}`,
      sourceType: 'ai',
      structuredResult: aiAnalysis.value.structuredResult,
      summary: aiAnalysis.value.summary,
    };
  }

  const row = detailData.value;
  if (!row) {
    return null;
  }

  const structuredResult = {
    conditions: row.conditionText ? [row.conditionText] : [],
    endDate: row.endDate,
    materials: row.materialText ? [row.materialText] : [],
    startDate: row.startDate,
    subsidy: row.subsidyText,
    targetObjects: row.targetObjects ? [row.targetObjects] : [],
  };

  return {
    aiReason:
      row.importedByAi === 1
        ? '该政策文件标记为 AI 导入，但未关联到原始采集结果，已按当前字段生成兼容展示。'
        : '该政策文件暂无 AI 采集来源，已按当前维护字段生成兼容展示。',
    aiTaskId: null,
    officialConfidence: row.aiConfidence,
    officialVerified: row.importedByAi === 1 ? 1 : 0,
    rawText: row.content,
    sourceLabel: row.importedByAi === 1 ? 'AI 导入兼容数据' : '当前内容快照',
    sourceType: 'fallback',
    structuredResult,
    summary:
      row.content ||
      [row.title, row.subsidyText, row.targetObjects].filter(Boolean).join('；'),
  };
});
const aiStructuredJson = computed(() => {
  const structuredResult = analysisView.value?.structuredResult;
  return structuredResult
    ? JSON.stringify(structuredResult, null, 2)
    : '';
});

const [Drawer, drawerApi] = useVbenDrawer({
  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }

    const data = drawerApi.getData<PolicyFileItem>();
    if (!data?.id) {
      detailData.value = undefined;
      return;
    }

    detailData.value = await getPolicyFileDetailApi(data.id);
  },
});

function openAiRecord(taskId?: null | string) {
  if (!taskId) {
    return;
  }
  router.push({ path: '/system/ai-record', query: { taskId } }).catch(() => {});
}
</script>

<template>
  <Drawer :footer="false" title="区域政策文件详情">
    <div class="policy-file-detail">
      <VbenDescriptions bordered :column="1" :items="items" />

      <section class="policy-file-ai-section">
        <div class="policy-file-ai-header">
          <div>
            <div class="policy-file-ai-title">AI 识别解析内容</div>
            <div class="policy-file-ai-subtitle">
              优先展示 AI 采集导入的原始解析；旧数据或人工数据按当前字段兼容展示。
            </div>
          </div>
          <Button
            v-if="analysisView?.aiTaskId"
            size="small"
            @click="openAiRecord(analysisView.aiTaskId)"
          >
            <IconifyIcon icon="lucide:bot" class="size-4" />
            AI 记录
          </Button>
        </div>

        <Empty
          v-if="!analysisView"
          description="暂无 AI 识别解析内容"
        />
        <div v-else class="policy-file-ai-content">
          <div class="policy-file-ai-tags">
            <Tag>{{ analysisView.sourceType === 'ai' ? 'AI 原始解析' : '兼容当前内容' }}</Tag>
            <Tag>{{ analysisView.officialVerified === 1 ? '官方来源已确认' : '来源待核验' }}</Tag>
            <Tag>{{ analysisView.officialConfidence || '未知可信度' }}</Tag>
            <Tag>{{ analysisView.sourceLabel }}</Tag>
          </div>

          <div class="policy-file-ai-block">
            <div class="policy-file-ai-label">
              {{ analysisView.sourceType === 'ai' ? 'AI 摘要' : '当前内容摘要' }}
            </div>
            <p>{{ analysisView.summary || '-' }}</p>
          </div>

          <div class="policy-file-ai-block">
            <div class="policy-file-ai-label">
              {{ analysisView.sourceType === 'ai' ? 'AI 判断理由' : '兼容说明' }}
            </div>
            <p>{{ analysisView.aiReason || '-' }}</p>
          </div>

          <div class="policy-file-ai-block">
            <div class="policy-file-ai-label">结构化解析结果</div>
            <pre>{{ aiStructuredJson || '-' }}</pre>
          </div>

          <div class="policy-file-ai-block">
            <div class="policy-file-ai-label">原文关键内容</div>
            <p>{{ analysisView.rawText || '-' }}</p>
          </div>
        </div>
      </section>
    </div>
  </Drawer>
</template>

<style scoped>
.policy-file-detail {
  display: grid;
  gap: 16px;
}

.policy-file-ai-section {
  border-top: 1px solid #e5e7eb;
  padding-top: 16px;
}

.policy-file-ai-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.policy-file-ai-title {
  color: #0f172a;
  font-size: 15px;
  font-weight: 600;
}

.policy-file-ai-subtitle {
  color: #64748b;
  font-size: 12px;
  margin-top: 4px;
}

.policy-file-ai-content {
  display: grid;
  gap: 12px;
}

.policy-file-ai-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.policy-file-ai-block {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 10px 12px;
}

.policy-file-ai-label {
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}

.policy-file-ai-block p,
.policy-file-ai-block pre {
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
