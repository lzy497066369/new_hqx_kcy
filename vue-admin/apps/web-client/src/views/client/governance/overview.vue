<script setup lang="ts">
import type { CreateGovernanceAccount, GovernanceAccount, GovernanceEnterprise, GovernanceEnterpriseDetail, GovernanceFilters, GovernanceOverview } from '#/api/client/governance';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { Alert, Button, Descriptions, DescriptionsItem, Drawer, Form, FormItem, Input, InputNumber, InputPassword, Modal, Select, Table, Tabs, TabPane, Tag, Tooltip, message } from 'antdv-next';

import { createGovernanceAccountApi, createGovernanceEnterpriseApi, deleteGovernanceAccountApi, deleteGovernanceEnterpriseApi, distributeGovernanceEnterprisesApi, downloadGovernanceTemplateApi, exportGovernanceEnterprisesApi, getGovernanceEnterpriseApi, getGovernanceOverviewApi } from '#/api/client/governance';

import EnterpriseProjectsPreview from '../components/EnterpriseProjectsPreview.vue';
import ExcelImport from './excel-import.vue';
import { ENTERPRISE_PROJECTS, filterGovernanceEnterprises, saveGovernanceDownload } from './model';

defineOptions({ name: 'ClientGovernanceOverview' });

const route = useRoute();
const router = useRouter();
const section = computed({
  get: () => ['accounts', 'regions'].includes(String(route.query.section)) ? String(route.query.section) : 'enterprises',
  set: (value: string) => { void router.replace({ query: { ...route.query, section: value } }); },
});
const overview = ref<GovernanceOverview>({ scope: 'overall', regions: [], projectAccounts: [], enterprises: [] });
const loading = ref(false);
const loadError = ref('');
const busy = ref(false);
const downloading = ref(false);
const filters = reactive<GovernanceFilters>({ keyword: '', regionId: undefined, distribution: undefined });
const accountKeyword = ref('');
const enterprises = computed(() => filterGovernanceEnterprises(overview.value.enterprises, filters));
const accounts = computed(() => {
  const keyword = accountKeyword.value.trim().toLocaleLowerCase();
  return overview.value.projectAccounts.filter((account) => !keyword || `${account.name} ${account.username}`.toLocaleLowerCase().includes(keyword));
});
const pending = computed(() => overview.value.enterprises.filter((company) => !company.projectUserId));
const regionOptions = computed(() => overview.value.regions.map((region) => ({ label: region.name, value: region.id })));
const enabledRegions = computed(() => overview.value.regions.filter((region) => region.status === 1).map((region) => ({ label: region.name, value: region.id })));
const accountOptions = computed(() => overview.value.projectAccounts.filter((account) => account.status === 1).map((account) => ({ label: `${account.name}（${account.username}）`, value: account.id })));
const selectedIds = ref<string[]>([]);
const selection = computed(() => ({
  selectedRowKeys: selectedIds.value,
  preserveSelectedRowKeys: true,
  onChange: (keys: (number | string)[]) => { selectedIds.value = keys.map(String); },
  getCheckboxProps: (company: GovernanceEnterprise) => ({ disabled: !!company.projectUserId }),
}));
const enterpriseColumns = [
  { title: '企业名称', dataIndex: 'name', width: 240 },
  { title: '区域', dataIndex: 'regionName', width: 120 },
  { title: '销售负责人', dataIndex: 'salesOwner', width: 130 },
  { title: '企业项目', dataIndex: 'enterpriseProjects', width: 120 },
  { title: '预申报年份', dataIndex: 'preDeclarationYear', width: 110 },
  { title: '企业负责人', dataIndex: 'projectName', width: 170 },
  { title: '操作', key: 'actions', width: 210, fixed: 'right' as const },
];
const accountColumns = [
  { title: '负责人姓名', dataIndex: 'name' },
  { title: '登录账号', dataIndex: 'username' },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '已分发企业', dataIndex: 'enterpriseCount', width: 120 },
  { title: '操作', key: 'actions', width: 160 },
];
const regionColumns = [
  { title: '区域', dataIndex: 'name' },
  { title: '状态', dataIndex: 'status' },
  { title: '负责人账号', dataIndex: 'projectAccountCount' },
  { title: '企业数量', dataIndex: 'enterpriseCount' },
];

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    overview.value = await getGovernanceOverviewApi();
    const pendingIds = new Set(pending.value.map((company) => company.id));
    selectedIds.value = selectedIds.value.filter((id) => pendingIds.has(id));
  } catch (reason) {
    loadError.value = reason instanceof Error ? reason.message : '加载失败，请重试';
  } finally { loading.value = false; }
}
onMounted(load);

const enterpriseOpen = ref(false);
const enterpriseForm = reactive({ name: '', regionId: undefined as string | undefined, salesOwner: '', enterpriseProjects: [] as string[], preDeclarationYear: undefined as number | undefined });
const accountOpen = ref(false);
const accountForm = reactive<CreateGovernanceAccount>({ name: '', username: '', password: '', email: '', phone: '' });
const formError = ref('');
function openEnterprise() {
  Object.assign(enterpriseForm, { name: '', regionId: undefined, salesOwner: '', enterpriseProjects: [], preDeclarationYear: undefined });
  formError.value = '';
  enterpriseOpen.value = true;
}
function openAccount() {
  Object.assign(accountForm, { name: '', username: '', password: '', email: '', phone: '' });
  formError.value = '';
  accountOpen.value = true;
}
async function createEnterprise() {
  if (busy.value || !enterpriseForm.regionId || !Number.isInteger(enterpriseForm.preDeclarationYear)) return;
  busy.value = true;
  formError.value = '';
  try {
    await createGovernanceEnterpriseApi({ ...enterpriseForm, name: enterpriseForm.name.trim(), salesOwner: enterpriseForm.salesOwner.trim(), regionId: enterpriseForm.regionId, preDeclarationYear: enterpriseForm.preDeclarationYear! });
    enterpriseOpen.value = false;
    message.success('企业建档成功');
    await load();
  } catch (reason) { formError.value = reason instanceof Error ? reason.message : '建档失败，请重试'; }
  finally { busy.value = false; }
}
async function createAccount() {
  if (busy.value) return;
  busy.value = true;
  formError.value = '';
  try {
    await createGovernanceAccountApi({ ...accountForm, name: accountForm.name.trim(), username: accountForm.username.trim(), email: accountForm.email?.trim() || undefined, phone: accountForm.phone?.trim() || undefined });
    accountOpen.value = false;
    accountForm.password = '';
    message.success('账号创建成功');
    await load();
  } catch (reason) { formError.value = reason instanceof Error ? reason.message : '创建失败，请重试'; }
  finally { busy.value = false; }
}

const distributeOpen = ref(false);
const distributeForm = reactive({ accountId: undefined as string | undefined, enterpriseIds: [] as string[] });
function openDistribution(ids: string[] = [], accountId?: string) {
  distributeForm.enterpriseIds = [...ids];
  distributeForm.accountId = accountId;
  formError.value = '';
  distributeOpen.value = true;
}
async function distribute() {
  if (busy.value || !distributeForm.accountId || !distributeForm.enterpriseIds.length) return;
  busy.value = true;
  formError.value = '';
  try {
    await distributeGovernanceEnterprisesApi(distributeForm.accountId, distributeForm.enterpriseIds);
    distributeOpen.value = false;
    selectedIds.value = [];
    message.success('企业档案分发成功');
    await load();
  } catch (reason) { formError.value = reason instanceof Error ? reason.message : '分发失败，请重试'; }
  finally { busy.value = false; }
}

function deleteEnterprise(company: GovernanceEnterprise) {
  Modal.confirm({
    title: `删除企业“${company.name}”？`,
    content: '该企业将移出可访问档案，已有历史数据保留，企业名称不能重复建档。',
    okText: '删除', okType: 'danger', cancelText: '取消',
    onOk: async () => { await deleteGovernanceEnterpriseApi(company.id); message.success('企业档案已删除'); await load(); },
  });
}
function deleteAccount(account: GovernanceAccount) {
  Modal.confirm({
    title: `删除账号“${account.username}”？`,
    content: '该账号将无法继续登录，绑定企业会解除分发，历史数据保留。',
    okText: '删除', okType: 'danger', cancelText: '取消',
    onOk: async () => { await deleteGovernanceAccountApi(account.id); message.success('账号已删除'); await load(); },
  });
}

const detailOpen = ref(false);
const detailLoading = ref(false);
const detailError = ref('');
const detail = ref<GovernanceEnterpriseDetail>();
let detailRequest = 0;
async function showDetail(company: GovernanceEnterprise) {
  const request = ++detailRequest;
  detailOpen.value = true;
  detail.value = undefined;
  detailError.value = '';
  detailLoading.value = true;
  try {
    const data = await getGovernanceEnterpriseApi(company.id);
    if (request === detailRequest) detail.value = data;
  } catch (reason) {
    if (request === detailRequest) detailError.value = reason instanceof Error ? reason.message : '详情加载失败';
  } finally { if (request === detailRequest) detailLoading.value = false; }
}

const importOpen = ref(false);
async function download(template = false) {
  if (downloading.value) return;
  downloading.value = true;
  try {
    const blob = template ? await downloadGovernanceTemplateApi() : await exportGovernanceEnterprisesApi({ ...filters, keyword: filters.keyword?.trim() || undefined });
    saveGovernanceDownload(blob, template ? '企业建档模板.xlsx' : '企业档案.xlsx');
  } catch { /* Request errors are displayed by the shared request client. */ }
  finally { downloading.value = false; }
}
</script>

<template>
  <Page auto-content-height>
    <main class="governance-home">
      <header class="governance-header">
        <div><span class="text-muted-foreground">总负责人</span><h1>主页首页</h1></div>
        <Tooltip title="刷新"><Button aria-label="刷新" :loading="loading" @click="load"><IconifyIcon icon="lucide:refresh-cw" class="size-4" /></Button></Tooltip>
      </header>
      <Alert v-if="loadError" type="error" show-icon :message="loadError"><template #action><Button size="small" @click="load">重试</Button></template></Alert>
      <section class="governance-stats" aria-label="管理概览">
        <div><span>企业档案</span><strong>{{ overview.enterprises.length }}</strong></div>
        <div><span>负责人账号</span><strong>{{ overview.projectAccounts.length }}</strong></div>
        <div><span>待分发企业</span><strong class="text-amber-600">{{ pending.length }}</strong></div>
        <div><span>区域</span><strong>{{ overview.regions.length }}</strong></div>
      </section>
      <Tabs v-model:active-key="section">
        <TabPane key="enterprises" tab="企业档案">
          <div class="governance-toolbar">
            <div class="governance-filters">
              <Input v-model:value="filters.keyword" allow-clear aria-label="搜索企业" placeholder="企业 / 销售负责人 / 企业负责人" :maxlength="256" />
              <Select v-model:value="filters.regionId" allow-clear aria-label="区域筛选" placeholder="全部区域" :options="regionOptions" />
              <Select v-model:value="filters.distribution" allow-clear aria-label="分发状态筛选" placeholder="全部分发状态" :options="[{ label: '待分发', value: 'pending' }, { label: '已分发', value: 'assigned' }]" />
            </div>
            <div class="governance-actions">
              <Button type="primary" :disabled="loading || !!loadError" @click="openEnterprise"><IconifyIcon icon="lucide:plus" class="size-4" />企业建档</Button>
              <Button :disabled="loading || !!loadError" @click="importOpen = true"><IconifyIcon icon="lucide:upload" class="size-4" />导入</Button>
              <Tooltip title="下载模板"><Button aria-label="下载模板" :loading="downloading" @click="download(true)"><IconifyIcon icon="lucide:file-down" class="size-4" /></Button></Tooltip>
              <Tooltip title="导出企业档案"><Button aria-label="导出企业档案" :loading="downloading" @click="download()"><IconifyIcon icon="lucide:download" class="size-4" /></Button></Tooltip>
            </div>
          </div>
          <div v-if="selectedIds.length" class="governance-selection">
            <span>已选择 {{ selectedIds.length }} 家待分发企业</span>
            <Button size="small" :disabled="selectedIds.length > 100 || !accountOptions.length || !!loadError" @click="openDistribution(selectedIds)">批量分发</Button>
            <Button type="text" size="small" @click="selectedIds = []">清空</Button>
            <span v-if="selectedIds.length > 100" class="text-destructive">一次最多分发 100 家</span>
          </div>
          <Table :columns="enterpriseColumns" :data-source="enterprises" row-key="id" :row-selection="selection" :loading="loading" :scroll="{ x: 1240 }" :pagination="{ pageSize: 10, showSizeChanger: true }" size="middle">
            <template #bodyCell="{ column, record }">
              <Button v-if="column.dataIndex === 'name'" type="link" class="enterprise-name" @click="showDetail(record)">{{ record.name }}</Button>
              <EnterpriseProjectsPreview v-else-if="column.dataIndex === 'enterpriseProjects'" :projects="record.enterpriseProjects" />
              <template v-else-if="column.dataIndex === 'projectName'"><span v-if="record.projectUserId">{{ record.projectName || record.projectUsername }}</span><Tag v-else color="orange">待分发</Tag></template>
              <span v-else-if="column.dataIndex === 'preDeclarationYear'">{{ record.preDeclarationYear || '-' }}</span>
              <div v-else-if="column.key === 'actions'" class="row-actions">
                <Button type="link" size="small" @click="showDetail(record)">详情</Button>
                <Button v-if="!record.projectUserId" type="link" size="small" :disabled="!accountOptions.length || !!loadError" @click="openDistribution([record.id])">分发</Button>
                <Tooltip title="删除企业档案"><Button type="text" danger size="small" :disabled="!!loadError" :aria-label="`删除企业 ${record.name}`" @click="deleteEnterprise(record)"><IconifyIcon icon="lucide:trash-2" class="size-4" /></Button></Tooltip>
              </div>
            </template>
          </Table>
        </TabPane>
        <TabPane key="accounts" tab="账号管理">
          <div class="governance-toolbar">
            <Input v-model:value="accountKeyword" class="account-search" allow-clear aria-label="搜索账号" placeholder="负责人姓名 / 登录账号" />
            <Button type="primary" :disabled="loading || !!loadError" @click="openAccount"><IconifyIcon icon="lucide:user-plus" class="size-4" />创建账号</Button>
          </div>
          <Table :columns="accountColumns" :data-source="accounts" row-key="id" :loading="loading" :scroll="{ x: 700 }" :pagination="{ pageSize: 10, showSizeChanger: true }">
            <template #bodyCell="{ column, record }">
              <Tag v-if="column.dataIndex === 'status'" :color="record.status === 1 ? 'green' : 'default'">{{ record.status === 1 ? '启用' : '停用' }}</Tag>
              <div v-else-if="column.key === 'actions'" class="row-actions">
                <Button type="link" size="small" :disabled="record.status !== 1 || !pending.length || !!loadError" @click="openDistribution([], record.id)">分发企业</Button>
                <Tooltip title="删除账号"><Button type="text" danger size="small" :disabled="!!loadError" :aria-label="`删除账号 ${record.username}`" @click="deleteAccount(record)"><IconifyIcon icon="lucide:trash-2" class="size-4" /></Button></Tooltip>
              </div>
            </template>
          </Table>
        </TabPane>
        <TabPane key="regions" tab="区域概览">
          <Table :columns="regionColumns" :data-source="overview.regions" row-key="id" :loading="loading" :scroll="{ x: 600 }">
            <template #bodyCell="{ column, record }"><Tag v-if="column.dataIndex === 'status'" :color="record.status === 1 ? 'green' : 'default'">{{ record.status === 1 ? '启用' : '停用' }}</Tag></template>
          </Table>
        </TabPane>
      </Tabs>
    </main>

    <Modal v-model:open="enterpriseOpen" title="企业建档" :footer="null" :closable="!busy" :mask-closable="!busy" :keyboard="!busy" destroy-on-close>
      <Form :model="enterpriseForm" layout="vertical" :disabled="busy" @finish="createEnterprise">
        <Alert v-if="formError" type="error" show-icon :message="formError" class="mb-4" />
        <FormItem name="name" label="企业名称" :rules="[{ required: true, whitespace: true, min: 2, max: 128, message: '请输入 2-128 字的企业名称' }]"><Input v-model:value="enterpriseForm.name" :maxlength="128" /></FormItem>
        <FormItem name="regionId" label="区域" :rules="[{ required: true, message: '请选择区域' }]"><Select v-model:value="enterpriseForm.regionId" :options="enabledRegions" /></FormItem>
        <FormItem name="salesOwner" label="销售负责人" :rules="[{ required: true, whitespace: true, max: 64, message: '请输入销售负责人' }]"><Input v-model:value="enterpriseForm.salesOwner" :maxlength="64" /></FormItem>
        <FormItem name="enterpriseProjects" label="企业项目" :rules="[{ type: 'array', required: true, min: 1, max: 4, message: '请选择至少一个企业项目' }]"><Select v-model:value="enterpriseForm.enterpriseProjects" mode="multiple" :options="ENTERPRISE_PROJECTS.map((project) => ({ label: project, value: project }))" /></FormItem>
        <FormItem name="preDeclarationYear" label="预申报年份" :rules="[{ required: true, type: 'integer', min: 2000, max: 2100, message: '请输入 2000-2100 的整数年份' }]"><InputNumber v-model:value="enterpriseForm.preDeclarationYear" :min="2000" :max="2100" :precision="0" class="w-full" /></FormItem>
        <div class="form-actions"><Button :disabled="busy" @click="enterpriseOpen = false">取消</Button><Button html-type="submit" type="primary" :loading="busy">创建档案</Button></div>
      </Form>
    </Modal>

    <Modal v-model:open="accountOpen" title="创建企业负责人账号" :footer="null" :closable="!busy" :mask-closable="!busy" :keyboard="!busy" destroy-on-close @after-close="accountForm.password = ''">
      <Form :model="accountForm" layout="vertical" :disabled="busy" @finish="createAccount">
        <Alert v-if="formError" type="error" show-icon :message="formError" class="mb-4" />
        <FormItem name="name" label="负责人姓名" :rules="[{ required: true, whitespace: true, min: 2, max: 64, message: '请输入 2-64 字的负责人姓名' }]"><Input v-model:value="accountForm.name" :maxlength="64" /></FormItem>
        <FormItem name="username" label="登录账号" :rules="[{ required: true, whitespace: true, min: 3, max: 64, message: '请输入 3-64 字的登录账号' }]"><Input v-model:value="accountForm.username" autocomplete="off" :maxlength="64" /></FormItem>
        <FormItem name="password" label="初始密码" :rules="[{ required: true, min: 8, max: 128, pattern: /^\S(?:[\s\S]*\S)?$/, message: '请输入 8-128 位密码，首尾不能有空格' }]"><InputPassword v-model:value="accountForm.password" autocomplete="new-password" :maxlength="128" /></FormItem>
        <FormItem name="email" label="邮箱" :rules="[{ type: 'email', message: '请输入有效邮箱' }]"><Input v-model:value="accountForm.email" :maxlength="128" /></FormItem>
        <FormItem name="phone" label="联系电话"><Input v-model:value="accountForm.phone" :maxlength="32" /></FormItem>
        <div class="form-actions"><Button :disabled="busy" @click="accountOpen = false">取消</Button><Button html-type="submit" type="primary" :loading="busy">创建账号</Button></div>
      </Form>
    </Modal>

    <Modal v-model:open="distributeOpen" title="分发企业档案" :footer="null" :closable="!busy" :mask-closable="!busy" :keyboard="!busy" destroy-on-close>
      <Form :model="distributeForm" layout="vertical" :disabled="busy" @finish="distribute">
        <Alert v-if="formError" type="error" show-icon :message="formError" class="mb-4" />
        <FormItem name="accountId" label="企业负责人" :rules="[{ required: true, message: '请选择企业负责人' }]"><Select v-model:value="distributeForm.accountId" show-search option-filter-prop="label" :options="accountOptions" /></FormItem>
        <FormItem name="enterpriseIds" label="待分发企业" :rules="[{ type: 'array', required: true, min: 1, max: 100, message: '请选择 1-100 家待分发企业' }]"><Select v-model:value="distributeForm.enterpriseIds" mode="multiple" option-filter-prop="label" :options="pending.map((company) => ({ label: company.name, value: company.id }))" /></FormItem>
        <div class="form-actions"><Button :disabled="busy" @click="distributeOpen = false">取消</Button><Button html-type="submit" type="primary" :loading="busy">确认分发</Button></div>
      </Form>
    </Modal>

    <Drawer v-model:open="detailOpen" title="企业档案详情" width="min(640px, 100vw)" :loading="detailLoading">
      <Alert v-if="detailError" type="error" show-icon :message="detailError" />
      <template v-if="detail">
        <h2 class="mb-4 break-words text-xl font-semibold">{{ detail.name }}</h2>
        <Descriptions :column="1" bordered size="small">
          <DescriptionsItem label="区域">{{ detail.regionName || '-' }}</DescriptionsItem>
          <DescriptionsItem label="销售负责人">{{ detail.salesOwner || '-' }}</DescriptionsItem>
          <DescriptionsItem label="企业项目"><EnterpriseProjectsPreview :projects="detail.enterpriseProjects" expanded /></DescriptionsItem>
          <DescriptionsItem label="预申报年份">{{ detail.preDeclarationYear || '-' }}</DescriptionsItem>
          <DescriptionsItem label="企业负责人">{{ detail.projectName || detail.projectUsername || '待分发' }}</DescriptionsItem>
          <DescriptionsItem label="统一社会信用代码">{{ detail.creditCode || '-' }}</DescriptionsItem>
          <DescriptionsItem label="企业简称">{{ detail.shortName || '-' }}</DescriptionsItem>
          <DescriptionsItem label="法定代表人">{{ detail.legalPerson || '-' }}</DescriptionsItem>
          <DescriptionsItem label="联系人">{{ detail.contactName || '-' }}</DescriptionsItem>
          <DescriptionsItem label="联系电话">{{ detail.contactPhone || '-' }}</DescriptionsItem>
          <DescriptionsItem label="联系邮箱">{{ detail.contactEmail || '-' }}</DescriptionsItem>
          <DescriptionsItem label="行业">{{ detail.industry || '-' }}</DescriptionsItem>
          <DescriptionsItem label="企业类型">{{ detail.enterpriseType || '-' }}</DescriptionsItem>
          <DescriptionsItem label="地址">{{ [detail.province, detail.city, detail.district, detail.address].filter(Boolean).join(' ') || '-' }}</DescriptionsItem>
          <DescriptionsItem label="备注">{{ detail.remark || '-' }}</DescriptionsItem>
        </Descriptions>
      </template>
    </Drawer>
    <ExcelImport v-model:open="importOpen" @imported="load" />
  </Page>
</template>

<style scoped>
.governance-home { display: grid; gap: 20px; max-width: 1600px; margin: 0 auto; padding: 24px 28px 32px; min-width: 0; }
.governance-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.governance-header h1 { margin: 4px 0 0; font-size: 26px; line-height: 1.3; font-weight: 600; }
.governance-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; padding: 20px 0; border-top: 1px solid hsl(var(--border)); border-bottom: 1px solid hsl(var(--border)); }
.governance-stats > div { display: grid; gap: 6px; }
.governance-stats span { color: hsl(var(--muted-foreground)); }
.governance-stats strong { font-size: 26px; line-height: 1.2; font-weight: 600; }
.governance-toolbar { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin: 4px 0 20px; }
.governance-filters { display: grid; grid-template-columns: minmax(220px, 300px) 140px 150px; gap: 10px; max-width: 100%; }
.governance-actions, .row-actions, .form-actions, .governance-selection { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.governance-selection { padding: 10px 0; margin-bottom: 10px; }
.form-actions { justify-content: flex-end; }
.account-search { max-width: 300px; }
.enterprise-name { white-space: normal; height: auto; padding: 0; text-align: left; overflow-wrap: anywhere; }
.governance-home :deep(.ant-tabs), .governance-home :deep(.ant-tabs-content-holder) { min-width: 0; }
@media (max-width: 760px) {
  .governance-home { padding: 20px 12px 28px; gap: 16px; }
  .governance-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .governance-filters { width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .governance-filters > :first-child { grid-column: 1 / -1; }
  .governance-actions { width: 100%; }
}
</style>
