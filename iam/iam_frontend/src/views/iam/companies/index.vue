<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { Button, Drawer, Form, FormItem, Modal, Select, Switch, Table, Tag, message } from 'antdv-next';
import { useRoute } from 'vue-router';

import {
  listCompaniesApi,
  listCompanyMembersApi,
  listUsersApi,
  type IamCompany,
  type IamCompanyMember,
  type IamUser,
  upsertCompanyMemberApi,
} from '#/api';
import ApplicationContextHeader from '../application-workspace/ApplicationContextHeader.vue';

type MemberForm = {
  dataScope: 'all' | 'assigned';
  isDefault: boolean;
  isPrimary: boolean;
  memberType: IamCompanyMember['memberType'];
  status: number;
  userId: string;
};

const route = useRoute();
const appCode = computed(() => String(route.params.appCode ?? ''));
const companies = shallowRef<IamCompany[]>([]);
const users = shallowRef<IamUser[]>([]);
const members = shallowRef<IamCompanyMember[]>([]);
const selectedCompany = shallowRef<IamCompany>();
const editingMemberId = shallowRef<string>();
const loading = shallowRef(false);
const memberLoading = shallowRef(false);
const saving = shallowRef(false);
const memberDrawerOpen = shallowRef(false);
const memberModalOpen = shallowRef(false);
const memberForm = reactive<MemberForm>(blankMember());

function blankMember(): MemberForm {
  return { dataScope: 'assigned', isDefault: false, isPrimary: false, memberType: 'owner', status: 1, userId: '' };
}

const userOptions = computed(() => users.value
  .filter((item) => item.status)
  .map((item) => ({ label: `${item.realName} (${item.username})`, value: item.id })));
const columns = [
  { dataIndex: 'companyName', key: 'companyName', title: '公司名称' },
  { dataIndex: 'creditCode', key: 'creditCode', title: '统一社会信用代码', width: 210 },
  { dataIndex: 'sourceSystem', key: 'sourceSystem', title: '来源系统', width: 150 },
  { key: 'status', title: '状态', width: 90 },
  { key: 'action', title: '操作', width: 130 },
];

async function reload() {
  loading.value = true;
  try {
    const [companyResult, userResult] = await Promise.all([listCompaniesApi(), listUsersApi()]);
    companies.value = companyResult.items;
    users.value = userResult.items;
  } finally {
    loading.value = false;
  }
}

async function openMembers(company: IamCompany) {
  if (!appCode.value) return;
  selectedCompany.value = company;
  memberDrawerOpen.value = true;
  memberLoading.value = true;
  try {
    members.value = (await listCompanyMembersApi(company.id, appCode.value)).items;
  } finally {
    memberLoading.value = false;
  }
}

function openMemberForm() {
  editingMemberId.value = undefined;
  Object.assign(memberForm, blankMember());
  memberModalOpen.value = true;
}

function openEditMember(member: IamCompanyMember) {
  editingMemberId.value = member.id;
  Object.assign(memberForm, {
    dataScope: member.dataScope === 'all' ? 'all' : 'assigned',
    isDefault: Boolean(member.isDefault),
    isPrimary: Boolean(member.isPrimary),
    memberType: member.memberType,
    status: member.status,
    userId: member.userId,
  });
  memberModalOpen.value = true;
}

async function saveMember() {
  if (!selectedCompany.value || !appCode.value || !memberForm.userId) {
    message.error('请选择用户');
    return;
  }
  saving.value = true;
  try {
    await upsertCompanyMemberApi(selectedCompany.value.id, { ...memberForm, appCode: appCode.value });
    memberModalOpen.value = false;
    message.success('公司访问授权已保存');
    await openMembers(selectedCompany.value);
  } finally {
    saving.value = false;
  }
}

watch(appCode, () => {
  memberDrawerOpen.value = false;
  selectedCompany.value = undefined;
});
onMounted(() => void reload());
</script>

<template>
  <Page auto-content-height>
    <section class="company-access">
      <header class="company-access__header">
        <div>
          <h1 class="company-access__title">公司访问授权</h1>
          <p class="company-access__summary">公司资料来自业务系统；这里仅维护当前应用下的用户身份、访问范围和默认公司。</p>
        </div>
      </header>
      <ApplicationContextHeader active="companies" />
      <Table :columns="columns" :data-source="companies" :loading="loading" :pagination="false" row-key="id">
        <template #bodyCell="{ column, record }">
          <Tag v-if="column.key === 'status'" :color="record.status ? 'green' : 'default'">{{ record.status ? '可授权' : '已停用' }}</Tag>
          <Button v-else-if="column.key === 'action'" type="link" :disabled="!record.status" @click="openMembers(record)">访问授权</Button>
        </template>
      </Table>
    </section>

    <Drawer v-model:open="memberDrawerOpen" :title="`${selectedCompany?.companyName ?? ''} - 访问授权`" size="large">
      <div class="company-access__member-toolbar">
        <span>负责人、成员和项目老师均为当前应用下的授权关系，不编辑公司详情。</span>
        <Button type="primary" @click="openMemberForm"><Plus /> 新增授权</Button>
      </div>
      <Table :columns="[{ dataIndex: 'realName', key: 'realName', title: '用户' }, { dataIndex: 'username', key: 'username', title: '账号' }, { key: 'memberType', title: '身份', width: 120 }, { key: 'scope', title: '数据范围', width: 180 }, { key: 'status', title: '状态', width: 80 }, { key: 'action', title: '操作', width: 80 }]" :data-source="members" :loading="memberLoading" :pagination="false" row-key="id">
        <template #bodyCell="{ column, record }">
          <Tag v-if="column.key === 'memberType'" :color="record.memberType === 'owner' ? 'blue' : 'default'">{{ record.memberType === 'owner' ? '负责人' : record.memberType === 'project_teacher' ? '项目老师' : '成员' }}</Tag>
          <template v-else-if="column.key === 'scope'"><Tag>{{ record.dataScope ?? 'assigned' }}</Tag><Tag v-if="record.isDefault" color="green">默认公司</Tag><Tag v-if="record.isPrimary" color="blue">主负责人</Tag></template>
          <Tag v-else-if="column.key === 'status'" :color="record.status ? 'green' : 'default'">{{ record.status ? '启用' : '停用' }}</Tag>
          <Button v-else-if="column.key === 'action'" type="link" @click="openEditMember(record)">编辑</Button>
        </template>
      </Table>
    </Drawer>

    <Modal v-model:open="memberModalOpen" :confirm-loading="saving" :title="editingMemberId ? '编辑访问授权' : '新增访问授权'" @ok="saveMember">
      <Form layout="vertical">
        <FormItem label="用户" required><Select v-model:value="memberForm.userId" :disabled="Boolean(editingMemberId)" show-search :options="userOptions" /></FormItem>
        <div class="company-access__form-grid">
          <FormItem label="身份"><Select v-model:value="memberForm.memberType" :disabled="Boolean(editingMemberId)" :options="[{ label: '负责人', value: 'owner' }, { label: '成员', value: 'employee' }, { label: '项目老师', value: 'project_teacher' }]" /></FormItem>
          <FormItem label="数据范围"><Select v-model:value="memberForm.dataScope" :options="[{ label: '已分配公司', value: 'assigned' }, { label: '全部公司', value: 'all' }]" /></FormItem>
        </div>
        <FormItem label="默认公司"><Switch v-model:checked="memberForm.isDefault" /></FormItem>
        <FormItem v-if="memberForm.memberType === 'owner'" label="主负责人"><Switch v-model:checked="memberForm.isPrimary" /></FormItem>
        <FormItem label="启用"><Switch v-model:checked="memberForm.status" :checked-value="1" :un-checked-value="0" /></FormItem>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.company-access { min-height: 100%; padding: 24px; background: #f6f8fb; }
.company-access__header, .company-access__member-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.company-access__header { margin-bottom: 16px; }
.company-access__title { margin: 0; color: #172033; font-size: 20px; font-weight: 600; }
.company-access__summary { margin: 6px 0 0; color: #667085; font-size: 14px; }
.company-access__member-toolbar { margin-bottom: 16px; color: #667085; font-size: 13px; }
.company-access__form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
@media (max-width: 640px) { .company-access { padding: 16px; } .company-access__header, .company-access__member-toolbar { align-items: flex-start; flex-direction: column; } .company-access__form-grid { grid-template-columns: 1fr; } }
</style>
