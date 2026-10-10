<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { Button, Checkbox, CheckboxGroup, Form, FormItem, Input, Modal, Select, Switch, Table, Tag, message } from 'antdv-next';
import { useRoute } from 'vue-router';

import {
  createPermissionApi,
  createRoleApi,
  listPermissionsApi,
  listRolePermissionIdsApi,
  listRolesApi,
  setRolePermissionsApi,
  type IamPermission,
  type IamRole,
  updatePermissionApi,
  updateRoleApi,
} from '#/api';
import ApplicationContextHeader from '../application-workspace/ApplicationContextHeader.vue';

type PermissionForm = Omit<IamPermission, 'appCode' | 'id'>;
type RoleForm = Omit<IamRole, 'appCode' | 'id'>;

const route = useRoute();
const appCode = computed(() => String(route.params.appCode ?? ''));
const assignmentOpen = shallowRef(false);
const editingPermissionId = shallowRef<string>();
const editingRoleId = shallowRef<string>();
const loading = shallowRef(false);
const permissionOpen = shallowRef(false);
const permissions = shallowRef<IamPermission[]>([]);
const roleOpen = shallowRef(false);
const roles = shallowRef<IamRole[]>([]);
const saving = shallowRef(false);
const selectedPermissionIds = shallowRef<string[]>([]);
const selectedRole = shallowRef<IamRole>();
const permissionForm = reactive<PermissionForm>(blankPermissionForm());
const roleForm = reactive<RoleForm>(blankRoleForm());

const permissionColumns = [
  { dataIndex: 'permissionName', key: 'permissionName', title: '权限名称' },
  { dataIndex: 'permissionCode', key: 'permissionCode', title: '权限编码' },
  { dataIndex: 'resourceType', key: 'resourceType', title: '资源类型', width: 100 },
  { key: 'status', title: '状态', width: 80 },
  { key: 'action', title: '操作', width: 72 },
];
const roleColumns = [
  { dataIndex: 'roleName', key: 'roleName', title: '角色名称' },
  { dataIndex: 'roleCode', key: 'roleCode', title: '角色编码' },
  { key: 'status', title: '状态', width: 80 },
  { key: 'action', title: '操作', width: 148 },
];

function blankPermissionForm(): PermissionForm {
  return { permissionCode: '', permissionName: '', resourceType: 'api', status: 1 };
}

function blankRoleForm(): RoleForm {
  return { remark: null, roleCode: '', roleName: '', roleType: 'custom', status: 1 };
}

async function reload() {
  if (!appCode.value) return;
  loading.value = true;
  try {
    const [permissionResult, roleResult] = await Promise.all([listPermissionsApi(appCode.value), listRolesApi(appCode.value)]);
    permissions.value = permissionResult.items;
    roles.value = roleResult.items;
  } finally {
    loading.value = false;
  }
}

function openCreatePermission() {
  editingPermissionId.value = undefined;
  Object.assign(permissionForm, blankPermissionForm());
  permissionOpen.value = true;
}

function openEditPermission(permission: IamPermission) {
  editingPermissionId.value = permission.id;
  Object.assign(permissionForm, {
    permissionCode: permission.permissionCode,
    permissionName: permission.permissionName,
    resourceType: permission.resourceType,
    status: permission.status,
  });
  permissionOpen.value = true;
}

function openCreateRole() {
  editingRoleId.value = undefined;
  Object.assign(roleForm, blankRoleForm());
  roleOpen.value = true;
}

function openEditRole(role: IamRole) {
  editingRoleId.value = role.id;
  Object.assign(roleForm, {
    remark: role.remark,
    roleCode: role.roleCode,
    roleName: role.roleName,
    roleType: role.roleType,
    status: role.status,
  });
  roleOpen.value = true;
}

async function savePermission() {
  if (!appCode.value || !permissionForm.permissionCode.trim() || !permissionForm.permissionName.trim()) {
    message.error('请填写权限编码和名称');
    return;
  }
  saving.value = true;
  try {
    const payload = { ...permissionForm, permissionCode: permissionForm.permissionCode.trim(), permissionName: permissionForm.permissionName.trim() };
    if (editingPermissionId.value) await updatePermissionApi(appCode.value, editingPermissionId.value, payload);
    else await createPermissionApi(appCode.value, payload);
    permissionOpen.value = false;
    await reload();
    message.success('权限已保存');
  } finally {
    saving.value = false;
  }
}

async function saveRole() {
  if (!appCode.value || !roleForm.roleCode.trim() || !roleForm.roleName.trim()) {
    message.error('请填写角色编码和名称');
    return;
  }
  saving.value = true;
  try {
    const payload = { ...roleForm, roleCode: roleForm.roleCode.trim(), roleName: roleForm.roleName.trim() };
    if (editingRoleId.value) await updateRoleApi(appCode.value, editingRoleId.value, payload);
    else await createRoleApi(appCode.value, payload);
    roleOpen.value = false;
    await reload();
    message.success('角色已保存');
  } finally {
    saving.value = false;
  }
}

async function openAssignment(role: IamRole) {
  if (!appCode.value) return;
  selectedRole.value = role;
  saving.value = true;
  try {
    selectedPermissionIds.value = (await listRolePermissionIdsApi(appCode.value, role.id)).permissionIds;
    assignmentOpen.value = true;
  } finally {
    saving.value = false;
  }
}

async function saveAssignment() {
  if (!appCode.value || !selectedRole.value) return;
  saving.value = true;
  try {
    await setRolePermissionsApi(appCode.value, selectedRole.value.id, selectedPermissionIds.value);
    assignmentOpen.value = false;
    message.success('角色权限已保存');
  } finally {
    saving.value = false;
  }
}

watch(appCode, () => void reload(), { immediate: true });
</script>

<template>
  <Page auto-content-height>
    <section class="iam-access">
      <header class="iam-access__header">
        <div><h1 class="iam-access__title">角色与权限</h1><p class="iam-access__summary">角色和权限码仅属于当前应用，不跨应用复用。</p></div>
      </header>
      <ApplicationContextHeader active="access" />

      <div class="iam-access__grids">
        <section class="iam-access__section">
          <div class="section-title"><h2>角色</h2><Button type="primary" @click="openCreateRole"><Plus /> 新建角色</Button></div>
          <Table :columns="roleColumns" :data-source="roles" :loading="loading" :pagination="false" row-key="id">
            <template #bodyCell="{ column, record }">
              <Tag v-if="column.key === 'status'" :color="record.status ? 'green' : 'default'">{{ record.status ? '启用' : '停用' }}</Tag>
              <template v-else-if="column.key === 'action'"><Button type="link" @click="openAssignment(record)">分配权限</Button><Button type="link" @click="openEditRole(record)">编辑</Button></template>
            </template>
          </Table>
        </section>

        <section class="iam-access__section">
          <div class="section-title"><h2>权限码</h2><Button type="primary" @click="openCreatePermission"><Plus /> 新建权限</Button></div>
          <Table :columns="permissionColumns" :data-source="permissions" :loading="loading" :pagination="false" row-key="id">
            <template #bodyCell="{ column, record }">
              <Tag v-if="column.key === 'status'" :color="record.status ? 'green' : 'default'">{{ record.status ? '启用' : '停用' }}</Tag>
              <Button v-else-if="column.key === 'action'" type="link" @click="openEditPermission(record)">编辑</Button>
            </template>
          </Table>
        </section>
      </div>
    </section>

    <Modal v-model:open="permissionOpen" :confirm-loading="saving" :title="editingPermissionId ? '编辑权限' : '新建权限'" @ok="savePermission">
      <Form layout="vertical"><FormItem label="权限编码" required><Input v-model:value="permissionForm.permissionCode" :disabled="Boolean(editingPermissionId)" placeholder="例如 Enterprise:Profile:Read" /></FormItem><FormItem label="权限名称" required><Input v-model:value="permissionForm.permissionName" /></FormItem><FormItem label="资源类型"><Select v-model:value="permissionForm.resourceType" :options="[{label:'API',value:'api'},{label:'按钮',value:'button'},{label:'菜单',value:'menu'}]" /></FormItem><FormItem label="启用"><Switch v-model:checked="permissionForm.status" :checked-value="1" :un-checked-value="0" /></FormItem></Form>
    </Modal>
    <Modal v-model:open="roleOpen" :confirm-loading="saving" :title="editingRoleId ? '编辑角色' : '新建角色'" @ok="saveRole">
      <Form layout="vertical"><FormItem label="角色编码" required><Input v-model:value="roleForm.roleCode" :disabled="Boolean(editingRoleId)" /></FormItem><FormItem label="角色名称" required><Input v-model:value="roleForm.roleName" /></FormItem><FormItem label="角色类型"><Input v-model:value="roleForm.roleType" /></FormItem><FormItem label="备注"><Input v-model:value="roleForm.remark" /></FormItem><FormItem label="启用"><Switch v-model:checked="roleForm.status" :checked-value="1" :un-checked-value="0" /></FormItem></Form>
    </Modal>
    <Modal v-model:open="assignmentOpen" :confirm-loading="saving" :title="`${selectedRole?.roleName ?? ''} - 分配权限`" @ok="saveAssignment"><CheckboxGroup v-model:value="selectedPermissionIds" class="permission-options"><Checkbox v-for="permission in permissions" :key="permission.id" :value="permission.id"><Tag>{{ permission.permissionCode }}</Tag> {{ permission.permissionName }}</Checkbox></CheckboxGroup></Modal>
  </Page>
</template>

<style scoped>
.iam-access { min-height: 100%; padding: 24px; background: #f6f8fb; }
.iam-access__header, .section-title { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.iam-access__header { margin-bottom: 16px; }
.iam-access__title, .section-title h2 { margin: 0; color: #172033; font-weight: 600; }
.iam-access__title { font-size: 20px; }
.section-title h2 { font-size: 16px; }
.iam-access__summary { margin: 6px 0 0; color: #667085; font-size: 14px; }
.iam-access__grids { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 18px; }
.iam-access__section { padding: 18px; background: #fff; border: 1px solid #d9e1e8; border-radius: 8px; }
.section-title { margin-bottom: 14px; }
.permission-options { display: grid; gap: 12px; }
@media (max-width: 900px) { .iam-access { padding: 16px; }.iam-access__header { align-items: flex-start; flex-direction: column; }.iam-access__grids { grid-template-columns: 1fr; } }
</style>
