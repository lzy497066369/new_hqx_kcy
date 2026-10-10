<script setup lang="ts">
import type { EnterpriseProfileItem } from '#/api';

import { Empty, Pagination, Spin } from 'antdv-next';

import EnterpriseCardItem from './EnterpriseCardItem.vue';

const props = defineProps<{
  items: EnterpriseProfileItem[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
}>();
const emit = defineEmits<{
  accounts: [EnterpriseProfileItem];
  changePage: [page: number, pageSize: number];
  detail: [EnterpriseProfileItem];
  declarations: [EnterpriseProfileItem];
  edit: [EnterpriseProfileItem];
}>();
</script>

<template>
  <Spin :spinning="props.loading">
    <Empty
      v-if="!props.loading && props.items.length === 0"
      description="暂无可见企业"
    />
    <div v-else class="enterprise-card-list">
      <EnterpriseCardItem
        v-for="item in props.items"
        :key="item.id"
        :item="item"
        @accounts="emit('accounts', $event)"
        @detail="emit('detail', $event)"
        @declarations="emit('declarations', $event)"
        @edit="emit('edit', $event)"
      />
    </div>
    <div v-if="props.total" class="enterprise-card-list__pagination">
      <Pagination
        :current="props.page"
        :page-size="props.pageSize"
        :total="props.total"
        show-size-changer
        @change="(page, pageSize) => emit('changePage', page, pageSize)"
      />
    </div>
  </Spin>
</template>

<style scoped>
.enterprise-card-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
  gap: 16px;
}

.enterprise-card-list__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
