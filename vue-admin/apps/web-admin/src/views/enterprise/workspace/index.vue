<script setup lang="ts">
import { Page, ServiceJourneyBoard } from '@vben/common-ui';
import type { JourneyTarget } from '@vben/common-ui';

import { useRouter } from 'vue-router';

import { Card, Empty, Spin, message } from 'antdv-next';

import { reviewEnterpriseWorkspaceDeclarationApi } from '#/api';
import { useEnterpriseContextStore } from '#/store';

import EnterpriseDeclarationList from './components/EnterpriseDeclarationList.vue';
import EnterpriseOperationList from './components/EnterpriseOperationList.vue';
import EnterpriseOverviewHeader from './components/EnterpriseOverviewHeader.vue';
import EnterpriseRiskList from './components/EnterpriseRiskList.vue';
import type { EnterpriseRiskTarget } from './components/enterprise-risk-target';
import { useEnterpriseWorkspace } from './composables/use-enterprise-workspace';
import { getMaterialSectionTarget } from './materials/material-section';

defineOptions({ name: 'EnterpriseWorkspace' });

const {
  backToEnterpriseList,
  enterpriseId,
  loading,
  refresh,
  summary,
  model,
  error,
  detailLoading,
  detailError,
  selectDeclaration,
  refreshDetail,
} = useEnterpriseWorkspace();
const router = useRouter();
const enterpriseContextStore = useEnterpriseContextStore();

async function openProfile() {
  await openMaterialLedger('basic');
}

async function openFinance() {
  await openMaterialLedger('finance');
}

async function openEmployees() {
  await openMaterialLedger('employee');
}
async function openProperties() {
  await openMaterialLedger('intellectual_property');
}

async function openEvidenceChain() {
  if (!summary.value) return;
  await router.push({
    name: 'EnterpriseWorkspaceEvidenceChain',
    params: { enterpriseId: summary.value.profile.id },
  });
}

async function openArchiveRecords() {
  await openMaterialLedger('contract');
}

async function openDeclarations() {
  if (!summary.value) return;
  await router.push({
    name: 'EnterpriseDeclarationList',
    query: { enterpriseId: summary.value.profile.id },
  });
}

async function openMaterialLedger(section: string) {
  if (!summary.value) return;
  enterpriseContextStore.setCurrentEnterprise(summary.value.profile.id);
  await router.push({
    name: 'EnterpriseMaterialSection',
    params: { section },
    query: { enterpriseId: summary.value.profile.id },
  });
}

async function openRiskTarget(target: EnterpriseRiskTarget) {
  if (!summary.value) return;
  if (target.type === 'declarations') {
    if (target.declarationId) {
      await router.push({
        name: 'EnterpriseDeclarationDetail',
        params: {
          declarationId: target.declarationId,
          enterpriseId: summary.value.profile.id,
        },
      });
      return;
    }
    await openDeclarations();
    return;
  }
  enterpriseContextStore.setCurrentEnterprise(summary.value.profile.id);
  if (target.tab)
    enterpriseContextStore.setMaterialLedgerTab(target.section, target.tab);
  await router.push({
    name: 'EnterpriseMaterialSection',
    params: { section: target.section },
    query: { enterpriseId: summary.value.profile.id },
  });
}

async function openTodos() {
  if (!summary.value) return;
  await router.push({
    name: 'EnterpriseWorkspaceTodos',
    params: { enterpriseId: summary.value.profile.id },
  });
}

async function navigateJourney(target: JourneyTarget) {
  if (!summary.value) return;
  if (
    target.declarationId &&
    ['declaration', 'materials', 'review', 'results'].includes(target.stage)
  ) {
    await openRiskTarget({
      type: 'declarations',
      declarationId: target.declarationId,
    });
    return;
  }
  if (target.stage === 'profile') {
    await openMaterialLedger('company');
    return;
  }
  if (target.stage === 'data') {
    const section = getMaterialSectionTarget(target.moduleKey, target.tabKey);
    if (section) {
      await openRiskTarget({ type: 'materials', ...section });
      return;
    }
    await openMaterialLedger('basic');
    return;
  }
  if (['policy', 'declaration', 'materials'].includes(target.stage)) {
    await router.push({
      name: 'EnterpriseWorkspaceDeclarations',
      params: { enterpriseId: enterpriseId.value },
    });
    return;
  }
  await openDeclarations();
}

async function reviewDeclaration(payload: {
  action: 'approve' | 'return';
  declarationId: string;
}) {
  if (!enterpriseId.value) return;
  try {
    await reviewEnterpriseWorkspaceDeclarationApi(
      enterpriseId.value,
      payload.declarationId,
      { action: payload.action },
    );
    message.success(
      payload.action === 'approve' ? '申报已通过审核' : '申报已退回补资料',
    );
    await refresh();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '处理申报审核失败');
  }
}
</script>

<template>
  <Page auto-content-height>
    <Spin :spinning="loading">
      <div v-if="summary" class="enterprise-workspace">
        <EnterpriseOverviewHeader
          :metrics="summary.metrics"
          :profile="summary.profile"
          @back="backToEnterpriseList"
          @manage-profile="openProfile"
          @manage-finance="openFinance"
          @manage-employees="openEmployees"
          @manage-properties="openProperties"
          @manage-evidence-chain="openEvidenceChain"
          @manage-archive-records="openArchiveRecords"
          @manage-declarations="openDeclarations"
          @manage-todos="openTodos"
        />

        <ServiceJourneyBoard
          :model="model"
          :loading="loading"
          :error="error"
          :detail-loading="detailLoading"
          :detail-error="detailError"
          audience="staff"
          @navigate="navigateJourney"
          @select-declaration="selectDeclaration"
          @retry="refresh"
          @retry-detail="refreshDetail"
        />

        <div
          class="enterprise-workspace__grid enterprise-workspace__grid--primary"
        >
          <Card title="风险与待办">
            <EnterpriseRiskList :risks="summary.risks" @open="openRiskTarget" />
          </Card>
        </div>

        <Card title="近期申报">
          <EnterpriseDeclarationList
            :declarations="summary.declarations"
            @review="reviewDeclaration"
          />
        </Card>

        <details class="enterprise-workspace__secondary">
          <summary>查看最近操作</summary>
          <Card title="最近操作">
            <EnterpriseOperationList :operations="summary.recentOperations" />
          </Card>
        </details>
      </div>
      <ServiceJourneyBoard
        v-else-if="loading || error"
        :loading="loading"
        :error="error"
        @retry="refresh"
      />
      <Empty v-else description="未找到可访问的企业工作台" />
    </Spin>
  </Page>
</template>

<style scoped>
.enterprise-workspace {
  display: grid;
  gap: 16px;
}

.enterprise-workspace__grid {
  display: grid;
  gap: 16px;
}

.enterprise-workspace__grid--primary {
  grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.7fr);
}

@media (max-width: 960px) {
  .enterprise-workspace__grid--primary {
    grid-template-columns: 1fr;
  }
}

.enterprise-workspace__secondary {
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--card));
}

.enterprise-workspace__secondary > summary {
  cursor: pointer;
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.enterprise-workspace__secondary > .ant-card {
  border: 0;
  border-top: 1px solid hsl(var(--border));
  border-radius: 0;
}
</style>
