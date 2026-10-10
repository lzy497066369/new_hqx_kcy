<script setup lang="ts">
import type { EnterpriseWorkspaceTodo } from '#/api';

import { computed, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { Card, Empty, Spin, Tag } from 'antdv-next';

import { getEnterpriseWorkspaceTodosApi } from '#/api';
import { useEnterpriseContextStore } from '#/store';
import { getEnterpriseActionTarget } from '../enterprise-action-target';
import { useEnterpriseContextSync } from '../composables/use-enterprise-context-sync';

defineOptions({ name: 'EnterpriseWorkspaceTodos' });

const route = useRoute();
const router = useRouter();
const enterpriseContextStore = useEnterpriseContextStore();
const loading = shallowRef(false);
const todos = shallowRef<EnterpriseWorkspaceTodo[]>([]);
const enterpriseId = computed(() => String(route.params.enterpriseId ?? ''));
useEnterpriseContextSync(enterpriseId);

async function load() {
  if (!enterpriseId.value) return;
  loading.value = true;
  try { todos.value = await getEnterpriseWorkspaceTodosApi(enterpriseId.value); }
  finally { loading.value = false; }
}

async function openTodo(todo: EnterpriseWorkspaceTodo) {
  const target = getEnterpriseActionTarget(todo.key);
  if (target?.type === 'declarations') {
    if (target.declarationId) {
      await router.push({
        name: 'EnterpriseDeclarationDetail',
        params: { declarationId: target.declarationId, enterpriseId: enterpriseId.value },
      });
      return;
    }
    await router.push({
      name: 'EnterpriseDeclarationList',
      query: { enterpriseId: enterpriseId.value },
    });
    return;
  }
  if (target?.type === 'materials') {
    enterpriseContextStore.setCurrentEnterprise(enterpriseId.value);
    if (target.tab) enterpriseContextStore.setMaterialLedgerTab(target.section, target.tab);
    await router.push({
      name: 'EnterpriseMaterialSection',
      params: { section: target.section },
    });
    return;
  }
  await router.push({ name: todo.routeName, params: { enterpriseId: enterpriseId.value } });
}

watch(enterpriseId, () => void load(), { immediate: true });
</script>

<template>
  <Page auto-content-height>
    <Spin :spinning="loading">
      <div class="enterprise-todos">
        <Card title="审核与协同待办">
          <div v-if="todos.length" class="enterprise-todos__list">
            <button v-for="todo in todos" :key="todo.key" class="enterprise-todos__item" type="button" @click="openTodo(todo)"><div><div class="enterprise-todos__title"><Tag :color="todo.level === 'high' ? 'red' : todo.level === 'medium' ? 'orange' : 'blue'">{{ todo.level === 'high' ? '高优先级' : '待处理' }}</Tag><strong>{{ todo.title }}</strong></div><p>{{ todo.description }}</p></div><span>处理</span></button>
          </div>
          <Empty v-else-if="!loading" description="当前企业暂无待办" />
        </Card>
      </div>
    </Spin>
  </Page>
</template>

<style scoped>
.enterprise-todos { display: grid; gap: 16px; }
.enterprise-todos__list { display: grid; gap: 10px; }
.enterprise-todos__item { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px; border: 1px solid #e5e7eb; background: #fff; color: #374151; cursor: pointer; text-align: left; }
.enterprise-todos__item:hover { border-color: #93c5fd; }
.enterprise-todos__title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.enterprise-todos__item p { margin: 6px 0 0; color: #6b7280; font-size: 13px; }
.enterprise-todos__item > span { color: #2563eb; font-size: 13px; white-space: nowrap; }
</style>
