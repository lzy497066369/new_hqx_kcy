<script setup lang="ts">
import type { EnterpriseEvidenceChain } from '#/api';

import { Tag } from 'antdv-next';

interface Props {
  nodes: EnterpriseEvidenceChain['nodes'];
}

const props = defineProps<Props>();

const stages = [
  { key: 'research_project', title: 'RD 研发项目' },
  { key: 'intellectual_property', title: 'IP 知识产权' },
  { key: 'product_service', title: 'PS 产品服务' },
  { key: 'transformation', title: '成果转化' },
] as const;

function getStageNodes(type: EnterpriseEvidenceChain['nodes'][number]['type']) {
  return props.nodes.filter((node) => node.type === type);
}

function getLinkSummary(node: EnterpriseEvidenceChain['nodes'][number]) {
  const labels = {
    intellectual_property: 'IP',
    product_service: 'PS',
    research_project: 'RD',
    transformation: '转化',
  } as const;
  const entries = Object.entries(node.links).filter(([, ids]) => ids?.length);
  return entries.length
    ? entries
        .map(([type, ids]) => `${labels[type as keyof typeof labels]} ${ids?.length ?? 0}`)
        .join(' / ')
    : '暂未关联';
}
</script>

<template>
  <div class="evidence-chain-flow">
    <section
      v-for="(stage, index) in stages"
      :key="stage.key"
      class="evidence-chain-flow__stage"
    >
      <div class="evidence-chain-flow__stage-heading">
        <span>{{ stage.title }}</span>
        <Tag>{{ getStageNodes(stage.key).length }}</Tag>
      </div>
      <div class="evidence-chain-flow__node-list">
        <span
          v-for="node in getStageNodes(stage.key)"
          :key="node.id"
          class="evidence-chain-flow__node"
          :title="node.name"
        >
          <span class="evidence-chain-flow__node-code">{{ node.code }}</span>
          <span class="evidence-chain-flow__node-name">{{ node.name }}</span>
          <small>{{ getLinkSummary(node) }}</small>
        </span>
        <span
          v-if="getStageNodes(stage.key).length === 0"
          class="evidence-chain-flow__empty"
        >
          暂无记录
        </span>
      </div>
      <span v-if="index < stages.length - 1" class="evidence-chain-flow__arrow">→</span>
    </section>
  </div>
</template>

<style scoped>
.evidence-chain-flow {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 28px;
}

.evidence-chain-flow__stage {
  position: relative;
  display: grid;
  gap: 12px;
  min-width: 0;
}

.evidence-chain-flow__stage-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #1f2937;
  font-weight: 600;
}

.evidence-chain-flow__node-list {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 80px;
}

.evidence-chain-flow__node,
.evidence-chain-flow__empty {
  padding: 7px 9px;
  border: 1px solid #dbe3ed;
  border-radius: 4px;
  color: #374151;
  font-size: 13px;
  line-height: 1.45;
}

.evidence-chain-flow__node {
  display: grid;
  gap: 2px;
}

.evidence-chain-flow__node-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.evidence-chain-flow__node-code {
  color: #1f2937;
  font-weight: 600;
}

.evidence-chain-flow__node small {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.35;
}

.evidence-chain-flow__empty {
  border-style: dashed;
  color: #9ca3af;
}

.evidence-chain-flow__arrow {
  position: absolute;
  top: 45%;
  right: -22px;
  color: #9ca3af;
  font-size: 22px;
}

@media (max-width: 960px) {
  .evidence-chain-flow {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .evidence-chain-flow__arrow {
    top: auto;
    right: auto;
    bottom: -21px;
    left: 50%;
    transform: rotate(90deg);
  }
}
</style>
