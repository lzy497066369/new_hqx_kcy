<script lang="ts" setup>
import type { AiApi } from '#/api';

import { computed, shallowRef } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Descriptions, DescriptionsItem, Empty, Tag } from 'antdv-next';

import { getAiTaskDetail } from '#/api';

import { formatJson, formatScene, formatStatus } from '../data';

const detailData = shallowRef<AiApi.AiTask>();
const loading = shallowRef(false);

const auditLog = computed(() => detailData.value?.auditLogs?.[0]);

const [Drawer, drawerApi] = useVbenDrawer({
  async onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }
    const row = drawerApi.getData<AiApi.AiTask>();
    detailData.value = row;
    loading.value = true;
    try {
      detailData.value = await getAiTaskDetail(row.id);
    } finally {
      loading.value = false;
    }
  },
});
</script>

<template>
  <Drawer :footer="false" title="AI 请求详情" width="920">
    <div v-if="detailData" class="ai-record-detail">
      <Descriptions bordered :column="2" size="small">
        <DescriptionsItem label="任务 ID">{{ detailData.id }}</DescriptionsItem>
        <DescriptionsItem label="状态">
          <Tag :color="detailData.status === 'success' ? 'success' : detailData.status === 'failed' ? 'error' : 'processing'">
            {{ formatStatus(detailData.status) }}
          </Tag>
        </DescriptionsItem>
        <DescriptionsItem label="AI 场景">
          {{ formatScene(detailData.scene) }}
        </DescriptionsItem>
        <DescriptionsItem label="业务对象">
          {{ detailData.bizType }} / {{ detailData.bizId }}
        </DescriptionsItem>
        <DescriptionsItem label="创建时间">
          {{ detailData.createTime }}
        </DescriptionsItem>
        <DescriptionsItem label="完成时间">
          {{ detailData.finishedAt || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="错误信息" :span="2">
          {{ detailData.errorMessage || '-' }}
        </DescriptionsItem>
      </Descriptions>

      <section class="ai-record-detail__section">
        <h3>输入快照</h3>
        <pre>{{ formatJson(detailData.inputSnapshot) }}</pre>
      </section>

      <section class="ai-record-detail__section">
        <h3>结构化结果</h3>
        <pre>{{ formatJson(detailData.result?.structuredResult) }}</pre>
      </section>

      <section class="ai-record-detail__section">
        <h3>真实 Prompt</h3>
        <pre>{{ auditLog?.prompt || '-' }}</pre>
      </section>

      <section class="ai-record-detail__section">
        <h3>真实返回</h3>
        <pre>{{ auditLog?.rawResponse || '-' }}</pre>
      </section>

      <section class="ai-record-detail__section">
        <h3>Token 与耗时</h3>
        <pre>{{ formatJson({
          provider: auditLog?.provider,
          model: auditLog?.model,
          tokenUsage: auditLog?.tokenUsage,
          durationMs: auditLog?.durationMs,
          cost: auditLog?.cost,
          errorMessage: auditLog?.errorMessage,
        }) }}</pre>
      </section>
    </div>
    <Empty v-else-if="!loading" description="暂无详情" />
  </Drawer>
</template>

<style scoped>
.ai-record-detail {
  display: grid;
  gap: 16px;
}

.ai-record-detail__section {
  display: grid;
  gap: 8px;
}

.ai-record-detail__section h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.ai-record-detail__section pre {
  max-height: 280px;
  padding: 12px;
  margin: 0;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
</style>
