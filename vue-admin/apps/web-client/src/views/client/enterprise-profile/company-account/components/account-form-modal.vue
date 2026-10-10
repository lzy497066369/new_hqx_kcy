<script setup lang="ts">
import type { FormInstance } from 'antdv-next';
import type { Dayjs } from 'dayjs';
import type { ClientEnterpriseAccountApi } from '#/api/client/enterprise-account';

import { computed, reactive, ref, watch } from 'vue';

import {
  DatePicker,
  Form,
  FormItem,
  Input,
  Modal,
  Select,
} from 'antdv-next';
import dayjs from 'dayjs';

import {
  EnterpriseAccountStatus,
  EnterpriseAccountType,
} from '#/api/client/enterprise-account';

import {
  enterpriseAccountStatusOptions,
  enterpriseAccountTypeOptions,
  type EnterpriseAccountFormMode,
} from '../shared';

type AccountFormState = ClientEnterpriseAccountApi.SaveClientEnterpriseAccountParams & {
  b_email: string;
  b_phone: string;
  charge: string;
  end_date: string;
  endDateValue?: Dayjs;
  gsbm: string;
  pt_name: string;
  pt_url: string;
  remark: string;
  zh_number: string;
  zh_password: string;
  zh_status: number;
  zh_type: number;
};

const props = defineProps<{
  account?: ClientEnterpriseAccountApi.ClientEnterpriseAccount;
  mode: EnterpriseAccountFormMode;
  open: boolean;
  submitting: boolean;
}>();

const emit = defineEmits<{
  close: [];
  submit: [payload: ClientEnterpriseAccountApi.SaveClientEnterpriseAccountParams];
}>();

const formRef = ref<FormInstance>();
const formState = reactive<AccountFormState>({
  b_email: '',
  b_phone: '',
  charge: '',
  endDateValue: undefined,
  end_date: '',
  gsbm: '',
  pt_name: '',
  pt_url: '',
  remark: '',
  zh_number: '',
  zh_password: '',
  zh_status: EnterpriseAccountStatus.Enabled,
  zh_type: EnterpriseAccountType.HighTech,
});

const title = computed(() =>
  props.mode === 'create' ? '新增企业账号' : '编辑企业账号',
);

const passwordRules = computed(() =>
  props.mode === 'create'
    ? [
        {
          message: '请输入登录密码',
          required: true,
          trigger: 'blur',
        },
      ]
    : [],
);

const rules = computed(() => ({
  b_email: [
    {
      message: '请输入有效邮箱',
      type: 'email',
      trigger: 'blur',
    },
  ],
  b_phone: [
    {
      message: '请输入联系电话',
      required: true,
      trigger: 'blur',
    },
  ],
  charge: [
    {
      message: '请输入负责人',
      required: true,
      trigger: 'blur',
    },
  ],
  pt_name: [
    {
      message: '请输入平台名称',
      required: true,
      trigger: 'blur',
    },
  ],
  pt_url: [
    {
      message: '请输入平台网址',
      required: true,
      trigger: 'blur',
    },
    {
      message: '请输入有效的网址，例如 https://example.com',
      pattern:
        /^(https?:\/\/)(([\w-]+\.)+[\w-]+)(:[0-9]+)?(\/[\w\-./?%&=]*)?$/i,
      trigger: 'blur',
    },
  ],
  zh_number: [
    {
      message: '请输入账号',
      required: true,
      trigger: 'blur',
    },
  ],
  zh_password: passwordRules.value,
  zh_status: [
    {
      message: '请选择状态',
      required: true,
      trigger: 'change',
    },
  ],
  zh_type: [
    {
      message: '请选择账号类型',
      required: true,
      trigger: 'change',
    },
  ],
})) as any;

watch(
  () => [props.account, props.mode, props.open],
  () => {
    if (!props.open) {
      return;
    }

    const account = props.account;
    formState.pt_name = account?.pt_name ?? '';
    formState.pt_url = account?.pt_url ?? '';
    formState.zh_type = Number(account?.zh_type ?? EnterpriseAccountType.HighTech);
    formState.zh_number = account?.zh_number ?? '';
    formState.zh_password = account?.zh_password ?? '';
    formState.charge = account?.charge ?? '';
    formState.b_phone = account?.b_phone ?? '';
    formState.b_email = account?.b_email ?? '';
    formState.zh_status = Number(
      account?.zh_status ?? EnterpriseAccountStatus.Enabled,
    );
    formState.remark = account?.remark ?? '';
    formState.gsbm = account?.gsbm ?? '';
    formState.end_date = account?.end_date ?? '';
    formState.endDateValue = account?.end_date ? dayjs(account.end_date) : undefined;
    formRef.value?.clearValidate();
  },
  { immediate: true },
);

async function handleSubmit() {
  await formRef.value?.validate();

  emit('submit', {
    b_email: formState.b_email?.trim() || null,
    b_phone: formState.b_phone?.trim() || null,
    charge: formState.charge?.trim() || null,
    end_date: formState.endDateValue?.format('YYYY-MM-DD') || null,
    gsbm: formState.gsbm?.trim() || null,
    pt_name: formState.pt_name.trim(),
    pt_url: formState.pt_url.trim(),
    remark: formState.remark?.trim() || null,
    zh_number: formState.zh_number.trim(),
    zh_password: formState.zh_password?.trim() || null,
    zh_status: Number(formState.zh_status),
    zh_type: Number(formState.zh_type),
  });
}
</script>

<template>
  <Modal
    destroy-on-hidden
    :confirm-loading="props.submitting"
    :open="props.open"
    :title="title"
    width="760px"
    @cancel="emit('close')"
    @ok="handleSubmit"
  >
    <Form
      ref="formRef"
      :label-col="{ span: 6 }"
      :model="formState"
      :rules="rules"
      :wrapper-col="{ span: 18 }"
    >
      <div class="grid gap-x-4 md:grid-cols-2">
        <FormItem label="平台名称" name="pt_name">
          <Input
            v-model:value="formState.pt_name"
            :maxlength="100"
            placeholder="请输入平台名称"
          />
        </FormItem>

        <FormItem label="平台网址" name="pt_url">
          <Input
            v-model:value="formState.pt_url"
            :maxlength="255"
            placeholder="请输入平台网址"
          />
        </FormItem>

        <FormItem label="账号类型" name="zh_type">
          <Select
            v-model:value="formState.zh_type"
            :options="enterpriseAccountTypeOptions"
            placeholder="请选择账号类型"
          />
        </FormItem>

        <FormItem label="状态" name="zh_status">
          <Select
            v-model:value="formState.zh_status"
            :options="enterpriseAccountStatusOptions"
            placeholder="请选择状态"
          />
        </FormItem>

        <FormItem label="账号" name="zh_number">
          <Input
            v-model:value="formState.zh_number"
            :maxlength="100"
            placeholder="请输入登录账号"
          />
        </FormItem>

        <FormItem label="密码" name="zh_password">
          <Input.Password
            v-model:value="formState.zh_password"
            :maxlength="100"
            :placeholder="
              props.mode === 'create' ? '请输入登录密码' : '留空表示沿用现有密码'
            "
          />
        </FormItem>

        <FormItem label="负责人" name="charge">
          <Input
            v-model:value="formState.charge"
            :maxlength="50"
            placeholder="请输入负责人姓名"
          />
        </FormItem>

        <FormItem label="联系电话" name="b_phone">
          <Input
            v-model:value="formState.b_phone"
            :maxlength="30"
            placeholder="请输入联系电话"
          />
        </FormItem>

        <FormItem label="联系邮箱" name="b_email">
          <Input
            v-model:value="formState.b_email"
            :maxlength="120"
            placeholder="请输入联系邮箱"
          />
        </FormItem>

        <FormItem label="归属编码" name="gsbm">
          <Input
            v-model:value="formState.gsbm"
            :maxlength="50"
            placeholder="可选，后续可扩展"
          />
        </FormItem>

        <FormItem label="到期日期" name="end_date">
          <DatePicker
            v-model:value="formState.endDateValue"
            class="w-full"
            format="YYYY-MM-DD"
            placeholder="可选，到期日期"
          />
        </FormItem>

        <FormItem class="md:col-span-2" label="备注" name="remark">
          <Input.TextArea
            v-model:value="formState.remark"
            :rows="4"
            :maxlength="500"
            placeholder="请输入备注"
            show-count
          />
        </FormItem>
      </div>
    </Form>
  </Modal>
</template>
