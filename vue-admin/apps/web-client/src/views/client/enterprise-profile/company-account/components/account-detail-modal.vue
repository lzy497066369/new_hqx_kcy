<script setup lang="ts">
import type { ClientEnterpriseAccountApi } from '#/api/client/enterprise-account';

import { computed } from 'vue';

import { Button, Descriptions, DescriptionsItem, Modal, Tag } from 'antdv-next';

import {
  formatAccountUrl,
  getEnterpriseAccountStatusColor,
  getEnterpriseAccountStatusLabel,
  getEnterpriseAccountTypeLabel,
  maskPassword,
  normalizeNullableText,
} from '../shared';

const props = defineProps<{
  account?: ClientEnterpriseAccountApi.ClientEnterpriseAccount;
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  copyPassword: [account: ClientEnterpriseAccountApi.ClientEnterpriseAccount];
}>();

const title = computed(() => props.account?.pt_name || '企业账号详情');
</script>

<template>
  <Modal
    :footer="null"
    :open="props.open"
    :title="title"
    width="760px"
    @cancel="emit('close')"
  >
    <Descriptions
      v-if="props.account"
      bordered
      :column="{ md: 2, sm: 1, xs: 1 }"
    >
      <DescriptionsItem label="平台名称">
        {{ props.account.pt_name }}
      </DescriptionsItem>
      <DescriptionsItem label="账号类型">
        <Tag color="processing">
          {{ getEnterpriseAccountTypeLabel(props.account.zh_type) }}
        </Tag>
      </DescriptionsItem>
      <DescriptionsItem label="账号">
        {{ props.account.zh_number }}
      </DescriptionsItem>
      <DescriptionsItem label="密码">
        <div class="flex items-center justify-between gap-2">
          <span>{{ maskPassword(props.account.zh_password) }}</span>
          <Button size="small" @click="emit('copyPassword', props.account)">
            复制密码
          </Button>
        </div>
      </DescriptionsItem>
      <DescriptionsItem label="负责人">
        {{ normalizeNullableText(props.account.charge) }}
      </DescriptionsItem>
      <DescriptionsItem label="联系电话">
        {{ normalizeNullableText(props.account.b_phone) }}
      </DescriptionsItem>
      <DescriptionsItem label="联系邮箱">
        {{ normalizeNullableText(props.account.b_email) }}
      </DescriptionsItem>
      <DescriptionsItem label="状态">
        <Tag :color="getEnterpriseAccountStatusColor(props.account.zh_status)">
          {{ getEnterpriseAccountStatusLabel(props.account.zh_status) }}
        </Tag>
      </DescriptionsItem>
      <DescriptionsItem label="平台网址">
        <a
          v-if="props.account.pt_url"
          :href="props.account.pt_url"
          rel="noreferrer"
          target="_blank"
        >
          {{ formatAccountUrl(props.account.pt_url) }}
        </a>
        <span v-else>{{ normalizeNullableText(props.account.pt_url) }}</span>
      </DescriptionsItem>
      <DescriptionsItem label="归属编码">
        {{ normalizeNullableText(props.account.gsbm) }}
      </DescriptionsItem>
      <DescriptionsItem label="到期日期">
        {{ normalizeNullableText(props.account.end_date) }}
      </DescriptionsItem>
      <DescriptionsItem :span="2" label="备注">
        {{ normalizeNullableText(props.account.remark) }}
      </DescriptionsItem>
    </Descriptions>
  </Modal>
</template>
