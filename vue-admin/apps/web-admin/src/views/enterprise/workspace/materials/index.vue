<script setup lang="ts">
import EnterpriseJourneyTrail from '#/views/enterprise/workspace/components/EnterpriseJourneyTrail.vue';

import type { EnterpriseProfileItem } from '#/api';

import { computed, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { Alert, Empty, Select, Spin } from 'antdv-next';

import { getEnterpriseProfilesApi } from '#/api';
import { useEnterpriseContextStore } from '#/store';

import EnterpriseAccountLedger from '../archive-records/EnterpriseAccountLedger.vue';
import EnterpriseContractInvoiceLedger from '../archive-records/EnterpriseContractInvoiceLedger.vue';
import EnterpriseDocumentLedger from '../archive-records/EnterpriseDocumentLedger.vue';
import EnterpriseWorkspaceEmployees from '../employees/index.vue';
import EnterpriseWorkspaceFinance from '../finance/index.vue';
import EnterpriseWorkspaceProfile from '../profile/index.vue';
import EnterpriseCertificateGallery from './components/EnterpriseCertificateGallery.vue';
import EnterpriseMaterialCompanyOverview from './components/EnterpriseMaterialCompanyOverview.vue';
import EnterpriseMaterialTemplateCenter from './components/EnterpriseMaterialTemplateCenter.vue';
import EnterprisePhotoGallery from './components/EnterprisePhotoGallery.vue';
import EnterprisePropertyLedger from './components/EnterprisePropertyLedger.vue';
import { resolveMaterialLedgerTab } from './material-ledger-query';
import { resolveMaterialLedgerEnterpriseId } from './material-ledger-enterprise';
import {
  getMaterialSectionConfig,
  type MaterialSectionTarget,
  isMaterialSectionKey,
  type MaterialSectionKey,
  resolveMaterialLedgerSection,
} from './material-section';

defineOptions({ name: 'EnterpriseMaterialLedger' });

const route = useRoute();
const router = useRouter();
const enterpriseContextStore = useEnterpriseContextStore();
const activeModule = shallowRef<MaterialSectionKey>(
  resolveMaterialLedgerSection(
    typeof route.params.section === 'string' ? route.params.section : undefined,
    route.name,
  ),
);
const enterprises = shallowRef<EnterpriseProfileItem[]>([]);
const enterprisesLoaded = shallowRef(false);
const errorMessage = shallowRef('');
const loading = shallowRef(false);

const activeDefinition = computed(() =>
  getMaterialSectionConfig(activeModule.value),
);
const enterpriseId = computed({
  get: () => enterpriseContextStore.currentEnterpriseId,
  set: (nextEnterpriseId) => {
    const enterprise = enterprises.value.find(
      (item) => item.id === nextEnterpriseId,
    );
    enterpriseContextStore.setCurrentEnterprise(
      enterprise
        ? { id: enterprise.id, name: enterprise.name }
        : nextEnterpriseId,
    );
  },
});
const enterpriseOptions = computed(() =>
  enterprises.value.map((item) => ({ label: item.name, value: item.id })),
);
const selectedEnterprise = computed(() =>
  enterprises.value.find((item) => item.id === enterpriseId.value),
);
async function loadEnterprises() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await getEnterpriseProfilesApi({
      page: 1,
      pageSize: 100_000,
    });
    enterprises.value = result.items;
    enterpriseId.value = resolveMaterialLedgerEnterpriseId(
      enterprises.value.map((item) => item.id),
      typeof route.query.enterpriseId === 'string'
        ? route.query.enterpriseId
        : undefined,
      enterpriseContextStore.currentEnterpriseId,
    );
    enterprisesLoaded.value = true;
  } catch (error) {
    enterprises.value = [];
    errorMessage.value =
      error instanceof Error ? error.message : '企业列表加载失败';
  } finally {
    loading.value = false;
  }
}

function selectModule(target: string | MaterialSectionTarget) {
  const nextTarget: MaterialSectionTarget =
    typeof target === 'string'
      ? { section: target as MaterialSectionKey }
      : target;
  if (!isMaterialSectionKey(nextTarget.section)) return;
  activeModule.value = nextTarget.section;
  const definition = getMaterialSectionConfig(nextTarget.section);
  const selectedTab = resolveMaterialLedgerTab(
    nextTarget.section,
    nextTarget.tab ?? definition.archiveTab,
  );
  if (selectedTab) {
    enterpriseContextStore.setMaterialLedgerTab(
      nextTarget.section,
      selectedTab,
    );
  }
  void router.replace({
    path: `/enterprise-material-ledger/${nextTarget.section}`,
    query: {
      ...(enterpriseId.value ? { enterpriseId: enterpriseId.value } : {}),
      ...(selectedTab ? { tab: selectedTab } : {}),
    },
  });
}

function openEnterpriseDeclarations(declarationId?: string) {
  if (declarationId) {
    void router.push({
      name: 'EnterpriseDeclarationDetail',
      params: { declarationId, enterpriseId: enterpriseId.value },
    });
    return;
  }
  void router.push({
    name: 'EnterpriseDeclarationList',
    query: { enterpriseId: enterpriseId.value },
  });
}

watch(
  [() => route.query.enterpriseId, () => route.query.tab, enterprisesLoaded],
  ([queryEnterpriseId, queryTab, loaded]) => {
    if (!loaded) return;
    const routeEnterpriseId =
      typeof queryEnterpriseId === 'string' ? queryEnterpriseId : undefined;
    const nextEnterpriseId = resolveMaterialLedgerEnterpriseId(
      enterprises.value.map((item) => item.id),
      routeEnterpriseId,
      enterpriseContextStore.currentEnterpriseId,
    );
    if (nextEnterpriseId && nextEnterpriseId !== enterpriseId.value) {
      enterpriseId.value = nextEnterpriseId;
    }
    const legacyTab = resolveMaterialLedgerTab(
      activeModule.value,
      typeof queryTab === 'string' ? queryTab : undefined,
    );
    if (legacyTab) {
      enterpriseContextStore.setMaterialLedgerTab(
        activeModule.value,
        legacyTab,
      );
    }
  },
  { immediate: true },
);

watch(
  [() => route.params.section, () => route.name],
  ([section, routeName]) => {
    const sectionParam = typeof section === 'string' ? section : undefined;
    if (sectionParam === 'contacts') {
      void router.replace({
        path: '/enterprise-material-ledger/basic',
        query: route.query,
      });
      return;
    }
    const nextSection = resolveMaterialLedgerSection(sectionParam, routeName);
    if (sectionParam && !isMaterialSectionKey(sectionParam)) {
      void router.replace('/enterprise-material-ledger/company');
      return;
    }
    activeModule.value = nextSection;
  },
  { immediate: true },
);

void loadEnterprises();

watch(enterpriseId, (nextEnterpriseId) => {
  if (!nextEnterpriseId || route.query.enterpriseId === nextEnterpriseId)
    return;
  void router.replace({
    path: route.path,
    query: { ...route.query, enterpriseId: nextEnterpriseId },
  });
});
</script>

<template>
  <Page auto-content-height>
    <EnterpriseJourneyTrail :enterprise-id="enterpriseId ?? ''" stage="data" />

    <Spin :spinning="loading">
      <div class="enterprise-material-ledger">
        <Alert
          v-if="errorMessage"
          :message="errorMessage"
          show-icon
          type="error"
        />
        <section
          v-else-if="selectedEnterprise"
          class="enterprise-material-ledger__content"
        >
          <header class="enterprise-material-ledger__header">
            <div class="enterprise-material-ledger__title">
              <span>企业材料台账</span>
              <h1>{{ activeDefinition.title }}</h1>
            </div>
            <div class="enterprise-material-ledger__actions">
              <Select
                v-model:value="enterpriseId"
                :options="enterpriseOptions"
                class="enterprise-material-ledger__company-select"
                placeholder="切换企业"
              />
            </div>
          </header>

          <Alert
            class="enterprise-material-ledger__ownership-alert"
            :message="`当前企业：${selectedEnterprise.name}。文件识别到企业名称或统一社会信用代码时，将核验是否属于当前企业。`"
            show-icon
            type="info"
          />

          <div class="enterprise-material-ledger__workspace">
            <main class="enterprise-material-ledger__module">
              <EnterpriseMaterialCompanyOverview
                v-if="activeDefinition.view === 'company'"
                :key="`company-${enterpriseId}`"
                :enterprise="selectedEnterprise"
                @open-declarations="openEnterpriseDeclarations"
                @select-section="selectModule"
              />
              <EnterpriseMaterialTemplateCenter
                v-else-if="activeDefinition.view === 'templates'"
                :key="`templates-${enterpriseId}`"
              />
              <EnterpriseWorkspaceProfile
                v-else-if="activeDefinition.view === 'profile'"
                :key="`${activeModule}-${enterpriseId}`"
              />
              <EnterpriseWorkspaceFinance
                v-else-if="activeDefinition.view === 'finance'"
                :key="`finance-${enterpriseId}`"
              />
              <EnterpriseWorkspaceEmployees
                v-else-if="activeDefinition.view === 'employees'"
                :key="`employees-${enterpriseId}`"
              />
              <EnterprisePropertyLedger
                v-else-if="activeDefinition.view === 'properties'"
                :key="`property-ledger-${enterpriseId}`"
                :enterprise-id="enterpriseId!"
              />
              <EnterpriseContractInvoiceLedger
                v-else-if="activeDefinition.view === 'contracts'"
                :key="`contracts-${enterpriseId}`"
              />
              <EnterpriseDocumentLedger
                v-else-if="activeDefinition.view === 'documents'"
                :key="`documents-${enterpriseId}`"
              />
              <EnterpriseAccountLedger
                v-else-if="activeDefinition.view === 'accounts'"
                :key="`accounts-${enterpriseId}`"
              />
              <EnterpriseCertificateGallery
                v-else-if="activeDefinition.view === 'certificates'"
                :key="`certificates-${enterpriseId}`"
              />
              <EnterprisePhotoGallery
                v-else-if="activeDefinition.view === 'photos'"
                :key="`photos-${enterpriseId}`"
              />
              <Empty
                v-else
                :description="`${activeDefinition.title}正在接入后台维护能力`"
              />
            </main>
          </div>
        </section>
        <Empty v-else-if="!loading" description="暂无可见企业" />
      </div>
    </Spin>
  </Page>
</template>

<style scoped>
.enterprise-material-ledger {
  --ledger-border: #e2e8f0;
  --ledger-muted: #64748b;
  display: grid;
}

.enterprise-material-ledger__content {
  min-width: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--ledger-border);
  border-radius: 6px;
}

.enterprise-material-ledger__header,
.enterprise-material-ledger__actions {
  display: flex;
  gap: 12px;
}

.enterprise-material-ledger__header {
  align-items: center;
  justify-content: space-between;
  min-height: 72px;
  padding: 14px 22px;
  background: #f8fafc;
  border-bottom: 1px solid var(--ledger-border);
}

.enterprise-material-ledger__title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.enterprise-material-ledger__title span {
  flex: none;
  padding-right: 10px;
  color: var(--ledger-muted);
  font-size: 13px;
  line-height: 1.25;
  border-right: 1px solid #cbd5e1;
}

.enterprise-material-ledger__header h1 {
  margin: 0;
  overflow: hidden;
  color: #0f172a;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enterprise-material-ledger__company-select {
  width: 280px;
}

.enterprise-material-ledger__workspace {
  min-width: 0;
}

.enterprise-material-ledger__ownership-alert {
  margin: 16px 20px 0;
}

.enterprise-material-ledger__module {
  min-width: 0;
}

.enterprise-material-ledger__content > :deep(.ant-card),
.enterprise-material-ledger__content > :deep(.enterprise-profile-page) {
  margin: 20px;
}

/* Keep every imported client-material view on the same restrained work surface. */
.enterprise-material-ledger__content :deep(.enterprise-finance-page),
.enterprise-material-ledger__content :deep(.enterprise-employees-page),
.enterprise-material-ledger__content :deep(.enterprise-profile-page),
.enterprise-material-ledger__content :deep(.archive-records-page),
.enterprise-material-ledger__content :deep(.enterprise-property-ledger),
.enterprise-material-ledger__content
  :deep(.enterprise-material-template-center),
.enterprise-material-ledger__content :deep(.enterprise-certificate-gallery),
.enterprise-material-ledger__content :deep(.enterprise-photo-gallery),
.enterprise-material-ledger__content
  :deep(.enterprise-material-company-overview) {
  padding: 20px;
}

.enterprise-material-ledger__content :deep(.h-full.p-4) {
  padding: 20px !important;
}

.enterprise-material-ledger__content :deep(.enterprise-finance-page),
.enterprise-material-ledger__content :deep(.enterprise-employees-page),
.enterprise-material-ledger__content :deep(.enterprise-profile-page),
.enterprise-material-ledger__content :deep(.archive-records-page),
.enterprise-material-ledger__content
  :deep(.enterprise-material-template-center),
.enterprise-material-ledger__content :deep(.enterprise-certificate-gallery),
.enterprise-material-ledger__content :deep(.enterprise-photo-gallery),
.enterprise-material-ledger__content
  :deep(.enterprise-material-company-overview) {
  gap: 20px;
}

.enterprise-material-ledger__content :deep(.ant-card) {
  border-color: var(--ledger-border);
  border-radius: 4px;
  box-shadow: none;
}

.enterprise-material-ledger__content :deep(.ant-card-head) {
  min-height: 48px;
  padding: 0 18px;
  background: #f8fafc;
  border-bottom-color: var(--ledger-border);
}

.enterprise-material-ledger__content :deep(.ant-card-head-title) {
  color: #1e293b;
  font-size: 15px;
  font-weight: 600;
}

.enterprise-material-ledger__content :deep(.ant-card-head-wrapper) {
  align-items: center;
  gap: 16px;
}

.enterprise-material-ledger__content :deep(.ant-card-extra) {
  max-width: 100%;
  margin-inline-start: auto;
}

.enterprise-material-ledger__content :deep(.ant-card-body) {
  padding: 18px;
}

.enterprise-material-ledger__content :deep(.ant-form-item) {
  margin-bottom: 16px;
}

.enterprise-material-ledger__content :deep(.ant-form-item-label > label) {
  color: #334155;
  font-size: 13px;
  font-weight: 500;
}

.enterprise-material-ledger__content :deep(.ant-input),
.enterprise-material-ledger__content :deep(.ant-input-affix-wrapper),
.enterprise-material-ledger__content :deep(.ant-select-selector) {
  border-color: #d8e0ea;
  box-shadow: none;
}

.enterprise-material-ledger__content :deep(.ant-table) {
  border: 1px solid var(--ledger-border);
  border-radius: 4px;
  overflow: hidden;
}

.enterprise-material-ledger__content :deep(.ant-table-thead > tr > th) {
  color: var(--ledger-muted);
  font-size: 13px;
  font-weight: 600;
  background: #f8fafc;
}

.enterprise-material-ledger__content :deep(.ant-table-tbody > tr > td) {
  color: #334155;
  vertical-align: middle;
}

.enterprise-material-ledger__content :deep(.ant-tabs-nav) {
  margin: 0 0 16px;
  padding: 0 18px;
  background: #f8fafc;
  border: 1px solid var(--ledger-border);
  border-radius: 4px;
}

.enterprise-material-ledger__content :deep(.ant-tabs-nav::before) {
  border-bottom: 0;
}

.enterprise-material-ledger__content :deep(.ant-tabs-tab) {
  padding: 12px 0;
  color: var(--ledger-muted);
  font-size: 13px;
}

.enterprise-material-ledger__content
  :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  font-weight: 600;
}

.enterprise-material-ledger__content :deep(.enterprise-finance-page__actions),
.enterprise-material-ledger__content
  :deep(.archive-records-page__header-actions),
.enterprise-material-ledger__content :deep(.enterprise-employee-list__actions) {
  justify-content: flex-end;
}

.enterprise-material-ledger__content :deep(.enterprise-employee-list__toolbar),
.enterprise-material-ledger__content :deep(.enterprise-contact-list__toolbar),
.enterprise-material-ledger__content
  :deep(.enterprise-property-ledger__evidence-actions),
.enterprise-material-ledger__content
  :deep(.enterprise-certificate-gallery__toolbar),
.enterprise-material-ledger__content :deep(.enterprise-photo-gallery__toolbar) {
  padding: 12px 14px;
  background: #f8fafc;
  border: 1px solid var(--ledger-border);
  border-radius: 4px;
}

.enterprise-material-ledger__content :deep(.archive-records-page__toolbar) {
  align-items: center;
  margin-bottom: 18px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid var(--ledger-border);
  border-radius: 4px;
}

.enterprise-material-ledger__content
  :deep(.enterprise-employees-page__stats .ant-card) {
  border-top: 3px solid #0f766e;
}

.enterprise-material-ledger__content
  :deep(.enterprise-employees-page__stats .ant-card-body) {
  padding-block: 16px;
}

.enterprise-material-ledger__content
  :deep(.enterprise-employees-page__stats .ant-statistic-title) {
  color: var(--ledger-muted);
  font-size: 13px;
}

.enterprise-material-ledger__content
  :deep(.enterprise-employees-page__stats .ant-statistic-content) {
  color: #0f172a;
  font-size: 28px;
  font-weight: 600;
}

.enterprise-material-ledger__content
  :deep(.enterprise-property-ledger__metrics > div),
.enterprise-material-ledger__content
  :deep(.enterprise-property-ledger__evidence-section),
.enterprise-material-ledger__content
  :deep(.archive-records-page__account-summary > div) {
  border-color: var(--ledger-border);
  border-radius: 4px;
  box-shadow: none;
}

.enterprise-material-ledger__content
  :deep(.enterprise-certificate-gallery__item),
.enterprise-material-ledger__content :deep(.enterprise-photo-gallery__item) {
  border-color: var(--ledger-border);
  border-radius: 4px;
  box-shadow: none;
}

.enterprise-material-ledger__content
  :deep(.enterprise-certificate-gallery__meta),
.enterprise-material-ledger__content :deep(.enterprise-photo-gallery__meta) {
  background: #fff;
}

@media (max-width: 760px) {
  .enterprise-material-ledger__header,
  .enterprise-material-ledger__actions {
    align-items: stretch;
    flex-direction: column;
  }

  .enterprise-material-ledger__header {
    padding: 16px;
  }
  .enterprise-material-ledger__title {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
  .enterprise-material-ledger__title span {
    padding: 0;
    border: 0;
  }
  .enterprise-material-ledger__company-select {
    width: 100%;
  }
  .enterprise-material-ledger__workspace {
    grid-template-columns: 1fr;
  }
  .enterprise-material-ledger__content > :deep(.ant-card),
  .enterprise-material-ledger__content > :deep(.enterprise-profile-page) {
    margin: 14px;
  }
  .enterprise-material-ledger__content :deep(.enterprise-finance-page),
  .enterprise-material-ledger__content :deep(.enterprise-employees-page),
  .enterprise-material-ledger__content :deep(.enterprise-profile-page),
  .enterprise-material-ledger__content :deep(.archive-records-page),
  .enterprise-material-ledger__content :deep(.enterprise-property-ledger),
  .enterprise-material-ledger__content
    :deep(.enterprise-material-template-center),
  .enterprise-material-ledger__content :deep(.enterprise-certificate-gallery),
  .enterprise-material-ledger__content :deep(.enterprise-photo-gallery),
  .enterprise-material-ledger__content
    :deep(.enterprise-material-company-overview),
  .enterprise-material-ledger__content :deep(.h-full.p-4) {
    padding: 14px !important;
  }
  .enterprise-material-ledger__content :deep(.ant-card-body) {
    padding: 14px;
  }
  .enterprise-material-ledger__content :deep(.ant-tabs-nav) {
    padding: 0 14px;
  }
  .enterprise-material-ledger__content :deep(.ant-card-head-wrapper) {
    align-items: flex-start;
    flex-direction: column;
  }
  .enterprise-material-ledger__content :deep(.ant-card-extra) {
    margin-inline-start: 0;
  }
  .enterprise-material-ledger__content :deep(.enterprise-finance-page__actions),
  .enterprise-material-ledger__content
    :deep(.archive-records-page__header-actions),
  .enterprise-material-ledger__content
    :deep(.enterprise-employee-list__actions) {
    justify-content: flex-start;
  }
}
</style>
