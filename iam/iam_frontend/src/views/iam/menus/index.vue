<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { Button, Form, FormItem, Input, InputNumber, Modal, Select, Switch, Table, Tag, message } from 'antdv-next';
import { useRoute } from 'vue-router';

import { createMenuApi, listMenusApi, listPermissionsApi, type IamMenu, type IamPermission, updateMenuApi } from '#/api';
import ApplicationContextHeader from '../application-workspace/ApplicationContextHeader.vue';

type MenuForm = Omit<IamMenu, 'id'>;

const route = useRoute();
const appCode = computed(() => String(route.params.appCode ?? ''));
const editingId = shallowRef<string>();
const loading = shallowRef(false);
const menus = shallowRef<IamMenu[]>([]);
const modalOpen = shallowRef(false);
const permissions = shallowRef<IamPermission[]>([]);
const saving = shallowRef(false);
const form = reactive<MenuForm>(blankForm());

const permissionOptions = computed(() => permissions.value.map((permission) => ({ label: `${permission.permissionName} (${permission.permissionCode})`, value: permission.permissionCode })));
const parentOptions = computed(() => [
  { label: '顶级菜单', value: null },
  ...menus.value
    .filter((menu) => menu.id !== editingId.value && menu.menuType !== 'button')
    .map((menu) => ({ label: menu.menuName, value: menu.id })),
]);
const columns = [
  { dataIndex: 'menuName', key: 'menuName', title: '名称' },
  { dataIndex: 'menuType', key: 'menuType', title: '类型', width: 100 },
  { dataIndex: 'path', key: 'path', title: '路径' },
  { dataIndex: 'component', key: 'component', title: '组件' },
  { dataIndex: 'authCode', key: 'authCode', title: '权限码' },
  { dataIndex: 'sortOrder', key: 'sortOrder', title: '排序', width: 80 },
  { key: 'status', title: '状态', width: 80 },
  { key: 'action', title: '操作', width: 72 },
];

function blankForm(): MenuForm {
  return { authCode: null, component: null, menuName: '', menuType: 'menu', meta: {}, parentId: null, path: null, redirect: null, sortOrder: 0, status: 1 };
}

async function reload() {
  if (!appCode.value) return;
  loading.value = true;
  try {
    const [menuResult, permissionResult] = await Promise.all([listMenusApi(appCode.value), listPermissionsApi(appCode.value)]);
    menus.value = menuResult.items;
    permissions.value = permissionResult.items;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = undefined;
  Object.assign(form, blankForm());
  modalOpen.value = true;
}

function openEdit(menu: IamMenu) {
  editingId.value = menu.id;
  Object.assign(form, {
    authCode: menu.authCode,
    component: menu.component,
    menuName: menu.menuName,
    menuType: menu.menuType,
    meta: menu.meta,
    parentId: menu.parentId,
    path: menu.path,
    redirect: menu.redirect,
    sortOrder: menu.sortOrder,
    status: menu.status,
  });
  modalOpen.value = true;
}

async function save() {
  if (!appCode.value || !form.menuName.trim()) {
    message.error('请填写菜单名称');
    return;
  }
  saving.value = true;
  try {
    const payload = { ...form, menuName: form.menuName.trim() };
    if (editingId.value) await updateMenuApi(appCode.value, editingId.value, payload);
    else await createMenuApi(appCode.value, payload);
    modalOpen.value = false;
    await reload();
    message.success('菜单已保存');
  } finally {
    saving.value = false;
  }
}

watch(appCode, () => void reload(), { immediate: true });
</script>

<template>
  <Page auto-content-height>
    <section class="iam-menus">
      <header class="iam-menus__header">
        <div><h1 class="iam-menus__title">业务菜单</h1><p class="iam-menus__summary">仅维护当前应用自己的目录、路由菜单和按钮资源。</p></div>
        <div class="toolbar"><Button type="primary" @click="openCreate"><Plus /> 新建菜单</Button></div>
      </header>
      <ApplicationContextHeader active="menus" />
      <Table :columns="columns" :data-source="menus" :loading="loading" :pagination="false" row-key="id">
        <template #bodyCell="{ column, record }">
          <Tag v-if="column.key === 'menuType'" :color="record.menuType === 'button' ? 'orange' : record.menuType === 'catalog' ? 'blue' : 'green'">{{ record.menuType }}</Tag>
          <Tag v-else-if="column.key === 'authCode' && record.authCode">{{ record.authCode }}</Tag>
          <Tag v-else-if="column.key === 'status'" :color="record.status ? 'green' : 'default'">{{ record.status ? '启用' : '停用' }}</Tag>
          <Button v-else-if="column.key === 'action'" type="link" @click="openEdit(record)">编辑</Button>
        </template>
      </Table>
    </section>
    <Modal v-model:open="modalOpen" :confirm-loading="saving" :title="editingId ? '编辑菜单资源' : '新建菜单资源'" @ok="save">
      <Form layout="vertical"><div class="two-col"><FormItem label="名称" required><Input v-model:value="form.menuName" /></FormItem><FormItem label="类型"><Select v-model:value="form.menuType" :options="[{label:'目录',value:'catalog'},{label:'菜单',value:'menu'},{label:'按钮',value:'button'}]" /></FormItem></div><FormItem label="父级菜单"><Select v-model:value="form.parentId" :options="parentOptions" /></FormItem><div class="two-col"><FormItem label="路径"><Input v-model:value="form.path" placeholder="例如 /enterprise" /></FormItem><FormItem label="组件"><Input v-model:value="form.component" placeholder="例如 enterprise/profile/list" /></FormItem></div><FormItem label="关联权限码"><Select v-model:value="form.authCode" allow-clear :options="permissionOptions" /></FormItem><FormItem label="排序"><InputNumber v-model:value="form.sortOrder" :min="0" class="full" /></FormItem><FormItem label="启用"><Switch v-model:checked="form.status" :checked-value="1" :un-checked-value="0" /></FormItem></Form>
    </Modal>
  </Page>
</template>

<style scoped>
.iam-menus { min-height: 100%; padding: 24px; background: #f6f8fb; }
.iam-menus__header, .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.iam-menus__title { margin: 0; color: #172033; font-size: 20px; font-weight: 600; }
.iam-menus__summary { margin: 6px 0 16px; color: #667085; font-size: 14px; }
.two-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.full { width: 100%; }
@media (max-width: 640px) { .iam-menus { padding: 16px; }.iam-menus__header, .toolbar { align-items: flex-start; flex-direction: column; }.two-col { grid-template-columns: 1fr; } }
</style>
