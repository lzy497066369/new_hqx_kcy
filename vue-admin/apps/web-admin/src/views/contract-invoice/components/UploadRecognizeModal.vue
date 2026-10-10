<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Empty, Tag, message } from 'antdv-next';

import type {
  ContractDraft,
  ContractRecord,
  DocumentKind,
  InvoiceDraft,
  RecognizedDraft,
  UploadRecognizePayload,
} from '../types';

interface UploadModalData {
  contractId?: string;
  kind?: DocumentKind;
}

const props = defineProps<{
  contracts: ContractRecord[];
}>();

const emit = defineEmits<{
  success: [payload: UploadRecognizePayload];
}>();

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef');
const kind = shallowRef<DocumentKind>('contract');
const defaultContractId = shallowRef<string>();
const drafts = ref<RecognizedDraft[]>([]);
const recognizing = shallowRef(false);
const dragging = shallowRef(false);

const modalTitle = computed(() =>
  kind.value === 'contract' ? '上传识别合同' : '上传识别发票',
);

const uploadTitle = computed(() =>
  kind.value === 'contract' ? '拖拽上传合同文件' : '拖拽上传发票文件',
);

const uploadDescription = computed(() =>
  kind.value === 'contract'
    ? 'AI 会自动读取合同金额、合作对象、合同编号和签约日期。'
    : 'AI 会自动读取发票号码、开票日期、销售方、购买方和金额，并尝试关联合同。',
);

const hasDrafts = computed(() => drafts.value.length > 0);

const contractOptions = computed(() =>
  props.contracts.map((contract) => ({
    label: `${contract.name} / ${contract.counterparty}`,
    value: contract.id,
  })),
);

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!hasDrafts.value) {
      message.warning('请先上传文件并完成识别');
      return;
    }

    emit('success', { drafts: drafts.value });
    modalApi.close();
  },
  onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }
    const data = modalApi.getData<UploadModalData>() ?? {};
    kind.value = data.kind ?? 'contract';
    defaultContractId.value = data.contractId;
    drafts.value = [];
    recognizing.value = false;
    dragging.value = false;
  },
});

function openFilePicker() {
  fileInputRef.value?.click();
}

function handleInputChange(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files ?? []);
  void recognizeFiles(files);
  (event.target as HTMLInputElement).value = '';
}

function handleDrop(event: DragEvent) {
  dragging.value = false;
  const files = Array.from(event.dataTransfer?.files ?? []);
  void recognizeFiles(files);
}

async function recognizeFiles(files: File[]) {
  const availableFiles = files.filter((file) =>
    ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) ||
    /\.(ofd|pdf|png|jpe?g)$/i.test(file.name),
  );

  if (availableFiles.length === 0) {
    message.warning('请上传 PDF、OFD、PNG 或 JPG 文件');
    return;
  }

  recognizing.value = true;
  await new Promise((resolve) => window.setTimeout(resolve, 600));
  drafts.value = [
    ...drafts.value,
    ...availableFiles.map((file, index) => simulateRecognition(file, index)),
  ];
  recognizing.value = false;
}

function simulateRecognition(file: File, index: number): RecognizedDraft {
  if (kind.value === 'contract') {
    return {
      data: createContractDraft(file, index),
      kind: 'contract',
    };
  }

  return {
    data: createInvoiceDraft(file, index),
    kind: 'invoice',
  };
}

function createContractDraft(file: File, index: number): ContractDraft {
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return {
    amount: String(96_000 + index * 18_500),
    contractNo: `HT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}${index}`,
    counterparty: index % 2 === 0 ? '杭州智链科技有限公司' : '成都云策信息技术有限公司',
    fileName: file.name,
    id: `${file.name}-${Date.now()}-${index}`,
    name: baseName || '未命名合同',
    ourEntity: '川涌城市服务有限公司',
    signDate: '2026-07-08',
    summary: 'AI 已识别合同主体、金额、合作对象和开票约定，保存前可继续修正。',
  };
}

function createInvoiceDraft(file: File, index: number): InvoiceDraft {
  const matchedContract =
    props.contracts.find((contract) => contract.id === defaultContractId.value) ??
    props.contracts[index % Math.max(props.contracts.length, 1)];

  return {
    amount: String(42_000 + index * 12_800),
    buyerName: matchedContract?.ourEntity ?? '川涌城市服务有限公司',
    contractId: matchedContract?.id,
    fileName: file.name,
    id: `${file.name}-${Date.now()}-${index}`,
    invoiceNo: `33${String(Date.now()).slice(-8)}${index}`,
    invoiceType: '增值税专用发票',
    issueDate: '2026-07-08',
    matchConfidence: matchedContract ? 'high' : 'low',
    sellerName: matchedContract?.counterparty ?? '待识别销售方',
    taxAmount: String(3853.21 + index * 640),
  };
}

function removeDraft(id: string) {
  drafts.value = drafts.value.filter((draft) => draft.data.id !== id);
}

function getContractName(contractId?: string) {
  return props.contracts.find((contract) => contract.id === contractId)?.name ?? '未关联';
}
</script>

<template>
  <Modal :title="modalTitle" class="w-full max-w-260">
    <div class="contract-upload-modal">
      <div class="contract-upload-toolbar">
        <Tag color="blue">
          {{ kind === 'contract' ? '合同识别' : '发票识别' }}
        </Tag>
        <span class="contract-upload-tip">
          {{ kind === 'contract' ? '支持一次上传多个合同 PDF' : '可从合同详情进入并自动关联' }}
        </span>
      </div>

      <button
        class="contract-upload-dropzone"
        :class="{ 'is-dragging': dragging }"
        type="button"
        @click="openFilePicker"
        @dragenter.prevent="dragging = true"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="handleDrop"
      >
        <IconifyIcon icon="lucide:upload-cloud" class="contract-upload-icon" />
        <strong>{{ uploadTitle }}</strong>
        <span>{{ uploadDescription }}</span>
        <small>支持 PDF、OFD、PNG、JPG</small>
      </button>
      <input
        ref="fileInputRef"
        accept=".pdf,.ofd,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        class="hidden"
        multiple
        type="file"
        @change="handleInputChange"
      />

      <div class="contract-upload-result">
        <div class="contract-upload-result-head">
          <div>
            <div class="contract-upload-result-title">AI 识别结果</div>
            <div class="contract-upload-result-desc">确认前可以直接修正字段。</div>
          </div>
          <Tag :color="hasDrafts ? 'blue' : 'default'">
            {{ recognizing ? '识别中' : `${drafts.length} 条待确认` }}
          </Tag>
        </div>

        <Empty v-if="!hasDrafts" description="上传文件后生成待确认数据" />

        <div v-else class="contract-upload-drafts">
          <div
            v-for="draft in drafts"
            :key="draft.data.id"
            class="contract-upload-draft"
          >
            <div class="contract-upload-draft-head">
              <div>
                <strong>{{ draft.data.fileName }}</strong>
                <span>{{ draft.kind === 'contract' ? '合同档案' : '发票档案' }}</span>
              </div>
              <Button danger size="small" @click="removeDraft(draft.data.id)">
                移除
              </Button>
            </div>

            <div v-if="draft.kind === 'contract'" class="contract-upload-form-grid">
              <label>
                合同名称
                <input v-model="draft.data.name" />
              </label>
              <label>
                合同编号
                <input v-model="draft.data.contractNo" />
              </label>
              <label>
                合作对象
                <input v-model="draft.data.counterparty" />
              </label>
              <label>
                我方主体
                <input v-model="draft.data.ourEntity" />
              </label>
              <label>
                合同金额
                <input v-model="draft.data.amount" />
              </label>
              <label>
                签约日期
                <input v-model="draft.data.signDate" type="date" />
              </label>
              <label class="contract-upload-form-wide">
                AI 摘要
                <textarea v-model="draft.data.summary" rows="2" />
              </label>
            </div>

            <div v-else class="contract-upload-form-grid">
              <label>
                发票类型
                <input v-model="draft.data.invoiceType" />
              </label>
              <label>
                发票号码
                <input v-model="draft.data.invoiceNo" />
              </label>
              <label>
                销售方
                <input v-model="draft.data.sellerName" />
              </label>
              <label>
                购买方
                <input v-model="draft.data.buyerName" />
              </label>
              <label>
                发票金额
                <input v-model="draft.data.amount" />
              </label>
              <label>
                税额
                <input v-model="draft.data.taxAmount" />
              </label>
              <label>
                开票日期
                <input v-model="draft.data.issueDate" type="date" />
              </label>
              <label>
                关联合同
                <select v-model="draft.data.contractId">
                  <option value="">不关联</option>
                  <option
                    v-for="option in contractOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>
              <div class="contract-upload-form-wide contract-upload-match">
                <Tag :color="draft.data.matchConfidence === 'high' ? 'green' : 'orange'">
                  {{ draft.data.matchConfidence === 'high' ? '高置信度匹配' : '需人工确认' }}
                </Tag>
                <span>{{ getContractName(draft.data.contractId) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.contract-upload-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 16px 12px;
}

.contract-upload-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.contract-upload-tip {
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}

.contract-upload-dropzone {
  display: flex;
  min-height: 184px;
  width: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgb(14 116 144 / 8%), transparent 46%),
    hsl(var(--muted) / 42%);
  color: hsl(var(--foreground));
  cursor: pointer;
  gap: 8px;
  text-align: center;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease;
}

.contract-upload-dropzone:hover,
.contract-upload-dropzone.is-dragging {
  border-color: rgb(14 116 144);
  background-color: rgb(14 116 144 / 8%);
  transform: translateY(-1px);
}

.contract-upload-icon {
  color: rgb(14 116 144);
  font-size: 40px;
}

.contract-upload-dropzone span,
.contract-upload-dropzone small {
  color: hsl(var(--muted-foreground));
}

.contract-upload-result {
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--background));
  padding: 14px;
}

.contract-upload-result-head,
.contract-upload-draft-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.contract-upload-result-title {
  color: hsl(var(--foreground));
  font-weight: 650;
}

.contract-upload-result-desc {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  margin-top: 2px;
}

.contract-upload-drafts {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}

.contract-upload-draft {
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 14px;
}

.contract-upload-draft-head strong {
  display: block;
  color: hsl(var(--foreground));
}

.contract-upload-draft-head span {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.contract-upload-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.contract-upload-form-grid label {
  color: hsl(var(--muted-foreground));
  display: flex;
  flex-direction: column;
  font-size: 12px;
  gap: 6px;
}

.contract-upload-form-grid input,
.contract-upload-form-grid select,
.contract-upload-form-grid textarea {
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  min-height: 34px;
  padding: 6px 10px;
  outline: none;
}

.contract-upload-form-grid textarea {
  resize: vertical;
}

.contract-upload-form-grid input:focus,
.contract-upload-form-grid select:focus,
.contract-upload-form-grid textarea:focus {
  border-color: rgb(14 116 144);
  box-shadow: 0 0 0 2px rgb(14 116 144 / 12%);
}

.contract-upload-form-wide {
  grid-column: 1 / -1;
}

.contract-upload-match {
  align-items: center;
  background: hsl(var(--muted) / 48%);
  border-radius: 6px;
  display: flex;
  gap: 8px;
  min-height: 36px;
  padding: 8px 10px;
}

@media (max-width: 768px) {
  .contract-upload-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
