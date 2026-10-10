<script setup lang="ts">
import type { ClientEnterpriseContractApi } from '#/api/client';
import type { EnterpriseRecordTab } from '../components/table-types';

import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Button, message } from 'antdv-next';

import { IconifyIcon } from '@vben/icons';

import {
  createClientContractApi,
  createClientInvoiceApi,
  deleteClientContractApi,
  deleteClientInvoiceApi,
  getClientContractListApi,
  getClientInvoiceListApi,
  updateClientContractApi,
  updateClientInvoiceApi,
} from '#/api/client';
import { useClientEnterpriseStore } from '#/store';

import EnterpriseRecordModule from '../modules/EnterpriseRecordModule.vue';
import ContractInvoiceRecognizeModal from './ContractInvoiceRecognizeModal.vue';
import { contractColumns, invoiceColumns } from './data';

defineOptions({ name: 'ClientEnterpriseProfileContract' });

const store = useClientEnterpriseStore();
const route = useRoute();
const activeKey = shallowRef('contracts');
const loading = shallowRef(false);
const errorMessage = shallowRef('');
const recognizeOpen = shallowRef(false);
const recognizeKind = shallowRef<'contracts' | 'invoices'>('contracts');
const contractRows = ref<ClientEnterpriseContractApi.Contract[]>([]);
const invoiceRows = ref<ClientEnterpriseContractApi.Invoice[]>([]);

const hasCompany = computed(() => Boolean(store.currentCompany));
const moduleError = computed(() => errorMessage.value || store.errorMessage);
const tabs = computed<EnterpriseRecordTab[]>(() => [
  {
    columns: contractColumns,
    description: '维护合同名称、编号、客户、金额、周期和合同附件。',
    emptyDescription: '暂无合同资料',
    key: 'contracts',
    records: contractRows.value.map((row) => ({ ...row })),
    title: '合同',
  },
  {
    columns: invoiceColumns,
    description: '维护发票编号、开票日期、金额、支付状态和备注。',
    emptyDescription: '暂无发票资料',
    key: 'invoices',
    records: invoiceRows.value.map((row) => ({ ...row })),
    title: '发票',
  },
]);

watch(
  () => route.query.tab,
  (tab) => {
    const tabKey = Array.isArray(tab) ? tab[0] : tab;
    if (typeof tabKey !== 'string') {
      return;
    }
    if (tabs.value.some((item) => item.key === tabKey)) {
      activeKey.value = tabKey;
    }
  },
  { immediate: true },
);

onMounted(async () => {
  if (!store.initialized) {
    await store.refreshContext().catch(() => {});
  }
  await loadRecords();
});

async function loadRecords() {
  if (!store.currentCompany) {
    contractRows.value = [];
    invoiceRows.value = [];
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  try {
    const [contractResult, invoiceResult] = await Promise.all([
      getClientContractListApi(),
      getClientInvoiceListApi(),
    ]);
    contractRows.value = contractResult.items;
    invoiceRows.value = invoiceResult.items;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : '合同和发票资料加载失败';
  } finally {
    loading.value = false;
  }
}

async function handleCreateRecord(tabKey: string, record: Record<string, unknown>) {
  if (tabKey === 'contracts') {
    const saved = await createClientContractApi(
      record as unknown as ClientEnterpriseContractApi.Contract,
    );
    contractRows.value = [
      saved,
      ...contractRows.value,
    ];
    message.success('合同资料已新增');
    return;
  }

  if (tabKey === 'invoices') {
    const saved = await createClientInvoiceApi(
      record as unknown as ClientEnterpriseContractApi.Invoice,
    );
    invoiceRows.value = [
      saved,
      ...invoiceRows.value,
    ];
    message.success('发票资料已新增');
  }
}

async function handleUpdateRecord(tabKey: string, record: Record<string, unknown>) {
  if (!record.id) {
    return;
  }

  if (tabKey === 'contracts') {
    const saved = await updateClientContractApi(
      record.id as number | string,
      record as unknown as ClientEnterpriseContractApi.Contract,
    );
    contractRows.value = contractRows.value.map((item) =>
      String(item.id) === String(saved.id) ? saved : item,
    );
    message.success('合同资料已更新');
    return;
  }

  if (tabKey === 'invoices') {
    const saved = await updateClientInvoiceApi(
      record.id as number | string,
      record as unknown as ClientEnterpriseContractApi.Invoice,
    );
    invoiceRows.value = invoiceRows.value.map((item) =>
      String(item.id) === String(saved.id) ? saved : item,
    );
    message.success('发票资料已更新');
  }
}

async function handleDeleteRecord(tabKey: string, record: Record<string, unknown>) {
  if (!record.id) {
    return;
  }

  if (tabKey === 'contracts') {
    await deleteClientContractApi(record.id as number | string);
    contractRows.value = contractRows.value.filter(
      (item) => String(item.id) !== String(record.id),
    );
    message.success('合同资料已删除');
    return;
  }

  if (tabKey === 'invoices') {
    await deleteClientInvoiceApi(record.id as number | string);
    invoiceRows.value = invoiceRows.value.filter(
      (item) => String(item.id) !== String(record.id),
    );
    message.success('发票资料已删除');
  }
}

function openRecognizeModal(tabKey: string) {
  recognizeKind.value = tabKey === 'invoices' ? 'invoices' : 'contracts';
  recognizeOpen.value = true;
}

async function handleRecognizeConfirm(
  tabKey: 'contracts' | 'invoices',
  records: Record<string, unknown>[],
) {
  if (records.length === 0) {
    return;
  }

  if (tabKey === 'contracts') {
    let createdCount = 0;
    let replacedCount = 0;
    const savedRecords = await Promise.all(
      records.map(async (record) => {
        const contract = record as unknown as ClientEnterpriseContractApi.Contract;
        const matchedContract = findContractByNumber(contract.ht_num);
        if (!matchedContract?.id) {
          createdCount += 1;
          return await createClientContractApi(contract);
        }

        replacedCount += 1;
        return await updateClientContractApi(matchedContract.id, {
          ...matchedContract,
          ...contract,
          id: matchedContract.id,
        });
      }),
    );
    contractRows.value = mergeContractsById(savedRecords, contractRows.value);
    message.success(
      `AI 识别完成：新增 ${createdCount} 条合同，替换 ${replacedCount} 条合同`,
    );
    return;
  }

  const savedRecords = await Promise.all(
    records.map((record) =>
      createClientInvoiceApi(
        record as unknown as ClientEnterpriseContractApi.Invoice,
      ),
    ),
  );
  invoiceRows.value = [...savedRecords, ...invoiceRows.value];
  message.success(`已通过 AI 识别新增 ${savedRecords.length} 条发票资料`);
}

function findContractByNumber(contractNo?: number | string) {
  const normalizedContractNo = normalizeContractNo(contractNo);
  if (!normalizedContractNo) {
    return undefined;
  }

  return contractRows.value.find(
    (contract) => normalizeContractNo(contract.ht_num) === normalizedContractNo,
  );
}

function mergeContractsById(
  savedRecords: ClientEnterpriseContractApi.Contract[],
  currentRecords: ClientEnterpriseContractApi.Contract[],
) {
  const savedIdSet = new Set(savedRecords.map((record) => String(record.id)));
  return [
    ...savedRecords,
    ...currentRecords.filter((record) => !savedIdSet.has(String(record.id))),
  ];
}

function normalizeContractNo(contractNo?: number | string) {
  return String(contractNo ?? '').trim().toLowerCase();
}
</script>

<template>
  <ContractInvoiceRecognizeModal
    v-model:open="recognizeOpen"
    :contracts="contractRows"
    :kind="recognizeKind"
    @confirm="handleRecognizeConfirm"
  />

  <EnterpriseRecordModule
    v-model:active-key="activeKey"
    :company-name="store.currentCompanyName"
    description="集中维护企业合同台账和发票支付资料。"
    :error-message="moduleError"
    :has-company="hasCompany"
    :loading="loading || store.loading"
    module-key="contract"
    :tabs="tabs"
    title="合同和发票"
    @create-record="handleCreateRecord"
    @delete-record="handleDeleteRecord"
    @update-record="handleUpdateRecord"
  >
    <template #actions="{ activeTab }">
      <Button @click="openRecognizeModal(activeTab.key)">
        <IconifyIcon
          :icon="activeTab.key === 'contracts' ? 'lucide:file-up' : 'lucide:receipt-text'"
          class="size-4"
        />
        {{ activeTab.key === 'contracts' ? '上传识别合同' : '上传识别发票' }}
      </Button>
    </template>
  </EnterpriseRecordModule>
</template>
