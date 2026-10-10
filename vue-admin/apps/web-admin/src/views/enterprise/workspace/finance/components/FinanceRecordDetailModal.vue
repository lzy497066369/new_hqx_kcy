<script setup lang="ts">
import type { EnterpriseWorkspaceFinancialRecord } from '#/api';

import { computed } from 'vue';

import { Descriptions, DescriptionsItem, Modal } from 'antdv-next';

import { formatFinanceAmount } from '../finance-amount';

const props = defineProps<{
  record?: EnterpriseWorkspaceFinancialRecord;
}>();

const open = defineModel<boolean>('open', { default: false });

const fields = computed(() => {
  const record = props.record;
  if (!record) return [];
  return [
    { label: '年度', value: record.year },
    { label: '销售收入(万元)', value: formatFinanceAmount(record.xxsr) },
    { label: '营业收入(万元)', value: formatFinanceAmount(record.mainBusinessIncome) },
    { label: '高新收入(万元)', value: formatFinanceAmount(record.highTechIncome) },
    { label: '总资产(万元)', value: formatFinanceAmount(record.zxc) },
    { label: '净资产(万元)', value: formatFinanceAmount(record.netAssets) },
    { label: '负债(万元)', value: formatFinanceAmount(record.fz) },
    { label: '负债率', value: record.fzl },
    { label: '利润总额(万元)', value: formatFinanceAmount(record.lrTotal) },
    { label: '净利润(万元)', value: formatFinanceAmount(record.netProfit) },
    { label: '研发费用(万元)', value: formatFinanceAmount(record.rdExpense) },
    { label: '人员人工(万元)', value: formatFinanceAmount(record.rdPersonnelCost) },
    { label: '直接投入(万元)', value: formatFinanceAmount(record.rdDirectInput) },
    { label: '折旧摊销(万元)', value: formatFinanceAmount(record.rdDepreciation) },
    { label: '无形资产摊销(万元)', value: formatFinanceAmount(record.rdIntangibleAmortization) },
    { label: '设计费(万元)', value: formatFinanceAmount(record.rdDesignFee) },
    { label: '装备调试费(万元)', value: formatFinanceAmount(record.rdEquipmentDebuggingFee) },
    { label: '委托研发(万元)', value: formatFinanceAmount(record.rdEntrustedDevelopment) },
    { label: '其他费用(万元)', value: formatFinanceAmount(record.rdOtherExpense) },
    { label: '备注', value: record.remark },
  ];
});
</script>

<template>
  <Modal v-model:open="open" :footer="null" title="财务数据详情" width="900px">
    <Descriptions bordered :column="2" size="small">
      <DescriptionsItem v-for="field in fields" :key="field.label" :label="field.label">
        {{ field.value ?? '-' }}
      </DescriptionsItem>
    </Descriptions>
  </Modal>
</template>
