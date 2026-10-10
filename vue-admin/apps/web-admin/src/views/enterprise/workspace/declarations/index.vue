<script setup lang="ts">
import EnterpriseJourneyTrail from '#/views/enterprise/workspace/components/EnterpriseJourneyTrail.vue';

import type {
  EnterpriseWorkspaceCandidateProject,
  EnterpriseWorkspaceDeclaration,
  EnterpriseWorkspaceDeclarationDetail,
} from '#/api';

import { computed, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import {
  Button,
  Card,
  Drawer,
  Empty,
  Progress,
  Spin,
  Table,
  Tag,
} from 'antdv-next';

import {
  getEnterpriseWorkspaceDeclarationDetailApi,
  createEnterpriseWorkspaceDeclarationDraftApi,
  getEnterpriseWorkspaceCandidateProjectsApi,
  getEnterpriseWorkspaceDeclarationsApi,
  reviewEnterpriseWorkspaceDeclarationApi,
  submitEnterpriseWorkspaceDeclarationApi,
} from '#/api';
import {
  showActionFailure,
  showActionSuccess,
} from '../../../system/shared/action-feedback';
import { useEnterpriseContextStore } from '#/store';
import { getDeclarationMaterialTarget } from '../../declarations/declaration-material-link';
import { useEnterpriseContextSync } from '../composables/use-enterprise-context-sync';

defineOptions({ name: 'EnterpriseWorkspaceDeclarations' });

const route = useRoute();
const router = useRouter();
const enterpriseContextStore = useEnterpriseContextStore();
const loading = shallowRef(false);
const detailLoading = shallowRef(false);
const rows = shallowRef<EnterpriseWorkspaceDeclaration[]>([]);
const candidates = shallowRef<EnterpriseWorkspaceCandidateProject[]>([]);
const detail = shallowRef<EnterpriseWorkspaceDeclarationDetail>();
const detailOpen = shallowRef(false);
const enterpriseId = computed(() => String(route.params.enterpriseId ?? ''));
useEnterpriseContextSync(enterpriseId);
const columns = [
  { dataIndex: 'projectName', title: '项目名称' },
  { dataIndex: 'status', title: '状态', width: 110 },
  { dataIndex: 'currentNodeName', title: '当前节点' },
  { dataIndex: 'missingMaterialCount', title: '待补材料', width: 100 },
  { dataIndex: 'updatedAt', title: '更新时间', width: 180 },
  { key: 'actions', title: '操作', width: 180 },
];

async function load() {
  if (!enterpriseId.value) return;
  loading.value = true;
  try {
    const [declarations, projects] = await Promise.all([
      getEnterpriseWorkspaceDeclarationsApi(enterpriseId.value),
      getEnterpriseWorkspaceCandidateProjectsApi(enterpriseId.value),
    ]);
    rows.value = declarations;
    candidates.value = projects;
  } finally {
    loading.value = false;
  }
}

async function createDraft(candidate: EnterpriseWorkspaceCandidateProject) {
  try {
    await createEnterpriseWorkspaceDeclarationDraftApi(
      enterpriseId.value,
      candidate.id,
    );
    showActionSuccess('申报草稿已创建');
    await load();
  } catch (error) {
    showActionFailure(error);
  }
}

async function openDetail(record: EnterpriseWorkspaceDeclaration) {
  detailOpen.value = true;
  detail.value = undefined;
  detailLoading.value = true;
  try {
    detail.value = await getEnterpriseWorkspaceDeclarationDetailApi(
      enterpriseId.value,
      record.id,
    );
  } catch (error) {
    showActionFailure(error);
  } finally {
    detailLoading.value = false;
  }
}

async function review(
  record: EnterpriseWorkspaceDeclaration,
  action: 'approve' | 'return',
) {
  try {
    await reviewEnterpriseWorkspaceDeclarationApi(
      enterpriseId.value,
      record.id,
      { action },
    );
    showActionSuccess(
      action === 'approve' ? '申报已通过审核' : '申报已退回补正',
    );
    await load();
    if (detail.value?.id === record.id) await openDetail(record);
  } catch (error) {
    showActionFailure(error);
  }
}

async function submit(record: EnterpriseWorkspaceDeclaration) {
  try {
    await submitEnterpriseWorkspaceDeclarationApi(
      enterpriseId.value,
      record.id,
    );
    showActionSuccess('申报已提交审核');
    await load();
  } catch (error) {
    showActionFailure(error);
  }
}

function statusColor(status: string) {
  return (
    (
      {
        approved: 'green',
        completed: 'green',
        preparing: 'orange',
        rejected: 'red',
        reviewing: 'blue',
        submitted: 'blue',
      } as Record<string, string>
    )[status] ?? 'default'
  );
}

async function openMaterialDomain(item: {
  moduleKey?: string;
  tabKey?: string;
}) {
  const target = getDeclarationMaterialTarget(item);
  if (!target) return;
  enterpriseContextStore.setCurrentEnterprise(enterpriseId.value);
  if (target.tab)
    enterpriseContextStore.setMaterialLedgerTab(target.section, target.tab);
  await router.push({
    name: 'EnterpriseMaterialSection',
    params: { section: target.section },
  });
}
watch(enterpriseId, () => void load(), { immediate: true });
</script>

<template>
  <Page auto-content-height>
    <EnterpriseJourneyTrail :enterprise-id="enterpriseId" stage="declaration" />

    <Spin :spinning="loading">
      <div class="declaration-page">
        <Card title="企业申报工作台">
          <template #extra
            ><span class="declaration-page__hint"
              >候选项目 {{ candidates.length }} 个</span
            ></template
          >
          <div v-if="candidates.length" class="declaration-page__candidates">
            <article
              v-for="candidate in candidates"
              :key="candidate.id"
              class="declaration-page__candidate"
            >
              <div>
                <strong>{{ candidate.name }}</strong>
                <p>
                  {{ candidate.policyType ?? '政策项目' }} ·
                  {{ candidate.policyCount }} 份匹配政策 · 截止
                  {{ candidate.deadline ?? '-' }}
                </p>
                <p
                  v-if="candidate.qualificationMissing.length"
                  class="declaration-page__warning"
                >
                  前置条件：{{ candidate.qualificationMissing.join('、') }}
                </p>
              </div>
              <Button
                v-if="candidate.canCreate"
                type="primary"
                @click="createDraft(candidate)"
                >创建草稿</Button
              >
              <Button
                v-else-if="candidate.existingDeclarationId"
                @click="
                  openDetail(
                    rows.find(
                      (item) => item.id === candidate.existingDeclarationId,
                    )!,
                  )
                "
                >查看进行中申报</Button
              >
            </article>
          </div>
          <Table
            v-if="rows.length"
            :columns="columns"
            :data-source="rows"
            :pagination="false"
            :row-key="(record: EnterpriseWorkspaceDeclaration) => record.id"
            :scroll="{ x: 920 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'status'"
                ><Tag :color="statusColor(record.status)">{{
                  record.status
                }}</Tag></template
              >
              <template v-else-if="column.key === 'actions'"
                ><Button size="small" type="link" @click="openDetail(record)"
                  >查看准备度</Button
                ><Button
                  v-if="
                    ['draft', 'preparing', 'rejected'].includes(record.status)
                  "
                  size="small"
                  type="link"
                  @click="submit(record)"
                  >提交审核</Button
                ><Button
                  v-if="['reviewing', 'submitted'].includes(record.status)"
                  size="small"
                  type="link"
                  @click="review(record, 'approve')"
                  >通过</Button
                ><Button
                  v-if="['reviewing', 'submitted'].includes(record.status)"
                  danger
                  size="small"
                  type="link"
                  @click="review(record, 'return')"
                  >退回</Button
                ></template
              >
            </template>
          </Table>
          <Empty v-else-if="!loading" description="暂无企业申报记录" />
        </Card>
      </div>
    </Spin>
    <Drawer v-model:open="detailOpen" :width="680" title="申报准备度">
      <Spin :spinning="detailLoading">
        <div v-if="detail" class="declaration-detail">
          <h3>{{ detail.projectName }}</h3>
          <p>当前节点：{{ detail.currentNodeName ?? '-' }}</p>
          <Card v-if="detail.materialCheck" size="small" title="材料准备度">
            <Progress :percent="detail.materialCheck.readinessScore" />
            <p>
              待补材料 {{ detail.materialCheck.missingItems }} 项，风险等级：{{
                detail.materialCheck.riskLevel
              }}
            </p>
            <div class="declaration-detail__items">
              <div
                v-for="(item, index) in detail.materialCheck.items"
                :key="index"
                class="declaration-detail__material"
              >
                <div>
                  <Tag
                    :color="item.checkStatus === 'passed' ? 'green' : 'orange'"
                    >{{ item.checkStatus }}</Tag
                  >{{ item.itemName ?? '未命名材料'
                  }}<span v-if="item.suggestion">：{{ item.suggestion }}</span>
                </div>
                <Button
                  v-if="item.checkStatus !== 'passed' && item.moduleKey"
                  size="small"
                  type="link"
                  @click="openMaterialDomain(item)"
                  >去补资料</Button
                >
              </div>
            </div>
          </Card>
          <Card size="small" title="补正与流程记录"
            ><Empty
              v-if="!detail.flowHistory.length"
              :image="Empty.PRESENTED_IMAGE_SIMPLE"
              description="暂无流程记录"
            />
            <div v-else class="declaration-detail__items">
              <div v-for="(event, index) in detail.flowHistory" :key="index">
                {{ event.from ?? '-' }} → {{ event.to ?? '-' }}：{{
                  event.reason ?? '-'
                }}
              </div>
            </div></Card
          >
        </div>
      </Spin>
    </Drawer>
  </Page>
</template>

<style scoped>
.declaration-page,
.declaration-detail {
  display: grid;
  gap: 16px;
}
.declaration-page__hint {
  color: #6b7280;
  font-size: 13px;
}
.declaration-page__candidates {
  display: grid;
  gap: 10px;
  margin-bottom: 18px;
}
.declaration-page__candidate {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px;
  border: 1px solid #e5e7eb;
}
.declaration-page__candidate p {
  margin: 5px 0 0;
  color: #6b7280;
  font-size: 13px;
}
.declaration-page__warning {
  color: #b45309 !important;
}
.declaration-detail h3,
.declaration-detail p {
  margin: 0;
}
.declaration-detail__items {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}
.declaration-detail__material {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
@media (max-width: 640px) {
  .declaration-page__candidate {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
