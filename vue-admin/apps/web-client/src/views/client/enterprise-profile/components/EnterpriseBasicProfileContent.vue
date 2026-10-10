<script setup lang="ts">
import type { ClientEnterpriseApi } from '#/api/client';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Card,
  DatePicker,
  Input,
  InputNumber,
  Radio,
  RadioGroup,
  Select,
  Tag,
  TextArea,
} from 'antdv-next';

import type { EnterpriseBasicCompleteness } from '../basic/profile-helpers';

import EnterpriseShareholderEditor from './EnterpriseShareholderEditor.vue';

defineOptions({ name: 'ClientEnterpriseBasicProfileContent' });

interface Props {
  completeness: EnterpriseBasicCompleteness;
  form: ClientEnterpriseApi.ClientEnterpriseBasicProfile;
  loading?: boolean;
  remoteState?: 'idle' | 'synced' | 'unavailable';
  saving?: boolean;
  shareholders: ClientEnterpriseApi.ClientEnterpriseShareholder[];
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  remoteState: 'idle',
  saving: false,
});

const emit = defineEmits<{
  reset: [];
  save: [];
}>();

const remoteTag = computed(() => {
  if (props.remoteState === 'synced') {
    return { color: 'success', label: '已同步接口数据' };
  }

  if (props.remoteState === 'unavailable') {
    return { color: 'warning', label: '加载失败' };
  }

  return { color: 'default', label: '待加载' };
});
</script>

<template>
  <div class="space-y-5">
    <Card :loading="props.loading" variant="borderless">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="text-sm text-foreground/60">基础资料维护</div>
          <div class="mt-2 text-2xl font-semibold">
            {{ props.completeness.percent }}%
          </div>
          <div class="mt-1 text-sm text-foreground/60">
            已完成 {{ props.completeness.completed }}/{{ props.completeness.total }}
            个基础检查项
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Tag :color="remoteTag.color">{{ remoteTag.label }}</Tag>
          <Button @click="emit('reset')">
            <IconifyIcon icon="lucide:rotate-ccw" class="size-4" />
            重置
          </Button>
          <Button type="primary" :loading="props.saving" @click="emit('save')">
            <IconifyIcon icon="lucide:save" class="size-4" />
            保存
          </Button>
        </div>
      </div>
    </Card>

    <Card title="企业信息" variant="borderless">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="md:col-span-2">
          <div class="mb-1 text-sm text-foreground/60">企业名称</div>
          <Input v-model:value="props.form.company_name" placeholder="请输入企业名称" />
        </div>

        <div>
          <div class="mb-1 text-sm text-foreground/60">注册时间</div>
          <DatePicker
            v-model:value="props.form.register_date"
            class="w-full"
            placeholder="请选择注册时间"
            value-format="YYYY-MM-DD"
          />
        </div>

        <div>
          <div class="mb-1 text-sm text-foreground/60">技术领域</div>
          <Input v-model:value="props.form.js_areas" placeholder="请输入技术领域" />
        </div>

        <div>
          <div class="mb-1 text-sm text-foreground/60">注册类型</div>
          <Input v-model:value="props.form.register_type" placeholder="请输入注册类型" />
        </div>

        <div>
          <div class="mb-1 text-sm text-foreground/60">统一代码/税号</div>
          <Input v-model:value="props.form.tax_id" placeholder="请输入统一代码/税号" />
        </div>

        <div class="md:col-span-2">
          <div class="mb-1 text-sm text-foreground/60">通讯地址</div>
          <Input
            v-model:value="props.form.company_address"
            placeholder="请输入通讯地址"
          />
        </div>

        <div>
          <div class="mb-1 text-sm text-foreground/60">邮政编码</div>
          <Input v-model:value="props.form.zip_code" placeholder="请输入邮政编码" />
        </div>

        <div>
          <div class="mb-1 text-sm text-foreground/60">主要领域</div>
          <Select
            v-model:value="props.form.main_areas"
            mode="tags"
            placeholder="请输入主要领域，可回车添加"
          />
        </div>

        <div class="md:col-span-2">
          <div class="mb-1 text-sm text-foreground/60">企业简介</div>
          <TextArea
            v-model:value="props.form.companyIntro"
            :rows="5"
            placeholder="请输入企业简介"
          />
        </div>
      </div>
    </Card>

    <div class="grid gap-4 xl:grid-cols-2">
      <Card title="法人信息" variant="borderless">
        <div class="space-y-4">
          <div>
            <div class="mb-1 text-sm text-foreground/60">法人姓名</div>
            <Input
              v-model:value="props.form.le_person_name"
              placeholder="请输入法人姓名"
            />
          </div>
          <div>
            <div class="mb-1 text-sm text-foreground/60">法人身份证号</div>
            <Input
              v-model:value="props.form.le_person_idcard"
              placeholder="请输入法人身份证号"
            />
          </div>
          <div>
            <div class="mb-1 text-sm text-foreground/60">法人电话</div>
            <Input
              v-model:value="props.form.le_person_phone"
              placeholder="请输入法人电话"
            />
          </div>
        </div>
      </Card>

      <Card title="联系人信息" variant="borderless">
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <div class="mb-1 text-sm text-foreground/60">联系人姓名</div>
            <Input
              v-model:value="props.form.contacts_name"
              placeholder="请输入联系人姓名"
            />
          </div>
          <div>
            <div class="mb-1 text-sm text-foreground/60">联系人身份证号</div>
            <Input
              v-model:value="props.form.contacts_idcard"
              placeholder="请输入联系人身份证号"
            />
          </div>
          <div>
            <div class="mb-1 text-sm text-foreground/60">联系人邮箱</div>
            <Input
              v-model:value="props.form.contacts_email"
              placeholder="请输入联系人邮箱"
            />
          </div>
          <div>
            <div class="mb-1 text-sm text-foreground/60">联系人电话</div>
            <Input
              v-model:value="props.form.contacts_phone"
              placeholder="请输入联系人电话"
            />
          </div>
          <div>
            <div class="mb-1 text-sm text-foreground/60">联系人手机</div>
            <Input
              v-model:value="props.form.contacts_mobile"
              placeholder="请输入联系人手机"
            />
          </div>
          <div>
            <div class="mb-1 text-sm text-foreground/60">联系人传真</div>
            <Input
              v-model:value="props.form.contacts_fax"
              placeholder="请输入联系人传真"
            />
          </div>
        </div>
      </Card>
    </div>

    <Card title="资本信息" variant="borderless">
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <div class="mb-1 text-sm text-foreground/60">注册资本</div>
          <InputNumber
            v-model:value="props.form.register_capital"
            :min="0"
            placeholder="请输入注册资本"
          />
        </div>

        <div>
          <div class="mb-1 text-sm text-foreground/60">是否上市</div>
          <RadioGroup v-model:value="props.form.is_ipo">
            <Radio :value="1">是</Radio>
            <Radio :value="0">否</Radio>
          </RadioGroup>
        </div>

        <div v-if="props.form.is_ipo === 1">
          <div class="mb-1 text-sm text-foreground/60">上市代码</div>
          <Input v-model:value="props.form.listedCode" placeholder="请输入上市代码" />
        </div>

        <div>
          <div class="mb-1 text-sm text-foreground/60">是否引入投资</div>
          <RadioGroup v-model:value="props.form.is_invest">
            <Radio :value="1">是</Radio>
            <Radio :value="0">否</Radio>
          </RadioGroup>
        </div>

        <div v-if="props.form.is_invest === 1">
          <div class="mb-1 text-sm text-foreground/60">投资金额</div>
          <InputNumber
            v-model:value="props.form.vcAmount"
            :min="0"
            placeholder="请输入投资金额"
          />
        </div>
      </div>
    </Card>

    <Card title="股东信息" variant="borderless">
      <EnterpriseShareholderEditor :shareholders="props.shareholders" />
    </Card>

    <div class="flex justify-end gap-2">
      <Button @click="emit('reset')">
        <IconifyIcon icon="lucide:rotate-ccw" class="size-4" />
        重置
      </Button>
      <Button type="primary" :loading="props.saving" @click="emit('save')">
        <IconifyIcon icon="lucide:save" class="size-4" />
        保存基础资料
      </Button>
    </div>
  </div>
</template>
