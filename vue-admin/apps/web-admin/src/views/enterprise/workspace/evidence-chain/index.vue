<script setup lang="ts">
import type { EnterpriseEvidenceChain } from '#/api';

import { Page } from '@vben/common-ui';

import { computed, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Card, Empty, Spin, Statistic } from 'antdv-next';

import { getEnterpriseEvidenceChainApi } from '#/api';

import { useEnterpriseContextSync } from '../composables/use-enterprise-context-sync';

import EvidenceChainBreakList from './components/EvidenceChainBreakList.vue';
import EvidenceChainFlow from './components/EvidenceChainFlow.vue';

defineOptions({ name: 'EnterpriseWorkspaceEvidenceChain' });

const route = useRoute();
const router = useRouter();
const evidenceChain = shallowRef<EnterpriseEvidenceChain>();
const loading = shallowRef(false);

const enterpriseId = computed(() => String(route.params.enterpriseId ?? ''));
useEnterpriseContextSync(enterpriseId);

async function load() {
  if (!enterpriseId.value) return;
  loading.value = true;
  try {
    evidenceChain.value = await getEnterpriseEvidenceChainApi(enterpriseId.value);
  } finally {
    loading.value = false;
  }
}

async function openBreak(item: EnterpriseEvidenceChain['breaks'][number]) {
  await router.push({
    name: item.routeName,
    params: { enterpriseId: enterpriseId.value },
  });
}

watch(enterpriseId, () => void load(), { immediate: true });
</script>

<template>
  <Page auto-content-height>
    <Spin :spinning="loading">
      <div v-if="evidenceChain" class="evidence-chain-page">

        <section class="evidence-chain-page__heading">
          <div>
            <h1>研发成果证据链</h1>
            <p>以 IP、RD、PS 和成果转化的有效关联为申报资料提供可追溯依据。</p>
          </div>
          <div class="evidence-chain-page__stats">
            <Statistic title="链路节点" :value="evidenceChain.nodes.length" />
            <Statistic title="已完整节点" :value="evidenceChain.stats.connectedNodeCount" />
            <Statistic title="待补齐断链" :value="evidenceChain.stats.breakCount" />
          </div>
        </section>

        <Card title="RD - IP - PS - 成果转化链路">
          <EvidenceChainFlow :nodes="evidenceChain.nodes" />
        </Card>

        <Card title="待补齐关联">
          <EvidenceChainBreakList :breaks="evidenceChain.breaks" @open="openBreak" />
        </Card>
      </div>
      <Empty v-else-if="!loading" description="未找到企业证据链数据" />
    </Spin>
  </Page>
</template>

<style scoped>
.evidence-chain-page {
  display: grid;
  gap: 16px;
}

.evidence-chain-page__heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 20px 24px;
  background: #fff;
  border: 1px solid #e5e7eb;
}

.evidence-chain-page__heading h1 {
  margin: 0;
  color: #111827;
  font-size: 22px;
  line-height: 1.35;
}

.evidence-chain-page__heading p {
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.5;
}

.evidence-chain-page__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(112px, 1fr));
  gap: 18px;
  min-width: 380px;
}

@media (max-width: 960px) {
  .evidence-chain-page__heading {
    align-items: stretch;
    flex-direction: column;
  }

  .evidence-chain-page__stats {
    min-width: 0;
  }
}

@media (max-width: 640px) {
  .evidence-chain-page__heading {
    padding: 16px;
  }

  .evidence-chain-page__stats {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
