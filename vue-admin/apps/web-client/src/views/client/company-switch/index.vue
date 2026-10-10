<script setup lang="ts">
import { computed, onMounted } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Alert, Button, Card, Empty, message, Skeleton, Tag } from 'antdv-next';

import { useClientEnterpriseStore } from '#/store';

defineOptions({ name: 'ClientCompanySwitch' });

const store = useClientEnterpriseStore();

const currentCompanyId = computed(() => store.currentCompanyId);

onMounted(() => {
  if (!store.initialized) {
    store.refreshContext().catch(() => {});
  }
});

async function selectCompany(companyId: string) {
  await store.switchCompany(companyId);
  message.success('当前企业已切换');
}
</script>

<template>
  <Page auto-content-height>
    <div class="space-y-5 p-5">
      <Alert
        v-if="store.errorMessage"
        show-icon
        type="warning"
        :message="store.errorMessage"
      />

      <div class="flex flex-col gap-2">
        <div class="text-2xl font-semibold">公司切换</div>
        <div class="text-sm text-foreground/60">
          当前账号可操作的公司会共用同一个企业上下文。
        </div>
      </div>

      <Skeleton v-if="store.loading && !store.initialized" active />
      <Empty
        v-else-if="!store.hasCompanies"
        description="暂无分发的企业，请联系总负责人"
      />

      <div v-else class="grid gap-4 lg:grid-cols-2">
        <Card
          v-for="company in store.companies"
          :key="company.id"
          variant="borderless"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <div class="text-lg font-semibold">{{ company.name }}</div>
                <Tag v-if="company.id === currentCompanyId" color="success">
                  当前
                </Tag>
                <Tag v-if="company.isDefault" color="blue">默认</Tag>
              </div>
              <div class="mt-2 text-sm text-foreground/60">
                {{ company.shortName || company.creditCode || '暂无简称或信用代码' }}
              </div>
              <div class="mt-2 text-sm text-foreground/60">
                {{ company.roleName || '经办账号' }}
              </div>
            </div>
            <Button
              :disabled="company.id === currentCompanyId"
              :loading="store.switching"
              type="primary"
              @click="selectCompany(company.id)"
            >
              <IconifyIcon icon="lucide:check" class="size-4" />
              设为当前
            </Button>
          </div>
        </Card>
      </div>
    </div>
  </Page>
</template>
