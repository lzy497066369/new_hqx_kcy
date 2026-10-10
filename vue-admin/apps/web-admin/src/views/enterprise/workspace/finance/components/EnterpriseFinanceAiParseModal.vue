<script setup lang="ts">
import type { EnterpriseWorkspaceFinanceAiDraft } from '#/api';
import type { TableColumnsType } from 'antdv-next';

import { computed, reactive, shallowRef, useTemplateRef, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Checkbox, Empty, Form, FormItem, Input, Modal, Select, Table, Tag } from 'antdv-next';

import {
  approveEnterpriseWorkspaceFinanceAiParseDraftsApi,
  deleteEnterpriseWorkspaceFinanceAiParseDraftApi,
  getEnterpriseWorkspaceFinanceAiParseDraftsApi,
  rejectEnterpriseWorkspaceFinanceAiParseDraftsApi,
  retryEnterpriseWorkspaceFinanceAiParseDraftsApi,
  updateEnterpriseWorkspaceFinanceAiParseDraftApi,
  uploadEnterpriseWorkspaceFinanceAiParseFilesApi,
} from '#/api';
import EnterpriseAiTaskStatusList from '../../components/EnterpriseAiTaskStatusList.vue';

import { showActionFailure, showActionSuccess } from '../../../../system/shared/action-feedback';
import { formatFinanceAmount } from '../finance-amount';

defineOptions({ name: 'EnterpriseFinanceAiParseModal' });

const props = defineProps<{
  enterpriseId: string;
}>();

const emit = defineEmits<{ approved: [] }>();
const open = defineModel<boolean>('open', { required: true });
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInput');
const drafts = shallowRef<EnterpriseWorkspaceFinanceAiDraft[]>([]);
const selectedIds = shallowRef<string[]>([]);
const loading = shallowRef(false);
const uploading = shallowRef(false);
const approving = shallowRef(false);
const editing = shallowRef<EnterpriseWorkspaceFinanceAiDraft>();
const editorOpen = shallowRef(false);
const saving = shallowRef(false);
const editForm = reactive({
  documentType: 'financial_statement' as 'financial_statement' | 'other' | 'tax_audit',
  fz: '',
  fzl: '',
  highTechIncome: '',
  lrTotal: '',
  mainBusinessIncome: '',
  netAssets: '',
  netProfit: '',
  q: 1,
  rdDepreciation: '',
  rdDesignFee: '',
  rdDirectInput: '',
  rdEntrustedDevelopment: '',
  rdEquipmentDebuggingFee: '',
  rdExpense: '',
  rdIntangibleAmortization: '',
  rdOtherExpense: '',
  rdPersonnelCost: '',
  remark: '',
  xxsr: '',
  year: '',
  zxc: '',
});

const reviewDrafts = computed(() => drafts.value.filter((draft) => draft.status === 'reviewing'));
const selectedReviewDrafts = computed(() =>
  reviewDrafts.value.filter((draft) => selectedIds.value.includes(draft.id)),
);
const columns: TableColumnsType<EnterpriseWorkspaceFinanceAiDraft> = [
  { key: 'select', width: 48 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 88 },
  { dataIndex: ['draftPayload', 'sourceFileName'], key: 'source', title: '来源文件', width: 180 },
  { dataIndex: ['draftPayload', 'year'], key: 'year', title: '年度', width: 88 },
  { dataIndex: ['draftPayload', 'documentType'], key: 'type', title: '文件类型', width: 108 },
  { key: 'revenue', title: '营业收入(万元)', width: 132 },
  { key: 'assets', title: '总资产(万元)', width: 132 },
  { key: 'liabilities', title: '负债合计(万元)', width: 132 },
  { key: 'profit', title: '净利润(万元)', width: 132 },
  { dataIndex: ['draftPayload', 'confidence'], key: 'confidence', title: '置信度', width: 92 },
  { key: 'actions', fixed: 'right', title: '操作', width: 210 },
];

watch(
  () => [open.value, props.enterpriseId] as const,
  ([visible]) => {
    if (visible) {
      void loadDrafts();
    }
  },
);

function getStatusLabel(status: string) {
  return { approved: '已入库', rejected: '已作废', reviewing: '待审核' }[status] ?? status;
}

function getStatusColor(status: string) {
  return { approved: 'success', rejected: 'default', reviewing: 'processing' }[status] ?? 'default';
}

function getDocumentTypeLabel(type: EnterpriseWorkspaceFinanceAiDraft['draftPayload']['documentType']) {
  return { financial_statement: '财务报表', other: '其他资料', tax_audit: '纳税审计' }[type ?? 'other'];
}

function getFinancialValue(draft: EnterpriseWorkspaceFinanceAiDraft, key: string) {
  const value = draft.draftPayload.financial?.[key];
  return formatFinanceAmount(value);
}

function confidenceColor(value: number) {
  return value >= 80 ? 'success' : value >= 60 ? 'warning' : 'error';
}

async function loadDrafts() {
  if (!props.enterpriseId) return;
  loading.value = true;
  try {
    const result = await getEnterpriseWorkspaceFinanceAiParseDraftsApi(props.enterpriseId);
    drafts.value = result.items;
    selectedIds.value = [];
  } catch (error) {
    showActionFailure(error);
  } finally {
    loading.value = false;
  }
}

function chooseFiles() {
  fileInputRef.value?.click();
}

async function upload(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (!files.length) return;
  if (files.length > 10) {
    showActionFailure(new Error('单次最多上传 10 个财税文件'));
    return;
  }
  uploading.value = true;
  try {
    await uploadEnterpriseWorkspaceFinanceAiParseFilesApi(props.enterpriseId, files);
    await loadDrafts();
    showActionSuccess('财税文件已解析，请核对草稿后选择入库');
  } catch (error) {
    showActionFailure(error);
  } finally {
    uploading.value = false;
  }
}

function toggleAll(checked: boolean) {
  selectedIds.value = checked ? reviewDrafts.value.map((draft) => draft.id) : [];
}

function toggleDraft(id: string, checked: boolean) {
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, id])]
    : selectedIds.value.filter((item) => item !== id);
}

function openEditor(draft: EnterpriseWorkspaceFinanceAiDraft) {
  editing.value = draft;
  const financial = draft.draftPayload.financial ?? {};
  Object.assign(editForm, {
    documentType: draft.draftPayload.documentType ?? 'other',
    fz: String(financial.fz ?? ''),
    fzl: String(financial.fzl ?? ''),
    highTechIncome: String(financial.high_tech_income ?? ''),
    lrTotal: String(financial.lr_total ?? ''),
    mainBusinessIncome: String(financial.main_business_income ?? ''),
    netAssets: String(financial.net_assets ?? ''),
    netProfit: String(financial.net_profit ?? ''),
    q: 1,
    rdDepreciation: String(financial.rd_depreciation ?? ''),
    rdDesignFee: String(financial.rd_design_fee ?? ''),
    rdDirectInput: String(financial.rd_direct_input ?? ''),
    rdEntrustedDevelopment: String(financial.rd_entrusted_development ?? ''),
    rdEquipmentDebuggingFee: String(financial.rd_equipment_debugging_fee ?? ''),
    rdExpense: String(financial.yffy ?? ''),
    rdIntangibleAmortization: String(financial.rd_intangible_amortization ?? ''),
    rdOtherExpense: String(financial.rd_other_expense ?? ''),
    rdPersonnelCost: String(financial.rd_personnel_cost ?? ''),
    remark: String(financial.remark ?? ''),
    xxsr: String(financial.xxsr ?? ''),
    year: draft.draftPayload.year ?? '',
    zxc: String(financial.zxc ?? ''),
  });
  editorOpen.value = true;
}

async function saveDraft() {
  if (!editing.value) return;
  saving.value = true;
  try {
    const financial = {
      ...(editing.value.draftPayload.financial ?? {}),
      fz: editForm.fz || null,
      fzl: editForm.fzl || null,
      high_tech_income: editForm.highTechIncome || null,
      lr_total: editForm.lrTotal || null,
      main_business_income: editForm.mainBusinessIncome || null,
      net_assets: editForm.netAssets || null,
      net_profit: editForm.netProfit || null,
      q: 1,
      rd_depreciation: editForm.rdDepreciation || null,
      rd_design_fee: editForm.rdDesignFee || null,
      rd_direct_input: editForm.rdDirectInput || null,
      rd_entrusted_development: editForm.rdEntrustedDevelopment || null,
      rd_equipment_debugging_fee: editForm.rdEquipmentDebuggingFee || null,
      rd_intangible_amortization: editForm.rdIntangibleAmortization || null,
      rd_other_expense: editForm.rdOtherExpense || null,
      rd_personnel_cost: editForm.rdPersonnelCost || null,
      remark: editForm.remark || null,
      xxsr: editForm.xxsr || null,
      year: editForm.year,
      yffy: editForm.rdExpense || null,
      zxc: editForm.zxc || null,
    };
    await updateEnterpriseWorkspaceFinanceAiParseDraftApi(props.enterpriseId, editing.value.id, {
      ...editing.value.draftPayload,
      documentType: editForm.documentType,
      financial,
      taxAudit: editForm.documentType === 'tax_audit' ? editing.value.draftPayload.taxAudit : null,
      year: editForm.year,
    });
    editorOpen.value = false;
    await loadDrafts();
    showActionSuccess('财税识别草稿已保存');
  } catch (error) {
    showActionFailure(error);
  } finally {
    saving.value = false;
  }
}

async function approveSelected() {
  if (!selectedReviewDrafts.value.length) {
    showActionFailure(new Error('请选择待入库的财税草稿'));
    return;
  }
  approving.value = true;
  try {
    const result = await approveEnterpriseWorkspaceFinanceAiParseDraftsApi(
      props.enterpriseId,
      selectedReviewDrafts.value.map((draft) => draft.id),
    );
    if (result.success.length) {
      showActionSuccess(`已确认入库 ${result.success.length} 条财税草稿`);
      emit('approved');
    }
    if (result.failed.length) {
      showActionFailure(new Error(result.failed.map((item) => item.reason).join('；')));
    }
    await loadDrafts();
  } catch (error) {
    showActionFailure(error);
  } finally {
    approving.value = false;
  }
}

async function rejectDraft(draft: EnterpriseWorkspaceFinanceAiDraft) {
  try {
    await rejectEnterpriseWorkspaceFinanceAiParseDraftsApi(props.enterpriseId, [draft.id]);
    await loadDrafts();
    showActionSuccess('财税草稿已作废');
  } catch (error) {
    showActionFailure(error);
  }
}

async function retryDraft(draft: EnterpriseWorkspaceFinanceAiDraft) {
  try {
    await retryEnterpriseWorkspaceFinanceAiParseDraftsApi(props.enterpriseId, [draft.id]);
    await loadDrafts();
    showActionSuccess('财税草稿已重新识别');
  } catch (error) {
    showActionFailure(error);
  }
}

function confirmDeleteDraft(draft: EnterpriseWorkspaceFinanceAiDraft) {
  Modal.confirm({
    content: '删除后无法恢复该财税识别草稿。',
    okText: '删除',
    okType: 'danger',
    title: '删除财税识别草稿',
    onOk: async () => {
      await deleteEnterpriseWorkspaceFinanceAiParseDraftApi(props.enterpriseId, draft.id);
      await loadDrafts();
      showActionSuccess('财税识别草稿已删除');
    },
  });
}
</script>

<template>
  <Modal v-model:open="open" :footer="null" title="财税 AI 解析" width="min(1440px, calc(100vw - 48px))">
    <div class="finance-ai-parse">
      <div class="finance-ai-parse__toolbar">
        <div class="finance-ai-parse__summary">
          <span>待审核 {{ reviewDrafts.length }} 条</span>
          <span>已入库 {{ drafts.filter((draft) => draft.status === 'approved').length }} 条</span>
        </div>
        <div class="finance-ai-parse__actions">
          <input ref="fileInput" accept=".csv,.jpg,.jpeg,.pdf,.png,.xls,.xlsx" class="finance-ai-parse__input" multiple type="file" @change="upload" />
          <Button :loading="uploading" @click="chooseFiles"><IconifyIcon icon="lucide:file-up" />上传并解析</Button>
          <Button :disabled="!selectedReviewDrafts.length" :loading="approving" type="primary" @click="approveSelected">审核通过并入库</Button>
        </div>
      </div>

      <EnterpriseAiTaskStatusList :active="open" :enterprise-id="props.enterpriseId" :scenes="['finance_ai_parse']" @completed="loadDrafts" />

      <Table v-if="drafts.length" :columns="columns" :data-source="drafts" :loading="loading" :pagination="false" :row-key="(record: EnterpriseWorkspaceFinanceAiDraft) => record.id" :scroll="{ x: 1460, y: 520 }" size="small">
        <template #bodyCell="{ column, record }">
          <Checkbox v-if="column.key === 'select'" :checked="selectedIds.includes(record.id)" :disabled="record.status !== 'reviewing'" @update:checked="(checked) => toggleDraft(record.id, checked)" />
          <Tag v-else-if="column.key === 'status'" :color="getStatusColor(record.status)">{{ getStatusLabel(record.status) }}</Tag>
          <span v-else-if="column.key === 'type'">{{ getDocumentTypeLabel(record.draftPayload.documentType) }}</span>
          <span v-else-if="column.key === 'revenue'">{{ getFinancialValue(record, 'main_business_income') || getFinancialValue(record, 'total_revenue') }}</span>
          <span v-else-if="column.key === 'assets'">{{ getFinancialValue(record, 'zxc') }}</span>
          <span v-else-if="column.key === 'liabilities'">{{ getFinancialValue(record, 'fz') }}</span>
          <span v-else-if="column.key === 'profit'">{{ getFinancialValue(record, 'net_profit') }}</span>
          <Tag v-else-if="column.key === 'confidence'" :color="confidenceColor(record.draftPayload.confidence)">{{ record.draftPayload.confidence }}</Tag>
          <div v-else-if="column.key === 'actions'" class="finance-ai-parse__row-actions">
            <Button :disabled="record.status === 'approved'" size="small" type="link" @click="openEditor(record)">编辑</Button>
            <Button v-if="record.status !== 'approved'" size="small" type="link" @click="retryDraft(record)">重新识别</Button>
            <Button v-if="record.status === 'reviewing'" danger size="small" type="link" @click="rejectDraft(record)">作废</Button>
            <Button danger size="small" type="link" @click="confirmDeleteDraft(record)">删除</Button>
          </div>
        </template>
      </Table>
      <Empty v-else-if="!loading" description="暂无识别草稿，可上传财务报表或审计资料" />
      <div v-if="reviewDrafts.length" class="finance-ai-parse__footer">
        <Checkbox :checked="reviewDrafts.every((draft) => selectedIds.includes(draft.id))" @update:checked="toggleAll">全选待审核草稿</Checkbox>
      </div>
    </div>

    <Modal v-model:open="editorOpen" :confirm-loading="saving" title="编辑财税识别草稿" width="900px" @ok="saveDraft">
      <Form :model="editForm" layout="vertical">
        <section class="finance-ai-parse__form-section">
          <h3>基础信息</h3>
          <div class="finance-ai-parse__form-grid">
            <FormItem label="年度"><Input v-model:value="editForm.year" /></FormItem>
            <FormItem label="文件类型"><Select v-model:value="editForm.documentType" :options="[{ label: '财务报表', value: 'financial_statement' }, { label: '纳税审计', value: 'tax_audit' }, { label: '其他资料', value: 'other' }]" /></FormItem>
          </div>
        </section>
        <section class="finance-ai-parse__form-section">
          <h3>基础财务数据</h3>
          <div class="finance-ai-parse__form-grid">
            <FormItem label="销售收入(万元)"><Input v-model:value="editForm.xxsr" /></FormItem>
            <FormItem label="营业收入(万元)"><Input v-model:value="editForm.mainBusinessIncome" /></FormItem>
            <FormItem label="高新收入(万元)"><Input v-model:value="editForm.highTechIncome" /></FormItem>
            <FormItem label="总资产(万元)"><Input v-model:value="editForm.zxc" /></FormItem>
            <FormItem label="净资产(万元)"><Input v-model:value="editForm.netAssets" /></FormItem>
            <FormItem label="负债(万元)"><Input v-model:value="editForm.fz" /></FormItem>
            <FormItem label="负债率"><Input v-model:value="editForm.fzl" /></FormItem>
            <FormItem label="利润总额(万元)"><Input v-model:value="editForm.lrTotal" /></FormItem>
            <FormItem label="净利润(万元)"><Input v-model:value="editForm.netProfit" /></FormItem>
            <FormItem label="研发费用(万元)"><Input v-model:value="editForm.rdExpense" /></FormItem>
          </div>
        </section>
        <section class="finance-ai-parse__form-section">
          <h3>研发费用结构(万元)</h3>
          <div class="finance-ai-parse__form-grid">
            <FormItem label="人员人工"><Input v-model:value="editForm.rdPersonnelCost" /></FormItem>
            <FormItem label="直接投入"><Input v-model:value="editForm.rdDirectInput" /></FormItem>
            <FormItem label="折旧摊销"><Input v-model:value="editForm.rdDepreciation" /></FormItem>
            <FormItem label="无形资产摊销"><Input v-model:value="editForm.rdIntangibleAmortization" /></FormItem>
            <FormItem label="设计费"><Input v-model:value="editForm.rdDesignFee" /></FormItem>
            <FormItem label="装备调试费"><Input v-model:value="editForm.rdEquipmentDebuggingFee" /></FormItem>
            <FormItem label="委托研发"><Input v-model:value="editForm.rdEntrustedDevelopment" /></FormItem>
            <FormItem label="其他费用"><Input v-model:value="editForm.rdOtherExpense" /></FormItem>
          </div>
        </section>
        <FormItem label="备注"><Input v-model:value="editForm.remark" /></FormItem>
      </Form>
    </Modal>
  </Modal>
</template>

<style scoped>
.finance-ai-parse { display: grid; gap: 16px; }
.finance-ai-parse__toolbar, .finance-ai-parse__actions, .finance-ai-parse__summary, .finance-ai-parse__footer, .finance-ai-parse__row-actions { display: flex; align-items: center; gap: 12px; }
.finance-ai-parse__toolbar { justify-content: space-between; }
.finance-ai-parse__summary { color: hsl(var(--muted-foreground)); }
.finance-ai-parse__actions, .finance-ai-parse__row-actions { flex-wrap: wrap; }
.finance-ai-parse__input { display: none; }
.finance-ai-parse__form-section { margin-bottom: 16px; }
.finance-ai-parse__form-section h3 { margin: 0 0 8px; font-size: 14px; }
.finance-ai-parse__form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
@media (max-width: 640px) { .finance-ai-parse__form-grid { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .finance-ai-parse__toolbar { align-items: flex-start; flex-direction: column; } }
</style>
