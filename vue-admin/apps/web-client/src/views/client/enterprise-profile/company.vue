<script setup lang="ts">
import type {
  ClientEnterpriseApi,
  ClientEnterpriseProfileStatApi,
} from '#/api/client';

import { computed, onMounted, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Alert, Button, Empty, Skeleton } from 'antdv-next';

import {
  getClientEnterpriseBasicProfileApi,
  getClientEnterpriseProfileStatsApi,
} from '#/api/client';
import { useClientEnterpriseStore } from '#/store';

import EnterpriseProfileOverview from './components/EnterpriseProfileOverview.vue';
import {
  getEnterpriseBasicCompleteness,
  mapEnterpriseProfileToBasicProfile,
} from './basic/profile-helpers';

defineOptions({ name: 'ClientEnterpriseProfileCompany' });

const router = useRouter();
const store = useClientEnterpriseStore();
const profileStat = shallowRef<ClientEnterpriseProfileStatApi.Stat | null>(
  null,
);
const remoteBasicProfile =
  shallowRef<ClientEnterpriseApi.ClientEnterpriseBasicProfile | null>(null);
const basicProfileErrorMessage = shallowRef('');
const basicProfileLoading = shallowRef(false);
const statsErrorMessage = shallowRef('');
const statsLoading = shallowRef(false);

const profileStatusMap: Record<string, { color: string; label: string }> = {
  checking: { color: 'processing', label: '审核中' },
  draft: { color: 'default', label: '待完善' },
  invalid: { color: 'warning', label: '待补正' },
  valid: { color: 'success', label: '已通过' },
};

const companyStatus = computed(() => {
  if (!store.currentCompany) {
    return { color: 'default', label: '未选择企业' };
  }

  return store.currentCompany.status === 1
    ? { color: 'success', label: '正常' }
    : { color: 'error', label: '停用' };
});

const profileStatus = computed(() => {
  const status = store.enterpriseProfile?.profileStatus ?? 'draft';

  return (
    profileStatusMap[status] ?? {
      color: 'default',
      label: status || '待完善',
    }
  );
});

const basicProfile = computed<ClientEnterpriseApi.ClientEnterpriseBasicProfile>(
  () =>
    remoteBasicProfile.value ??
    mapEnterpriseProfileToBasicProfile(store.enterpriseProfile),
);

const completeness = computed(() =>
  getEnterpriseBasicCompleteness(basicProfile.value),
);

onMounted(async () => {
  if (!store.initialized) {
    await store.refreshContext().catch(() => {});
  } else {
    await store.refreshEnterpriseProfile().catch(() => {});
  }
  await Promise.all([loadBasicProfile(), loadProfileStats()]);
});

watch(
  () => store.currentCompanyId,
  async (companyId, previousCompanyId) => {
    if (companyId === previousCompanyId) {
      return;
    }

    await Promise.all([loadBasicProfile(), loadProfileStats()]);
  },
);

async function loadBasicProfile() {
  if (!store.currentCompany) {
    remoteBasicProfile.value = null;
    basicProfileErrorMessage.value = '';
    return;
  }

  basicProfileLoading.value = true;
  basicProfileErrorMessage.value = '';

  try {
    remoteBasicProfile.value = await getClientEnterpriseBasicProfileApi();
  } catch (error) {
    remoteBasicProfile.value = null;
    basicProfileErrorMessage.value =
      error instanceof Error ? error.message : '基础资料加载失败';
  } finally {
    basicProfileLoading.value = false;
  }
}

async function loadProfileStats() {
  if (!store.currentCompany) {
    profileStat.value = null;
    statsErrorMessage.value = '';
    return;
  }

  statsLoading.value = true;
  statsErrorMessage.value = '';
  try {
    profileStat.value = await getClientEnterpriseProfileStatsApi();
  } catch (error) {
    statsErrorMessage.value =
      error instanceof Error ? error.message : '企业资料统计加载失败';
  } finally {
    statsLoading.value = false;
  }
}
</script>

<template>
  <Page auto-content-height>
    <div class="space-y-5 p-5">
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div><h1 class="text-2xl font-semibold">企业总览</h1><p class="mt-2 text-foreground/60">查看已分发给您的企业，完善资料并办理申报。</p></div>
        <div class="flex gap-2">
          <Button v-if="store.hasCompanies" @click="router.push({ name: 'ClientCompanySwitch' })"><IconifyIcon icon="lucide:repeat-2" />切换企业</Button>
        </div>
      </header>
      <Alert
        v-if="
          store.errorMessage || statsErrorMessage || basicProfileErrorMessage
        "
        show-icon
        type="warning"
        :message="
          store.errorMessage || statsErrorMessage || basicProfileErrorMessage
        "
      />

      <Skeleton v-if="store.loading && !store.initialized" active />

      <Empty v-else-if="!store.currentCompany" :description="store.hasCompanies ? '请先选择当前企业' : '暂无分发的企业，请联系总负责人'">
        <Button
          v-if="store.hasCompanies"
          type="primary"
          @click="router.push({ name: 'ClientCompanySwitch' })"
        >
          <IconifyIcon icon="lucide:repeat-2" class="size-4" />
          去切换企业
        </Button>
      </Empty>

      <EnterpriseProfileOverview
        v-else
        :basic-profile="basicProfile"
        :company-credit-code="store.currentCompany?.creditCode || ''"
        :company-name="store.currentCompanyName"
        :company-status="companyStatus"
        :completeness="completeness"
        :profile-status="profileStatus"
        :profile-stat="profileStat"
        :stats-loading="statsLoading || basicProfileLoading"
      />
    </div>
  </Page>
</template>
