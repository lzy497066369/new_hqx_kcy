<script setup lang="ts">
import type { EnterpriseWorkspaceEmployee, EnterpriseWorkspaceEmployeeInput } from '#/api';
import type { FormProps } from 'antdv-next';

import { computed, reactive, shallowRef, useTemplateRef, watch } from 'vue';

import { Button, DatePicker, Form, FormItem, Input, InputNumber, message, Modal, Select, Switch, TextArea, Upload } from 'antdv-next';
import { IconifyIcon } from '@vben/icons';

import {
  previewEnterpriseWorkspaceAttachmentApi,
  uploadEnterpriseWorkspaceEmployeeAttachmentApi,
} from '#/api';

import {
  employeeAttachmentName,
  normalizeEmployeeIdCard,
  parseEmployeeIdCard,
} from '../employee-identity';

interface Props {
  employee?: EnterpriseWorkspaceEmployee;
  enterpriseId: string;
  saving: boolean;
}

const props = defineProps<Props>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ save: [data: EnterpriseWorkspaceEmployeeInput] }>();

const uploadingField = shallowRef<string>();
const formRef = useTemplateRef<{ validate: () => Promise<void> }>('form');
const formData = reactive<EnterpriseWorkspaceEmployeeInput>(createEmptyForm());
const busy = computed(() => props.saving || Boolean(uploadingField.value));
const genderOptions = [{ label: '男', value: 1 }, { label: '女', value: 2 }];
const employeeTypeOptions = [{ label: '在职人员', value: 1 }, { label: '兼职人员', value: 2 }, { label: '临时兼职人员', value: 3 }, { label: '临时聘用人员', value: 4 }];
const educationOptions = [{ label: '博士', value: 1 }, { label: '硕士', value: 2 }, { label: '本科', value: 3 }, { label: '大专及以下', value: 4 }];
const titleOptions = [{ label: '高级职称', value: 1 }, { label: '中级职称', value: 2 }, { label: '初级职称', value: 3 }, { label: '高级技工', value: 4 }, { label: '暂无', value: 5 }];
const ageOptions = [{ label: '30岁以下', value: 1 }, { label: '31-40岁', value: 2 }, { label: '41-50岁', value: 3 }, { label: '50岁及以上', value: 4 }];
const attachmentFields = [
  { key: 'ygFiles', label: '综合附件' },
  { key: 'laborContractFile', label: '劳动合同' },
  { key: 'socialSecurityFile', label: '社保材料' },
  { key: 'educationFile', label: '学历证明' },
  { key: 'titleFile', label: '职称证明' },
] as const;

function createEmptyForm(): EnterpriseWorkspaceEmployeeInput {
  return {
    annualWorkDays: null, department: null, educationFile: null, entryDate: null,
    idCard: null, isActive: true, isKjyf: false, laborContractFile: null,
    position: null, rdProjects: null, remark: null, socialSecurityFile: null,
    titleFile: null, ygFiles: null, ygLx: 1, ygLxgg: false, ygName: '',
    ygNl: null, ygQr: false, ygSex: null, ygWj: false, ygXl: null, ygZc: null,
  };
}

function resetFormData() {
  Object.assign(formData, createEmptyForm(), props.employee ?? {});
}

async function uploadFile(field: typeof attachmentFields[number]['key'], options: { file: File; onError: () => void; onSuccess: () => void }) {
  uploadingField.value = field;
  try {
    const result = await uploadEnterpriseWorkspaceEmployeeAttachmentApi(props.enterpriseId, options.file);
    formData[field] = result.path;
    options.onSuccess();
  } catch (error) {
    options.onError();
    message.error(error instanceof Error ? error.message : '附件上传失败');
  } finally {
    uploadingField.value = undefined;
  }
}

function normalizeIdCard() {
  formData.idCard = normalizeEmployeeIdCard(formData.idCard) || null;
}

async function submitForm() {
  try {
    await formRef.value?.validate();
    normalizeIdCard();
    emit('save', { ...formData, ygName: formData.ygName.trim() });
  } catch {
    message.warning('请先检查员工必填项和身份证号');
  }
}

async function previewAttachment(
  field: typeof attachmentFields[number]['key'],
) {
  const path = formData[field];
  if (!path || !props.employee || props.employee[field] !== path) {
    message.info('新增或替换的附件保存员工后即可预览');
    return;
  }
  try {
    const blob = await previewEnterpriseWorkspaceAttachmentApi(
      props.enterpriseId,
      'employee',
      props.employee.id,
      path,
    );
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '附件预览失败');
  }
}

const rules: FormProps['rules'] = {
  annualWorkDays: [
    {
      max: 366,
      message: '全年工作天数不能超过 366 天',
      type: 'number',
    },
  ],
  idCard: [
    {
      validator: async (_rule: unknown, value?: null | string) => {
        const idCard = normalizeEmployeeIdCard(value);
        if (!idCard) return;
        if (!/^[0-9A-Z]{6,32}$/u.test(idCard)) {
          throw new Error('证件号码应为 6-32 位数字或字母');
        }
        if (/^\d{17}[\dX]$/u.test(idCard) && !parseEmployeeIdCard(idCard)) {
          throw new Error('身份证号出生日期或校验位不正确');
        }
      },
    },
  ],
  ygName: [
    { message: '请输入员工姓名', required: true, whitespace: true },
  ],
};

watch([open, () => props.employee], resetFormData, { immediate: true });
watch(
  () => formData.idCard,
  (value) => {
    const identity = parseEmployeeIdCard(value);
    if (!identity) return;
    formData.ygSex = identity.gender;
    formData.ygNl = identity.ageRange;
  },
);
</script>

<template>
  <Modal v-model:open="open" :cancel-button-props="{ disabled: busy }" :closable="!busy" :confirm-loading="busy" :keyboard="!busy" :mask-closable="false" :title="employee ? '编辑员工' : '新增员工'" width="860px" @ok="submitForm">
    <Form ref="form" :model="formData" :rules="rules" layout="vertical">
      <div class="enterprise-employee-modal__form-grid">
        <FormItem label="姓名" name="ygName" required><Input v-model:value="formData.ygName" :maxlength="128" placeholder="请输入员工姓名" /></FormItem>
        <FormItem label="性别"><Select v-model:value="formData.ygSex" allow-clear :options="genderOptions" /></FormItem>
        <FormItem label="部门"><Input v-model:value="formData.department" :maxlength="128" /></FormItem>
        <FormItem label="岗位"><Input v-model:value="formData.position" :maxlength="128" /></FormItem>
        <FormItem label="员工类型"><Select v-model:value="formData.ygLx" allow-clear :options="employeeTypeOptions" /></FormItem>
        <FormItem label="入职日期"><DatePicker v-model:value="formData.entryDate" class="w-full" value-format="YYYY-MM-DD" /></FormItem>
        <FormItem label="学历"><Select v-model:value="formData.ygXl" allow-clear :options="educationOptions" /></FormItem>
        <FormItem label="职称"><Select v-model:value="formData.ygZc" allow-clear :options="titleOptions" /></FormItem>
        <FormItem label="年龄段"><Select v-model:value="formData.ygNl" allow-clear :options="ageOptions" /></FormItem>
        <FormItem label="全年工作天数" name="annualWorkDays"><InputNumber v-model:value="formData.annualWorkDays" :max="366" :min="0" class="w-full" /></FormItem>
        <FormItem label="身份证号" name="idCard"><Input v-model:value="formData.idCard" :maxlength="32" placeholder="身份证号将自动计算性别和年龄段" @blur="normalizeIdCard" /></FormItem>
        <FormItem label="在职"><Switch v-model:checked="formData.isActive" /></FormItem>
        <FormItem label="科技人员"><Switch v-model:checked="formData.isKjyf" /></FormItem>
        <FormItem label="外籍人员"><Switch v-model:checked="formData.ygWj" /></FormItem>
        <FormItem label="留学归国人员"><Switch v-model:checked="formData.ygLxgg" /></FormItem>
        <FormItem label="千人计划人员"><Switch v-model:checked="formData.ygQr" /></FormItem>
      </div>
      <FormItem label="参与 RD 项目"><Input v-model:value="formData.rdProjects" :maxlength="500" /></FormItem>
      <div class="enterprise-employee-modal__attachments">
        <FormItem v-for="field in attachmentFields" :key="field.key" :label="field.label">
          <div class="enterprise-employee-modal__file"><Upload :custom-request="(options) => uploadFile(field.key, options as never)" :disabled="busy" :show-upload-list="false"><Button :loading="uploadingField === field.key"><IconifyIcon icon="lucide:upload" class="size-4" />{{ formData[field.key] ? '替换' : '上传' }}</Button></Upload><span v-if="formData[field.key]" class="enterprise-employee-modal__file-name" :title="employeeAttachmentName(formData[field.key])">{{ employeeAttachmentName(formData[field.key]) }}</span><Button v-if="formData[field.key]" size="small" type="text" title="预览附件" @click="previewAttachment(field.key)"><IconifyIcon icon="lucide:eye" class="size-4" /></Button><Button v-if="formData[field.key]" danger size="small" type="text" title="移除附件" @click="formData[field.key] = null"><IconifyIcon icon="lucide:trash-2" class="size-4" /></Button></div>
        </FormItem>
      </div>
      <FormItem label="备注"><TextArea v-model:value="formData.remark" :maxlength="500" :rows="3" /></FormItem>
    </Form>
  </Modal>
</template>

<style scoped>
.enterprise-employee-modal__form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.enterprise-employee-modal__attachments { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.enterprise-employee-modal__file { display: flex; align-items: center; gap: 8px; color: #6b7280; }
.enterprise-employee-modal__file-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 640px) { .enterprise-employee-modal__form-grid, .enterprise-employee-modal__attachments { grid-template-columns: 1fr; } }
</style>
