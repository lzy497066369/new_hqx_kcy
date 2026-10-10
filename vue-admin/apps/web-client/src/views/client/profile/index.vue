<script setup lang="ts">
import type { ClientAccountApi } from '#/api/client';

import { computed, onMounted, reactive, shallowRef, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Input,
  message,
  Skeleton,
} from 'antdv-next';

import { useClientEnterpriseStore } from '#/store';

defineOptions({ name: 'ClientProfile' });

const store = useClientEnterpriseStore();
const saving = shallowRef(false);

const form = reactive<ClientAccountApi.UpdateClientMeParams>({
  email: '',
  phone: '',
  position: '',
  realName: '',
  roleInCompany: '',
});

const boundCompanyText = computed(() => {
  if (!store.companies.length) {
    return '暂无绑定公司';
  }

  return store.companies.map((company) => company.name).join('、');
});

onMounted(() => {
  if (!store.initialized) {
    store.refreshContext().catch(() => {});
  }
});

watch(
  () => store.me,
  (me) => {
    form.realName = me?.realName ?? me?.name ?? '';
    form.phone = me?.phone ?? me?.mobile ?? '';
    form.email = me?.email ?? '';
    form.position = me?.position ?? '';
    form.roleInCompany = me?.roleInCompany ?? '';
  },
  { immediate: true },
);

async function saveProfile() {
  saving.value = true;
  try {
    await store.updateMe(form);
    message.success('个人情况已保存');
  } finally {
    saving.value = false;
  }
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
        <div class="text-2xl font-semibold">个人情况</div>
        <div class="text-sm text-foreground/60">
          维护当前登录人的联系方式和经办身份。
        </div>
      </div>

      <Skeleton v-if="store.loading && !store.initialized" active />

      <template v-else>
        <Card title="基本信息" variant="borderless">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <div class="mb-1 text-sm text-foreground/60">姓名</div>
              <Input v-model:value="form.realName" placeholder="请输入姓名" />
            </div>
            <div>
              <div class="mb-1 text-sm text-foreground/60">手机号</div>
              <Input v-model:value="form.phone" placeholder="请输入手机号" />
            </div>
            <div>
              <div class="mb-1 text-sm text-foreground/60">邮箱</div>
              <Input v-model:value="form.email" placeholder="请输入邮箱" />
            </div>
            <div>
              <div class="mb-1 text-sm text-foreground/60">职务</div>
              <Input v-model:value="form.position" placeholder="请输入职务" />
            </div>
            <div class="md:col-span-2">
              <div class="mb-1 text-sm text-foreground/60">经办身份</div>
              <Input
                v-model:value="form.roleInCompany"
                placeholder="例如：企业负责人、经办人"
              />
            </div>
          </div>

          <div class="mt-5">
            <Button type="primary" :loading="saving" @click="saveProfile">
              <IconifyIcon icon="lucide:save" class="size-4" />
              保存
            </Button>
          </div>
        </Card>

        <Card title="绑定公司" variant="borderless">
          <Descriptions bordered :column="{ md: 2, sm: 1, xs: 1 }">
            <DescriptionsItem label="当前公司">
              {{ store.currentCompanyName || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="可操作公司数">
              {{ store.companies.length }}
            </DescriptionsItem>
            <DescriptionsItem label="公司列表">
              {{ boundCompanyText }}
            </DescriptionsItem>
          </Descriptions>
        </Card>
      </template>
    </div>
  </Page>
</template>
