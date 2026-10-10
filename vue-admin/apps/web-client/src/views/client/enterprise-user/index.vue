<script setup lang="ts">
import type { ClientEnterpriseProfile } from '#/api';

import { computed, onMounted, ref } from 'vue';

import { Profile } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Alert, Card, Descriptions, DescriptionsItem, Skeleton, Tag } from 'antdv-next';

import { getCurrentEnterpriseProfileApi } from '#/api';
import { $t } from '#/locales';

import ProfileBase from '../../_core/profile/base-setting.vue';
import ProfilePasswordSetting from '../../_core/profile/password-setting.vue';
import ProfileSecuritySetting from '../../_core/profile/security-setting.vue';

defineOptions({ name: 'ClientEnterpriseUser' });

const userStore = useUserStore();

const tabsValue = ref('enterprise');
const loading = ref(false);
const errorMessage = ref('');
const enterprise = ref<ClientEnterpriseProfile>();

const tabs = computed(() => [
  {
    label: '企业资料',
    value: 'enterprise',
  },
  {
    label: $t('page.auth.basicSetting'),
    value: 'basic',
  },
  {
    label: $t('page.auth.securitySetting'),
    value: 'security',
  },
  {
    label: $t('page.auth.passwordSetting'),
    value: 'password',
  },
]);

const profileStatusMap: Record<string, { color: string; label: string }> = {
  approved: { color: 'success', label: '已通过' },
  draft: { color: 'default', label: '草稿' },
  need_resubmit: { color: 'warning', label: '待重提' },
  pending_review: { color: 'processing', label: '待审核' },
  rejected: { color: 'error', label: '已驳回' },
};

const profileStatus = computed(
  () =>
    profileStatusMap[enterprise.value?.profileStatus ?? ''] ?? {
      color: 'default',
      label: enterprise.value?.profileStatus ?? '-',
    },
);

const regionText = computed(() => {
  const row = enterprise.value;
  if (!row) {
    return '-';
  }
  return [row.province, row.city, row.district].filter(Boolean).join(' / ') || '-';
});

onMounted(() => {
  loadEnterprise();
});

async function loadEnterprise() {
  loading.value = true;
  errorMessage.value = '';
  try {
    enterprise.value = await getCurrentEnterpriseProfileApi();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : '当前账号暂未绑定企业';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Profile
    v-model:model-value="tabsValue"
    title="企业账号中心"
    :user-info="userStore.userInfo"
    :tabs="tabs"
  >
    <template #content>
      <div v-if="tabsValue === 'enterprise'" class="space-y-4">
        <Skeleton v-if="loading" active />

        <Alert
          v-else-if="errorMessage"
          show-icon
          type="warning"
          :message="errorMessage"
        />

        <template v-else-if="enterprise">
          <Card variant="borderless">
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div class="text-xl font-semibold text-foreground">
                  {{ enterprise.name }}
                </div>
                <div class="mt-1 text-sm text-foreground/60">
                  {{ enterprise.shortName || enterprise.creditCode }}
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <Tag :color="profileStatus.color">
                  {{ profileStatus.label }}
                </Tag>
                <Tag :color="enterprise.status === 1 ? 'success' : 'error'">
                  {{ enterprise.status === 1 ? '启用' : '停用' }}
                </Tag>
              </div>
            </div>
          </Card>

          <Card title="企业资料" variant="borderless">
            <Descriptions bordered :column="{ md: 2, sm: 1, xs: 1 }">
              <DescriptionsItem label="统一社会信用代码">
                {{ enterprise.creditCode }}
              </DescriptionsItem>
              <DescriptionsItem label="法人">
                {{ enterprise.legalPerson || '-' }}
              </DescriptionsItem>
              <DescriptionsItem label="行业">
                {{ enterprise.industry || '-' }}
              </DescriptionsItem>
              <DescriptionsItem label="企业类型">
                {{ enterprise.enterpriseType || '-' }}
              </DescriptionsItem>
              <DescriptionsItem label="地区">
                {{ regionText }}
              </DescriptionsItem>
              <DescriptionsItem label="详细地址">
                {{ enterprise.address || '-' }}
              </DescriptionsItem>
              <DescriptionsItem label="联系人">
                {{ enterprise.contactName || '-' }}
              </DescriptionsItem>
              <DescriptionsItem label="联系电话">
                {{ enterprise.contactPhone || '-' }}
              </DescriptionsItem>
              <DescriptionsItem label="联系邮箱">
                {{ enterprise.contactEmail || '-' }}
              </DescriptionsItem>
              <DescriptionsItem label="更新时间">
                {{ enterprise.updateTime || '-' }}
              </DescriptionsItem>
            </Descriptions>
          </Card>
        </template>
      </div>

      <ProfileBase v-if="tabsValue === 'basic'" />
      <ProfileSecuritySetting v-if="tabsValue === 'security'" />
      <ProfilePasswordSetting v-if="tabsValue === 'password'" />
    </template>
  </Profile>
</template>
