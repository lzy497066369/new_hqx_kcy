<script setup lang="ts">
import type { ClientDashboardApi } from '#/api/client';

import { computed, onMounted, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Card, Empty, Skeleton, Tag } from 'antdv-next';

import { useClientDashboardData } from '../../dashboard/composables/use-client-dashboard-data';

defineOptions({ name: 'ClientTasks' });

const router = useRouter();
const route = useRoute();
const dashboard = useClientDashboardData();
const todos = computed(() => dashboard.todos.value);
const isDeclarationTasksPage = computed(() => route.path === '/projects/todos');
const activeCategory = shallowRef<'all' | ClientDashboardApi.TodoItem['category']>(
  isDeclarationTasksPage.value ? 'declaration' : 'all',
);
const activePriority = shallowRef<'all' | ClientDashboardApi.TodoItem['priority']>('all');

const priorityColor: Record<string, string> = {
  high: 'error',
  low: 'default',
  medium: 'warning',
};

const priorityLabel: Record<string, string> = {
  high: '高优先级',
  low: '一般',
  medium: '普通',
};

const categoryLabel: Record<ClientDashboardApi.TodoItem['category'], string> = {
  declaration: '申报项目',
  material: '材料中心',
  profile: '企业资料',
};

const categoryFilters = computed(() => [
  { count: todos.value?.summary.all ?? 0, label: '全部', value: 'all' as const },
  {
    count: todos.value?.summary.profile ?? 0,
    label: '企业资料',
    value: 'profile' as const,
  },
  {
    count: todos.value?.summary.material ?? 0,
    label: '材料中心',
    value: 'material' as const,
  },
  {
    count: todos.value?.summary.declaration ?? 0,
    label: '申报项目',
    value: 'declaration' as const,
  },
]);

const priorityFilters = computed(() => [
  { count: todos.value?.summary.all ?? 0, label: '全部优先级', value: 'all' as const },
  { count: todos.value?.summary.high ?? 0, label: '高优先级', value: 'high' as const },
  {
    count: todos.value?.items.filter((item) => item.priority === 'medium').length ?? 0,
    label: '普通',
    value: 'medium' as const,
  },
  {
    count: todos.value?.items.filter((item) => item.priority === 'low').length ?? 0,
    label: '一般',
    value: 'low' as const,
  },
]);

const filteredItems = computed(() => {
  const priorityWeight: Record<ClientDashboardApi.TodoItem['priority'], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return [...(todos.value?.items ?? [])]
    .filter((item) =>
      activeCategory.value === 'all' ? true : item.category === activeCategory.value,
    )
    .filter((item) =>
      activePriority.value === 'all' ? true : item.priority === activePriority.value,
    )
    .sort((left, right) => {
      const priorityDiff =
        priorityWeight[left.priority] - priorityWeight[right.priority];
      return priorityDiff || left.source.localeCompare(right.source, 'zh-CN');
    });
});

onMounted(() => {
  dashboard.loadTodos();
});

function navTo(path: string) {
  router.push(path).catch(() => {});
}
</script>

<template>
  <Page auto-content-height>
    <div class="client-tasks p-5">
      <Alert
        v-if="dashboard.errorMessage.value"
        class="mb-4"
        show-icon
        type="warning"
        :message="dashboard.errorMessage.value"
      />

      <Skeleton v-if="dashboard.loading.value" active />

      <template v-else-if="todos">
        <section class="client-tasks__head">
          <div>
            <div class="text-sm font-medium text-teal-700">
              {{ isDeclarationTasksPage ? '申报待办' : '待办事项' }}
            </div>
            <h1 class="mt-1 text-2xl font-semibold text-slate-950">
              {{ dashboard.companyName.value }}
            </h1>
            <p class="mt-1 text-sm text-slate-600">
              {{
                isDeclarationTasksPage
                  ? '集中处理申报退回、材料缺失和截止日期临近等事项。'
                  : '汇总企业资料未完善、材料未上传或需修正、申报待完善事项。'
              }}
            </p>
          </div>
        </section>

        <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card variant="borderless">
            <div class="text-sm text-slate-500">全部待办</div>
            <div class="mt-2 text-3xl font-semibold">{{ todos.summary.all }}</div>
          </Card>
          <Card variant="borderless">
            <div class="text-sm text-slate-500">高优先级</div>
            <div class="mt-2 text-3xl font-semibold">{{ todos.summary.high }}</div>
          </Card>
          <Card variant="borderless">
            <div class="text-sm text-slate-500">资料待完善</div>
            <div class="mt-2 text-3xl font-semibold">{{ todos.summary.profile }}</div>
          </Card>
          <Card variant="borderless">
            <div class="text-sm text-slate-500">材料待处理</div>
            <div class="mt-2 text-3xl font-semibold">{{ todos.summary.material }}</div>
          </Card>
          <Card variant="borderless">
            <div class="text-sm text-slate-500">申报待完善</div>
            <div class="mt-2 text-3xl font-semibold">{{ todos.summary.declaration }}</div>
          </Card>
        </div>

        <Card class="mt-5" title="待处理清单" variant="borderless">
          <div class="client-tasks__filters">
            <div class="client-tasks__filter-group">
              <button
                v-for="filter in categoryFilters"
                :key="filter.value"
                class="client-tasks__filter"
                :class="{ 'client-tasks__filter--active': activeCategory === filter.value }"
                type="button"
                @click="activeCategory = filter.value"
              >
                <span>{{ filter.label }}</span>
                <small>{{ filter.count }}</small>
              </button>
            </div>
            <div class="client-tasks__filter-group">
              <button
                v-for="filter in priorityFilters"
                :key="filter.value"
                class="client-tasks__filter"
                :class="{ 'client-tasks__filter--active': activePriority === filter.value }"
                type="button"
                @click="activePriority = filter.value"
              >
                <span>{{ filter.label }}</span>
                <small>{{ filter.count }}</small>
              </button>
            </div>
          </div>

          <Empty v-if="todos.items.length === 0" description="暂无待办事项" />
          <Empty
            v-else-if="filteredItems.length === 0"
            class="mt-4"
            description="当前筛选条件下暂无待办"
          />
          <div v-else class="space-y-3">
            <button
              v-for="todo in filteredItems"
              :key="todo.key"
              class="client-tasks__item"
              type="button"
              @click="navTo(todo.routePath)"
            >
              <div class="min-w-0 flex-1 text-left">
                <div class="flex flex-wrap items-center gap-2">
                  <Tag :color="priorityColor[todo.priority]">
                    {{ priorityLabel[todo.priority] }}
                  </Tag>
                  <Tag color="blue">{{ categoryLabel[todo.category] || todo.source }}</Tag>
                  <span class="font-medium text-slate-900">{{ todo.title }}</span>
                </div>
                <div class="mt-2 text-sm text-slate-500">
                  {{ todo.description }}
                </div>
                <div
                  v-if="todo.priorityReason"
                  class="mt-2 text-xs text-slate-400"
                >
                  {{ todo.priorityReason }}
                </div>
              </div>
              <span class="text-sm font-medium text-teal-700">
                {{ todo.actionText }}
              </span>
            </button>
          </div>
        </Card>
      </template>
    </div>
  </Page>
</template>

<style scoped>
.client-tasks {
  min-height: 100%;
  background: linear-gradient(180deg, rgb(248 250 252) 0%, rgb(241 245 249) 100%);
}

.client-tasks__head,
.client-tasks__item {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: #fff;
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
}

.client-tasks__item {
  width: 100%;
  padding: 14px;
}

.client-tasks__filters {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.client-tasks__filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.client-tasks__filter {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-height: 34px;
  padding: 6px 12px;
  font-size: 14px;
  color: rgb(71 85 105);
  background: rgb(248 250 252);
  border: 1px solid rgb(226 232 240);
  border-radius: 8px;
}

.client-tasks__filter small {
  min-width: 22px;
  padding: 1px 7px;
  font-size: 12px;
  line-height: 18px;
  color: rgb(15 118 110);
  text-align: center;
  background: rgb(204 251 241);
  border-radius: 999px;
}

.client-tasks__filter--active {
  color: rgb(15 118 110);
  background: rgb(240 253 250);
  border-color: rgb(20 184 166 / 55%);
}

.client-tasks__item:hover {
  border-color: rgb(20 184 166 / 45%);
  box-shadow: 0 10px 26px rgb(15 23 42 / 8%);
}

@media (max-width: 640px) {
  .client-tasks__head,
  .client-tasks__item {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
