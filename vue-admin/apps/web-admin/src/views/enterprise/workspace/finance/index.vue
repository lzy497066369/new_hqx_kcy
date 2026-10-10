<script setup lang="ts">
import type {
  EnterpriseWorkspaceFinancialRecord,
  EnterpriseWorkspaceFinancialRecordInput,
  EnterpriseWorkspaceMaterialError,
  EnterpriseWorkspaceTaxAudit,
  EnterpriseWorkspaceTaxAuditInput,
} from '#/api';

import { computed, reactive, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { Button, Card, Empty, Form, FormItem, Input, InputNumber, Modal, Spin, Table, TabPane, Tabs } from 'antdv-next';

import {
  createEnterpriseWorkspaceFinancialRecordApi,
  createEnterpriseWorkspaceTaxAuditApi,
  deleteEnterpriseWorkspaceFinancialRecordApi,
  deleteEnterpriseWorkspaceTaxAuditApi,
  downloadEnterpriseWorkspaceMaterialTemplateApi,
  getEnterpriseWorkspaceFinancialRecordsApi,
  getEnterpriseWorkspaceMaterialErrorsApi,
  getEnterpriseWorkspaceTaxAuditsApi,
  previewEnterpriseWorkspaceAttachmentApi,
  restoreEnterpriseWorkspaceFinancialRecordApi,
  restoreEnterpriseWorkspaceTaxAuditApi,
  updateEnterpriseWorkspaceFinancialRecordApi,
  updateEnterpriseWorkspaceTaxAuditApi,
  uploadEnterpriseWorkspaceArchiveAttachmentApi,
  uploadEnterpriseWorkspaceMaterialApi,
} from '#/api';

import { confirmAction, showActionFailure, showActionSuccess } from '../../../system/shared/action-feedback';
import { useEnterpriseContextStore } from '#/store';
import EnterpriseFinanceAiParseModal from './components/EnterpriseFinanceAiParseModal.vue';
import FinanceRecordDetailModal from './components/FinanceRecordDetailModal.vue';
import { formatFinanceAmount } from './finance-amount';
import { resolveFinanceTab, type FinanceTab } from './finance-tab';
import { describeFinanceTemplateImport, financeTemplateId } from './finance-template-import';

defineOptions({ name: 'EnterpriseWorkspaceFinance' });

type FinanceItem = EnterpriseWorkspaceFinancialRecord | EnterpriseWorkspaceTaxAudit;

const route = useRoute();
const enterpriseContextStore = useEnterpriseContextStore();
const activeKey = shallowRef<FinanceTab>('financial');
const editing = shallowRef<FinanceItem>();
const detailRecord = shallowRef<EnterpriseWorkspaceFinancialRecord>();
const detailOpen = shallowRef(false);
const editorOpen = shallowRef(false);
const financeAiParseOpen = shallowRef(false);
const financialRecords = shallowRef<EnterpriseWorkspaceFinancialRecord[]>([]);
const importing = shallowRef(false);
const importErrors = shallowRef<EnterpriseWorkspaceMaterialError[]>([]);
const importResultDescription = shallowRef('');
const importResultOpen = shallowRef(false);
const importResultTitle = shallowRef('导入结果');
const isLedgerView = computed(() => route.name === 'EnterpriseMaterialSection');
const loading = shallowRef(false);
const saving = shallowRef(false);
const taxAudits = shallowRef<EnterpriseWorkspaceTaxAudit[]>([]);
const financialForm = reactive<EnterpriseWorkspaceFinancialRecordInput>(newFinancial());
const taxAuditForm = reactive<EnterpriseWorkspaceTaxAuditInput>(newTaxAudit());

const financialColumns = [
  { dataIndex: 'year', key: 'year', title: '年度', width: 90 },
  { dataIndex: 'mainBusinessIncome', key: 'mainBusinessIncome', title: '营业收入(万元)', width: 140 },
  { dataIndex: 'netAssets', key: 'netAssets', title: '净资产(万元)', width: 130 },
  { dataIndex: 'fz', key: 'fz', title: '负债(万元)', width: 130 },
  { dataIndex: 'lrTotal', key: 'lrTotal', title: '利润总额(万元)', width: 130 },
  { dataIndex: 'rdExpense', key: 'rdExpense', title: '研发费用(万元)', width: 130 },
  { dataIndex: 'netProfit', key: 'netProfit', title: '净利润(万元)', width: 130 },
  { dataIndex: 'remark', key: 'remark', title: '备注', width: 180 },
  { key: 'actions', title: '操作', width: 180 },
];
const taxColumns = [
  { dataIndex: 'year', key: 'year', title: '年度' },
  { dataIndex: 'fileClass', key: 'fileClass', title: '文件类型' },
  { dataIndex: 'taxCategory', key: 'taxCategory', title: '税种/报告类别' },
  { dataIndex: 'filePath', key: 'filePath', title: '附件' },
  { dataIndex: 'remark', key: 'remark', title: '备注' },
  { key: 'actions', title: '操作', width: 180 },
];
const currentColumns = computed(() => activeKey.value === 'financial' ? financialColumns : taxColumns);
const currentRows = computed(() => activeKey.value === 'financial' ? financialRecords.value : taxAudits.value);
const currentTitle = computed(() => activeKey.value === 'financial' ? '财务数据' : '纳税审计');
const financeAmountFields = new Set(['mainBusinessIncome', 'netAssets', 'fz', 'lrTotal', 'rdExpense', 'netProfit']);

function formatFinancialColumn(record: EnterpriseWorkspaceFinancialRecord, key: string) {
  return formatFinanceAmount(record[key as keyof EnterpriseWorkspaceFinancialRecord]);
}

function enterpriseId() {
  return enterpriseContextStore.currentEnterpriseId ?? '';
}

function newFinancial(): EnterpriseWorkspaceFinancialRecordInput {
  return {
    fz: null, fzl: null, highTechIncome: null, lrTotal: null, mainBusinessIncome: null,
    netAssets: null, netProfit: null, rdDepreciation: null, rdDesignFee: null,
    rdDirectInput: null, rdEntrustedDevelopment: null, rdEquipmentDebuggingFee: null,
    rdExpense: null, rdIntangibleAmortization: null, rdOtherExpense: null,
    rdPersonnelCost: null, remark: null, totalRevenue: null, xxsr: null, year: '', zxc: null,
  };
}

function newTaxAudit(): EnterpriseWorkspaceTaxAuditInput {
  return { fileClass: 1, filePath: null, remark: null, taxCategory: null, year: '' };
}

async function load() {
  const id = enterpriseId();
  if (!id) return;
  loading.value = true;
  try {
    const [financial, audits] = await Promise.all([
      getEnterpriseWorkspaceFinancialRecordsApi(id, false),
      getEnterpriseWorkspaceTaxAuditsApi(id, false),
    ]);
    financialRecords.value = financial;
    taxAudits.value = audits;
  } finally {
    loading.value = false;
  }
}

function openEditor(item?: FinanceItem) {
  editing.value = item;
  if (activeKey.value === 'financial') Object.assign(financialForm, newFinancial(), item ?? {});
  else Object.assign(taxAuditForm, newTaxAudit(), item ?? {});
  editorOpen.value = true;
}

async function save() {
  saving.value = true;
  try {
    if (activeKey.value === 'financial') {
      if (editing.value) await updateEnterpriseWorkspaceFinancialRecordApi(enterpriseId(), editing.value.id, financialForm);
      else await createEnterpriseWorkspaceFinancialRecordApi(enterpriseId(), financialForm);
    } else if (editing.value) {
      await updateEnterpriseWorkspaceTaxAuditApi(enterpriseId(), editing.value.id, taxAuditForm);
    } else {
      await createEnterpriseWorkspaceTaxAuditApi(enterpriseId(), taxAuditForm);
    }
    editorOpen.value = false;
    await load();
    showActionSuccess(editing.value ? `${currentTitle.value}已更新` : `${currentTitle.value}已新增`);
  } catch (error) {
    showActionFailure(error);
  } finally {
    saving.value = false;
  }
}

async function remove(item: FinanceItem) {
  try {
    const summary = activeKey.value === 'financial'
      ? `${item.year ?? ''} 年度财务数据`
      : `${item.year ?? ''} 年度${(item as EnterpriseWorkspaceTaxAudit).taxCategory || '纳税审计'}`;
    await confirmAction(`确认删除${summary}吗？`, `删除${currentTitle.value}`);
    if (activeKey.value === 'financial') await deleteEnterpriseWorkspaceFinancialRecordApi(enterpriseId(), item.id);
    else await deleteEnterpriseWorkspaceTaxAuditApi(enterpriseId(), item.id);
    await load();
    showActionSuccess(`${currentTitle.value}已删除`);
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') return;
    showActionFailure(error);
  }
}

function showDetails(item: EnterpriseWorkspaceFinancialRecord) {
  detailRecord.value = item;
  detailOpen.value = true;
}

function isDeleted(item: FinanceItem) {
  return item.status === 0;
}

function fileClassLabel(fileClass: null | number) {
  return ({ 1: '纳税申报', 2: '审计报告', 3: '其他' })[fileClass ?? 0] ?? '-';
}

async function restore(item: FinanceItem) {
  try {
    if (activeKey.value === 'financial') {
      await restoreEnterpriseWorkspaceFinancialRecordApi(enterpriseId(), item.id);
    } else {
      await restoreEnterpriseWorkspaceTaxAuditApi(enterpriseId(), item.id);
    }
    await load();
    showActionSuccess(`${currentTitle.value}已恢复`);
  } catch (error) {
    showActionFailure(error);
  }
}

async function upload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  saving.value = true;
  try {
    const result = await uploadEnterpriseWorkspaceArchiveAttachmentApi(enterpriseId(), file);
    taxAuditForm.filePath = result.path;
    showActionSuccess('审计文件已上传');
  } catch (error) {
    showActionFailure(error);
  } finally {
    saving.value = false;
  }
}

async function downloadFinanceTemplate() {
  try {
    const blob = await downloadEnterpriseWorkspaceMaterialTemplateApi(financeTemplateId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = '财务信息模板.csv';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    showActionFailure(error);
  }
}

async function importFinanceTemplate(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  importing.value = true;
  try {
    const record = await uploadEnterpriseWorkspaceMaterialApi(enterpriseId(), financeTemplateId, file);
    const result = describeFinanceTemplateImport(record);
    await load();
    importResultTitle.value = result.title;
    importResultDescription.value = result.description;
    importErrors.value = record.errorCount ? await getEnterpriseWorkspaceMaterialErrorsApi(enterpriseId(), record.id) : [];
    importResultOpen.value = true;
    if (record.status === 'valid') showActionSuccess('财税数据已导入');
    else showActionFailure(new Error(record.status === 'partial' ? '部分数据已导入，请查看错误行' : '财税数据导入失败，请查看错误行'));
  } catch (error) {
    showActionFailure(error);
  } finally {
    importing.value = false;
  }
}

async function download(record: EnterpriseWorkspaceTaxAudit) {
  if (!record.filePath) return;
  try {
    const blob = await previewEnterpriseWorkspaceAttachmentApi(enterpriseId(), 'tax-audit', record.id, record.filePath);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = record.filePath.split('/').pop() || '审计附件';
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    showActionFailure(error);
  }
}

async function syncLedgerTab(tab: FinanceTab) {
  if (isLedgerView.value) enterpriseContextStore.setMaterialLedgerTab('finance', tab);
}

watch(() => enterpriseContextStore.currentEnterpriseId, () => void load(), { immediate: true });

watch(
  () => enterpriseContextStore.getMaterialLedgerTab('finance'),
  (tab) => {
    activeKey.value = resolveFinanceTab(tab);
  },
  { immediate: true },
);

watch(activeKey, (tab) => void syncLedgerTab(tab));
</script>

<template>
  <Page auto-content-height>
    <Spin :spinning="loading">
      <div class="enterprise-finance-page">
        <Card title="财税资料">
          <template #extra>
            <div class="enterprise-finance-page__actions">
              <Button @click="financeAiParseOpen = true"><IconifyIcon icon="lucide:sparkles" class="size-4" />AI 解析财务报表/审计</Button>
              <Button @click="downloadFinanceTemplate">下载财税模板</Button>
              <label class="enterprise-finance-page__import"><Button :loading="importing">导入财税数据</Button><input accept=".csv,text/csv" type="file" @change="importFinanceTemplate" /></label>
              <Button type="primary" @click="openEditor()">新增{{ currentTitle }}</Button>
            </div>
          </template>
          <Tabs v-model:active-key="activeKey"><TabPane key="financial" tab="财务数据" /><TabPane key="taxAudit" tab="纳税审计" /></Tabs>
          <Table v-if="currentRows.length" :columns="currentColumns" :data-source="currentRows" :pagination="false" :row-key="(item: FinanceItem) => item.id" :scroll="{ x: 1420 }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'fileClass'">{{ fileClassLabel((record as EnterpriseWorkspaceTaxAudit).fileClass) }}</template>
              <template v-else-if="column.key === 'filePath'">{{ (record as EnterpriseWorkspaceTaxAudit).filePath ? '已上传' : '-' }}</template>
              <template v-else-if="activeKey === 'financial' && financeAmountFields.has(String(column.key))">{{ formatFinancialColumn(record as EnterpriseWorkspaceFinancialRecord, String(column.key)) }}</template>
              <template v-else-if="column.key === 'actions'"><Button v-if="activeKey === 'financial'" size="small" type="link" @click="showDetails(record as EnterpriseWorkspaceFinancialRecord)">详情</Button><Button v-if="isDeleted(record)" size="small" type="link" @click="restore(record)">恢复</Button><template v-else><Button v-if="activeKey === 'taxAudit' && (record as EnterpriseWorkspaceTaxAudit).filePath" size="small" type="link" @click="download(record as EnterpriseWorkspaceTaxAudit)">下载附件</Button><Button size="small" type="link" @click="openEditor(record)">编辑</Button><Button danger size="small" type="link" @click="remove(record)">删除</Button></template></template>
            </template>
          </Table>
          <Empty v-else description="暂无记录" />
        </Card>
        <Modal v-model:open="editorOpen" :confirm-loading="saving" :title="editing ? `编辑${currentTitle}` : `新增${currentTitle}`" width="900px" @ok="save">
          <Form v-if="activeKey === 'financial'" :model="financialForm" layout="vertical">
            <section class="enterprise-finance-page__form-section"><h3>基础财务数据</h3><div class="enterprise-finance-page__grid"><FormItem label="年度" required><Input v-model:value="financialForm.year" /></FormItem><FormItem label="销售收入(万元)"><InputNumber v-model:value="financialForm.xxsr" :precision="2" class="w-full" /></FormItem><FormItem label="营业收入(万元)"><InputNumber v-model:value="financialForm.mainBusinessIncome" :precision="2" class="w-full" /></FormItem><FormItem label="高新收入(万元)"><InputNumber v-model:value="financialForm.highTechIncome" :precision="2" class="w-full" /></FormItem><FormItem label="总资产(万元)"><InputNumber v-model:value="financialForm.zxc" :precision="2" class="w-full" /></FormItem><FormItem label="净资产(万元)"><InputNumber v-model:value="financialForm.netAssets" :precision="2" class="w-full" /></FormItem><FormItem label="负债(万元)"><InputNumber v-model:value="financialForm.fz" :precision="2" class="w-full" /></FormItem><FormItem label="负债率"><Input v-model:value="financialForm.fzl" /></FormItem><FormItem label="利润总额(万元)"><InputNumber v-model:value="financialForm.lrTotal" :precision="2" class="w-full" /></FormItem><FormItem label="净利润(万元)"><InputNumber v-model:value="financialForm.netProfit" :precision="2" class="w-full" /></FormItem><FormItem label="研发费用(万元)"><InputNumber v-model:value="financialForm.rdExpense" :precision="2" class="w-full" /></FormItem></div></section>
            <section class="enterprise-finance-page__form-section"><h3>研发费用结构(万元)</h3><div class="enterprise-finance-page__grid"><FormItem label="人员人工"><InputNumber v-model:value="financialForm.rdPersonnelCost" :precision="2" class="w-full" /></FormItem><FormItem label="直接投入"><InputNumber v-model:value="financialForm.rdDirectInput" :precision="2" class="w-full" /></FormItem><FormItem label="折旧摊销"><InputNumber v-model:value="financialForm.rdDepreciation" :precision="2" class="w-full" /></FormItem><FormItem label="无形资产摊销"><InputNumber v-model:value="financialForm.rdIntangibleAmortization" :precision="2" class="w-full" /></FormItem><FormItem label="设计费"><InputNumber v-model:value="financialForm.rdDesignFee" :precision="2" class="w-full" /></FormItem><FormItem label="装备调试费"><InputNumber v-model:value="financialForm.rdEquipmentDebuggingFee" :precision="2" class="w-full" /></FormItem><FormItem label="委托研发"><InputNumber v-model:value="financialForm.rdEntrustedDevelopment" :precision="2" class="w-full" /></FormItem><FormItem label="其他费用"><InputNumber v-model:value="financialForm.rdOtherExpense" :precision="2" class="w-full" /></FormItem></div></section>
            <FormItem label="备注"><Input v-model:value="financialForm.remark" /></FormItem>
          </Form>
          <Form v-else :model="taxAuditForm" layout="vertical"><FormItem label="年度" required><Input v-model:value="taxAuditForm.year" /></FormItem><FormItem label="文件类型"><InputNumber v-model:value="taxAuditForm.fileClass" :max="3" :min="1" class="w-full" /></FormItem><FormItem label="税种/报告类别"><Input v-model:value="taxAuditForm.taxCategory" /></FormItem><FormItem label="审计附件"><input type="file" @change="upload" /><p v-if="taxAuditForm.filePath">文件已上传</p></FormItem><FormItem label="备注"><Input v-model:value="taxAuditForm.remark" /></FormItem></Form>
        </Modal>
        <Modal v-model:open="importResultOpen" :footer="null" :title="importResultTitle" width="720px"><p>{{ importResultDescription }}</p><Table v-if="importErrors.length" :columns="[{ dataIndex: 'rowNumber', title: '行号' }, { dataIndex: 'fieldName', title: '字段' }, { dataIndex: 'message', title: '错误说明' }, { dataIndex: 'suggestion', title: '修正建议' }]" :data-source="importErrors" :pagination="false" :row-key="(item: EnterpriseWorkspaceMaterialError) => item.id" :scroll="{ x: 820 }" size="small" /><Empty v-else description="未发现解析错误" /></Modal>
        <EnterpriseFinanceAiParseModal v-model:open="financeAiParseOpen" :enterprise-id="enterpriseId()" @approved="load" />
        <FinanceRecordDetailModal v-model:open="detailOpen" :record="detailRecord" />
      </div>
    </Spin>
  </Page>
</template>

<style scoped>
.enterprise-finance-page { display: grid; gap: 16px; }
.enterprise-finance-page__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.enterprise-finance-page__import input { display: none; }
.enterprise-finance-page__form-section { margin-bottom: 16px; }
.enterprise-finance-page__form-section h3 { margin: 0 0 8px; font-size: 14px; }
.enterprise-finance-page__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
@media (max-width: 640px) { .enterprise-finance-page__grid { grid-template-columns: 1fr; } }
</style>
