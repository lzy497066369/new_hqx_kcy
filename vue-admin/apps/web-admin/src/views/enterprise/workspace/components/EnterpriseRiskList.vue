<script setup lang="ts">
import type { EnterpriseWorkspaceRisk } from '#/api';

import { Alert, Button, Empty, Tag } from 'antdv-next';

import { getEnterpriseRiskTarget, type EnterpriseRiskTarget } from './enterprise-risk-target';

interface Props {
  risks: EnterpriseWorkspaceRisk[];
}

defineProps<Props>();
const emit = defineEmits<{ open: [target: EnterpriseRiskTarget] }>();

function getRiskType(level: EnterpriseWorkspaceRisk['level']) {
  return level === 'high' ? 'error' : level === 'medium' ? 'warning' : 'info';
}

function getRiskLabel(level: EnterpriseWorkspaceRisk['level']) {
  return level === 'high' ? '高风险' : level === 'medium' ? '待处理' : '提示';
}
</script>

<template>
  <div v-if="risks.length" class="enterprise-risk-list">
    <Alert
      v-for="risk in risks"
      :key="risk.code"
      :description="risk.description"
      :message="risk.title"
      :type="getRiskType(risk.level)"
      show-icon
    >
      <template #action>
        <div class="enterprise-risk-list__action">
          <Tag :color="risk.level === 'high' ? 'red' : 'orange'">
            {{ getRiskLabel(risk.level) }}
          </Tag>
          <Button
            v-if="getEnterpriseRiskTarget(risk.code)"
            size="small"
            type="link"
            @click="emit('open', getEnterpriseRiskTarget(risk.code)!)"
          >处理</Button>
        </div>
      </template>
    </Alert>
  </div>
  <Empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" description="当前未发现需要处理的风险" />
</template>

<style scoped>
.enterprise-risk-list {
  display: grid;
  gap: 10px;
}

.enterprise-risk-list__action {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
