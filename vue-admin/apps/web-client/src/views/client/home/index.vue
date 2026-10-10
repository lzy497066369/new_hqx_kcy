<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { Page, ServiceJourneyBoard } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Alert, Button, Empty, Skeleton } from 'antdv-next';

import { useClientEnterpriseStore } from '#/store';

import { useClientJourney } from './composables/use-client-journey';

defineOptions({ name: 'ClientHome' });

const router = useRouter();
const store = useClientEnterpriseStore();
const journey = useClientJourney();

const currentCompanySubtitle = computed(() => {
  const company = store.currentCompany;
  if (!company) {
    return '当前账号暂未绑定企业';
  }

  return company.shortName || company.creditCode || '企业上下文已就绪';
});

onMounted(() => {
  if (!store.initialized) {
    store.refreshContext().catch(() => {});
  }
});

function goToCompanySwitch() {
  void router.push({ name: 'ClientCompanySwitch' });
}
</script>

<template>
  <Page auto-content-height>
    <div class="client-home">
      <Alert
        v-if="store.errorMessage"
        show-icon
        type="warning"
        :message="store.errorMessage"
      />

      <Skeleton v-if="store.loading && !store.initialized" active />

      <template v-else>
        <header class="client-home__header">
          <div>
            <span class="client-home__eyebrow">企业申报工作区</span>
            <h1>申报工作台</h1>
            <p>按六个步骤完成企业资料、材料和申报结果归档。</p>
          </div>
          <div class="client-home__actions">
            <Button @click="goToCompanySwitch">
              <IconifyIcon icon="lucide:repeat-2" class="size-4" />
              切换企业
            </Button>
          </div>
        </header>

        <section class="client-home__company">
          <div class="client-home__company-icon"><IconifyIcon icon="lucide:building-2" /></div>
          <div class="client-home__company-copy">
            <span>当前企业</span>
            <strong>{{ store.currentCompanyName || '未选择企业' }}</strong>
            <small>{{ currentCompanySubtitle }}</small>
          </div>
          <span class="client-home__scope"><IconifyIcon icon="lucide:lock-keyhole" />仅限当前企业</span>
        </section>

        <section v-if="!store.hasCompanies" class="client-home__empty">
          <Empty description="当前账号还没有可访问企业" />
          <Button type="primary" @click="goToCompanySwitch">查看企业绑定</Button>
        </section>

        <template v-else>
          <ServiceJourneyBoard
            :model="journey.model.value"
            :loading="journey.loading.value"
            :error="journey.error.value"
            :detail-loading="journey.detailLoading.value"
            :detail-error="journey.detailError.value"
            audience="enterprise"
            @navigate="journey.navigate"
            @select-declaration="journey.selectDeclaration"
            @retry="journey.refresh"
            @retry-detail="journey.refreshDetail"
          />
        </template>
      </template>
    </div>
  </Page>
</template>

<style scoped>
.client-home { display: grid; gap: 20px; max-width: 1440px; margin: 0 auto; padding: 28px 32px 40px; }
.client-home__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.client-home__eyebrow { color: #667085; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.client-home h1 { margin: 7px 0 8px; color: #101828; font-size: 30px; line-height: 1.2; }
.client-home__header p { margin: 0; color: #667085; font-size: 15px; }
.client-home__actions { display: flex; flex-wrap: wrap; gap: 10px; }
.client-home__company { display: flex; align-items: center; gap: 14px; padding: 18px 20px; border: 1px solid #eaecf0; border-radius: 10px; background: #fff; }
.client-home__company-icon { display: grid; place-items: center; width: 40px; height: 40px; flex: 0 0 40px; border-radius: 9px; color: #2563eb; background: #eff6ff; font-size: 19px; }
.client-home__company-copy { display: grid; gap: 4px; min-width: 0; }
.client-home__company-copy span, .client-home__company-copy small { color: #667085; font-size: 12px; }
.client-home__company-copy strong { overflow: hidden; color: #101828; font-size: 18px; text-overflow: ellipsis; white-space: nowrap; }
.client-home__scope { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; color: #667085; font-size: 12px; white-space: nowrap; }
.client-home__empty { display: grid; justify-items: center; gap: 10px; padding: 56px 24px; border: 1px dashed #d0d5dd; border-radius: 10px; background: #fff; }
.client-home :deep(.service-journey-board) { margin-top: 0; }
@media (max-width: 760px) {
  .client-home { padding: 20px 16px 32px; }
  .client-home__header { flex-direction: column; }
  .client-home__company { align-items: flex-start; }
  .client-home__scope { margin-left: 0; }
}
</style>
