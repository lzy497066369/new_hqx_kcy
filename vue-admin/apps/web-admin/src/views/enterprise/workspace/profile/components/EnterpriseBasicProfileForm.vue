<script setup lang="ts">
import type { EnterpriseProfileItem, EnterpriseWorkspaceProfileInput } from '#/api';
import { reactive, watch } from 'vue';
import { Button, Form, FormItem, Input, TextArea } from 'antdv-next';
interface Props { profile: EnterpriseProfileItem; saving: boolean; }
const props = defineProps<Props>(); const emit = defineEmits<{ save: [data: EnterpriseWorkspaceProfileInput] }>(); const formData = reactive<EnterpriseWorkspaceProfileInput>({});
function syncFormData(profile: EnterpriseProfileItem) { Object.assign(formData, { address: profile.address, city: profile.city, contactEmail: profile.contactEmail, contactName: profile.contactName, contactPhone: profile.contactPhone, creditCode: profile.creditCode, district: profile.district, enterpriseType: profile.enterpriseType, industry: profile.industry, legalPerson: profile.legalPerson, name: profile.name, province: profile.province, remark: profile.remark, shortName: profile.shortName }); }
function submit() { emit('save', { ...formData }); } watch(() => props.profile, syncFormData, { immediate: true });
</script>
<template><Form :model="formData" layout="vertical" @finish="submit"><div class="enterprise-basic-profile-form__grid"><FormItem label="企业名称" name="name" required><Input v-model:value="formData.name" :maxlength="128" /></FormItem><FormItem label="企业简称" name="shortName"><Input v-model:value="formData.shortName" :maxlength="128" /></FormItem><FormItem label="统一社会信用代码" name="creditCode" required><Input v-model:value="formData.creditCode" :maxlength="64" /></FormItem><FormItem label="法定代表人" name="legalPerson"><Input v-model:value="formData.legalPerson" :maxlength="64" /></FormItem><FormItem label="所属行业" name="industry"><Input v-model:value="formData.industry" :maxlength="128" /></FormItem><FormItem label="企业类型" name="enterpriseType"><Input v-model:value="formData.enterpriseType" :maxlength="64" /></FormItem><FormItem label="省份" name="province"><Input v-model:value="formData.province" :maxlength="64" /></FormItem><FormItem label="城市" name="city"><Input v-model:value="formData.city" :maxlength="64" /></FormItem><FormItem label="区县" name="district"><Input v-model:value="formData.district" :maxlength="64" /></FormItem><FormItem label="默认联系人" name="contactName"><Input v-model:value="formData.contactName" :maxlength="64" /></FormItem><FormItem label="默认联系人电话" name="contactPhone"><Input v-model:value="formData.contactPhone" :maxlength="32" /></FormItem><FormItem label="默认联系人邮箱" name="contactEmail"><Input v-model:value="formData.contactEmail" :maxlength="128" /></FormItem></div><FormItem label="办公地址" name="address"><Input v-model:value="formData.address" :maxlength="255" /></FormItem><FormItem label="备注" name="remark"><TextArea v-model:value="formData.remark" :maxlength="255" :rows="3" /></FormItem><div class="enterprise-basic-profile-form__actions"><Button :loading="saving" html-type="submit" type="primary">保存基础信息</Button></div></Form></template>
<style scoped>
.enterprise-basic-profile-form__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2px 18px;
}

.enterprise-basic-profile-form__grid :deep(.ant-form-item),
.enterprise-basic-profile-form__actions :deep(.ant-form-item) {
  margin-bottom: 14px;
}

.enterprise-basic-profile-form__grid :deep(.ant-form-item-label > label),
:deep(.ant-form-item-label > label) {
  color: #334155;
  font-size: 13px;
  font-weight: 500;
}

:deep(.ant-input),
:deep(.ant-input-affix-wrapper) {
  min-height: 34px;
  border-color: #d8e0ea;
  box-shadow: none;
}

.enterprise-basic-profile-form__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

@media (max-width: 960px) {
  .enterprise-basic-profile-form__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .enterprise-basic-profile-form__grid { grid-template-columns: 1fr; }
}
</style>
