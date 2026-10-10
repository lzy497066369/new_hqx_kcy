<script setup lang="ts">
import { computed } from 'vue';

import {
  Empty,
  Tag,
  TypographyParagraph,
} from 'antdv-next';

import type { ClientDeclarationApi } from '#/api/client';

defineOptions({ name: 'DeclarationFlowPanel' });

interface Props {
  flow: ClientDeclarationApi.DeclarationFlow | null | undefined;
}

const props = defineProps<Props>();

const activeNodeCount = computed(
  () => props.flow?.auditNodes.filter((node) => node.status === 'current').length ?? 0,
);

const nodeSectionDescription = computed(() => {
  if (activeNodeCount.value > 1) {
    return `当前有 ${activeNodeCount.value} 个节点同时进行中。`;
  }
  return '当前申报从草稿、提交到审核归档的节点状态。';
});

const eventMetaMap: Record<
  ClientDeclarationApi.DeclarationFlowEventType,
  { color: string; label: string }
> = {
  audit: { color: 'blue', label: '审核节点' },
  material_snapshot: { color: 'cyan', label: '材料快照' },
  replenishment: { color: 'red', label: '退回补件' },
  submit: { color: 'green', label: '提交记录' },
};

const nodeStatusMap: Record<
  ClientDeclarationApi.DeclarationFlowNode['status'],
  { color: string; label: string }
> = {
  completed: { color: 'green', label: '已完成' },
  current: { color: 'blue', label: '进行中' },
  pending: { color: 'default', label: '未开始' },
  rejected: { color: 'red', label: '已退回' },
  waiting: { color: 'gold', label: '待开始' },
};

function formatArray(values: string[]) {
  return values.length > 0 ? values.join('、') : '无';
}
</script>

<template>
  <div class="declaration-flow-panel">
    <Empty v-if="!flow" description="暂无流程记录" />

    <template v-else>
      <div class="declaration-flow-panel__section">
        <div class="declaration-flow-panel__section-head">
          <div>
            <h3>审核节点</h3>
            <p>{{ nodeSectionDescription }}</p>
          </div>
        </div>
        <div class="declaration-flow-panel__nodes">
          <div
            v-for="node in flow.auditNodes"
            :key="node.order"
            :class="[
              'declaration-flow-panel__node',
              `declaration-flow-panel__node--${node.status}`,
            ]"
          >
            <span>{{ node.order }}</span>
            <div class="declaration-flow-panel__node-head">
              <strong>{{ node.nodeName }}</strong>
              <Tag :color="nodeStatusMap[node.status].color">
                {{ nodeStatusMap[node.status].label }}
              </Tag>
            </div>
            <p>{{ node.time || node.description }}</p>
            <div class="declaration-flow-panel__node-rules">
              <span>{{ node.timeRuleDescription }}</span>
              <span>{{ node.timeNodeDescription }}</span>
            </div>
            <div
              v-if="node.qualification.presetNames.length > 0"
              class="declaration-flow-panel__node-qualification"
            >
              <Tag :color="node.qualification.status === 'eligible' ? 'green' : 'orange'">
                {{ node.qualification.status === 'eligible' ? '数据已完善' : '待补齐' }}
              </Tag>
              <span>{{ formatArray(node.qualification.presetNames) }}</span>
              <p v-if="node.qualification.missing.length > 0">
                缺失：{{ formatArray(node.qualification.missing) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="declaration-flow-panel__grid">
        <div class="declaration-flow-panel__section">
          <div class="declaration-flow-panel__section-head">
            <div>
              <h3>流程记录</h3>
              <p>提交、审核和退回补件的关键记录。</p>
            </div>
          </div>
          <div class="declaration-flow-panel__events">
            <div
              v-for="event in flow.events"
              :key="`${event.type}-${event.occurredAt}-${event.title}`"
              class="declaration-flow-panel__event"
            >
              <div class="declaration-flow-panel__event-head">
                <strong>{{ event.title }}</strong>
                <Tag :color="eventMetaMap[event.type].color">
                  {{ eventMetaMap[event.type].label }}
                </Tag>
              </div>
              <TypographyParagraph class="declaration-flow-panel__text">
                {{ event.description }}
              </TypographyParagraph>
              <p class="declaration-flow-panel__muted">
                {{ event.nodeName }} · {{ event.occurredAt }}
              </p>
            </div>
          </div>
        </div>

        <div class="declaration-flow-panel__section">
          <div class="declaration-flow-panel__section-head">
            <div>
              <h3>退回补件</h3>
              <p>展示审核退回原因和当前补件状态。</p>
            </div>
          </div>
          <div v-if="flow.replenishment" class="declaration-flow-panel__replenishment">
            <Tag :color="flow.replenishment.status === 'pending' ? 'red' : 'green'">
              {{ flow.replenishment.status === 'pending' ? '待补件' : '已处理' }}
            </Tag>
            <TypographyParagraph class="declaration-flow-panel__text">
              {{ flow.replenishment.reason }}
            </TypographyParagraph>
            <p class="declaration-flow-panel__muted">
              退回时间：{{ flow.replenishment.requestedAt }}
            </p>
          </div>
          <div v-else class="declaration-flow-panel__empty-text">
            当前没有退回补件记录。
          </div>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.declaration-flow-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.declaration-flow-panel__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.8fr);
  gap: 16px;
}

.declaration-flow-panel__section,
.declaration-flow-panel__event,
.declaration-flow-panel__replenishment {
  padding: 16px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fff;
}

.declaration-flow-panel__section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.declaration-flow-panel__nodes {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.declaration-flow-panel__node {
  min-height: 148px;
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fafafa;
}

.declaration-flow-panel__node span {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  color: #8c8c8c;
  background: #f0f0f0;
  border-radius: 50%;
}

.declaration-flow-panel__node strong {
  display: block;
  margin-bottom: 6px;
}

.declaration-flow-panel__node-head {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  justify-content: space-between;
}

.declaration-flow-panel__node p {
  margin: 0;
  color: rgb(0 0 0 / 45%);
}

.declaration-flow-panel__node-rules {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 8px;
  color: rgb(0 0 0 / 45%);
  font-size: 12px;
  line-height: 1.45;
}

.declaration-flow-panel__node-qualification {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  margin-top: 8px;
  color: rgb(0 0 0 / 45%);
  font-size: 12px;
  line-height: 1.45;
}

.declaration-flow-panel__node-qualification p {
  width: 100%;
  margin: 0;
  color: #d46b08;
}

.declaration-flow-panel__node--completed span {
  color: #fff;
  background: #52c41a;
}

.declaration-flow-panel__node--current {
  border-color: #91caff;
  background: #e6f4ff;
}

.declaration-flow-panel__node--current span {
  color: #fff;
  background: #1677ff;
}

.declaration-flow-panel__node--waiting {
  border-color: #ffe58f;
  background: #fffbe6;
}

.declaration-flow-panel__node--waiting span {
  color: #fff;
  background: #faad14;
}

.declaration-flow-panel__node--rejected {
  border-color: #ffccc7;
  background: #fff1f0;
}

.declaration-flow-panel__node--rejected span {
  color: #fff;
  background: #ff4d4f;
}

.declaration-flow-panel__section-head,
.declaration-flow-panel__event-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.declaration-flow-panel__section-head h3 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
}

.declaration-flow-panel__section-head p,
.declaration-flow-panel__text,
.declaration-flow-panel__muted,
.declaration-flow-panel__empty-text {
  margin: 0;
  color: rgb(0 0 0 / 45%);
}

.declaration-flow-panel__events {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.declaration-flow-panel__event {
  background: #fafafa;
}

.declaration-flow-panel__replenishment {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #fff7f6;
  border-color: #ffccc7;
}

@media (max-width: 900px) {
  .declaration-flow-panel__grid {
    grid-template-columns: 1fr;
  }

  .declaration-flow-panel__nodes {
    grid-template-columns: 1fr;
  }

  .declaration-flow-panel__section-head,
  .declaration-flow-panel__event-head {
    flex-direction: column;
  }
}
</style>
