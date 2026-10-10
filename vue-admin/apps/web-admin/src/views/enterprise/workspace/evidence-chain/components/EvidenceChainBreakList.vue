<script setup lang="ts">
import type { EnterpriseEvidenceChain } from '#/api';

import { Button, Empty, Tag } from 'antdv-next';

interface Props {
  breaks: EnterpriseEvidenceChain['breaks'];
}

defineProps<Props>();

const emit = defineEmits<{
  open: [item: EnterpriseEvidenceChain['breaks'][number]];
}>();
</script>

<template>
  <div v-if="breaks.length" class="evidence-chain-break-list">
    <article v-for="item in breaks" :key="item.code" class="evidence-chain-break-list__item">
      <div class="evidence-chain-break-list__content">
        <div class="evidence-chain-break-list__title-row">
          <strong>{{ item.title }}</strong>
          <Tag :color="item.severity === 'high' ? 'red' : 'orange'">
            {{ item.severity === 'high' ? '高优先级' : '待补齐' }}
          </Tag>
        </div>
        <p>{{ item.nodeName }}：{{ item.description }}</p>
      </div>
      <Button type="link" @click="emit('open', item)">去关联</Button>
    </article>
  </div>
  <Empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" description="证据链关联完整" />
</template>

<style scoped>
.evidence-chain-break-list {
  display: grid;
  gap: 10px;
}

.evidence-chain-break-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-left: 3px solid #f59e0b;
}

.evidence-chain-break-list__content {
  min-width: 0;
}

.evidence-chain-break-list__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: #1f2937;
}

.evidence-chain-break-list__content p {
  margin: 5px 0 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.5;
}

@media (max-width: 640px) {
  .evidence-chain-break-list__item {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
}
</style>
