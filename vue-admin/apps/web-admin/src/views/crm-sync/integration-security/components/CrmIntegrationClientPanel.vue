<script setup lang="ts">
import type { CrmIntegrationClient, CreatedCrmIntegrationKey } from '#/api';

import { reactive, shallowRef } from 'vue';

import { Button, Card, Form, FormItem, Input, InputNumber, Modal, Table, Tag } from 'antdv-next';

import {
  createCrmIntegrationClientApi,
  createCrmIntegrationKeyApi,
  disableCrmIntegrationKeyApi,
} from '#/api';
import { confirmAction, showActionFailure, showActionSuccess } from '../../../system/shared/action-feedback';

const props = defineProps<{
  clients: CrmIntegrationClient[];
  loading: boolean;
}>();

const emit = defineEmits<{ refresh: [] }>();

const clientModalOpen = shallowRef(false);
const keyModalOpen = shallowRef(false);
const createdKey = shallowRef<CreatedCrmIntegrationKey | null>(null);
const selectedClient = shallowRef<CrmIntegrationClient | null>(null);
const saving = shallowRef(false);
const clientForm = reactive({
  allowedIpCidrs: '',
  appId: '',
  name: '',
  rateLimitPerMinute: 60,
});
const keyForm = reactive({
  expiresAt: '',
  keyId: '',
  scopes: 'contracts,execution_orders,status',
});

const clientColumns = [
  { dataIndex: 'name', key: 'name', title: '调用方', width: 180 },
  { dataIndex: 'appId', key: 'appId', title: 'App ID', width: 200 },
  { dataIndex: 'allowedIpCidrs', key: 'allowedIpCidrs', title: 'IP 白名单', minWidth: 220 },
  { dataIndex: 'rateLimitPerMinute', key: 'rateLimitPerMinute', title: '每分钟限流', width: 120 },
  { key: 'keys', title: '密钥', minWidth: 280 },
  { key: 'actions', title: '操作', width: 120 },
];

function openClientModal() {
  Object.assign(clientForm, { allowedIpCidrs: '', appId: '', name: '', rateLimitPerMinute: 60 });
  clientModalOpen.value = true;
}

function openKeyModal(client: CrmIntegrationClient) {
  selectedClient.value = client;
  createdKey.value = null;
  Object.assign(keyForm, { expiresAt: '', keyId: '', scopes: 'contracts,execution_orders,status' });
  keyModalOpen.value = true;
}

async function createClient() {
  saving.value = true;
  try {
    await createCrmIntegrationClientApi({
      allowedIpCidrs: clientForm.allowedIpCidrs || undefined,
      appId: clientForm.appId || undefined,
      name: clientForm.name,
      rateLimitPerMinute: clientForm.rateLimitPerMinute,
    });
    clientModalOpen.value = false;
    showActionSuccess('CRM 调用方已创建');
    emit('refresh');
  } catch (error) {
    showActionFailure(error);
  } finally {
    saving.value = false;
  }
}

async function createKey() {
  if (!selectedClient.value) return;
  saving.value = true;
  try {
    createdKey.value = await createCrmIntegrationKeyApi(selectedClient.value.id, {
      expiresAt: keyForm.expiresAt || undefined,
      keyId: keyForm.keyId || undefined,
      scopes: keyForm.scopes,
    });
    showActionSuccess('签名密钥已创建，请立即交付并安全保存');
    emit('refresh');
  } catch (error) {
    showActionFailure(error);
  } finally {
    saving.value = false;
  }
}

async function disableKey(id: string) {
  try {
    await confirmAction('停用后该密钥立即无法调用 v2 接口，确认继续吗？', '停用签名密钥');
    await disableCrmIntegrationKeyApi(id);
    showActionSuccess('签名密钥已停用');
    emit('refresh');
  } catch (error) {
    if (error instanceof Error && error.message === 'cancel') return;
    showActionFailure(error);
  }
}
</script>

<template>
  <Card title="CRM 调用方与签名密钥">
    <template #extra><Button type="primary" @click="openClientModal">新增调用方</Button></template>
    <Table :columns="clientColumns" :data-source="props.clients" :loading="props.loading" :pagination="false" :row-key="(item: CrmIntegrationClient) => item.id" :scroll="{ x: 1220 }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'allowedIpCidrs'">{{ record.allowedIpCidrs || '未限制' }}</template>
        <template v-else-if="column.key === 'keys'">
          <div v-if="record.keys.length" class="crm-integration-client__keys">
            <span v-for="key in record.keys" :key="key.id">
              <Tag :color="key.status === 1 ? 'green' : 'default'">{{ key.keyId }}</Tag>
              <Button v-if="key.status === 1" size="small" type="link" @click="disableKey(key.id)">停用</Button>
            </span>
          </div>
          <span v-else>-</span>
        </template>
        <template v-else-if="column.key === 'actions'"><Button size="small" type="link" @click="openKeyModal(record)">新建密钥</Button></template>
      </template>
    </Table>
  </Card>

  <Modal v-model:open="clientModalOpen" :confirm-loading="saving" title="新增 CRM 调用方" @ok="createClient">
    <Form layout="vertical">
      <FormItem label="调用方名称" required><Input v-model:value="clientForm.name" /></FormItem>
      <FormItem label="App ID"><Input v-model:value="clientForm.appId" placeholder="留空则自动生成" /></FormItem>
      <FormItem label="IP 白名单"><Input v-model:value="clientForm.allowedIpCidrs" placeholder="例如 10.0.0.0/24,203.0.113.8" /></FormItem>
      <FormItem label="每分钟限流"><InputNumber v-model:value="clientForm.rateLimitPerMinute" :max="600" :min="1" /></FormItem>
    </Form>
  </Modal>

  <Modal v-model:open="keyModalOpen" :confirm-loading="saving" :footer="createdKey ? null : undefined" title="创建签名密钥" @ok="createKey">
    <template v-if="createdKey">
      <Form layout="vertical">
        <FormItem label="Key ID"><Input :value="createdKey.keyId" readonly /></FormItem>
        <FormItem label="Secret（仅此处显示一次）"><Input :value="createdKey.secret" readonly /></FormItem>
      </Form>
    </template>
    <Form v-else layout="vertical">
      <FormItem label="Key ID"><Input v-model:value="keyForm.keyId" placeholder="留空则自动生成" /></FormItem>
      <FormItem label="权限"><Input v-model:value="keyForm.scopes" /></FormItem>
      <FormItem label="过期时间"><Input v-model:value="keyForm.expiresAt" placeholder="例如 2026-12-31T23:59:59+08:00" /></FormItem>
    </Form>
  </Modal>
</template>

<style scoped>
.crm-integration-client__keys {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
