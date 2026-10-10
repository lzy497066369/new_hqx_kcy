<script setup lang="ts">
import { Button, Input, Select } from 'antdv-next';

import type { EnterpriseCardFiltersValue } from './types';

const filters = defineModel<EnterpriseCardFiltersValue>('filters', {
  required: true,
});
const emit = defineEmits<{ reset: []; search: [] }>();

const profileStatusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '待审核', value: 'pending_review' },
  { label: '已通过', value: 'approved' },
  { label: '已驳回', value: 'rejected' },
  { label: '待重提', value: 'need_resubmit' },
];
const completenessOptions = [{ label: '待完善', value: '1' }];
</script>

<template>
  <div class="enterprise-card-filters">
    <Input
      v-model:value="filters.name"
      allow-clear
      placeholder="企业名称"
      @press-enter="emit('search')"
    />
    <Input
      v-model:value="filters.creditCode"
      allow-clear
      placeholder="统一社会信用代码"
      @press-enter="emit('search')"
    />
    <Input
      v-model:value="filters.industry"
      allow-clear
      placeholder="行业"
      @press-enter="emit('search')"
    />
    <Select
      v-model:value="filters.profileStatus"
      allow-clear
      :options="profileStatusOptions"
      placeholder="资料状态"
    />
    <Select
      v-model:value="filters.incomplete"
      allow-clear
      :options="completenessOptions"
      placeholder="资料完整度"
    />
    <Select
      v-model:value="filters.status"
      allow-clear
      :options="[
        { label: '启用', value: 1 },
        { label: '停用', value: 0 },
      ]"
      placeholder="启用状态"
    />
    <Button type="primary" @click="emit('search')">查询</Button>
    <Button @click="emit('reset')">重置</Button>
  </div>
</template>

<style scoped>
.enterprise-card-filters {
  display: grid;
  grid-template-columns: repeat(6, minmax(140px, 1fr)) auto auto;
  gap: 12px;
}

@media (max-width: 1200px) {
  .enterprise-card-filters {
    grid-template-columns: repeat(3, minmax(140px, 1fr));
  }
}

@media (max-width: 640px) {
  .enterprise-card-filters {
    grid-template-columns: 1fr;
  }
}
</style>
