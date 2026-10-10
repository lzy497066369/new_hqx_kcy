<script setup lang="ts">
import ClientJourneyTrail from '#/views/client/components/ClientJourneyTrail.vue';

import type { ClientPolicyApi } from '#/api/client';

import { computed, onMounted, ref, shallowRef, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Card,
  Cascader,
  Empty,
  Skeleton,
  Tag,
  message,
} from 'antdv-next';

import { getClientPolicyRegionTreeApi } from '#/api/client';
import { useClientEnterpriseStore } from '#/store';

import EnterpriseBasicProfileContent from './components/EnterpriseBasicProfileContent.vue';
import { useEnterpriseBasicProfile } from './basic/use-enterprise-basic-profile';

defineOptions({ name: 'ClientEnterpriseProfileBasic' });

interface RegionOption {
  children?: RegionOption[];
  label: string;
  value: string;
}

const store = useClientEnterpriseStore();
const enterpriseBasic = useEnterpriseBasicProfile(store);
const regionOptions = ref<RegionOption[]>([]);
const regionValue = ref<string[]>([]);
const regionLoading = shallowRef(false);
const regionSaving = shallowRef(false);
const regionLoaded = shallowRef(false);
const regionErrorMessage = shallowRef('');

const pageErrorMessage = computed(
  () =>
    regionErrorMessage.value ||
    enterpriseBasic.remoteHint.value ||
    store.errorMessage,
);

const currentRegionText = computed(
  () => regionValue.value.filter(Boolean).join(' / ') || '暂未设置',
);

function toRegionOptions(
  items: ClientPolicyApi.PolicyRegion[],
): RegionOption[] {
  return items.map((item) => ({
    children:
      item.children && item.children.length > 0
        ? toRegionOptions(item.children)
        : undefined,
    label: item.name,
    value: item.name,
  }));
}

function syncRegionValueFromProfile() {
  regionValue.value = [
    store.enterpriseProfile?.province,
    store.enterpriseProfile?.city,
    store.enterpriseProfile?.district,
  ].filter((item): item is string => Boolean(item?.trim()));
}

async function loadRegionTree() {
  if (regionLoaded.value) {
    return;
  }

  regionLoading.value = true;
  regionErrorMessage.value = '';

  try {
    const tree = await getClientPolicyRegionTreeApi();
    regionOptions.value = toRegionOptions(tree);
    regionLoaded.value = true;
  } catch (error) {
    regionErrorMessage.value =
      error instanceof Error ? error.message : '区域数据加载失败';
  } finally {
    regionLoading.value = false;
  }
}

async function saveRegionProfile() {
  if (!store.currentCompany) {
    return;
  }

  const [province, city, district] = regionValue.value;

  regionSaving.value = true;

  try {
    await store.updateEnterpriseProfile({
      city: city ?? null,
      district: district ?? null,
      province: province ?? null,
    });
    message.success('企业所在地区已保存');
  } catch (error) {
    message.error(
      error instanceof Error ? error.message : '企业所在地区保存失败',
    );
  } finally {
    regionSaving.value = false;
  }
}

function resetRegionProfile() {
  syncRegionValueFromProfile();
}

watch(
  () =>
    [
      store.currentCompanyId,
      store.enterpriseProfile?.province,
      store.enterpriseProfile?.city,
      store.enterpriseProfile?.district,
    ] as const,
  () => {
    syncRegionValueFromProfile();
  },
  { immediate: true },
);

watch(
  () => store.currentCompanyId,
  async (companyId, previousCompanyId) => {
    if (!store.initialized || companyId === previousCompanyId) {
      return;
    }

    await enterpriseBasic.refreshRemoteProfile().catch(() => {});
  },
);

onMounted(async () => {
  loadRegionTree().catch(() => {});

  if (!store.initialized) {
    await store.refreshContext().catch(() => {});
  } else {
    await store.refreshEnterpriseProfile().catch(() => {});
  }

  await enterpriseBasic.refreshRemoteProfile().catch(() => {});
});
</script>

<template>
  <Page auto-content-height>
    <ClientJourneyTrail />
    <div class="space-y-5 p-5">
      <Alert
        v-if="pageErrorMessage"
        show-icon
        type="warning"
        :message="pageErrorMessage"
      />

      <div class="flex flex-col gap-2">
        <div class="text-2xl font-semibold">基础资料</div>
        <div class="text-sm text-foreground/60">
          维护企业信息、法人信息、联系人信息、资本信息和股东信息。
        </div>
      </div>

      <Skeleton v-if="store.loading && !store.initialized" active />

      <Empty v-else-if="!store.currentCompany" description="请先选择当前企业" />

      <template v-else>
        <EnterpriseBasicProfileContent
          :completeness="enterpriseBasic.completeness.value"
          :form="enterpriseBasic.form.value"
          :loading="enterpriseBasic.loading.value"
          :remote-state="enterpriseBasic.remoteState.value"
          :saving="enterpriseBasic.saving.value"
          :shareholders="enterpriseBasic.shareholders.value"
          @reset="enterpriseBasic.resetProfile"
          @save="enterpriseBasic.saveProfile"
        />

        <Card title="企业所在地区" variant="borderless">
          <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
            <div class="space-y-4">
              <div class="text-sm text-foreground/60">
                修改当前企业的所在省、市、区县。保存后，政策库和项目列表会基于新的地区信息继续匹配。
              </div>
              <Cascader
                v-model:value="regionValue"
                allow-clear
                change-on-select
                class="w-full"
                :field-names="{
                  children: 'children',
                  label: 'label',
                  value: 'value',
                }"
                :options="regionOptions"
                placeholder="请选择企业所在省 / 市 / 区县"
                show-search
              />
              <div
                class="flex flex-wrap items-center gap-2 text-sm text-foreground/60"
              >
                <Tag color="blue">当前值：{{ currentRegionText }}</Tag>
                <Tag v-if="regionLoaded" color="success">区域数据已加载</Tag>
                <Tag v-else-if="regionLoading" color="processing"
                  >区域数据加载中</Tag
                >
              </div>
            </div>

            <div
              class="flex flex-col justify-between gap-3 rounded-lg border border-dashed border-border bg-background p-4"
            >
              <div class="space-y-2">
                <div class="flex items-center gap-2 font-medium">
                  <IconifyIcon icon="lucide:map-pinned" class="size-4" />
                  地区操作
                </div>
                <div class="text-sm text-foreground/60">
                  支持逐级选择，也支持清空后保存。
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <Button :disabled="regionLoading" @click="resetRegionProfile">
                  <IconifyIcon icon="lucide:rotate-ccw" class="size-4" />
                  重置地区
                </Button>
                <Button
                  type="primary"
                  :disabled="regionLoading"
                  :loading="regionSaving"
                  @click="saveRegionProfile"
                >
                  <IconifyIcon icon="lucide:save" class="size-4" />
                  保存地区
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </template>
    </div>
  </Page>
</template>
