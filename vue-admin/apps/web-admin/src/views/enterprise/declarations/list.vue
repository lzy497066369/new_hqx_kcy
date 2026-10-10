<script setup lang="ts">
import type {
  EnterpriseDeclarationLedgerItem,
  EnterpriseProfileItem,
  EnterpriseWorkspaceCandidateProject,
} from '#/api';

import { computed, onMounted, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Pagination,
  Select,
  Spin,
  Table,
  Tag,
} from 'antdv-next';

import {
  createEnterpriseWorkspaceDeclarationDraftApi,
  getEnterpriseDeclarationLedgerApi,
  getEnterpriseProfilesApi,
  getEnterpriseWorkspaceCandidateProjectsApi,
} from '#/api';
import { useEnterpriseContextStore } from '#/store';
import {
  showActionFailure,
  showActionSuccess,
} from '../../system/shared/action-feedback';
import {
  buildDeclarationListQuery,
  parseDeclarationListQuery,
} from './declaration-list-query';

defineOptions({ name: 'EnterpriseDeclarationList' });

const route = useRoute();
const router = useRouter();
const enterpriseContextStore = useEnterpriseContextStore();
const enterprises = shallowRef<EnterpriseProfileItem[]>([]);
const items = shallowRef<EnterpriseDeclarationLedgerItem[]>([]);
const loading = shallowRef(false);
const createDeclarationOpen = shallowRef(false);
const createEnterpriseId = shallowRef<string>();
const createProjectId = shallowRef<string>();
const candidateLoading = shallowRef(false);
const creatingDeclaration = shallowRef(false);
const candidateProjects = shallowRef<EnterpriseWorkspaceCandidateProject[]>([]);
const routeQuery = parseDeclarationListQuery(route.query);
const query = shallowRef({
  deadlineWithinDays: routeQuery.deadlineWithinDays,
  enterpriseId: routeQuery.enterpriseId,
  keyword: routeQuery.keyword ?? '',
  missingMaterials: routeQuery.missingMaterials ? '1' : undefined,
  status: routeQuery.status,
});
const page = shallowRef(routeQuery.page);
const pageSize = shallowRef(routeQuery.pageSize);
const total = shallowRef(0);
const enterpriseOptions = computed(() =>
  enterprises.value.map((item) => ({ label: item.name, value: item.id })),
);
const hasCandidateProjects = computed(() => candidateProjects.value.length > 0);
const hasCreatableCandidateProjects = computed(() =>
  candidateProjects.value.some((item) => item.canCreate),
);
const createProjectEmptyDescription = computed(() => {
  if (!createEnterpriseId.value) return '选择企业后将自动加载可申报项目';
  return '暂无已启用的申报项目';
});
const candidateOptions = computed(() =>
  candidateProjects.value.map((item) => ({
    disabled: !item.canCreate,
    label: item.canCreate ? item.name : `${item.name}（${candidateProjectReason(item)}）`,
    value: item.id,
  })),
);
const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '准备中', value: 'preparing' },
  { label: '审核中', value: 'reviewing' },
  { label: '已提交', value: 'submitted' },
  { label: '已通过', value: 'approved' },
  { label: '已退回', value: 'rejected' },
];
const materialOptions = [{ label: '仅待补材料', value: '1' }];
const deadlineOptions = [
  { label: '未来 7 天截止', value: 7 },
  { label: '未来 30 天截止', value: 30 },
];

const columns = [
  { dataIndex: 'enterpriseName', key: 'enterpriseName', title: '企业', width: 220 },
  { dataIndex: 'projectName', key: 'projectName', title: '申报项目', minWidth: 220 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 110 },
  { dataIndex: 'currentNodeName', key: 'currentNodeName', title: '当前节点', width: 150 },
  { dataIndex: 'missingMaterialCount', key: 'missingMaterialCount', title: '待补材料', width: 100 },
  { dataIndex: 'deadline', key: 'deadline', title: '截止日期', width: 130 },
  { key: 'actions', title: '操作', width: 100 },
];

function formatDate(value: Date | string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('zh-CN');
}

function statusColor(status: string) {
  return (
    ({ approved: 'green', completed: 'green', preparing: 'orange', rejected: 'red', reviewing: 'blue', submitted: 'blue' } as Record<string, string>)[status] ?? 'default'
  );
}

function statusLabel(status: string) {
  return (
    ({ approved: '已通过', completed: '已完成', draft: '草稿', preparing: '准备中', rejected: '已退回', reviewing: '审核中', submitted: '已提交' } as Record<string, string>)[status] ?? status
  );
}

function candidateProjectReason(item: EnterpriseWorkspaceCandidateProject) {
  if (item.canCreate) return '可创建';
  if (item.existingDeclarationId) return '已有进行中申报';
  if (item.qualificationMissing.length > 0) {
    return `前置条件待补齐：${item.qualificationMissing.join('、')}`;
  }
  return '暂不可创建';
}

function candidateProjectColor(item: EnterpriseWorkspaceCandidateProject) {
  if (item.canCreate) return 'green';
  if (item.existingDeclarationId) return 'orange';
  if (item.qualificationMissing.length > 0) return 'red';
  return 'default';
}

function syncEnterpriseContext(enterpriseId?: string) {
  if (!enterpriseId) return;
  enterpriseContextStore.setCurrentEnterprise({
    id: enterpriseId,
    name: enterprises.value.find((item) => item.id === enterpriseId)?.name,
  });
}

async function load() {
  loading.value = true;
  try {
    const result = await getEnterpriseDeclarationLedgerApi({
      ...query.value,
      keyword: query.value.keyword || undefined,
      missingMaterials: query.value.missingMaterials === '1',
      page: page.value,
      pageSize: pageSize.value,
    });
    items.value = result.items;
    total.value = result.total;
  } catch (error) {
    showActionFailure(error);
  } finally {
    loading.value = false;
  }
}

function search() {
  page.value = 1;
  void syncRouteQuery();
}

async function syncRouteQuery() {
  await router.replace({
    name: 'EnterpriseDeclarationList',
    query: buildDeclarationListQuery({
      ...query.value,
      missingMaterials: query.value.missingMaterials === '1',
      page: page.value,
      pageSize: pageSize.value,
    }),
  });
}

async function syncFromRouteQuery() {
  const nextQuery = parseDeclarationListQuery(route.query);
  query.value = {
    deadlineWithinDays: nextQuery.deadlineWithinDays,
    enterpriseId: nextQuery.enterpriseId,
    keyword: nextQuery.keyword ?? '',
    missingMaterials: nextQuery.missingMaterials ? '1' : undefined,
    status: nextQuery.status,
  };
  page.value = nextQuery.page;
  pageSize.value = nextQuery.pageSize;
  await load();
}

async function changeEnterprise(value: unknown) {
  const enterpriseId = typeof value === 'string' ? value : undefined;
  if (query.value.enterpriseId === enterpriseId) return;
  query.value = { ...query.value, enterpriseId };
  page.value = 1;
  await syncRouteQuery();
}

async function reset() {
  query.value = {
    deadlineWithinDays: undefined,
    enterpriseId: undefined,
    keyword: '',
    missingMaterials: undefined,
    status: undefined,
  };
  page.value = 1;
  pageSize.value = 20;
  await syncRouteQuery();
}

function changePage(nextPage: number, nextPageSize: number) {
  page.value = nextPage;
  pageSize.value = nextPageSize;
  void syncRouteQuery();
}

async function openDetail(record: EnterpriseDeclarationLedgerItem) {
  enterpriseContextStore.setCurrentEnterprise({
    id: record.enterpriseId,
    name: record.enterpriseName,
  });
  await router.push({
    name: 'EnterpriseDeclarationDetail',
    params: { enterpriseId: record.enterpriseId, declarationId: record.id },
    query: buildDeclarationListQuery({
      ...query.value,
      missingMaterials: query.value.missingMaterials === '1',
      page: page.value,
      pageSize: pageSize.value,
    }),
  });
}

async function openCreateDeclaration() {
  createEnterpriseId.value = query.value.enterpriseId;
  createProjectId.value = undefined;
  candidateProjects.value = [];
  createDeclarationOpen.value = true;
  if (createEnterpriseId.value) {
    await loadCreateCandidates(createEnterpriseId.value);
  }
}

async function submitCreateDeclaration() {
  const enterpriseId = createEnterpriseId.value;
  if (!enterpriseId) {
    showActionFailure(new Error('请选择企业'));
    return;
  }

  const projectId = createProjectId.value;
  if (!projectId) {
    showActionFailure(new Error('请选择申报项目'));
    return;
  }

  creatingDeclaration.value = true;
  try {
    await createEnterpriseWorkspaceDeclarationDraftApi(enterpriseId, projectId);
    showActionSuccess('申报草稿已创建');
    createDeclarationOpen.value = false;
    syncEnterpriseContext(enterpriseId);
    query.value = { ...query.value, enterpriseId };
    page.value = 1;
    await syncRouteQuery();
    await load();
  } catch (error) {
    showActionFailure(error);
  } finally {
    creatingDeclaration.value = false;
  }
}

async function changeCreateEnterprise(value: unknown) {
  const enterpriseId = typeof value === 'string' ? value : undefined;
  createEnterpriseId.value = enterpriseId;
  createProjectId.value = undefined;
  candidateProjects.value = [];
  if (enterpriseId) {
    await loadCreateCandidates(enterpriseId);
  }
}

async function loadCreateCandidates(enterpriseId: string) {
  candidateLoading.value = true;
  try {
    candidateProjects.value =
      await getEnterpriseWorkspaceCandidateProjectsApi(enterpriseId);
  } catch (error) {
    showActionFailure(error);
  } finally {
    candidateLoading.value = false;
  }
}

function closeCreateDeclaration() {
  createDeclarationOpen.value = false;
  createEnterpriseId.value = undefined;
  createProjectId.value = undefined;
  candidateProjects.value = [];
}

onMounted(async () => {
  try {
    enterprises.value = (
      await getEnterpriseProfilesApi({ page: 1, pageSize: 100_000 })
    ).items;
    syncEnterpriseContext(query.value.enterpriseId);
  } catch (error) {
    showActionFailure(error);
  }
  await load();
});

watch(() => route.query, () => void syncFromRouteQuery());
watch(
  () => query.value.enterpriseId,
  (enterpriseId) => {
    syncEnterpriseContext(enterpriseId);
  },
  { immediate: true },
);
</script>

<template>
  <Page auto-content-height>
    <Modal
      v-model:open="createDeclarationOpen"
      :confirm-loading="creatingDeclaration"
      ok-text="创建草稿"
      title="添加申报"
      width="min(760px, calc(100vw - 32px))"
      @cancel="closeCreateDeclaration"
      @ok="submitCreateDeclaration"
    >
      <div class="declaration-create-modal">
        <label>
          <span>企业</span>
          <Select
            :value="createEnterpriseId"
            class="w-full"
            option-filter-prop="label"
            :options="enterpriseOptions"
            placeholder="请选择企业"
            allow-clear
            show-search
            @update:value="changeCreateEnterprise"
          />
        </label>
        <label>
          <span>申报项目</span>
          <Spin :spinning="candidateLoading">
            <Select
              v-model:value="createProjectId"
              class="w-full"
              :disabled="!createEnterpriseId"
              option-filter-prop="label"
              :options="candidateOptions"
              placeholder="请选择申报项目"
              show-search
            />
            <Empty
              v-if="!candidateLoading && !hasCandidateProjects"
              :image="Empty.PRESENTED_IMAGE_SIMPLE"
              :description="createProjectEmptyDescription"
            />
            <Alert
              v-else-if="hasCandidateProjects && !hasCreatableCandidateProjects"
              class="declaration-create-modal__alert"
              message="当前项目暂不可创建，可查看下方原因。"
              show-icon
              type="warning"
            />
            <div
              v-if="hasCandidateProjects"
              class="declaration-create-modal__candidates"
            >
              <div
                v-for="project in candidateProjects"
                :key="project.id"
                class="declaration-create-modal__candidate"
              >
                <span>{{ project.name }}</span>
                <Tag :color="candidateProjectColor(project)">
                  {{ candidateProjectReason(project) }}
                </Tag>
              </div>
            </div>
          </Spin>
        </label>
      </div>
    </Modal>
    <Card>
      <template #title>申报列表</template>
      <template #extra>
        <Button type="primary" @click="openCreateDeclaration">
          <Plus class="size-4" />
          添加申报
        </Button>
      </template>
      <div class="declaration-list__filters">
        <Select :value="query.enterpriseId" allow-clear :options="enterpriseOptions" placeholder="全部企业" @update:value="changeEnterprise" />
        <Select v-model:value="query.status" allow-clear :options="statusOptions" placeholder="全部状态" />
        <Select v-model:value="query.missingMaterials" allow-clear :options="materialOptions" placeholder="材料状态" />
        <Select v-model:value="query.deadlineWithinDays" allow-clear :options="deadlineOptions" placeholder="截止时间" />
        <Input v-model:value="query.keyword" allow-clear placeholder="搜索企业、项目或申报编号" @press-enter="search" />
        <Button type="primary" @click="search">查询</Button>
        <Button @click="reset">重置</Button>
      </div>
      <div v-if="query.enterpriseId" class="declaration-list__scope">
        当前仅展示所选企业的申报记录
      </div>
      <Spin :spinning="loading">
        <Empty v-if="!loading && !items.length" description="暂无申报记录" />
        <Table
          v-else
          :columns="columns"
          :data-source="items"
          :pagination="false"
          :row-key="(item: EnterpriseDeclarationLedgerItem) => item.id"
          :scroll="{ x: 1030 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'"><Tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</Tag></template>
            <template v-else-if="column.key === 'deadline'">{{ formatDate(record.deadline) }}</template>
            <template v-else-if="column.key === 'actions'"><Button size="small" type="link" @click="openDetail(record)">查看详情</Button></template>
          </template>
        </Table>
      </Spin>
      <div v-if="total" class="declaration-list__pagination">
        <Pagination :current="page" :page-size="pageSize" :total="total" show-size-changer @change="changePage" />
      </div>
    </Card>
  </Page>
</template>

<style scoped>
.declaration-create-modal { display: grid; gap: 16px; }
.declaration-create-modal__alert { margin-top: 12px; }
.declaration-create-modal__candidate { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
.declaration-create-modal__candidate > span { flex: 0 0 180px; }
.declaration-create-modal__candidate :deep(.ant-tag) { flex: 1; margin-inline-end: 0; white-space: normal; }
.declaration-create-modal__candidate:last-child { border-bottom: 0; }
.declaration-create-modal__candidates { margin-top: 12px; padding: 4px 12px; border: 1px solid #eef2f7; border-radius: 6px; background: #fafafa; }
.declaration-create-modal label { display: grid; gap: 8px; color: #4b5563; font-size: 13px; }
.declaration-list__filters { display: grid; grid-template-columns: 260px repeat(3, 160px) minmax(240px, 1fr) auto auto; gap: 12px; margin-bottom: 16px; }
.declaration-list__pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.declaration-list__scope { margin: -4px 0 12px; color: #64748b; font-size: 13px; }
@media (max-width: 900px) { .declaration-list__filters { grid-template-columns: 1fr; } }
</style>
