<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { Button, Checkbox, CheckboxGroup, Drawer, Form, FormItem, Input, Modal, Select, Switch, Table, Tag, message } from 'antdv-next';

import {
  createUserApi,
  grantUserAppApi,
  listAppsApi,
  listRolesApi,
  listUserAppsApi,
  listUserRoleIdsApi,
  listUsersApi,
  setUserRolesApi,
  type IamApp,
  type IamRole,
  type IamUser,
  type IamUserApp,
  updateUserApi,
} from '#/api';

type UserForm = Omit<IamUser, 'id'> & { password?: string };

const users = shallowRef<IamUser[]>([]);
const apps = shallowRef<IamApp[]>([]);
const userApps = shallowRef<IamUserApp[]>([]);
const roles = shallowRef<IamRole[]>([]);
const editingId = shallowRef<string>();
const authorizationUser = shallowRef<IamUser>();
const loading = shallowRef(false);
const authorizationLoading = shallowRef(false);
const modalOpen = shallowRef(false);
const authorizationOpen = shallowRef(false);
const saving = shallowRef(false);
const form = reactive<UserForm>(blankForm());
const authorizationForm = reactive({
  appCode: '',
  enabled: true,
  homePath: '',
  roleIds: [] as string[],
});

function blankForm(): UserForm {
  return { avatarPath: null, email: null, password: '', phone: null, realName: '', remark: null, status: 1, username: '' };
}

const appOptions = computed(() => apps.value
  .filter((item) => item.status)
  .map((item) => ({ label: `${item.appName} (${item.appCode})`, value: item.appCode })));
const currentUserApp = computed(() => userApps.value.find((item) => item.appCode === authorizationForm.appCode));

async function reload() {
  loading.value = true;
  try {
    users.value = (await listUsersApi()).items;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = undefined;
  Object.assign(form, blankForm());
  modalOpen.value = true;
}

function openEdit(item: IamUser) {
  editingId.value = item.id;
  Object.assign(form, item, { password: '' });
  modalOpen.value = true;
}

async function save() {
  if (!form.username.trim() || !form.realName.trim() || (!editingId.value && !form.password)) {
    message.error('请填写账号、姓名和初始密码');
    return;
  }
  saving.value = true;
  try {
    const payload = { ...form, realName: form.realName.trim(), username: form.username.trim() };
    if (editingId.value) await updateUserApi(editingId.value, payload);
    else await createUserApi({ ...payload, password: payload.password! });
    message.success('已保存');
    modalOpen.value = false;
    await reload();
  } finally {
    saving.value = false;
  }
}

async function loadAuthorizationContext() {
  if (!authorizationUser.value || !authorizationForm.appCode) return;
  authorizationLoading.value = true;
  try {
    const [roleResult, roleIdsResult] = await Promise.all([
      listRolesApi(authorizationForm.appCode),
      listUserRoleIdsApi(authorizationUser.value.id, authorizationForm.appCode),
    ]);
    roles.value = roleResult.items.filter((item) => item.status);
    authorizationForm.roleIds = roleIdsResult.roleIds;
    authorizationForm.enabled = currentUserApp.value?.status !== 0;
    authorizationForm.homePath = currentUserApp.value?.homePath ?? '';
  } finally {
    authorizationLoading.value = false;
  }
}

async function openAuthorization(user: IamUser) {
  authorizationUser.value = user;
  authorizationLoading.value = true;
  try {
    const [appResult, userAppResult] = await Promise.all([listAppsApi(), listUserAppsApi(user.id)]);
    apps.value = appResult.items;
    userApps.value = userAppResult.items;
    authorizationForm.appCode = userApps.value.find((item) => item.status)?.appCode
      ?? apps.value.find((item) => item.status)?.appCode
      ?? '';
    authorizationOpen.value = true;
    await loadAuthorizationContext();
  } finally {
    authorizationLoading.value = false;
  }
}

async function saveAuthorization() {
  if (!authorizationUser.value || !authorizationForm.appCode) {
    message.error('请选择应用');
    return;
  }
  saving.value = true;
  try {
    await grantUserAppApi(authorizationUser.value.id, authorizationForm.appCode, {
      homePath: authorizationForm.homePath.trim() || null,
      status: authorizationForm.enabled ? 1 : 0,
    });
    if (authorizationForm.enabled) {
      await setUserRolesApi(authorizationUser.value.id, authorizationForm.appCode, authorizationForm.roleIds);
    }
    userApps.value = (await listUserAppsApi(authorizationUser.value.id)).items;
    message.success('应用授权已保存');
  } finally {
    saving.value = false;
  }
}

watch(() => authorizationForm.appCode, () => {
  if (authorizationOpen.value) void loadAuthorizationContext();
});

const columns = [
  { dataIndex: 'realName', key: 'realName', title: '姓名' },
  { dataIndex: 'username', key: 'username', title: '账号' },
  { dataIndex: 'phone', key: 'phone', title: '手机' },
  { dataIndex: 'email', key: 'email', title: '邮箱' },
  { key: 'status', title: '状态', width: 96 },
  { key: 'action', title: '操作', width: 156 },
];

onMounted(reload);
</script>

<template>
  <Page auto-content-height>
    <section class="iam-list-page">
      <header class="iam-list-page__header">
        <div>
          <h1>用户管理</h1>
          <p>统一维护所有接入系统的身份账号。</p>
        </div>
        <div class="iam-list-page__actions">
          <Button type="primary" @click="openCreate"><Plus /> 新建用户</Button>
        </div>
      </header>
      <Table :columns="columns" :data-source="users" :loading="loading" :pagination="false" row-key="id" size="middle">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'"><Tag :color="record.status ? 'green' : 'default'">{{ record.status ? '启用' : '停用' }}</Tag></template>
          <template v-else-if="column.key === 'action'"><Button type="link" @click="openAuthorization(record)">应用授权</Button><Button type="link" @click="openEdit(record)">编辑</Button></template>
        </template>
      </Table>
    </section>
    <Modal v-model:open="modalOpen" :confirm-loading="saving" :title="editingId ? '编辑用户' : '新建用户'" @ok="save">
      <Form layout="vertical">
        <div class="iam-form-grid"><FormItem label="账号" required><Input v-model:value="form.username" /></FormItem><FormItem label="姓名" required><Input v-model:value="form.realName" /></FormItem></div>
        <FormItem :label="editingId ? '重置密码（留空不修改）' : '初始密码'" :required="!editingId"><InputPassword v-model:value="form.password" /></FormItem>
        <div class="iam-form-grid"><FormItem label="手机"><Input v-model:value="form.phone" /></FormItem><FormItem label="邮箱"><Input v-model:value="form.email" /></FormItem></div>
        <FormItem label="备注"><Input v-model:value="form.remark" /></FormItem>
        <FormItem label="启用"><Switch v-model:checked="form.status" :checked-value="1" :un-checked-value="0" /></FormItem>
      </Form>
    </Modal>
    <Drawer v-model:open="authorizationOpen" :title="`${authorizationUser?.realName ?? ''} - 应用授权`" size="large">
      <Form layout="vertical">
        <FormItem label="应用" required><Select v-model:value="authorizationForm.appCode" :loading="authorizationLoading" :options="appOptions" /></FormItem>
        <FormItem label="应用访问"><Switch v-model:checked="authorizationForm.enabled" checked-children="启用" un-checked-children="停用" /></FormItem>
        <FormItem label="个人首页"><Input v-model:value="authorizationForm.homePath" placeholder="留空使用应用默认首页" /></FormItem>
        <FormItem label="应用角色"><CheckboxGroup v-model:value="authorizationForm.roleIds" class="role-options"><Checkbox v-for="role in roles" :key="role.id" :disabled="!authorizationForm.enabled" :value="role.id"><Tag>{{ role.roleCode }}</Tag> {{ role.roleName }}</Checkbox></CheckboxGroup></FormItem>
        <div class="authorization-actions"><Button :loading="saving" type="primary" @click="saveAuthorization">保存授权</Button></div>
      </Form>
    </Drawer>
  </Page>
</template>

<style scoped>
.iam-list-page { min-height: 100%; padding: 24px; background: #f6f8fb; }
.iam-list-page__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.iam-list-page__header h1 { margin: 0; color: #172033; font-size: 20px; font-weight: 600; }
.iam-list-page__header p { margin: 6px 0 0; color: #667085; font-size: 14px; }
.iam-list-page__actions { display: flex; gap: 8px; }
.iam-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.role-options { display: grid; gap: 12px; }
.authorization-actions { display: flex; justify-content: flex-end; margin-top: 24px; }
@media (max-width: 640px) { .iam-list-page { padding: 16px; }.iam-list-page__header { align-items: flex-start; flex-direction: column; }.iam-form-grid { grid-template-columns: 1fr; } }
</style>
