<script setup lang="ts">
import type { EnterpriseWorkspaceEmployee } from '#/api';
import type { TableColumnsType } from 'antdv-next';

import { reactive } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { Button, Empty, Input, Pagination, Select, Table, Tag } from 'antdv-next';

import { maskEmployeeIdCard } from '../employee-identity';

interface Props {
  deletingEmployeeId?: string;
  employees: EnterpriseWorkspaceEmployee[];
  page: number;
  pageSize: number;
  saving: boolean;
  total: number;
}

defineProps<Props>();
const emit = defineEmits<{
  create: [];
  detail: [employee: EnterpriseWorkspaceEmployee];
  downloadExport: [];
  downloadTemplate: [];
  edit: [employee: EnterpriseWorkspaceEmployee];
  filter: [filters: typeof filterForm];
  import: [];
  pageChange: [page: number, pageSize: number];
  preview: [employee: EnterpriseWorkspaceEmployee, path: string];
  remove: [employee: EnterpriseWorkspaceEmployee];
}>();
const filterForm = reactive({
  activeStatus: 'all' as 'active' | 'all' | 'inactive',
  employeeType: 0,
  keyword: '',
  researchStatus: 'all' as 'all' | 'no' | 'yes',
});
const columns: TableColumnsType<EnterpriseWorkspaceEmployee> = [
  { dataIndex: 'ygName', key: 'ygName', title: '姓名', width: 110 },
  { dataIndex: 'idCard', key: 'idCard', title: '身份证号', width: 180 },
  { dataIndex: 'department', key: 'department', title: '部门 / 岗位', width: 170 },
  { dataIndex: 'ygSex', key: 'ygSex', title: '性别 / 年龄段', width: 150 },
  { dataIndex: 'entryDate', key: 'entryDate', title: '入职日期', width: 112 },
  { dataIndex: 'ygLx', key: 'ygLx', title: '员工类型', width: 120 },
  { dataIndex: 'isActive', key: 'isActive', title: '状态', width: 82 },
  { dataIndex: 'isKjyf', key: 'isKjyf', title: '科技人员', width: 100 },
  { dataIndex: 'attachment', key: 'attachment', title: '证明材料', width: 260 },
  { fixed: 'right', key: 'actions', title: '操作', width: 180 },
];
const employeeTypes: Record<number, string> = { 1: '在职人员', 2: '兼职人员', 3: '临时兼职', 4: '临时聘用' };
const ageRanges: Record<number, string> = { 1: '30岁以下', 2: '31-40岁', 3: '41-50岁', 4: '50岁及以上' };
const activeOptions = [{ label: '全部状态', value: 'all' }, { label: '在职', value: 'active' }, { label: '离职', value: 'inactive' }];
const researchOptions = [{ label: '全部人员', value: 'all' }, { label: '科技人员', value: 'yes' }, { label: '非科技人员', value: 'no' }];
const employeeTypeOptions = [{ label: '全部类型', value: 0 }, ...Object.entries(employeeTypes).map(([value, label]) => ({ label, value: Number(value) }))];

function attachments(employee: EnterpriseWorkspaceEmployee) {
  return [
    ['综合', employee.ygFiles], ['合同', employee.laborContractFile], ['社保', employee.socialSecurityFile], ['学历', employee.educationFile], ['职称', employee.titleFile],
  ].filter((item): item is [string, string] => Boolean(item[1]));
}

function applyFilters() {
  emit('filter', { ...filterForm });
}

function resetFilters() {
  Object.assign(filterForm, {
    activeStatus: 'all',
    employeeType: 0,
    keyword: '',
    researchStatus: 'all',
  });
  applyFilters();
}

function handlePageChange(page: number, pageSize: number) {
  emit('pageChange', page, pageSize);
}
</script>

<template>
  <div class="enterprise-employee-list__toolbar"><div class="enterprise-employee-list__filters"><Input v-model:value="filterForm.keyword" allow-clear placeholder="姓名、身份证号、部门或岗位" @press-enter="applyFilters" /><Select v-model:value="filterForm.activeStatus" :options="activeOptions" /><Select v-model:value="filterForm.researchStatus" :options="researchOptions" /><Select v-model:value="filterForm.employeeType" :options="employeeTypeOptions" /><Button title="查询" type="primary" @click="applyFilters"><IconifyIcon class="size-4" icon="lucide:search" /></Button><Button title="重置" @click="resetFilters"><IconifyIcon class="size-4" icon="lucide:rotate-ccw" /></Button></div><div class="enterprise-employee-list__actions"><Button @click="emit('import')"><IconifyIcon class="size-4" icon="lucide:sparkles" />AI 解析员工名册/社保</Button><Button @click="emit('downloadTemplate')">下载模板</Button><Button @click="emit('downloadExport')">导出名册</Button><Button type="primary" @click="emit('create')"><IconifyIcon class="size-4" icon="lucide:plus" />新增员工</Button></div></div>
  <Table v-if="employees.length" :columns="columns" :data-source="employees" :loading="saving" :pagination="false" :row-key="(record) => record.id" :scroll="{ x: 1380 }" size="small"><template #bodyCell="{ column, record }"><template v-if="column.key === 'idCard'">{{ maskEmployeeIdCard(record.idCard) }}</template><template v-else-if="column.key === 'department'">{{ record.department || '-' }} / {{ record.position || '-' }}</template><template v-else-if="column.key === 'ygSex'">{{ record.ygSex === 1 ? '男' : record.ygSex === 2 ? '女' : '-' }} / {{ record.ygNl ? ageRanges[record.ygNl] : '-' }}</template><template v-else-if="column.key === 'entryDate'">{{ record.entryDate || '-' }}</template><template v-else-if="column.key === 'ygLx'">{{ record.ygLx ? employeeTypes[record.ygLx] : '-' }}</template><template v-else-if="column.key === 'isActive'"><Tag :color="record.isActive ? 'green' : 'default'">{{ record.isActive ? '在职' : '离职' }}</Tag></template><template v-else-if="column.key === 'isKjyf'">{{ record.isKjyf ? '是' : '否' }}</template><template v-else-if="column.key === 'attachment'"><div class="enterprise-employee-list__attachments"><Button v-for="[label, path] in attachments(record)" :key="path" size="small" type="link" @click="emit('preview', record, path)">{{ label }}</Button><span v-if="attachments(record).length === 0">-</span></div></template><template v-else-if="column.key === 'actions'"><Button size="small" type="link" @click="emit('detail', record)">详情</Button><Button size="small" type="link" @click="emit('edit', record)">编辑</Button><Button danger :loading="deletingEmployeeId === record.id" size="small" type="link" @click="emit('remove', record)">删除</Button></template></template></Table>
  <Empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" description="暂无符合条件的员工记录"><Button type="primary" @click="emit('create')">新增员工</Button></Empty>
  <div v-if="total > 0" class="enterprise-employee-list__pagination"><Pagination :current="page" :page-size="pageSize" :show-total="(value: number) => `共 ${value} 条`" :total="total" show-size-changer @change="handlePageChange" /></div>
</template>

<style scoped>
.enterprise-employee-list__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }.enterprise-employee-list__actions, .enterprise-employee-list__attachments, .enterprise-employee-list__filters { display: flex; flex-wrap: wrap; gap: 8px; }.enterprise-employee-list__filters :deep(.ant-input-affix-wrapper) { width: 240px; }.enterprise-employee-list__filters :deep(.ant-select) { width: 120px; }.enterprise-employee-list__pagination { display: flex; justify-content: flex-end; padding-top: 16px; }@media (max-width: 720px) { .enterprise-employee-list__toolbar { align-items: stretch; flex-direction: column; }.enterprise-employee-list__filters > * { flex: 1 1 140px; }.enterprise-employee-list__filters :deep(.ant-input-affix-wrapper), .enterprise-employee-list__filters :deep(.ant-select) { width: auto; } }
</style>
