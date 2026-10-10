<script setup lang="ts">
import type { EnterpriseWorkspaceEmployee } from '#/api';

import { Button, Descriptions, DescriptionsItem, Drawer, Tag } from 'antdv-next';

interface Props {
  employee?: EnterpriseWorkspaceEmployee;
}

defineProps<Props>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{
  edit: [employee: EnterpriseWorkspaceEmployee];
  preview: [employee: EnterpriseWorkspaceEmployee, path: string];
}>();

const employeeTypes: Record<number, string> = {
  1: '在职人员',
  2: '兼职人员',
  3: '临时兼职人员',
  4: '临时聘用人员',
};
const ageRanges: Record<number, string> = {
  1: '30岁以下',
  2: '31-40岁',
  3: '41-50岁',
  4: '50岁及以上',
};
const educationLabels: Record<number, string> = {
  1: '博士',
  2: '硕士',
  3: '本科',
  4: '大专及以下',
};
const titleLabels: Record<number, string> = {
  1: '高级职称',
  2: '中级职称',
  3: '初级职称',
  4: '高级技工',
  5: '暂无',
};

function attachments(employee: EnterpriseWorkspaceEmployee) {
  return [
    ['综合附件', employee.ygFiles],
    ['劳动合同', employee.laborContractFile],
    ['社保材料', employee.socialSecurityFile],
    ['学历证明', employee.educationFile],
    ['职称证明', employee.titleFile],
  ].filter((item): item is [string, string] => Boolean(item[1]));
}
</script>

<template>
  <Drawer v-model:open="open" title="员工详情" width="620px">
    <template v-if="employee">
      <Descriptions :column="2" bordered size="small">
        <DescriptionsItem label="姓名">{{ employee.ygName || '-' }}</DescriptionsItem>
        <DescriptionsItem label="状态"><Tag :color="employee.isActive ? 'green' : 'default'">{{ employee.isActive ? '在职' : '离职' }}</Tag></DescriptionsItem>
        <DescriptionsItem label="身份证号" :span="2">{{ employee.idCard || '-' }}</DescriptionsItem>
        <DescriptionsItem label="性别">{{ employee.ygSex === 1 ? '男' : employee.ygSex === 2 ? '女' : '-' }}</DescriptionsItem>
        <DescriptionsItem label="年龄段">{{ employee.ygNl ? ageRanges[employee.ygNl] : '-' }}</DescriptionsItem>
        <DescriptionsItem label="部门">{{ employee.department || '-' }}</DescriptionsItem>
        <DescriptionsItem label="岗位">{{ employee.position || '-' }}</DescriptionsItem>
        <DescriptionsItem label="员工类型">{{ employee.ygLx ? employeeTypes[employee.ygLx] : '-' }}</DescriptionsItem>
        <DescriptionsItem label="入职日期">{{ employee.entryDate || '-' }}</DescriptionsItem>
        <DescriptionsItem label="学历">{{ employee.ygXl ? educationLabels[employee.ygXl] : '-' }}</DescriptionsItem>
        <DescriptionsItem label="职称">{{ employee.ygZc ? titleLabels[employee.ygZc] : '-' }}</DescriptionsItem>
        <DescriptionsItem label="全年工作天数">{{ employee.annualWorkDays ?? '-' }}</DescriptionsItem>
        <DescriptionsItem label="科技人员">{{ employee.isKjyf ? '是' : '否' }}</DescriptionsItem>
        <DescriptionsItem label="外籍人员">{{ employee.ygWj ? '是' : '否' }}</DescriptionsItem>
        <DescriptionsItem label="留学归国人员">{{ employee.ygLxgg ? '是' : '否' }}</DescriptionsItem>
        <DescriptionsItem label="千人计划人员">{{ employee.ygQr ? '是' : '否' }}</DescriptionsItem>
        <DescriptionsItem label="参与 RD 项目" :span="2">{{ employee.rdProjects || '-' }}</DescriptionsItem>
        <DescriptionsItem label="备注" :span="2">{{ employee.remark || '-' }}</DescriptionsItem>
        <DescriptionsItem label="证明材料" :span="2"><div class="enterprise-employee-detail__attachments"><Button v-for="[label, path] in attachments(employee)" :key="path" size="small" type="link" @click="emit('preview', employee, path)">{{ label }}</Button><span v-if="attachments(employee).length === 0">-</span></div></DescriptionsItem>
      </Descriptions>
      <div class="enterprise-employee-detail__footer"><Button type="primary" @click="emit('edit', employee)">编辑员工</Button></div>
    </template>
  </Drawer>
</template>

<style scoped>
.enterprise-employee-detail__attachments { display: flex; flex-wrap: wrap; gap: 8px; }
.enterprise-employee-detail__footer { display: flex; justify-content: flex-end; padding-top: 16px; }
</style>
