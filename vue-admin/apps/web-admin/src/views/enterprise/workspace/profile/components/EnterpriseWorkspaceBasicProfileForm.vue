<script setup lang="ts">
import type { EnterpriseWorkspaceBasicProfileInput } from '#/api';

import { computed, reactive, watch } from 'vue';

import {
  Button,
  Card,
  DatePicker,
  Form,
  FormItem,
  Input,
  InputNumber,
  Radio,
  RadioGroup,
  Select,
  TextArea,
} from 'antdv-next';

import EnterpriseWorkspaceShareholderEditor from './EnterpriseWorkspaceShareholderEditor.vue';

interface Props {
  profile: EnterpriseWorkspaceBasicProfileInput;
  saving: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ save: [data: EnterpriseWorkspaceBasicProfileInput] }>();
const form = reactive<EnterpriseWorkspaceBasicProfileInput>(createEmptyProfile());
const completeness = computed(() => {
  const values = [
    form.companyName,
    form.registerType,
    form.taxId,
    form.address,
    form.legalPersonName,
    form.contactName,
    form.contactPhone || form.contactMobile,
    form.contactEmail,
    form.technologyArea || form.mainAreas.length,
  ];
  const completed = values.filter(Boolean).length;
  return { completed, percent: Math.round((completed / values.length) * 100), total: values.length };
});

function createEmptyProfile(): EnterpriseWorkspaceBasicProfileInput {
  return {
    address: null,
    companyIntro: null,
    companyName: '',
    contactEmail: null,
    contactFax: null,
    contactIdCard: null,
    contactMobile: null,
    contactName: null,
    contactPhone: null,
    isInvest: null,
    isIpo: null,
    legalPersonIdCard: null,
    legalPersonName: null,
    legalPersonPhone: null,
    listedCode: null,
    mainAreas: [],
    province: null,
    city: null,
    district: null,
    registerCapital: null,
    registerDate: '',
    registerType: null,
    shareholders: [],
    taxId: '',
    technologyArea: null,
    vcAmount: null,
    zipCode: null,
  };
}

function syncProfile(value: EnterpriseWorkspaceBasicProfileInput) {
  Object.assign(form, createEmptyProfile(), structuredClone(value));
}

function submit() {
  emit('save', structuredClone(form));
}

function reset() {
  syncProfile(props.profile);
}

watch(() => props.profile, syncProfile, { immediate: true });
</script>

<template>
  <Form :model="form" layout="vertical" @finish="submit">
    <Card class="enterprise-workspace-basic-profile__summary" variant="borderless">
      <div>
        <span>基础资料完整度</span>
        <strong>{{ completeness.percent }}%</strong>
        <p>已完成 {{ completeness.completed }}/{{ completeness.total }} 个基础检查项</p>
      </div>
      <div class="enterprise-workspace-basic-profile__actions">
        <Button @click="reset">重置</Button>
        <Button :loading="saving" html-type="submit" type="primary">保存基础资料</Button>
      </div>
    </Card>

    <Card title="企业信息" variant="borderless">
      <div class="enterprise-workspace-basic-profile__grid">
        <FormItem class="enterprise-workspace-basic-profile__span-2" label="企业名称" name="companyName" required><Input v-model:value="form.companyName" :maxlength="128" /></FormItem>
        <FormItem label="注册时间" name="registerDate"><DatePicker v-model:value="form.registerDate" class="w-full" value-format="YYYY-MM-DD" /></FormItem>
        <FormItem label="技术领域" name="technologyArea"><Input v-model:value="form.technologyArea" :maxlength="128" /></FormItem>
        <FormItem label="注册类型" name="registerType"><Input v-model:value="form.registerType" :maxlength="128" /></FormItem>
        <FormItem label="统一代码/税号" name="taxId" required><Input v-model:value="form.taxId" :maxlength="64" /></FormItem>
        <FormItem class="enterprise-workspace-basic-profile__span-2" label="通讯地址" name="address"><Input v-model:value="form.address" :maxlength="255" /></FormItem>
        <FormItem label="省份" name="province"><Input v-model:value="form.province" :maxlength="64" /></FormItem>
        <FormItem label="城市" name="city"><Input v-model:value="form.city" :maxlength="64" /></FormItem>
        <FormItem label="区县" name="district"><Input v-model:value="form.district" :maxlength="64" /></FormItem>
        <FormItem label="邮政编码" name="zipCode"><Input v-model:value="form.zipCode" :maxlength="32" /></FormItem>
        <FormItem label="主要领域" name="mainAreas"><Select v-model:value="form.mainAreas" mode="tags" /></FormItem>
        <FormItem class="enterprise-workspace-basic-profile__span-2" label="企业简介" name="companyIntro"><TextArea v-model:value="form.companyIntro" :maxlength="2000" :rows="4" /></FormItem>
      </div>
    </Card>

    <div class="enterprise-workspace-basic-profile__two-columns">
      <Card title="法人信息" variant="borderless">
        <FormItem label="法人姓名" name="legalPersonName"><Input v-model:value="form.legalPersonName" :maxlength="64" /></FormItem>
        <FormItem label="法人身份证号" name="legalPersonIdCard"><Input v-model:value="form.legalPersonIdCard" :maxlength="64" /></FormItem>
        <FormItem label="法人电话" name="legalPersonPhone"><Input v-model:value="form.legalPersonPhone" :maxlength="32" /></FormItem>
      </Card>
      <Card title="默认联系人信息" variant="borderless">
        <div class="enterprise-workspace-basic-profile__grid">
          <FormItem label="联系人姓名" name="contactName"><Input v-model:value="form.contactName" :maxlength="64" /></FormItem>
          <FormItem label="联系人身份证号" name="contactIdCard"><Input v-model:value="form.contactIdCard" :maxlength="64" /></FormItem>
          <FormItem label="联系人邮箱" name="contactEmail"><Input v-model:value="form.contactEmail" :maxlength="128" /></FormItem>
          <FormItem label="联系人电话" name="contactPhone"><Input v-model:value="form.contactPhone" :maxlength="32" /></FormItem>
          <FormItem label="联系人手机" name="contactMobile"><Input v-model:value="form.contactMobile" :maxlength="32" /></FormItem>
          <FormItem label="联系人传真" name="contactFax"><Input v-model:value="form.contactFax" :maxlength="32" /></FormItem>
        </div>
      </Card>
    </div>

    <Card title="资本信息" variant="borderless">
      <div class="enterprise-workspace-basic-profile__grid">
        <FormItem label="注册资本" name="registerCapital"><InputNumber v-model:value="form.registerCapital" :min="0" class="w-full" /></FormItem>
        <FormItem label="是否上市" name="isIpo"><RadioGroup v-model:value="form.isIpo"><Radio :value="1">是</Radio><Radio :value="0">否</Radio></RadioGroup></FormItem>
        <FormItem v-if="form.isIpo === 1" label="上市代码" name="listedCode"><Input v-model:value="form.listedCode" :maxlength="64" /></FormItem>
        <FormItem label="是否引入投资" name="isInvest"><RadioGroup v-model:value="form.isInvest"><Radio :value="1">是</Radio><Radio :value="0">否</Radio></RadioGroup></FormItem>
        <FormItem v-if="form.isInvest === 1" label="投资金额" name="vcAmount"><InputNumber v-model:value="form.vcAmount" :min="0" class="w-full" /></FormItem>
      </div>
    </Card>

    <Card title="股东信息" variant="borderless">
      <EnterpriseWorkspaceShareholderEditor v-model:shareholders="form.shareholders" />
    </Card>

    <div class="enterprise-workspace-basic-profile__actions enterprise-workspace-basic-profile__footer">
      <Button @click="reset">重置</Button>
      <Button :loading="saving" html-type="submit" type="primary">保存基础资料</Button>
    </div>
  </Form>
</template>

<style scoped>
.enterprise-workspace-basic-profile__summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.enterprise-workspace-basic-profile__summary span, .enterprise-workspace-basic-profile__summary p { color: #6b7280; font-size: 13px; }
.enterprise-workspace-basic-profile__summary strong { display: block; margin-top: 4px; color: #0369a1; font-size: 28px; }
.enterprise-workspace-basic-profile__summary p { margin: 4px 0 0; }
.enterprise-workspace-basic-profile__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.enterprise-workspace-basic-profile__span-2 { grid-column: span 2; }
.enterprise-workspace-basic-profile__two-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 16px 0; }
.enterprise-workspace-basic-profile__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.enterprise-workspace-basic-profile__footer { margin-top: 16px; }
@media (max-width: 760px) { .enterprise-workspace-basic-profile__summary, .enterprise-workspace-basic-profile__two-columns { display: grid; grid-template-columns: 1fr; } .enterprise-workspace-basic-profile__grid { grid-template-columns: 1fr; } .enterprise-workspace-basic-profile__span-2 { grid-column: span 1; } }
</style>
