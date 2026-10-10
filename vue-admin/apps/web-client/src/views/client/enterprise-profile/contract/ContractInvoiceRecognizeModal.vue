<script setup lang="ts">
import type { ClientEnterpriseContractApi } from '#/api/client';

import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Empty, Modal, Tag, message } from 'antdv-next';

type RecognizeKind = 'contracts' | 'invoices';

type ContractDraft = ClientEnterpriseContractApi.Contract & {
  draftId: string;
};

type InvoiceDraft = ClientEnterpriseContractApi.Invoice & {
  draftId: string;
};

const props = defineProps<{
  contracts: ClientEnterpriseContractApi.Contract[];
  defaultContractId?: number | string;
  kind: RecognizeKind;
  open: boolean;
}>();

const emit = defineEmits<{
  confirm: [kind: RecognizeKind, records: Record<string, unknown>[]];
  'update:open': [open: boolean];
}>();

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef');
const contractDrafts = ref<ContractDraft[]>([]);
const invoiceDrafts = ref<InvoiceDraft[]>([]);
const dragging = shallowRef(false);
const recognizing = shallowRef(false);

const modalTitle = computed(() =>
  props.kind === 'contracts' ? '上传识别合同' : '上传识别发票',
);

const uploadTitle = computed(() =>
  props.kind === 'contracts' ? '拖拽上传合同文件' : '拖拽上传发票文件',
);

const uploadDescription = computed(() =>
  props.kind === 'contracts'
    ? 'AI 自动读取合同名称、编号、客户、金额、日期，并生成合同摘要。'
    : 'AI 自动读取发票编号、开票日期、金额，并尝试关联合同。',
);

const currentDrafts = computed(() =>
  props.kind === 'contracts' ? contractDrafts.value : invoiceDrafts.value,
);

const hasDrafts = computed(() => currentDrafts.value.length > 0);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return;
    }
    contractDrafts.value = [];
    invoiceDrafts.value = [];
    dragging.value = false;
    recognizing.value = false;
  },
);

function closeModal() {
  emit('update:open', false);
}

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
  await new Promise((resolve) => window.setTimeout(resolve, 500));
  if (props.kind === 'contracts') {
    contractDrafts.value = [
      ...contractDrafts.value,
      ...availableFiles.map(createContractDraft),
    ];
  } else {
    invoiceDrafts.value = [
      ...invoiceDrafts.value,
      ...availableFiles.map(createInvoiceDraft),
    ];
  }
  recognizing.value = false;
}

function createDraftId(file: File) {
  return `${file.name}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createInvoiceDraft(file: File, index: number): InvoiceDraft {
  const matchedContract =
    props.contracts.find((contract) => String(contract.id) === String(props.defaultContractId)) ??
    props.contracts[index % Math.max(props.contracts.length, 1)];

  return {
    draftId: createDraftId(file),
    fp_date: '2026-07-08',
    fp_money: 30_000 + index * 8800,
    fp_num: `FP${String(Date.now()).slice(-8)}${index}`,
    fp_status: 1,
    ht_id: matchedContract?.id,
    remark: matchedContract
      ? `AI 推荐关联：${matchedContract.ht_name}`
      : 'AI 未匹配到合同，可保存后手动关联。',
    zf_date: '',
  };
}

function removeDraft(draftId: string) {
  if (props.kind === 'contracts') {
    contractDrafts.value = contractDrafts.value.filter(
      (draft) => draft.draftId !== draftId,
    );
    return;
  }

  invoiceDrafts.value = invoiceDrafts.value.filter(
    (draft) => draft.draftId !== draftId,
  );
}

function confirmDrafts() {
  if (!hasDrafts.value) {
    message.warning('请先上传文件并完成识别');
    return;
  }

  const records = currentDrafts.value.map(({ draftId: _draftId, ...record }) => ({
    ...record,
  }));
  emit('confirm', props.kind, records);
  closeModal();
}

function getContractName(contractId?: number | string) {
  return (
    props.contracts.find((contract) => String(contract.id) === String(contractId))
      ?.ht_name ?? '未关联'
  );
}
function createContractDraft(file: File, index: number): ContractDraft {
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const customerName =
    index % 2 === 0 ? '杭州智链科技有限公司' : '成都云策信息技术有限公司';
  const amount = 80_000 + index * 16_000;
  const signDate = resolveRecognizedDate(file.name);
  const signDateSummary = signDate ? `签订日期为 ${signDate}` : '签订日期未识别';
  return {
    draftId: createDraftId(file),
    end_date: '',
    ht_des: `本合同合作对象为${customerName}，合同金额约 ${amount} 元，${signDateSummary}，合同周期未识别，主要用于项目服务/采购交付及相关验收开票事项。`,
    ht_money: amount,
    ht_name: baseName || '未命名合同',
    ht_num: `HT-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}${index}`,
    ht_path: file.name,
    ht_status: 1,
    kh_name: customerName,
    qd_date: signDate,
    start_date: '',
  };
}

function resolveRecognizedDate(fileName: string) {
  const normalizedName = fileName.replace(/\.[^.]+$/, '');
  const dashedDate = normalizedName.match(
    /(20\d{2})[-_.年](0?[1-9]|1[0-2])[-_.月](0?[1-9]|[12]\d|3[01])日?/u,
  );
  if (dashedDate?.[1] && dashedDate[2] && dashedDate[3]) {
    return formatDateParts(dashedDate[1], dashedDate[2], dashedDate[3]);
  }

  const compactDate = normalizedName.match(
    /(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/u,
  );
  if (compactDate?.[1] && compactDate[2] && compactDate[3]) {
    return formatDateParts(compactDate[1], compactDate[2], compactDate[3]);
  }

  return '';
}

function formatDateParts(year: string, month: string, day: string) {
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
</script>

<template>
  <Modal
    :open="open"
    :title="modalTitle"
    width="880px"
    @cancel="closeModal"
    @ok="confirmDrafts"
  >
    <div class="recognize-modal">
      <div class="recognize-toolbar">
        <Tag color="blue">
          {{ kind === 'contracts' ? '合同识别' : '发票识别' }}
        </Tag>
        <span>{{ kind === 'contracts' ? '支持批量上传合同' : '可自动匹配已有合同' }}</span>
      </div>

      <button
        class="recognize-dropzone"
        :class="{ 'is-dragging': dragging }"
        type="button"
        @click="openFilePicker"
        @dragenter.prevent="dragging = true"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="handleDrop"
      >
        <IconifyIcon icon="lucide:upload-cloud" class="recognize-upload-icon" />
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

      <div class="recognize-result">
        <div class="recognize-result-head">
          <div>
            <div class="recognize-result-title">AI 识别结果</div>
            <div class="recognize-result-desc">确认前可以直接修改识别字段。</div>
          </div>
          <Tag :color="hasDrafts ? 'blue' : 'default'">
            {{ recognizing ? '识别中' : `${currentDrafts.length} 条待确认` }}
          </Tag>
        </div>

        <Empty v-if="!hasDrafts" description="上传文件后生成待确认数据" />

        <div v-else class="recognize-drafts">
          <div
            v-for="draft in contractDrafts"
            v-show="kind === 'contracts'"
            :key="draft.draftId"
            class="recognize-draft"
          >
            <div class="recognize-draft-head">
              <strong>{{ draft.ht_path }}</strong>
              <Button danger size="small" @click="removeDraft(draft.draftId)">
                移除
              </Button>
            </div>
            <div class="recognize-form-grid">
              <label>合同名称<input v-model="draft.ht_name" /></label>
              <label>合同编号<input v-model="draft.ht_num" /></label>
              <label>客户名称<input v-model="draft.kh_name" /></label>
              <label>合同金额<input v-model="draft.ht_money" /></label>
              <label>签订日期<input v-model="draft.qd_date" placeholder="例如 2026-07-08" /></label>
              <label>生效日期<input v-model="draft.start_date" placeholder="例如 2026-07-08" /></label>
              <label>截止日期<input v-model="draft.end_date" placeholder="例如 2026-12-31" /></label>
              <label>合同文件<input v-model="draft.ht_path" /></label>
              <label class="recognize-form-wide">
                AI 合同摘要<textarea v-model="draft.ht_des" rows="3" />
              </label>
            </div>
          </div>

          <div
            v-for="draft in invoiceDrafts"
            v-show="kind === 'invoices'"
            :key="draft.draftId"
            class="recognize-draft"
          >
            <div class="recognize-draft-head">
              <strong>{{ draft.fp_num }}</strong>
              <Button danger size="small" @click="removeDraft(draft.draftId)">
                移除
              </Button>
            </div>
            <div class="recognize-form-grid">
              <label>发票编号<input v-model="draft.fp_num" /></label>
              <label>开票日期<input v-model="draft.fp_date" type="date" /></label>
              <label>发票金额<input v-model="draft.fp_money" /></label>
              <label>支付日期<input v-model="draft.zf_date" type="date" /></label>
              <label>
                关联合同
                <select v-model="draft.ht_id">
                  <option value="">不关联</option>
                  <option
                    v-for="contract in contracts"
                    :key="contract.id"
                    :value="contract.id"
                  >
                    {{ contract.ht_name }}
                  </option>
                </select>
              </label>
              <label class="recognize-form-wide">
                备注<textarea v-model="draft.remark" rows="2" />
              </label>
              <div class="recognize-form-wide recognize-match">
                <Tag :color="draft.ht_id ? 'green' : 'orange'">
                  {{ draft.ht_id ? '已匹配合同' : '需人工确认' }}
                </Tag>
                <span>{{ getContractName(draft.ht_id) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.recognize-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.recognize-toolbar {
  align-items: center;
  color: hsl(var(--muted-foreground));
  display: flex;
  flex-wrap: wrap;
  font-size: 13px;
  gap: 8px;
}

.recognize-dropzone {
  align-items: center;
  background:
    linear-gradient(135deg, rgb(14 116 144 / 8%), transparent 46%),
    hsl(var(--muted) / 42%);
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
  color: hsl(var(--foreground));
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  min-height: 178px;
  text-align: center;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease;
  width: 100%;
}

.recognize-dropzone:hover,
.recognize-dropzone.is-dragging {
  background-color: rgb(14 116 144 / 8%);
  border-color: rgb(14 116 144);
  transform: translateY(-1px);
}

.recognize-upload-icon {
  color: rgb(14 116 144);
  font-size: 40px;
}

.recognize-dropzone span,
.recognize-dropzone small {
  color: hsl(var(--muted-foreground));
}

.recognize-result {
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 14px;
}

.recognize-result-head,
.recognize-draft-head {
  align-items: flex-start;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
}

.recognize-result-title {
  color: hsl(var(--foreground));
  font-weight: 650;
}

.recognize-result-desc {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  margin-top: 2px;
}

.recognize-drafts {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}

.recognize-draft {
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 14px;
}

.recognize-draft-head strong {
  color: hsl(var(--foreground));
}

.recognize-form-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 14px;
}

.recognize-form-grid label {
  color: hsl(var(--muted-foreground));
  display: flex;
  flex-direction: column;
  font-size: 12px;
  gap: 6px;
}

.recognize-form-grid input,
.recognize-form-grid select,
.recognize-form-grid textarea {
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  color: hsl(var(--foreground));
  min-height: 34px;
  outline: none;
  padding: 6px 10px;
}

.recognize-form-grid textarea {
  resize: vertical;
}

.recognize-form-grid input:focus,
.recognize-form-grid select:focus,
.recognize-form-grid textarea:focus {
  border-color: rgb(14 116 144);
  box-shadow: 0 0 0 2px rgb(14 116 144 / 12%);
}

.recognize-form-wide {
  grid-column: 1 / -1;
}

.recognize-match {
  align-items: center;
  background: hsl(var(--muted) / 48%);
  border-radius: 6px;
  display: flex;
  gap: 8px;
  min-height: 36px;
  padding: 8px 10px;
}

@media (max-width: 768px) {
  .recognize-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>

