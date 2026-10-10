<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';
import { Button, Drawer, Form, FormItem, Input, InputNumber, Modal, Select, Switch, Table, Tag, message } from 'antdv-next';

import {
  createPlatformDepartmentApi,
  listPlatformDepartmentMembersApi,
  listPlatformDepartmentsApi,
  listUsersApi,
  type IamPlatformDepartment,
  type IamUser,
  type IamUserPlatformDepartment,
  updatePlatformDepartmentApi,
  upsertPlatformDepartmentMemberApi,
} from '#/api';

type PlatformDepartmentForm = Omit<IamPlatformDepartment, 'id' | 'leaderRealName' | 'memberCount'>;
type MemberForm = { isPrimary: boolean; status: number; userId: string };
type PlatformDepartmentTreeNode = IamPlatformDepartment & { children: PlatformDepartmentTreeNode[] };

const departments = shallowRef<IamPlatformDepartment[]>([]);
const users = shallowRef<IamUser[]>([]);
const members = shallowRef<IamUserPlatformDepartment[]>([]);
const selectedDepartment = shallowRef<IamPlatformDepartment>();
const editingId = shallowRef<string>();
const editingMemberId = shallowRef<string>();
const loading = shallowRef(false);
const memberLoading = shallowRef(false);
const saving = shallowRef(false);
const departmentDrawerOpen = shallowRef(false);
const memberDrawerOpen = shallowRef(false);
const memberModalOpen = shallowRef(false);
const form = reactive<PlatformDepartmentForm>(blankDepartment());
const memberForm = reactive<MemberForm>(blankMember());

function blankDepartment(): PlatformDepartmentForm {
  return { deptCode: '', deptName: '', leaderUserId: null, parentId: null, remark: null, sortOrder: 0, status: 1 };
}

function blankMember(): MemberForm {
  return { isPrimary: false, status: 1, userId: '' };
}

const tableRows = computed<PlatformDepartmentTreeNode[]>(() => {
  const nodes = new Map<string, PlatformDepartmentTreeNode>(
    departments.value.map((department) => [department.id, { ...department, children: [] }]),
  );
  const roots: PlatformDepartmentTreeNode[] = [];
  for (const department of departments.value) {
    const node = nodes.get(department.id)!;
    const parent = department.parentId ? nodes.get(department.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
});
const parentOptions = computed(() => [
  { label: '顶级部门', value: null },
  ...departments.value
    .filter((item) => item.id !== editingId.value)
    .map((item) => ({ label: `${item.deptName} (${item.deptCode})`, value: item.id })),
]);
const userOptions = computed(() => users.value
  .filter((item) => item.status)
  .map((item) => ({ label: `${item.realName} (${item.username})`, value: item.id })));
const parentNameById = computed(() => new Map(departments.value.map((item) => [item.id, item.deptName])));

const columns = [
  { dataIndex: 'deptName', key: 'deptName', title: '部门名称', width: 220 },
  { dataIndex: 'deptCode', key: 'deptCode', title: '部门编码', width: 160 },
  { key: 'leader', title: '负责人', width: 140 },
  { key: 'memberCount', title: '成员数', width: 90 },
  { dataIndex: 'remark', key: 'remark', title: '备注' },
  { key: 'status', title: '状态', width: 90 },
  { key: 'action', title: '操作', width: 220 },
];

async function reload() {
  loading.value = true;
  try {
    const [departmentResult, userResult] = await Promise.all([listPlatformDepartmentsApi(), listUsersApi()]);
    departments.value = departmentResult.items;
    users.value = userResult.items;
  } finally {
    loading.value = false;
  }
}

function openCreate(parentId: null | string = null) {
  editingId.value = undefined;
  Object.assign(form, blankDepartment(), { parentId });
  departmentDrawerOpen.value = true;
}

function openEdit(department: IamPlatformDepartment) {
  editingId.value = department.id;
  Object.assign(form, {
    deptCode: department.deptCode,
    deptName: department.deptName,
    leaderUserId: department.leaderUserId,
    parentId: department.parentId,
    remark: department.remark,
    sortOrder: department.sortOrder,
    status: department.status,
  });
  departmentDrawerOpen.value = true;
}

async function saveDepartment() {
  if (!form.deptCode.trim() || !form.deptName.trim()) {
    message.error('请填写部门编码和部门名称');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      ...form,
      deptCode: form.deptCode.trim(),
      deptName: form.deptName.trim(),
      leaderUserId: form.leaderUserId || null,
      parentId: form.parentId || null,
      remark: form.remark?.trim() || null,
    };
    if (editingId.value) await updatePlatformDepartmentApi(editingId.value, payload);
    else await createPlatformDepartmentApi(payload);
    departmentDrawerOpen.value = false;
    message.success('平台部门已保存');
    await reload();
  } finally {
    saving.value = false;
  }
}

async function openMembers(department: IamPlatformDepartment) {
  selectedDepartment.value = department;
  memberDrawerOpen.value = true;
  memberLoading.value = true;
  try {
    members.value = (await listPlatformDepartmentMembersApi(department.id)).items;
  } finally {
    memberLoading.value = false;
  }
}

function openMemberForm() {
  editingMemberId.value = undefined;
  Object.assign(memberForm, blankMember());
  memberModalOpen.value = true;
}

function openEditMember(member: IamUserPlatformDepartment) {
  editingMemberId.value = member.id;
  Object.assign(memberForm, { isPrimary: Boolean(member.isPrimary), status: member.status, userId: member.userId });
  memberModalOpen.value = true;
}

async function saveMember() {
  if (!selectedDepartment.value || !memberForm.userId) {
    message.error('请选择用户');
    return;
  }
  saving.value = true;
  try {
    await upsertPlatformDepartmentMemberApi(selectedDepartment.value.id, memberForm);
    memberModalOpen.value = false;
    message.success('部门成员已保存');
    await openMembers(selectedDepartment.value);
    await reload();
  } finally {
    saving.value = false;
  }
}

onMounted(() => void reload());
</script>

<template>
  <Page auto-content-height>
    <section class="platform-departments">
      <header class="platform-departments__header">
        <div>
          <h1 class="platform-departments__title">平台组织</h1>
          <p class="platform-departments__summary">维护平台内部员工的部门树和部门归属，不包含企业客户的公司资料或详情。</p>
        </div>
        <div class="platform-departments__actions">
          <Button type="primary" @click="openCreate()"><Plus /> 新建部门</Button>
        </div>
      </header>

      <Table
        :columns="columns"
        :data-source="tableRows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        :expandable="{ childrenColumnName: 'children', defaultExpandAllRows: true }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'deptName'">
            <span class="department-name">{{ record.deptName }}</span>
            <span v-if="record.parentId" class="department-parent">{{ parentNameById.get(record.parentId) }}</span>
          </template>
          <template v-else-if="column.key === 'leader'">{{ record.leaderRealName || '未设置' }}</template>
          <template v-else-if="column.key === 'memberCount'">{{ record.memberCount ?? 0 }}</template>
          <Tag v-else-if="column.key === 'status'" :color="record.status ? 'green' : 'default'">{{ record.status ? '启用' : '停用' }}</Tag>
          <template v-else-if="column.key === 'action'">
            <Button type="link" @click="openCreate(record.id)">新增下级</Button>
            <Button type="link" @click="openMembers(record)">成员</Button>
            <Button type="link" @click="openEdit(record)">编辑</Button>
          </template>
        </template>
      </Table>
    </section>

    <Drawer v-model:open="departmentDrawerOpen" :title="editingId ? '编辑平台部门' : '新建平台部门'" size="large">
      <Form layout="vertical">
        <div class="platform-departments__form-grid">
          <FormItem label="部门编码" required><Input v-model:value="form.deptCode" :disabled="Boolean(editingId)" /></FormItem>
          <FormItem label="部门名称" required><Input v-model:value="form.deptName" /></FormItem>
        </div>
        <FormItem label="上级部门"><Select v-model:value="form.parentId" :options="parentOptions" /></FormItem>
        <FormItem label="部门负责人"><Select v-model:value="form.leaderUserId" allow-clear show-search :options="userOptions" /></FormItem>
        <FormItem label="排序"><InputNumber v-model:value="form.sortOrder" :min="0" class="platform-departments__full" /></FormItem>
        <FormItem label="备注"><Input v-model:value="form.remark" /></FormItem>
        <FormItem label="启用"><Switch v-model:checked="form.status" :checked-value="1" :un-checked-value="0" /></FormItem>
        <Button :loading="saving" type="primary" @click="saveDepartment">保存</Button>
      </Form>
    </Drawer>

    <Drawer v-model:open="memberDrawerOpen" :title="`${selectedDepartment?.deptName ?? ''} - 部门成员`" size="large">
      <div class="platform-departments__member-toolbar">
        <span>用户可归属多个平台部门，但只能有一个主部门。</span>
        <Button type="primary" @click="openMemberForm"><IconifyIcon icon="lucide:user-plus" /> 添加成员</Button>
      </div>
      <Table :columns="[{ dataIndex: 'realName', key: 'realName', title: '姓名' }, { dataIndex: 'username', key: 'username', title: '账号' }, { key: 'isPrimary', title: '主部门', width: 100 }, { key: 'status', title: '状态', width: 80 }, { key: 'action', title: '操作', width: 80 }]" :data-source="members" :loading="memberLoading" :pagination="false" row-key="id">
        <template #bodyCell="{ column, record }">
          <Tag v-if="column.key === 'isPrimary'" :color="record.isPrimary ? 'blue' : 'default'">{{ record.isPrimary ? '主部门' : '兼岗' }}</Tag>
          <Tag v-else-if="column.key === 'status'" :color="record.status ? 'green' : 'default'">{{ record.status ? '启用' : '停用' }}</Tag>
          <Button v-else-if="column.key === 'action'" type="link" @click="openEditMember(record)">编辑</Button>
        </template>
      </Table>
    </Drawer>

    <Modal v-model:open="memberModalOpen" :confirm-loading="saving" :title="editingMemberId ? '编辑部门成员' : '添加部门成员'" @ok="saveMember">
      <Form layout="vertical">
        <FormItem label="用户" required><Select v-model:value="memberForm.userId" :disabled="Boolean(editingMemberId)" show-search :options="userOptions" /></FormItem>
        <FormItem label="主部门"><Switch v-model:checked="memberForm.isPrimary" /></FormItem>
        <FormItem label="启用"><Switch v-model:checked="memberForm.status" :checked-value="1" :un-checked-value="0" /></FormItem>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.platform-departments { min-height: 100%; padding: 24px; background: #f6f8fb; }
.platform-departments__header, .platform-departments__actions, .platform-departments__member-toolbar { display: flex; align-items: center; gap: 12px; }
.platform-departments__header, .platform-departments__member-toolbar { justify-content: space-between; }
.platform-departments__header { margin-bottom: 16px; }
.platform-departments__title { margin: 0; color: #172033; font-size: 20px; font-weight: 600; }
.platform-departments__summary { margin: 6px 0 0; color: #667085; font-size: 14px; }
.department-name { color: #172033; font-weight: 600; }
.department-parent { margin-left: 8px; color: #98a2b3; font-size: 12px; }
.platform-departments__form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.platform-departments__full { width: 100%; }
.platform-departments__member-toolbar { margin-bottom: 16px; color: #667085; font-size: 13px; }
@media (max-width: 640px) { .platform-departments { padding: 16px; } .platform-departments__header, .platform-departments__member-toolbar { align-items: flex-start; flex-direction: column; } .platform-departments__form-grid { grid-template-columns: 1fr; } }
</style>
