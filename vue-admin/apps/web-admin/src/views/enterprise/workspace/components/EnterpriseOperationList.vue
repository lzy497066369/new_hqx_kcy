<script setup lang="ts">
import type { EnterpriseWorkspaceSummary } from '#/api';

import { Empty, Tag } from 'antdv-next';

interface Props {
  operations: EnterpriseWorkspaceSummary['recentOperations'];
}

defineProps<Props>();

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
</script>

<template>
  <ol v-if="operations.length" class="enterprise-operation-list">
    <li v-for="operation in operations" :key="operation.id">
      <div class="enterprise-operation-list__content">
        <div class="enterprise-operation-list__line">
          <strong>{{ operation.module }}</strong>
          <Tag :color="operation.success ? 'green' : 'red'">
            {{ operation.success ? '成功' : '失败' }}
          </Tag>
        </div>
        <p>{{ operation.operatorName }}：{{ operation.action }}</p>
        <time>{{ formatDateTime(operation.createdAt) }}</time>
      </div>
    </li>
  </ol>
  <Empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" description="暂无可关联的操作记录" />
</template>

<style scoped>
.enterprise-operation-list {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.enterprise-operation-list > li {
  position: relative;
  padding-left: 16px;
}

.enterprise-operation-list > li::before {
  position: absolute;
  top: 5px;
  left: 0;
  width: 7px;
  height: 7px;
  content: '';
  background: #2563eb;
  border-radius: 50%;
}

.enterprise-operation-list__content {
  display: grid;
  gap: 4px;
  padding-bottom: 8px;
}

.enterprise-operation-list__line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.enterprise-operation-list__line strong {
  color: #374151;
}

.enterprise-operation-list__content p,
.enterprise-operation-list__content time {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}
</style>
