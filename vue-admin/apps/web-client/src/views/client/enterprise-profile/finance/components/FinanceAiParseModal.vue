<script setup lang="ts">
import type { ClientEnterpriseFinanceApi } from '#/api/client';

import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, message, Modal, Tag } from 'antdv-next';

import {
  approveClientFinanceAiParseDraftsApi,
  deleteClientFinanceAiParseDraftApi,
  uploadClientFinanceAiParseFilesApi,
} from '#/api/client';

defineOptions({ name: 'ClientFinanceAiParseModal' });

const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{
  approved: [];
}>();

type FinanceDraft =
  ClientEnterpriseFinanceApi.AiDraft<ClientEnterpriseFinanceApi.FinanceAiParseDraftPayload>;

type PreviewStep = 'preview' | 'upload';
type DiffRow = {
  aiValue: string;
  currentValue: string;
  field: string;
  label: string;
};

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInput');
const previewDrafts = ref<FinanceDraft[]>([]);
const step = shallowRef<PreviewStep>('upload');
const uploading = shallowRef(false);
const approving = shallowRef(false);
const deleting = shallowRef(false);
const dragging = shallowRef(false);

const reviewDrafts = computed(() =>
  previewDrafts.value.filter(
    (draft) => draft.status !== 'approved' && draft.status !== 'rejected',
  ),
);
const hasPreviewDrafts = computed(() => previewDrafts.value.length > 0);

watch(
  () => open.value,
  (value) => {
    if (value) {
      resetWorkflow();
    }
  },
);

function resetWorkflow() {
  previewDrafts.value = [];
  step.value = 'upload';
  dragging.value = false;
}

function openFileDialog() {
  fileInputRef.value?.click();
}

function handleFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  uploadFiles(files).catch(() => {});
}

function handleDrop(event: DragEvent) {
  dragging.value = false;
  const files = Array.from(event.dataTransfer?.files ?? []);
  uploadFiles(files).catch(() => {});
}

async function uploadFiles(files: File[]) {
  const allowedFiles = files.filter((file) =>
    /\.(csv|jpe?g|pdf|png|xlsx?)$/iu.test(file.name),
  );
  if (allowedFiles.length === 0) {
    message.warning('请上传 PDF、图片、CSV 或 Excel 文件');
    return;
  }
  if (allowedFiles.length > 1) {
    message.warning('请一次上传 1 个财税文件，识别确认后再上传下一个');
    return;
  }
  const oversized = allowedFiles.find((file) => file.size > 30 * 1024 * 1024);
  if (oversized) {
    message.warning(`${oversized.name} 超过 30MB`);
    return;
  }

  uploading.value = true;
  try {
    const result = await uploadClientFinanceAiParseFilesApi(allowedFiles);
    previewDrafts.value = result.drafts.filter(
      (draft) => draft.status !== 'approved' && draft.status !== 'rejected',
    );
    if (previewDrafts.value.length === 0) {
      message.error('识别失败，未识别到可确认更新的数据');
      return;
    }
    step.value = 'preview';
    message.success('识别完成，请核对将更新的数据');
  } finally {
    uploading.value = false;
  }
}

async function approvePreviewDrafts() {
  if (reviewDrafts.value.length === 0) {
    message.warning('没有可确认更新的数据');
    return;
  }

  approving.value = true;
  try {
    const result = await approveClientFinanceAiParseDraftsApi(
      reviewDrafts.value.map((draft) => draft.id),
    );
    if (result.success.length > 0) {
      message.success(`已更新 ${result.success.length} 条财税数据`);
      emit('approved');
    }
    if (result.failed.length > 0) {
      message.warning(
        `${result.failed.length} 条未更新：${result.failed
          .map((item) => item.reason)
          .join('；')}`,
      );
      const failedIds = new Set(result.failed.map((item) => String(item.draftId)));
      previewDrafts.value = previewDrafts.value.filter((draft) =>
        failedIds.has(String(draft.id)),
      );
      return;
    }

    open.value = false;
    resetWorkflow();
  } finally {
    approving.value = false;
  }
}

function confirmDeleteDraft(draft: FinanceDraft) {
  Modal.confirm({
    content: '删除后该条识别结果不可恢复，已确认更新的数据不能删除。',
    okText: '删除',
    okType: 'danger',
    title: '删除本次识别结果',
    onOk() {
      return deleteDraft(draft);
    },
  });
}

async function deleteDraft(draft: FinanceDraft) {
  deleting.value = true;
  try {
    await deleteClientFinanceAiParseDraftApi(draft.id);
    previewDrafts.value = previewDrafts.value.filter((item) => item.id !== draft.id);
    message.success('识别结果已删除');
    if (previewDrafts.value.length === 0) {
      step.value = 'upload';
    }
  } finally {
    deleting.value = false;
  }
}

function getParseTagColor(status: string) {
  if (status === 'success') {
    return 'success';
  }
  if (status === 'partial') {
    return 'warning';
  }
  return 'error';
}

function getConfidenceTagColor(value: number) {
  if (value >= 80) {
    return 'success';
  }
  if (value >= 60) {
    return 'warning';
  }
  return 'error';
}

function getParseStatusText(status: string) {
  const labels: Record<string, string> = {
    partial: '部分识别',
    review_required: '需核对',
    success: '识别成功',
  };
  return labels[status] ?? '需核对';
}

function formatValue(value: unknown) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function readRecordValue(record: Record<string, unknown>, keys: string[]) {
  const key = keys.find((item) => record[item] !== undefined && record[item] !== null);
  return key ? record[key] : undefined;
}

const financialFieldLabels: Array<{
  currentKeys: string[];
  field: keyof ClientEnterpriseFinanceApi.FinancialData & string;
  label: string;
}> = [
  { currentKeys: ['xxsr'], field: 'xxsr', label: '销售收入' },
  { currentKeys: ['total_revenue', 'totalRevenue'], field: 'total_revenue', label: '总收入' },
  {
    currentKeys: ['main_business_income', 'mainBusinessIncome'],
    field: 'main_business_income',
    label: '主营业务收入',
  },
  {
    currentKeys: ['high_tech_income', 'highTechIncome'],
    field: 'high_tech_income',
    label: '高新收入',
  },
  { currentKeys: ['zxc'], field: 'zxc', label: '总资产' },
  { currentKeys: ['net_assets', 'netAssets'], field: 'net_assets', label: '净资产' },
  { currentKeys: ['yffy'], field: 'yffy', label: '研发费用' },
  { currentKeys: ['fz'], field: 'fz', label: '负债' },
  { currentKeys: ['fzl'], field: 'fzl', label: '负债率' },
  { currentKeys: ['lr_total', 'lrTotal'], field: 'lr_total', label: '利润总额' },
  { currentKeys: ['net_profit', 'netProfit'], field: 'net_profit', label: '净利润' },
  {
    currentKeys: ['rd_personnel_cost', 'rdPersonnelCost'],
    field: 'rd_personnel_cost',
    label: '人员人工',
  },
  {
    currentKeys: ['rd_direct_input', 'rdDirectInput'],
    field: 'rd_direct_input',
    label: '直接投入',
  },
  {
    currentKeys: ['rd_depreciation', 'rdDepreciation'],
    field: 'rd_depreciation',
    label: '折旧摊销',
  },
  {
    currentKeys: ['rd_intangible_amortization', 'rdIntangibleAmortization'],
    field: 'rd_intangible_amortization',
    label: '无形资产摊销',
  },
  {
    currentKeys: ['rd_design_fee', 'rdDesignFee'],
    field: 'rd_design_fee',
    label: '设计费',
  },
  {
    currentKeys: ['rd_equipment_debugging_fee', 'rdEquipmentDebuggingFee'],
    field: 'rd_equipment_debugging_fee',
    label: '装备调试费',
  },
  {
    currentKeys: ['rd_entrusted_development', 'rdEntrustedDevelopment'],
    field: 'rd_entrusted_development',
    label: '委托研发',
  },
  {
    currentKeys: ['rd_other_expense', 'rdOtherExpense'],
    field: 'rd_other_expense',
    label: '其他费用',
  },
];

const taxAuditFieldLabels: Array<{
  currentKeys: string[];
  field: keyof ClientEnterpriseFinanceApi.TaxAudit & string;
  label: string;
}> = [
  { currentKeys: ['year'], field: 'year', label: '年度' },
  {
    currentKeys: ['tax_category', 'taxCategory'],
    field: 'tax_category',
    label: '报告类别',
  },
  { currentKeys: ['file_class', 'fileClass'], field: 'file_class', label: '文件类型' },
  { currentKeys: ['file_path', 'filePath'], field: 'file_path', label: '附件路径' },
];

function buildFinancialDiffRows(draft: FinanceDraft): DiffRow[] {
  const financial = draft.draftPayload.financial ?? {};
  const existing = draft.draftPayload.existingFinancial ?? {};
  const rows = financialFieldLabels
    .map((item) => ({
      aiValue: formatValue(financial[item.field]),
      currentValue: formatValue(readRecordValue(existing, item.currentKeys)),
      field: item.field,
      label: item.label,
    }))
    .filter((row) => row.aiValue !== '-');
  const changedRows = rows.filter((row) => row.aiValue !== row.currentValue);
  return changedRows.length > 0 ? changedRows : rows;
}

function buildTaxAuditDiffRows(draft: FinanceDraft): DiffRow[] {
  const taxAudit = draft.draftPayload.taxAudit ?? {};
  const existing = draft.draftPayload.existingTaxAudit ?? {};
  return taxAuditFieldLabels
    .map((item) => ({
      aiValue: formatTaxAuditValue(item.field, taxAudit[item.field]),
      currentValue: formatTaxAuditValue(
        item.field,
        readRecordValue(existing, item.currentKeys),
      ),
      field: item.field,
      label: item.label,
    }))
    .filter((row) => row.aiValue !== '-');
}

function formatTaxAuditValue(field: string, value: unknown) {
  if (field === 'file_class') {
    const labels: Record<string, string> = {
      1: '纳税申报',
      2: '审计报告',
      3: '其他资料',
    };
    return labels[String(value ?? '')] ?? formatValue(value);
  }
  return formatValue(value);
}

function getFinancialDiffSummary(draft: FinanceDraft) {
  const recognizedCount = buildFinancialDiffRows(draft).length;
  return recognizedCount > 0
    ? `将更新 ${recognizedCount} 项财务数据`
    : '未识别到可更新的财务数据';
}

function getTaxAuditDiffSummary(draft: FinanceDraft) {
  const recognizedCount = buildTaxAuditDiffRows(draft).length;
  return recognizedCount > 0
    ? `将更新 ${recognizedCount} 项纳税审计信息`
    : '未识别到可更新的纳税审计信息';
}

function getDraftUpdateSummary(draft: FinanceDraft) {
  const financialCount = buildFinancialDiffRows(draft).length;
  const taxAuditCount = buildTaxAuditDiffRows(draft).length;
  if (financialCount === 0 && taxAuditCount === 0) {
    return '未识别到可更新数据，请重新上传更清晰或结构化的文件。';
  }
  return `识别完成：财务数据 ${financialCount} 项，纳税审计 ${taxAuditCount} 项。`;
}
</script>

<template>
  <Modal
    v-model:open="open"
    destroy-on-hidden
    :footer="null"
    title="AI 识别财税文件"
    width="960px"
  >
    <div class="finance-ai-parse">
      <div class="finance-ai-parse__steps">
        <div
          class="finance-ai-parse__step"
          :class="{ 'finance-ai-parse__step--active': step === 'upload' }"
        >
          <span>1</span>
          <div>
            <strong>上传文件识别</strong>
            <p>一次上传一个文件，先让 AI 提取财务和税审数据。</p>
          </div>
        </div>
        <div
          class="finance-ai-parse__step"
          :class="{ 'finance-ai-parse__step--active': step === 'preview' }"
        >
          <span>2</span>
          <div>
            <strong>确认更新数据</strong>
            <p>核对将替换/写入的数据，确认后再更新年度数据。</p>
          </div>
        </div>
      </div>

      <section v-if="step === 'upload'" class="finance-ai-parse__panel">
        <button
          class="finance-ai-parse__dropzone"
          :class="{ 'finance-ai-parse__dropzone--dragging': dragging }"
          type="button"
          @click="openFileDialog"
          @dragenter.prevent="dragging = true"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="handleDrop"
        >
          <IconifyIcon icon="lucide:file-up" class="finance-ai-parse__drop-icon" />
          <strong>上传一个财税文件开始识别</strong>
          <span>支持 PDF、图片、CSV、Excel。识别完成后会进入下一步展示将更新的数据。</span>
        </button>

        <input
          ref="fileInput"
          accept=".csv,.jpg,.jpeg,.pdf,.png,.xls,.xlsx"
          type="file"
          class="finance-ai-parse__file-input"
          @change="handleFileInput"
        />

        <div class="finance-ai-parse__upload-footer">
          <Button type="primary" :loading="uploading" @click="openFileDialog">
            选择文件识别
          </Button>
          <span>建议优先上传 Excel/CSV 或带文本层的 PDF，识别结果会更准确。</span>
        </div>
      </section>

      <section v-else class="finance-ai-parse__panel">
        <div class="finance-ai-parse__preview-title">
          <div>
            <strong>请确认本次将更新的数据</strong>
            <p>如果识别结果不正确，可以删除本次结果后重新上传；确认后才会写入财务数据。</p>
          </div>
          <div class="finance-ai-parse__actions">
            <Button :disabled="approving || deleting" @click="resetWorkflow">
              重新上传
            </Button>
            <Button
              type="primary"
              :disabled="!hasPreviewDrafts || deleting"
              :loading="approving"
              @click="approvePreviewDrafts"
            >
              确认更新
            </Button>
          </div>
        </div>

        <div v-if="!hasPreviewDrafts" class="finance-ai-parse__empty">
          暂无可确认的识别结果，请重新上传文件。
        </div>

        <article
          v-for="draft in previewDrafts"
          :key="draft.id"
          class="finance-ai-parse__draft-card"
        >
          <div class="finance-ai-parse__draft-head">
            <div>
              <div class="finance-ai-parse__source">
                <a
                  v-if="draft.draftPayload.sourcePreviewUrl"
                  :href="draft.draftPayload.sourcePreviewUrl"
                  rel="noopener noreferrer"
                  target="_blank"
                  :title="draft.draftPayload.sourceFileName"
                >
                  {{ draft.draftPayload.sourceFileName }}
                </a>
                <span v-else>{{ draft.draftPayload.sourceFileName }}</span>
              </div>
              <p>{{ getDraftUpdateSummary(draft) }}</p>
            </div>
            <div class="finance-ai-parse__draft-tags">
              <Tag :color="getParseTagColor(draft.draftPayload.parseStatus)">
                {{ getParseStatusText(draft.draftPayload.parseStatus) }}
              </Tag>
              <Tag :color="getConfidenceTagColor(draft.draftPayload.confidence)">
                置信度 {{ draft.draftPayload.confidence }}
              </Tag>
              <Tag>年度 {{ draft.draftPayload.year }}</Tag>
            </div>
          </div>

          <div class="finance-ai-parse__section">
            <div class="finance-ai-parse__section-title">
              <strong>财务数据</strong>
              <span>{{ getFinancialDiffSummary(draft) }}</span>
            </div>
            <div
              v-if="buildFinancialDiffRows(draft).length > 0"
              class="finance-ai-parse__diff-list"
            >
              <div
                v-for="row in buildFinancialDiffRows(draft)"
                :key="row.field"
                class="finance-ai-parse__diff-row"
              >
                <span class="finance-ai-parse__field-name">{{ row.label }}</span>
                <span class="finance-ai-parse__field-current">{{ row.currentValue }}</span>
                <IconifyIcon icon="lucide:arrow-right" class="finance-ai-parse__field-arrow" />
                <strong>{{ row.aiValue }}</strong>
              </div>
            </div>
            <div v-else class="finance-ai-parse__empty-inline">
              本文件没有识别到可更新的财务字段。
            </div>
          </div>

          <div class="finance-ai-parse__section">
            <div class="finance-ai-parse__section-title">
              <strong>纳税审计</strong>
              <span>{{ getTaxAuditDiffSummary(draft) }}</span>
            </div>
            <div
              v-if="buildTaxAuditDiffRows(draft).length > 0"
              class="finance-ai-parse__diff-list"
            >
              <div
                v-for="row in buildTaxAuditDiffRows(draft)"
                :key="row.field"
                class="finance-ai-parse__diff-row"
              >
                <span class="finance-ai-parse__field-name">{{ row.label }}</span>
                <span class="finance-ai-parse__field-current">{{ row.currentValue }}</span>
                <IconifyIcon icon="lucide:arrow-right" class="finance-ai-parse__field-arrow" />
                <strong>{{ row.aiValue }}</strong>
              </div>
            </div>
            <div v-else class="finance-ai-parse__empty-inline">
              本文件没有识别到可更新的纳税审计信息。
            </div>
          </div>

          <div
            v-if="draft.draftPayload.reviewWarnings.length > 0"
            class="finance-ai-parse__warnings"
          >
            <span v-for="warning in draft.draftPayload.reviewWarnings" :key="warning">
              {{ warning }}
            </span>
          </div>

          <div class="finance-ai-parse__card-actions">
            <Button
              danger
              :disabled="draft.status === 'approved'"
              :loading="deleting"
              size="small"
              @click="confirmDeleteDraft(draft)"
            >
              删除本次结果
            </Button>
          </div>
        </article>
      </section>
    </div>
  </Modal>
</template>

<style scoped>
.finance-ai-parse {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.finance-ai-parse__steps {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.finance-ai-parse__step {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 22%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.finance-ai-parse__step--active {
  color: hsl(var(--foreground));
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 40%);
}

.finance-ai-parse__step > span {
  display: grid;
  flex: 0 0 26px;
  width: 26px;
  height: 26px;
  font-weight: 700;
  color: hsl(var(--primary));
  place-items: center;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--primary) / 35%);
  border-radius: 999px;
}

.finance-ai-parse__step strong,
.finance-ai-parse__preview-title strong,
.finance-ai-parse__section-title strong {
  display: block;
}

.finance-ai-parse__step p,
.finance-ai-parse__preview-title p,
.finance-ai-parse__draft-head p {
  margin: 4px 0 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.finance-ai-parse__panel {
  padding: 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.finance-ai-parse__dropzone {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 180px;
  padding: 26px;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: hsl(var(--muted) / 35%);
  border: 1px dashed hsl(var(--border));
  border-radius: 10px;
}

.finance-ai-parse__dropzone--dragging {
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary));
}

.finance-ai-parse__drop-icon {
  width: 36px;
  height: 36px;
  color: hsl(var(--primary));
}

.finance-ai-parse__dropzone span,
.finance-ai-parse__upload-footer span,
.finance-ai-parse__section-title span {
  color: hsl(var(--muted-foreground));
}

.finance-ai-parse__file-input {
  display: none;
}

.finance-ai-parse__upload-footer,
.finance-ai-parse__preview-title,
.finance-ai-parse__draft-head,
.finance-ai-parse__card-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.finance-ai-parse__upload-footer {
  margin-top: 12px;
}

.finance-ai-parse__actions,
.finance-ai-parse__draft-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.finance-ai-parse__empty,
.finance-ai-parse__empty-inline {
  color: hsl(var(--muted-foreground));
}

.finance-ai-parse__empty {
  padding: 36px 0;
  text-align: center;
}

.finance-ai-parse__empty-inline {
  padding: 12px;
  font-size: 13px;
  background: hsl(var(--muted) / 22%);
  border-radius: 8px;
}

.finance-ai-parse__draft-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  margin-top: 14px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.finance-ai-parse__source {
  font-weight: 600;
}

.finance-ai-parse__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.finance-ai-parse__section-title {
  display: flex;
  gap: 10px;
  align-items: baseline;
}

.finance-ai-parse__diff-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.finance-ai-parse__diff-row {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr) 16px minmax(0, 1fr);
  gap: 6px;
  align-items: center;
  min-height: 34px;
  padding: 6px 8px;
  background: hsl(var(--muted) / 24%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.finance-ai-parse__field-name {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.finance-ai-parse__field-current,
.finance-ai-parse__diff-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.finance-ai-parse__field-arrow {
  width: 14px;
  height: 14px;
  color: hsl(var(--muted-foreground));
}

.finance-ai-parse__warnings {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.finance-ai-parse__warnings span {
  max-width: 100%;
  padding: 5px 7px;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: hsl(36 80% 32%);
  background: hsl(42 100% 92%);
  border: 1px solid hsl(38 92% 72%);
  border-radius: 7px;
}

@media (max-width: 768px) {
  .finance-ai-parse__steps,
  .finance-ai-parse__diff-list {
    grid-template-columns: 1fr;
  }

  .finance-ai-parse__preview-title,
  .finance-ai-parse__draft-head,
  .finance-ai-parse__upload-footer,
  .finance-ai-parse__card-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
