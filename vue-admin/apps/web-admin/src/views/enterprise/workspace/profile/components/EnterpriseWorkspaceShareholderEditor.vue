<script setup lang="ts">
import type { EnterpriseWorkspaceBasicProfileShareholder } from '#/api';

import { computed, reactive, shallowRef } from 'vue';

import { Button, Input, InputNumber, Select, Tag, message } from 'antdv-next';

const shareholders = defineModel<EnterpriseWorkspaceBasicProfileShareholder[]>(
  'shareholders',
  { default: () => [] },
);

const citizenTypeOptions = [
  { label: '中国公民', value: 1 },
  { label: '外籍人士', value: 2 },
  { label: '企业/其他组织', value: 3 },
];

const draft = reactive<EnterpriseWorkspaceBasicProfileShareholder>({
  citizenType: 1,
  id: '',
  idCard: null,
  investMoney: null,
  name: '',
});
const editingId = shallowRef('');
const totalInvestment = computed(() =>
  shareholders.value.reduce((total, item) => total + Number(item.investMoney ?? 0), 0),
);

function reset() {
  draft.citizenType = 1;
  draft.id = '';
  draft.idCard = null;
  draft.investMoney = null;
  draft.name = '';
  editingId.value = '';
}

function edit(item: EnterpriseWorkspaceBasicProfileShareholder) {
  draft.citizenType = item.citizenType ?? 1;
  draft.id = item.id;
  draft.idCard = item.idCard;
  draft.investMoney = item.investMoney;
  draft.name = item.name;
  editingId.value = item.id;
}

function remove(id: string) {
  shareholders.value = shareholders.value.filter((item) => item.id !== id);
  if (editingId.value === id) reset();
}

function save() {
  const name = draft.name.trim();
  if (!name) {
    message.warning('请填写股东名称');
    return;
  }
  const item: EnterpriseWorkspaceBasicProfileShareholder = {
    citizenType: draft.citizenType ?? 1,
    id: editingId.value || `draft-${Date.now()}`,
    idCard: draft.idCard?.trim() || null,
    investMoney: draft.investMoney === null ? null : Number(draft.investMoney),
    name,
  };
  const index = shareholders.value.findIndex((entry) => entry.id === editingId.value);
  shareholders.value =
    index < 0
      ? [...shareholders.value, item]
      : shareholders.value.map((entry, entryIndex) =>
          entryIndex === index ? item : entry,
        );
  reset();
}

function citizenTypeLabel(value: null | number) {
  return citizenTypeOptions.find((item) => item.value === value)?.label ?? '未设置';
}
</script>

<template>
  <section class="enterprise-workspace-shareholder-editor">
    <div class="enterprise-workspace-shareholder-editor__list">
      <div class="enterprise-workspace-shareholder-editor__summary">
        共 {{ shareholders.length }} 位股东，累计投资额
        {{ totalInvestment.toLocaleString('zh-CN') }}
      </div>
      <div
        v-if="!shareholders.length"
        class="enterprise-workspace-shareholder-editor__empty"
      >
        暂无股东信息，可在右侧新增。
      </div>
      <article v-for="item in shareholders" :key="item.id" class="enterprise-workspace-shareholder-editor__item">
        <div>
          <div class="enterprise-workspace-shareholder-editor__name">
            <strong>{{ item.name }}</strong>
            <Tag>{{ citizenTypeLabel(item.citizenType) }}</Tag>
          </div>
          <p>证件号码：{{ item.idCard || '-' }}</p>
          <p>投资金额：{{ Number(item.investMoney ?? 0).toLocaleString('zh-CN') }}</p>
        </div>
        <div class="enterprise-workspace-shareholder-editor__actions">
          <Button size="small" @click="edit(item)">编辑</Button>
          <Button danger size="small" @click="remove(item.id)">删除</Button>
        </div>
      </article>
    </div>

    <div class="enterprise-workspace-shareholder-editor__form">
      <h4>{{ editingId ? '编辑股东' : '新增股东' }}</h4>
      <label>股东名称<Input v-model:value="draft.name" :maxlength="64" /></label>
      <label>人员类型<Select v-model:value="draft.citizenType" :options="citizenTypeOptions" /></label>
      <label>证件号码<Input v-model:value="draft.idCard" :maxlength="64" /></label>
      <label>投资金额<InputNumber v-model:value="draft.investMoney" :min="0" class="w-full" /></label>
      <div class="enterprise-workspace-shareholder-editor__form-actions">
        <Button type="primary" @click="save">保存股东</Button>
        <Button @click="reset">重置</Button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.enterprise-workspace-shareholder-editor { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 20px; }
.enterprise-workspace-shareholder-editor__list, .enterprise-workspace-shareholder-editor__form { display: grid; gap: 12px; }
.enterprise-workspace-shareholder-editor__summary, .enterprise-workspace-shareholder-editor__item p { color: #6b7280; font-size: 13px; }
.enterprise-workspace-shareholder-editor__empty { padding: 28px 16px; color: #6b7280; text-align: center; border: 1px dashed #d1d5db; }
.enterprise-workspace-shareholder-editor__item { display: flex; justify-content: space-between; gap: 16px; padding: 14px; border: 1px solid #e5e7eb; }
.enterprise-workspace-shareholder-editor__item p { margin: 6px 0 0; }
.enterprise-workspace-shareholder-editor__name, .enterprise-workspace-shareholder-editor__actions, .enterprise-workspace-shareholder-editor__form-actions { display: flex; gap: 8px; align-items: center; }
.enterprise-workspace-shareholder-editor__form { padding: 16px; border: 1px solid #e5e7eb; background: #f9fafb; }
.enterprise-workspace-shareholder-editor__form h4 { margin: 0 0 4px; }
.enterprise-workspace-shareholder-editor__form label { display: grid; gap: 6px; color: #4b5563; font-size: 13px; }
@media (max-width: 960px) { .enterprise-workspace-shareholder-editor { grid-template-columns: 1fr; } }
</style>
