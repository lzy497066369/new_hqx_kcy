<script setup lang="ts">
import type {
  EnterpriseWorkspaceDeclarationConfiguration,
  EnterpriseWorkspaceDeclarationDetail,
} from '#/api';

import { Empty, Tag } from 'antdv-next';

defineOptions({ name: 'DeclarationMaterialSummary' });

const props = defineProps<{
  configuration: EnterpriseWorkspaceDeclarationConfiguration['material'];
  materialCheck: EnterpriseWorkspaceDeclarationDetail['materialCheck'];
}>();

const statusMeta: Record<string, { color: string; label: string }> = {
  missing: { color: 'red', label: '缺失' },
  partial: { color: 'orange', label: '待补齐' },
  passed: { color: 'green', label: '已满足' },
};

function findCheckItem(item: EnterpriseWorkspaceDeclarationConfiguration['material']['items'][number]) {
  return props.materialCheck?.items.find(
    (check) => check.moduleKey === item.moduleKey && check.tabKey === item.tabKey,
  );
}

function requirementLabel(item: EnterpriseWorkspaceDeclarationConfiguration['material']['items'][number]) {
  const fields = item.requiredFields?.filter(Boolean) ?? [];
  return fields.length ? fields.join('、') : '按材料项要求填写';
}

function getCheckStatus(
  item: EnterpriseWorkspaceDeclarationConfiguration['material']['items'][number],
): { color: string; label: string } {
  return (
    statusMeta[findCheckItem(item)?.checkStatus ?? 'missing'] ?? {
      color: 'red',
      label: '缺失',
    }
  );
}
</script>

<template>
  <Empty v-if="!configuration.items.length" description="当前方案未配置材料要求" />
  <div v-else class="declaration-material-summary">
    <div class="declaration-material-summary__head">
      <div>
        <strong>{{ configuration.preset?.name ?? '方案材料要求' }}</strong>
        <p>{{ configuration.preset?.version ?? '方案内置规则' }}</p>
      </div>
      <Tag :color="materialCheck?.riskLevel === 'low' ? 'green' : 'orange'">
        {{ materialCheck ? `准备度 ${materialCheck.readinessScore}` : '待检查' }}
      </Tag>
    </div>

    <article v-for="item in configuration.items" :key="`${item.moduleKey}-${item.tabKey}`" class="declaration-material-summary__item">
      <div>
        <strong>{{ item.itemName ?? '未命名材料项' }}</strong>
        <p>{{ item.requirementDesc || requirementLabel(item) }}</p>
        <p>数量：至少 {{ item.requiredCount ?? 1 }} 项；附件：{{ item.attachmentRequired === 1 ? '必需' : '按需' }}</p>
      </div>
      <Tag :color="getCheckStatus(item).color">
        {{ getCheckStatus(item).label }}
      </Tag>
    </article>
  </div>
</template>

<style scoped>
.declaration-material-summary {
  display: grid;
  gap: 10px;
}

.declaration-material-summary__head,
.declaration-material-summary__item {
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.declaration-material-summary__item {
  padding: 12px;
  border: 1px solid #e5e7eb;
}

.declaration-material-summary__head p,
.declaration-material-summary__item p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 13px;
}

@media (max-width: 640px) {
  .declaration-material-summary__head,
  .declaration-material-summary__item {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
