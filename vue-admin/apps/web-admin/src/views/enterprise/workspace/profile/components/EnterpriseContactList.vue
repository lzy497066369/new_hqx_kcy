<script setup lang="ts">
import type { EnterpriseWorkspaceContact } from '#/api';

import { Button, Empty, Table, Tag } from 'antdv-next';

interface Props {
  contacts: EnterpriseWorkspaceContact[];
  saving: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  create: [];
  edit: [contact: EnterpriseWorkspaceContact];
  remove: [contact: EnterpriseWorkspaceContact];
}>();

const columns = [
  { dataIndex: 'name', key: 'name', title: '姓名', width: 120 },
  { dataIndex: 'roleName', key: 'roleName', title: '角色', width: 120 },
  { dataIndex: 'position', key: 'position', title: '职位', width: 120 },
  { dataIndex: 'phone', key: 'phone', title: '联系电话', width: 150 },
  { dataIndex: 'email', key: 'email', title: '邮箱' },
  { key: 'actions', title: '操作', width: 152 },
];
</script>

<template>
  <div class="enterprise-contact-list__toolbar">
    <p>维护企业申报、材料和审核协同联系人。</p>
    <Button type="primary" @click="emit('create')">新增联系人</Button>
  </div>
  <Table
    v-if="contacts.length"
    :columns="columns"
    :data-source="contacts"
    :loading="saving"
    :pagination="false"
    :row-key="(record) => record.id"
    :scroll="{ x: 814 }"
    size="small"
  >
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'name'">
        <div class="enterprise-contact-list__name">
          <span>{{ record.name }}</span>
          <Tag v-if="record.isDefault" color="blue">默认</Tag>
        </div>
      </template>
      <template v-else-if="column.key === 'roleName'">{{ record.roleName || '-' }}</template>
      <template v-else-if="column.key === 'position'">{{ record.position || '-' }}</template>
      <template v-else-if="column.key === 'phone'">{{ record.phone || '-' }}</template>
      <template v-else-if="column.key === 'email'">{{ record.email || '-' }}</template>
      <template v-else-if="column.key === 'actions'">
        <Button size="small" type="link" @click="emit('edit', record)">编辑</Button>
        <Button danger size="small" type="link" @click="emit('remove', record)">删除</Button>
      </template>
    </template>
  </Table>
  <Empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" description="暂无联系人">
    <Button type="primary" @click="emit('create')">新增联系人</Button>
  </Empty>
</template>

<style scoped>
.enterprise-contact-list__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; }
.enterprise-contact-list__toolbar p { margin: 0; color: #64748b; font-size: 13px; }
.enterprise-contact-list__name { display: flex; align-items: center; gap: 6px; }
@media (max-width: 640px) { .enterprise-contact-list__toolbar { align-items: stretch; flex-direction: column; } }
</style>
