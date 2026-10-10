<script setup lang="ts">
import type { EnterpriseWorkspaceOverview } from '#/api';

import { computed, shallowRef } from 'vue';

import { Card, Statistic } from 'antdv-next';

import { getEnterpriseWorkspaceOverviewApi } from '#/api';

const loading = shallowRef(false);
const overview = shallowRef<EnterpriseWorkspaceOverview>();
const emit = defineEmits<{
  openDeclarations: [filters: { deadlineWithinDays?: number; missingMaterials?: boolean; status?: string }];
  openProfiles: [filters: { incomplete: '1' }];
}>();

type OverviewAction =
  | {
      filters: { deadlineWithinDays?: number; missingMaterials?: boolean; status?: string };
      target: 'declarations';
    }
  | { filters: { incomplete: '1' }; target: 'profiles' };

const statistics = computed<
  Array<{ action?: OverviewAction; label: string; value: number }>
>(() => [
  { label: '可见企业', value: overview.value?.totalEnterprises ?? 0 },
  {
    action: { filters: { incomplete: '1' }, target: 'profiles' },
    label: '资料待完善',
    value: overview.value?.incompleteProfiles ?? 0,
  },
  {
    action: { filters: { missingMaterials: true }, target: 'declarations' },
    label: '材料待补',
    value: overview.value?.materialPending ?? 0,
  },
  {
    action: { filters: { status: 'reviewing' }, target: 'declarations' },
    label: '审核中',
    value: overview.value?.reviewingDeclarations ?? 0,
  },
  {
    action: { filters: { deadlineWithinDays: 7 }, target: 'declarations' },
    label: '临期申报',
    value: overview.value?.expiringDeclarations ?? 0,
  },
  { label: '证据链断链', value: overview.value?.evidenceChainBreaks ?? 0 },
]);

function openStatistic(action: OverviewAction | undefined) {
  if (!action) return;
  if (action.target === 'profiles') {
    emit('openProfiles', action.filters);
    return;
  }
  emit('openDeclarations', action.filters);
}

async function refresh() {
  loading.value = true;
  try {
    overview.value = await getEnterpriseWorkspaceOverviewApi();
  } finally {
    loading.value = false;
  }
}

defineExpose({ refresh });
</script>

<template>
  <Card class="enterprise-workspace-overview" :loading="loading" size="small">
    <template #title>企业管理概览</template>
    <div class="enterprise-workspace-overview__stats">
      <component
        v-for="item in statistics"
        :key="item.label"
        :is="item.action ? 'button' : 'div'"
        class="enterprise-workspace-overview__stat"
        :class="{ 'enterprise-workspace-overview__stat--actionable': item.action }"
        :type="item.action ? 'button' : undefined"
        @click="openStatistic(item.action)"
      >
        <Statistic :title="item.label" :value="item.value" />
      </component>
    </div>
  </Card>
</template>

<style scoped>
.enterprise-workspace-overview__stats {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 16px;
}

.enterprise-workspace-overview__stat--actionable {
  cursor: pointer;
}

.enterprise-workspace-overview__stat--actionable {
  min-width: 0;
  padding: 0;
  text-align: left;
  background: transparent;
  border: 0;
}

.enterprise-workspace-overview__stat--actionable:focus-visible {
  outline: 2px solid #1677ff;
  outline-offset: 4px;
}

.enterprise-workspace-overview__stat--actionable :deep(.ant-statistic-content) {
  color: #1677ff;
}

@media (max-width: 1200px) {
  .enterprise-workspace-overview__stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .enterprise-workspace-overview__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
