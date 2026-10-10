<script setup lang="ts">
import ClientJourneyTrail from '#/views/client/components/ClientJourneyTrail.vue';

import type { ClientEnterpriseAccountApi } from '#/api/client/enterprise-account';

import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Card,
  Empty,
  Modal,
  Skeleton,
  Tag,
  message,
} from 'antdv-next';

import {
  createClientEnterpriseAccountApi,
  deleteClientEnterpriseAccountApi,
  getClientEnterpriseAccountsApi,
  updateClientEnterpriseAccountApi,
} from '#/api/client';
import { useClientEnterpriseStore } from '#/store';

import AccountDetailModal from './company-account/components/account-detail-modal.vue';
import AccountFormModal from './company-account/components/account-form-modal.vue';
import AccountList from './company-account/components/account-list.vue';
import { type EnterpriseAccountFormMode } from './company-account/shared';

defineOptions({ name: 'ClientEnterpriseProfileAccount' });

const store = useClientEnterpriseStore();
const router = useRouter();

const accounts = ref<ClientEnterpriseAccountApi.ClientEnterpriseAccount[]>([]);
const editingAccount =
  ref<ClientEnterpriseAccountApi.ClientEnterpriseAccount>();
const detailAccount = ref<ClientEnterpriseAccountApi.ClientEnterpriseAccount>();

const detailOpen = shallowRef(false);
const formMode = shallowRef<EnterpriseAccountFormMode>('create');
const formOpen = shallowRef(false);
const keyword = shallowRef('');
const loading = shallowRef(false);
const loadMessage = shallowRef('');
const selectedStatus = shallowRef<number>();
const selectedType = shallowRef<number>();
const submitting = shallowRef(false);

const visibleAccounts = computed(() => {
  return accounts.value.filter((account) => {
    const matchKeyword = keyword.value
      ? [account.pt_name, account.zh_number, account.charge, account.b_email]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(keyword.value.toLowerCase()),
          )
      : true;

    const matchType = selectedType.value
      ? Number(account.zh_type) === selectedType.value
      : true;

    const matchStatus =
      selectedStatus.value === undefined
        ? true
        : Number(account.zh_status) === selectedStatus.value;

    return matchKeyword && matchType && matchStatus;
  });
});

const stats = computed(() => {
  const enabled = accounts.value.filter(
    (item) => Number(item.zh_status) === 1,
  ).length;
  const disabled = accounts.value.filter(
    (item) => Number(item.zh_status) === 0,
  ).length;

  return {
    disabled,
    enabled,
    total: accounts.value.length,
  };
});

onMounted(async () => {
  if (!store.initialized) {
    await store.refreshContext().catch(() => {});
  }
  await loadAccounts();
});

watch(
  () => store.currentCompanyId,
  async (companyId, previousCompanyId) => {
    if (companyId === previousCompanyId) {
      return;
    }

    if (!companyId) {
      accounts.value = [];
      return;
    }

    await loadAccounts();
  },
);

async function loadAccounts() {
  if (!store.currentCompany) {
    accounts.value = [];
    loadMessage.value = '';
    return;
  }

  loading.value = true;
  loadMessage.value = '';

  try {
    accounts.value = await getClientEnterpriseAccountsApi();
  } catch (error) {
    accounts.value = [];
    loadMessage.value =
      error instanceof Error && error.message
        ? error.message
        : '企业账号加载失败，请稍后重试。';
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  formMode.value = 'create';
  editingAccount.value = undefined;
  formOpen.value = true;
}

function openEditModal(
  account: ClientEnterpriseAccountApi.ClientEnterpriseAccount,
) {
  formMode.value = 'edit';
  editingAccount.value = account;
  formOpen.value = true;
}

function openDetailModal(
  account: ClientEnterpriseAccountApi.ClientEnterpriseAccount,
) {
  detailAccount.value = account;
  detailOpen.value = true;
}

async function submitForm(
  payload: ClientEnterpriseAccountApi.SaveClientEnterpriseAccountParams,
) {
  submitting.value = true;

  try {
    if (formMode.value === 'create') {
      await createClientEnterpriseAccountApi(payload);
      message.success('企业账号已新增');
    } else if (editingAccount.value?.id) {
      await updateClientEnterpriseAccountApi(editingAccount.value.id, payload);
      message.success('企业账号已更新');
    }

    formOpen.value = false;
    await loadAccounts();
  } finally {
    submitting.value = false;
  }
}

function deleteAccount(
  account: ClientEnterpriseAccountApi.ClientEnterpriseAccount,
) {
  Modal.confirm({
    cancelText: '取消',
    content: `删除后将无法恢复：${account.pt_name}`,
    okButtonProps: {
      danger: true,
    },
    okText: '删除',
    onOk: async () => {
      await deleteClientEnterpriseAccountApi(account.id);
      message.success('企业账号已删除');
      await loadAccounts();
    },
    title: '确认删除企业账号？',
  });
}

function copyPassword(
  account: ClientEnterpriseAccountApi.ClientEnterpriseAccount,
) {
  Modal.confirm({
    cancelText: '取消',
    content: '复制后请妥善保管账号密码，避免在公开渠道传播。确认继续吗？',
    okText: '确认复制',
    onOk: async () => {
      const password = account.zh_password?.trim();
      if (!password) {
        message.warning('当前记录未提供密码明文，请维护后再复制。');
        return;
      }

      await copyText(password);
      message.success('密码已复制到剪贴板');
    },
    title: '确认复制密码',
  });
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', 'readonly');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }
}
</script>

<template>
  <Page auto-content-height>
    <ClientJourneyTrail />
    <div class="space-y-5 p-5">
      <Alert
        v-if="store.errorMessage"
        show-icon
        type="warning"
        :message="store.errorMessage"
      />

      <Skeleton v-if="store.loading && !store.initialized" active />

      <Empty v-else-if="!store.currentCompany" description="请先选择当前企业">
        <Button
          type="primary"
          @click="router.push({ name: 'ClientCompanySwitch' })"
        >
          <IconifyIcon icon="lucide:repeat-2" class="size-4" />
          去切换公司
        </Button>
      </Empty>

      <template v-else>
        <div class="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div
            class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
          >
            <div>
              <div class="text-sm text-foreground/60">企业账号</div>
              <div class="mt-2 text-2xl font-semibold">
                {{ store.currentCompanyName }}
              </div>
              <div class="mt-1 text-sm text-foreground/60">
                管理当前企业在外部平台的账号信息，列表不展示明文密码，详情默认脱敏。
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <Tag color="processing">当前企业上下文</Tag>
            </div>
          </div>
        </div>

        <Alert
          v-if="loadMessage"
          show-icon
          type="warning"
          :message="loadMessage"
        />

        <div class="grid gap-4 md:grid-cols-3">
          <Card variant="borderless">
            <div class="text-sm text-foreground/60">账号总数</div>
            <div class="mt-2 text-3xl font-semibold">
              {{ stats.total }}
            </div>
          </Card>
          <Card variant="borderless">
            <div class="text-sm text-foreground/60">启用中</div>
            <div class="mt-2 text-3xl font-semibold text-emerald-600">
              {{ stats.enabled }}
            </div>
          </Card>
          <Card variant="borderless">
            <div class="text-sm text-foreground/60">停用中</div>
            <div class="mt-2 text-3xl font-semibold text-slate-500">
              {{ stats.disabled }}
            </div>
          </Card>
        </div>

        <AccountList
          :accounts="visibleAccounts"
          :keyword="keyword"
          :loading="loading"
          :selected-status="selectedStatus"
          :selected-type="selectedType"
          @create="openCreateModal"
          @delete="deleteAccount"
          @detail="openDetailModal"
          @edit="openEditModal"
          @update:keyword="keyword = $event"
          @update:selected-status="selectedStatus = $event"
          @update:selected-type="selectedType = $event"
        />
      </template>
    </div>

    <AccountFormModal
      :account="editingAccount"
      :mode="formMode"
      :open="formOpen"
      :submitting="submitting"
      @close="formOpen = false"
      @submit="submitForm"
    />

    <AccountDetailModal
      :account="detailAccount"
      :open="detailOpen"
      @close="detailOpen = false"
      @copy-password="copyPassword"
    />
  </Page>
</template>
