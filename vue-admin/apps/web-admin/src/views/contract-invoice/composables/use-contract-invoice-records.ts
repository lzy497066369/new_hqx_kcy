import { computed, shallowRef } from 'vue';

import type {
  ContractRecord,
  InvoiceRecord,
  RecognizedDraft,
} from '../types';

const seedContracts: ContractRecord[] = [
  {
    amount: 286_000,
    contractNo: 'HT-2026-0718',
    counterparty: '杭州智链科技有限公司',
    fileName: '智能设备采购合同.pdf',
    id: 'contract-1',
    name: '智能设备采购合同',
    ourEntity: '川涌城市服务有限公司',
    signDate: '2026-06-18',
    status: 'active',
    summary: '采购智能设备及配套服务，合同约定按验收节点开具发票。',
  },
  {
    amount: 128_500,
    contractNo: 'FW-2026-0509',
    counterparty: '成都云策信息技术有限公司',
    fileName: '平台运维服务协议.pdf',
    id: 'contract-2',
    name: '平台运维服务协议',
    ourEntity: '川涌城市服务有限公司',
    signDate: '2026-05-09',
    status: 'active',
    summary: '年度平台运维服务，按季度提交服务确认单后开票。',
  },
];

const seedInvoices: InvoiceRecord[] = [
  {
    amount: 86_000,
    buyerName: '川涌城市服务有限公司',
    contractId: 'contract-1',
    fileName: '发票-086000.pdf',
    id: 'invoice-1',
    invoiceNo: '338126400001',
    invoiceType: '增值税专用发票',
    issueDate: '2026-06-28',
    sellerName: '杭州智链科技有限公司',
    status: 'confirmed',
    taxAmount: 9893.81,
  },
];

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function toNumber(value: string) {
  const normalizedValue = Number(value.replaceAll(',', '').trim());
  return Number.isFinite(normalizedValue) ? normalizedValue : 0;
}

export function useContractInvoiceRecords() {
  const contracts = shallowRef<ContractRecord[]>(seedContracts);
  const invoices = shallowRef<InvoiceRecord[]>(seedInvoices);

  const overview = computed(() => {
    const invoiceAmount = invoices.value.reduce((sum, item) => sum + item.amount, 0);
    return {
      contractAmount: contracts.value.reduce((sum, item) => sum + item.amount, 0),
      contractCount: contracts.value.length,
      invoiceAmount,
      invoiceCount: invoices.value.length,
      unlinkedInvoiceCount: invoices.value.filter((item) => !item.contractId).length,
    };
  });

  const contractsWithInvoiceStats = computed(() =>
    contracts.value.map((contract) => {
      const linkedInvoices = invoices.value.filter(
        (invoice) => invoice.contractId === contract.id,
      );
      const invoiceAmount = linkedInvoices.reduce(
        (sum, invoice) => sum + invoice.amount,
        0,
      );
      return {
        ...contract,
        invoiceAmount,
        invoiceCount: linkedInvoices.length,
        remainingAmount: Math.max(contract.amount - invoiceAmount, 0),
      };
    }),
  );

  const invoicesWithContract = computed(() =>
    invoices.value.map((invoice) => ({
      ...invoice,
      contract: contracts.value.find((contract) => contract.id === invoice.contractId),
    })),
  );

  function confirmDrafts(drafts: RecognizedDraft[]) {
    const nextContracts: ContractRecord[] = [];
    const nextInvoices: InvoiceRecord[] = [];

    for (const draft of drafts) {
      if (draft.kind === 'contract') {
        nextContracts.push({
          ...draft.data,
          amount: toNumber(draft.data.amount),
          id: createId('contract'),
          status: 'active',
        });
        continue;
      }

      nextInvoices.push({
        ...draft.data,
        amount: toNumber(draft.data.amount),
        id: createId('invoice'),
        status: draft.data.contractId ? 'confirmed' : 'unlinked',
        taxAmount: toNumber(draft.data.taxAmount),
      });
    }

    if (nextContracts.length > 0) {
      contracts.value = [...nextContracts, ...contracts.value];
    }
    if (nextInvoices.length > 0) {
      invoices.value = [...nextInvoices, ...invoices.value];
    }
  }

  return {
    confirmDrafts,
    contracts,
    contractsWithInvoiceStats,
    invoices,
    invoicesWithContract,
    overview,
  };
}
