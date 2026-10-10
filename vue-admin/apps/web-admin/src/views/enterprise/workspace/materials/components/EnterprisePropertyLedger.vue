<script setup lang="ts">
import type { EnterpriseEvidenceChain } from '#/api';

import { shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';

import { IconifyIcon } from '@vben/icons';
import { Alert, Button, Empty, Spin, TabPane, Tabs } from 'antdv-next';

import {
  clearEnterpriseWorkspacePropertyResearchDataApi,
  getEnterpriseEvidenceChainApi,
} from '#/api';
import { useEnterpriseContextStore } from '#/store';

import {
  confirmAction,
  showActionFailure,
  showActionSuccess,
} from '../../../../system/shared/action-feedback';
import EnterpriseWorkspaceProductServices from '../../product-services/index.vue';
import EnterpriseWorkspaceProperties from '../../properties/index.vue';
import EnterpriseWorkspaceResearch from '../../research/index.vue';
import EnterpriseWorkspaceTransformations from '../../transformations/index.vue';
import EvidenceChainBreakList from '../../evidence-chain/components/EvidenceChainBreakList.vue';
import EvidenceChainFlow from '../../evidence-chain/components/EvidenceChainFlow.vue';

type PropertyLedgerTab = 'evidence' | 'ip' | 'ps' | 'rd' | 'transformation';

interface Props {
  enterpriseId: string;
}

const props = defineProps<Props>();
const route = useRoute();
const enterpriseContextStore = useEnterpriseContextStore();
const activeKey = shallowRef<PropertyLedgerTab>('ip');
const clearVersion = shallowRef(0);
const clearing = shallowRef(false);
const loadingEvidence = shallowRef(false);
const evidenceChain = shallowRef<EnterpriseEvidenceChain>();
const evidenceErrorMessage = shallowRef('');

function tabForBreak(
  item: EnterpriseEvidenceChain['breaks'][number],
): PropertyLedgerTab {
  const tabMap: Record<
    EnterpriseEvidenceChain['breaks'][number]['nodeType'],
    PropertyLedgerTab
  > = {
    intellectual_property: 'ip',
    product_service: 'ps',
    research_project: 'rd',
    transformation: 'transformation',
  };
  return tabMap[item.nodeType];
}

function openBreak(item: EnterpriseEvidenceChain['breaks'][number]) {
  activeKey.value = tabForBreak(item);
}

async function syncLedgerTab(tab: PropertyLedgerTab) {
  if (route.name === 'EnterpriseMaterialSection') {
    enterpriseContextStore.setMaterialLedgerTab('intellectual_property', tab);
  }
}

async function loadEvidenceChain() {
  if (!props.enterpriseId) {
    evidenceChain.value = undefined;
    return;
  }
  loadingEvidence.value = true;
  evidenceErrorMessage.value = '';
  try {
    evidenceChain.value = await getEnterpriseEvidenceChainApi(props.enterpriseId);
  } catch (error) {
    evidenceChain.value = undefined;
    evidenceErrorMessage.value =
      error instanceof Error ? error.message : '证据链数据加载失败';
  } finally {
    loadingEvidence.value = false;
  }
}

async function clearPropertyResearchData() {
  try {
    await confirmAction(
      '将永久删除该企业的知识产权 IP、研发项目 RD、产品服务 PS、成果转化、识别/生成草稿及其来源材料，且不可恢复。确认继续吗？',
      '一键清空研发与知识产权资料',
    );
    clearing.value = true;
    const result = await clearEnterpriseWorkspacePropertyResearchDataApi(props.enterpriseId);
    clearVersion.value += 1;
    await loadEvidenceChain();
    showActionSuccess(
      `已清空 ${result.recordCount} 条资料、${result.draftCount} 条草稿和 ${result.materialCount} 条材料`,
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') return;
    showActionFailure(error);
  } finally {
    clearing.value = false;
  }
}

watch(() => props.enterpriseId, () => void loadEvidenceChain(), { immediate: true });

watch(
  () => enterpriseContextStore.getMaterialLedgerTab('intellectual_property'),
  (tab) => {
    const requestedTab = String(tab ?? '');
    if (['evidence', 'ip', 'ps', 'rd', 'transformation'].includes(requestedTab)) {
      activeKey.value = requestedTab as PropertyLedgerTab;
    }
  },
  { immediate: true },
);

watch(activeKey, (tab) => void syncLedgerTab(tab));
</script>

<template>
  <div class="enterprise-property-ledger">
    <div class="enterprise-property-ledger__actions">
      <Button danger :loading="clearing" @click="clearPropertyResearchData">
        <IconifyIcon icon="lucide:trash-2" class="size-4" />一键清空 IP / RD / PS / 成果转化
      </Button>
    </div>
    <Tabs v-model:active-key="activeKey" class="enterprise-property-ledger__tabs">
      <TabPane key="ip" tab="知识产权 IP"><EnterpriseWorkspaceProperties :key="`properties-${props.enterpriseId}-${clearVersion}`" /></TabPane>
      <TabPane key="transformation" tab="成果转化"><EnterpriseWorkspaceTransformations :key="`transformations-${props.enterpriseId}-${clearVersion}`" /></TabPane>
      <TabPane key="rd" tab="研发项目 RD"><EnterpriseWorkspaceResearch :key="`research-${props.enterpriseId}-${clearVersion}`" /></TabPane>
      <TabPane key="ps" tab="产品服务 PS"><EnterpriseWorkspaceProductServices :key="`products-${props.enterpriseId}-${clearVersion}`" /></TabPane>
      <TabPane key="evidence" tab="完整证据链">
        <Spin :spinning="loadingEvidence">
          <div class="enterprise-property-ledger__evidence-actions">
            <p>查看 IP、RD、PS 到成果转化的关联关系，用于核验研发成果的可追溯性。</p>
          </div>
          <Alert v-if="evidenceErrorMessage" :message="evidenceErrorMessage" show-icon type="warning" />
          <template v-else-if="evidenceChain">
            <section class="enterprise-property-ledger__metrics">
              <div><strong>{{ evidenceChain.stats.intellectualPropertyCount }}</strong><span>IP</span></div>
              <div><strong>{{ evidenceChain.stats.connectedNodeCount }}</strong><span>已关联节点</span></div>
              <div><strong>{{ evidenceChain.stats.breakCount }}</strong><span>待补链路</span></div>
              <div><strong>{{ evidenceChain.stats.transformationCount }}</strong><span>成果转化</span></div>
            </section>
            <section class="enterprise-property-ledger__evidence-section"><h4>IP - RD - PS - 成果转化链路</h4><EvidenceChainFlow :nodes="evidenceChain.nodes" /></section>
            <section class="enterprise-property-ledger__evidence-section"><h4>待补齐关联</h4><EvidenceChainBreakList :breaks="evidenceChain.breaks" @open="openBreak" /></section>
          </template>
          <Empty v-else-if="!loadingEvidence" description="暂无企业证据链数据" />
        </Spin>
      </TabPane>
    </Tabs>
  </div>
</template>

<style scoped>
.enterprise-property-ledger { min-width: 0; }
.enterprise-property-ledger__actions { display: flex; justify-content: flex-end; margin-bottom: 12px; }
.enterprise-property-ledger__tabs :deep(.ant-tabs-nav) { margin-bottom: 16px; }
.enterprise-property-ledger__evidence-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.enterprise-property-ledger__evidence-actions p { margin: 0; color: #6b7280; font-size: 13px; }
.enterprise-property-ledger__metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.enterprise-property-ledger__metrics > div, .enterprise-property-ledger__evidence-section { padding: 16px; background: #fff; border: 1px solid #e5e7eb; }
.enterprise-property-ledger__metrics strong, .enterprise-property-ledger__metrics span { display: block; }
.enterprise-property-ledger__metrics strong { color: #0f172a; font-size: 26px; line-height: 1.1; }
.enterprise-property-ledger__metrics span { margin-top: 6px; color: #64748b; font-size: 13px; }
.enterprise-property-ledger__evidence-section + .enterprise-property-ledger__evidence-section { margin-top: 16px; }
.enterprise-property-ledger__evidence-section h4 { margin: 0 0 14px; color: #1f2937; font-size: 16px; }
@media (max-width: 720px) { .enterprise-property-ledger__evidence-actions { align-items: stretch; flex-direction: column; } .enterprise-property-ledger__metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
