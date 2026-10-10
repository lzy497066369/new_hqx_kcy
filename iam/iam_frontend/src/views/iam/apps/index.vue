<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { Button, Drawer, Form, FormItem, Input, InputNumber, InputPassword, Modal, Select, Switch, Table, Tag, TextArea, message } from 'antdv-next';
import { useRoute, useRouter } from 'vue-router';

import { createAppApi, createOAuthClientApi, listAppsApi, listOAuthClientsApi, type IamApp, type IamOAuthClient, type IamOAuthClientInput, updateAppApi, updateOAuthClientApi } from '#/api';

type AppForm = Omit<IamApp, 'id'>;

const apps = shallowRef<IamApp[]>([]);
const clients = shallowRef<IamOAuthClient[]>([]);
const editingId = shallowRef<string>();
const editingClientId = shallowRef<string>();
const clientApp = shallowRef<IamApp>();
const loading = shallowRef(false);
const clientLoading = shallowRef(false);
const modalOpen = shallowRef(false);
const clientDrawerOpen = shallowRef(false);
const clientModalOpen = shallowRef(false);
const saving = shallowRef(false);
const form = reactive<AppForm>(blankForm());
const clientForm = reactive<IamOAuthClientInput>(blankClientForm());
const route = useRoute();
const router = useRouter();

function blankForm(): AppForm {
  return { appCode: '', appName: '', appType: 'web', companySourceSystem: null, homePath: null, portalType: 'admin', remark: null, status: 1 };
}

function blankClientForm(): IamOAuthClientInput {
  return {
    accessTokenTtl: 1800,
    clientId: '',
    clientType: 'public',
    grantTypes: ['authorization_code', 'refresh_token'],
    postLogoutRedirectUris: [],
    redirectUris: [],
    refreshTokenTtl: 2_592_000,
    secret: '',
    status: 1,
  };
}

const clientTypeOptions = [
  { label: 'Public（SPA / 移动端）', value: 'public' },
  { label: 'Confidential（服务端）', value: 'confidential' },
];
const grantTypeOptions = [
  { label: 'Authorization Code', value: 'authorization_code' },
  { label: 'Refresh Token', value: 'refresh_token' },
];
const clientColumns = [
  { dataIndex: 'clientId', key: 'clientId', title: 'Client ID' },
  { dataIndex: 'clientType', key: 'clientType', title: '类型', width: 150 },
  { key: 'redirectUris', title: '回调地址' },
  { key: 'status', title: '状态', width: 88 },
  { key: 'action', title: '操作', width: 80 },
];

const appClientTitle = computed(() => `${clientApp.value?.appName ?? ''} - OAuth 客户端`);

async function reload() {
  loading.value = true;
  try {
    apps.value = (await listAppsApi()).items;
  } finally {
    loading.value = false;
  }
}

async function openClientFromQuery() {
  const appCode = String(route.query.clientApp ?? '');
  if (!appCode || clientApp.value?.appCode === appCode) return;
  const app = apps.value.find((item) => item.appCode === appCode);
  if (!app) return;
  await openClients(app);
  await router.replace({ query: { ...route.query, clientApp: undefined } });
}

function openCreate() {
  editingId.value = undefined;
  Object.assign(form, blankForm());
  modalOpen.value = true;
}

function openEdit(item: IamApp) {
  editingId.value = item.id;
  Object.assign(form, item);
  modalOpen.value = true;
}

async function save() {
  if (!form.appCode.trim() || !form.appName.trim()) {
    message.error('请填写应用编码和应用名称');
    return;
  }
  saving.value = true;
  try {
    const payload = { ...form, appCode: form.appCode.trim(), appName: form.appName.trim() };
    if (editingId.value) await updateAppApi(editingId.value, payload);
    else await createAppApi(payload);
    message.success('已保存');
    modalOpen.value = false;
    await reload();
  } finally {
    saving.value = false;
  }
}

async function openClients(app: IamApp) {
  clientApp.value = app;
  clientDrawerOpen.value = true;
  clientLoading.value = true;
  try {
    clients.value = (await listOAuthClientsApi(app.appCode)).items;
  } finally {
    clientLoading.value = false;
  }
}

function openCreateClient() {
  editingClientId.value = undefined;
  Object.assign(clientForm, blankClientForm());
  clientModalOpen.value = true;
}

function openEditClient(client: IamOAuthClient) {
  editingClientId.value = client.id;
  Object.assign(clientForm, {
    accessTokenTtl: client.accessTokenTtl,
    clientId: client.clientId,
    clientType: client.clientType,
    grantTypes: [...client.grantTypes],
    postLogoutRedirectUris: [...(client.postLogoutRedirectUris ?? [])],
    redirectUris: [...client.redirectUris],
    refreshTokenTtl: client.refreshTokenTtl,
    secret: '',
    status: client.status,
  });
  clientModalOpen.value = true;
}

function parseUris(value: number | string | undefined) {
  return String(value ?? '').split('\n').map((item) => item.trim()).filter(Boolean);
}

async function saveClient() {
  if (!clientApp.value || !clientForm.clientId.trim() || clientForm.redirectUris.length === 0) {
    message.error('请填写 Client ID 和至少一个回调地址');
    return;
  }
  if (!editingClientId.value && clientForm.clientType === 'confidential' && !clientForm.secret?.trim()) {
    message.error('服务端客户端必须设置密钥');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      ...clientForm,
      clientId: clientForm.clientId.trim(),
      postLogoutRedirectUris: clientForm.postLogoutRedirectUris?.filter(Boolean),
      redirectUris: clientForm.redirectUris.filter(Boolean),
      secret: clientForm.secret?.trim() || undefined,
    };
    if (editingClientId.value) await updateOAuthClientApi(clientApp.value.appCode, editingClientId.value, payload);
    else await createOAuthClientApi(clientApp.value.appCode, payload);
    clientModalOpen.value = false;
    clients.value = (await listOAuthClientsApi(clientApp.value.appCode)).items;
    message.success(editingClientId.value ? 'OAuth 客户端已更新' : 'OAuth 客户端已创建');
  } finally {
    saving.value = false;
  }
}

const columns = [
  { dataIndex: 'companySourceSystem', key: 'companySourceSystem', title: 'Company source' },
  { dataIndex: 'appName', key: 'appName', title: '应用名称' },
  { dataIndex: 'appCode', key: 'appCode', title: '应用编码' },
  { dataIndex: 'appType', key: 'appType', title: '类型' },
  { dataIndex: 'portalType', key: 'portalType', title: '门户' },
  { key: 'status', title: '状态', width: 96 },
  { key: 'action', title: '操作', width: 168 },
];

watch(() => route.query.clientApp, () => void openClientFromQuery());
onMounted(async () => {
  await reload();
  await openClientFromQuery();
});
</script>

<template>
  <Page auto-content-height>
    <section class="iam-list-page">
      <header class="iam-list-page__header">
        <div><h1>应用管理</h1><p>登记接入 IAM 的业务系统及其统一登录客户端。</p></div>
        <div class="iam-list-page__actions"><Button type="primary" @click="openCreate"><Plus /> 新建应用</Button></div>
      </header>
      <Table :columns="columns" :data-source="apps" :loading="loading" :pagination="false" row-key="id" size="middle">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'"><Tag :color="record.status ? 'green' : 'default'">{{ record.status ? '启用' : '停用' }}</Tag></template>
          <template v-else-if="column.key === 'action'"><Button type="link" @click="openClients(record)">OAuth 客户端</Button><Button type="link" @click="openEdit(record)">编辑</Button></template>
        </template>
      </Table>
    </section>
    <Modal v-model:open="modalOpen" :confirm-loading="saving" :title="editingId ? '编辑应用' : '新建应用'" @ok="save">
      <Form layout="vertical"><FormItem label="应用编码" required><Input v-model:value="form.appCode" :disabled="Boolean(editingId)" /></FormItem><FormItem label="应用名称" required><Input v-model:value="form.appName" /></FormItem><div class="iam-form-grid"><FormItem label="应用类型"><Select v-model:value="form.appType" :options="[{ label: 'Web', value: 'web' }, { label: 'Service', value: 'service' }]" /></FormItem><FormItem label="门户"><Select v-model:value="form.portalType" :options="[{ label: '管理端', value: 'admin' }, { label: '客户端', value: 'client' }]" /></FormItem></div><FormItem label="公司数据源"><Input v-model:value="form.companySourceSystem" placeholder="例如 hqx_kjqb；留空表示全局目录" /></FormItem><FormItem label="首页路径"><Input v-model:value="form.homePath" placeholder="例如 /dashboard" /></FormItem><FormItem label="备注"><Input v-model:value="form.remark" /></FormItem><FormItem label="启用"><Switch v-model:checked="form.status" :checked-value="1" :un-checked-value="0" /></FormItem></Form>
    </Modal>
    <Drawer v-model:open="clientDrawerOpen" :title="appClientTitle" size="large">
      <div class="client-toolbar"><span>每个 Web、移动端或服务端接入方均应登记一个独立客户端。</span><Button type="primary" @click="openCreateClient"><Plus /> 新建客户端</Button></div>
      <Table :columns="clientColumns" :data-source="clients" :loading="clientLoading" :pagination="false" row-key="id">
        <template #bodyCell="{ column, record }"><Tag v-if="column.key === 'clientType'">{{ record.clientType }}</Tag><template v-else-if="column.key === 'redirectUris'"><div v-for="uri in record.redirectUris" :key="uri" class="uri">{{ uri }}</div></template><Tag v-else-if="column.key === 'status'" :color="record.status ? 'green' : 'default'">{{ record.status ? '启用' : '停用' }}</Tag><Button v-else-if="column.key === 'action'" type="link" @click="openEditClient(record)">编辑</Button></template>
      </Table>
    </Drawer>
    <Modal v-model:open="clientModalOpen" :confirm-loading="saving" :title="editingClientId ? '编辑 OAuth 客户端' : '新建 OAuth 客户端'" @ok="saveClient">
      <Form layout="vertical"><FormItem label="Client ID" required><Input v-model:value="clientForm.clientId" :disabled="Boolean(editingClientId)" placeholder="例如 kjqb_admin_web" /></FormItem><FormItem label="客户端类型"><Select v-model:value="clientForm.clientType" :options="clientTypeOptions" /></FormItem><FormItem v-if="clientForm.clientType === 'confidential'" :label="editingClientId ? 'Client Secret（留空不变）' : 'Client Secret'" :required="!editingClientId"><InputPassword v-model:value="clientForm.secret" autocomplete="new-password" /></FormItem><FormItem label="授权类型"><Select v-model:value="clientForm.grantTypes" mode="multiple" :options="grantTypeOptions" /></FormItem><FormItem label="回调地址" required><TextArea :value="clientForm.redirectUris.join('\n')" :rows="3" placeholder="每行一个完整回调地址" @update:value="clientForm.redirectUris = parseUris($event)" /></FormItem><FormItem label="登出回调地址"><TextArea :value="clientForm.postLogoutRedirectUris?.join('\n')" :rows="2" placeholder="每行一个地址，可留空" @update:value="clientForm.postLogoutRedirectUris = parseUris($event)" /></FormItem><div class="iam-form-grid"><FormItem label="Access Token 秒数"><InputNumber v-model:value="clientForm.accessTokenTtl" :min="300" class="full" /></FormItem><FormItem label="Refresh Token 秒数"><InputNumber v-model:value="clientForm.refreshTokenTtl" :min="3600" class="full" /></FormItem></div><FormItem label="启用"><Switch v-model:checked="clientForm.status" :checked-value="1" :un-checked-value="0" /></FormItem></Form>
    </Modal>
  </Page>
</template>

<style scoped>
.iam-list-page { min-height: 100%; padding: 24px; background: #f6f8fb; }
.iam-list-page__header, .client-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.iam-list-page__header { margin-bottom: 16px; }
.iam-list-page__header h1 { margin: 0; color: #172033; font-size: 20px; font-weight: 600; }
.iam-list-page__header p, .client-toolbar { margin: 6px 0 0; color: #667085; font-size: 14px; }
.iam-list-page__actions { display: flex; gap: 8px; }
.client-toolbar { margin-bottom: 16px; }
.iam-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.full { width: 100%; }
.uri { overflow-wrap: anywhere; }
@media (max-width: 640px) { .iam-list-page { padding: 16px; }.iam-list-page__header, .client-toolbar { align-items: flex-start; flex-direction: column; }.iam-form-grid { grid-template-columns: 1fr; } }
</style>
