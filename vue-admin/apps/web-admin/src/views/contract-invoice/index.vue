<script setup lang="ts">
import { computed, shallowRef } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Card, Empty, Segmented, Tag, message } from 'antdv-next';

import type {
  ContractRecord,
  DocumentKind,
  UploadRecognizePayload,
} from './types';

import { useContractInvoiceRecords } from './composables/use-contract-invoice-records';
import UploadRecognizeModal from './components/UploadRecognizeModal.vue';

defineOptions({ name: 'ContractInvoicePage' });

const activeView = shallowRef<'contracts' | 'invoices'>('contracts');

const viewOptions = [
  { label: '合同', value: 'contracts' },
  { label: '发票', value: 'invoices' },
];

const {
  confirmDrafts,
  contracts,
  contractsWithInvoiceStats,
  invoicesWithContract,
  overview,
} = useContractInvoiceRecords();

const [UploadModal, uploadModalApi] = useVbenModal({
  connectedComponent: UploadRecognizeModal,
  destroyOnClose: true,
});

const activeContracts = computed(() =>
  contractsWithInvoiceStats.value.filter((contract) => contract.status === 'active'),
);

function openUpload(kind: DocumentKind, contract?: ContractRecord) {
  uploadModalApi.setData({ contractId: contract?.id, kind }).open();
}

function handleRecognizeSuccess(payload: UploadRecognizePayload) {
  confirmDrafts(payload.drafts);
  const contractCount = payload.drafts.filter((draft) => draft.kind === 'contract').length;
  const invoiceCount = payload.drafts.length - contractCount;
  message.success(
    `已确认入库：${contractCount} 个合同，${invoiceCount} 张发票`,
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    currency: 'CNY',
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}
</script>

<template>
  <Page auto-content-height>
    <UploadModal :contracts="contracts" @success="handleRecognizeSuccess" />

    <div class="contract-invoice-page">
      <section class="contract-invoice-hero">
        <div>
          <div class="contract-invoice-kicker">AI 自动建档</div>
          <h1 class="contract-invoice-title">合同发票</h1>
          <p class="contract-invoice-subtitle">
            上传合同或发票，系统自动识别关键信息，确认后形成合同与发票档案。
          </p>
        </div>
        <div class="contract-invoice-actions">
          <Button @click="openUpload('invoice')">
            <IconifyIcon icon="lucide:receipt-text" class="size-4" />
            上传发票
          </Button>
          <Button type="primary" @click="openUpload('contract')">
            <IconifyIcon icon="lucide:file-up" class="size-4" />
            上传合同
          </Button>
        </div>
      </section>

      <section class="contract-invoice-stats">
        <div class="contract-invoice-stat">
          <span>合同档案</span>
          <strong>{{ overview.contractCount }}</strong>
        </div>
        <div class="contract-invoice-stat">
          <span>合同金额</span>
          <strong>{{ formatCurrency(overview.contractAmount) }}</strong>
        </div>
        <div class="contract-invoice-stat">
          <span>发票档案</span>
          <strong>{{ overview.invoiceCount }}</strong>
        </div>
        <div class="contract-invoice-stat">
          <span>未关联发票</span>
          <strong>{{ overview.unlinkedInvoiceCount }}</strong>
        </div>
      </section>

      <section class="contract-invoice-panel">
        <div class="contract-invoice-panel-head">
          <Segmented v-model:value="activeView" :options="viewOptions" />
          <div class="contract-invoice-panel-actions">
            <Button v-if="activeView === 'contracts'" type="primary" @click="openUpload('contract')">
              <IconifyIcon icon="lucide:file-plus-2" class="size-4" />
              上传识别合同
            </Button>
            <Button v-else type="primary" @click="openUpload('invoice')">
              <IconifyIcon icon="lucide:receipt-text" class="size-4" />
              上传识别发票
            </Button>
          </div>
        </div>

        <div v-if="activeView === 'contracts'" class="contract-list">
          <Empty v-if="activeContracts.length === 0" description="暂无合同档案" />
          <Card
            v-for="contract in activeContracts"
            :key="contract.id"
            class="contract-card"
            variant="borderless"
          >
            <div class="contract-card-main">
              <div class="contract-card-info">
                <div class="contract-card-title-row">
                  <h2>{{ contract.name }}</h2>
                  <Tag color="blue">{{ contract.contractNo || '无编号' }}</Tag>
                </div>
                <div class="contract-card-meta">
                  {{ contract.counterparty }} / {{ contract.ourEntity }} / 签约 {{ contract.signDate }}
                </div>
                <p>{{ contract.summary }}</p>
              </div>
              <div class="contract-card-actions">
                <Button type="primary" @click="openUpload('invoice', contract)">
                  <IconifyIcon icon="lucide:plus" class="size-4" />
                  添加发票
                </Button>
              </div>
            </div>

            <div class="contract-card-grid">
              <div>
                <span>合同金额</span>
                <strong>{{ formatCurrency(contract.amount) }}</strong>
              </div>
              <div>
                <span>已关联发票</span>
                <strong>{{ contract.invoiceCount }} 张</strong>
              </div>
              <div>
                <span>已开票金额</span>
                <strong>{{ formatCurrency(contract.invoiceAmount) }}</strong>
              </div>
              <div>
                <span>未关联金额</span>
                <strong>{{ formatCurrency(contract.remainingAmount) }}</strong>
              </div>
            </div>
          </Card>
        </div>

        <div v-else class="invoice-list">
          <Empty v-if="invoicesWithContract.length === 0" description="暂无发票档案" />
          <Card
            v-for="invoice in invoicesWithContract"
            :key="invoice.id"
            class="invoice-card"
            variant="borderless"
          >
            <div class="invoice-card-main">
              <div>
                <div class="invoice-card-title-row">
                  <h2>{{ invoice.invoiceNo }}</h2>
                  <Tag :color="invoice.contract ? 'green' : 'orange'">
                    {{ invoice.contract ? '已关联合同' : '未关联' }}
                  </Tag>
                </div>
                <div class="invoice-card-meta">
                  {{ invoice.invoiceType }} / 开票 {{ invoice.issueDate }} / {{ invoice.fileName }}
                </div>
                <div class="invoice-card-parties">
                  销售方：{{ invoice.sellerName }}；购买方：{{ invoice.buyerName }}
                </div>
              </div>
              <div class="invoice-card-amount">
                <span>价税合计</span>
                <strong>{{ formatCurrency(invoice.amount) }}</strong>
              </div>
            </div>
            <div class="invoice-card-link">
              <IconifyIcon icon="lucide:link" class="size-4" />
              {{ invoice.contract?.name || '暂无关联合同，可重新上传识别或后续手动选择' }}
            </div>
          </Card>
        </div>
      </section>
    </div>
  </Page>
</template>

<style scoped>
.contract-invoice-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.contract-invoice-hero,
.contract-invoice-panel,
.contract-invoice-stat {
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--background));
}

.contract-invoice-hero {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 20px;
  overflow: hidden;
  padding: 24px;
  position: relative;
}

.contract-invoice-hero::before {
  background: linear-gradient(90deg, rgb(14 116 144 / 16%), transparent);
  content: '';
  inset: 0 auto 0 0;
  position: absolute;
  width: 42%;
}

.contract-invoice-hero > * {
  position: relative;
}

.contract-invoice-kicker {
  color: rgb(14 116 144);
  font-size: 13px;
  font-weight: 700;
}

.contract-invoice-title {
  color: hsl(var(--foreground));
  font-size: 28px;
  font-weight: 760;
  line-height: 1.2;
  margin: 6px 0;
}

.contract-invoice-subtitle {
  color: hsl(var(--muted-foreground));
  margin: 0;
  max-width: 620px;
}

.contract-invoice-actions,
.contract-invoice-panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.contract-invoice-stats {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.contract-invoice-stat {
  padding: 16px;
}

.contract-invoice-stat span,
.contract-card-grid span,
.invoice-card-amount span {
  color: hsl(var(--muted-foreground));
  display: block;
  font-size: 12px;
}

.contract-invoice-stat strong {
  color: hsl(var(--foreground));
  display: block;
  font-size: 22px;
  margin-top: 6px;
}

.contract-invoice-panel {
  padding: 16px;
}

.contract-invoice-panel-head {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.contract-list,
.invoice-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.contract-card,
.invoice-card {
  border: 1px solid hsl(var(--border));
}

.contract-card-main,
.invoice-card-main {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  gap: 18px;
}

.contract-card-info {
  min-width: 0;
}

.contract-card-title-row,
.invoice-card-title-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.contract-card-title-row h2,
.invoice-card-title-row h2 {
  color: hsl(var(--foreground));
  font-size: 17px;
  font-weight: 680;
  margin: 0;
}

.contract-card-meta,
.invoice-card-meta,
.invoice-card-parties {
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  margin-top: 6px;
}

.contract-card-info p {
  color: hsl(var(--foreground));
  margin: 10px 0 0;
}

.contract-card-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 16px;
}

.contract-card-grid div {
  background: hsl(var(--muted) / 48%);
  border-radius: 8px;
  padding: 12px;
}

.contract-card-grid strong,
.invoice-card-amount strong {
  color: hsl(var(--foreground));
  display: block;
  margin-top: 4px;
}

.invoice-card-amount {
  min-width: 150px;
  text-align: right;
}

.invoice-card-link {
  align-items: center;
  background: hsl(var(--muted) / 48%);
  border-radius: 8px;
  color: hsl(var(--muted-foreground));
  display: flex;
  gap: 8px;
  margin-top: 14px;
  padding: 10px 12px;
}

@media (max-width: 900px) {
  .contract-invoice-hero,
  .contract-invoice-panel-head,
  .contract-card-main,
  .invoice-card-main {
    align-items: stretch;
    flex-direction: column;
  }

  .contract-invoice-stats,
  .contract-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .invoice-card-amount {
    text-align: left;
  }
}

@media (max-width: 560px) {
  .contract-invoice-stats,
  .contract-card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
