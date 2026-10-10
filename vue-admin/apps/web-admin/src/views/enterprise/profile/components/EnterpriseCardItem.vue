<script setup lang="ts">
import type { EnterpriseProfileItem } from '#/api';

import { Button, Card, Tag } from 'antdv-next';

const props = defineProps<{ item: EnterpriseProfileItem }>();
const emit = defineEmits<{
  accounts: [EnterpriseProfileItem];
  detail: [EnterpriseProfileItem];
  declarations: [EnterpriseProfileItem];
  edit: [EnterpriseProfileItem];
}>();

const profileStatusLabels: Record<string, string> = {
  approved: '已通过',
  draft: '草稿',
  need_resubmit: '待重提',
  pending_review: '待审核',
  rejected: '已驳回',
};
</script>

<template>
  <Card class="enterprise-card" size="small">
    <template #title
      ><span class="enterprise-card__name">{{
        props.item.name
      }}</span></template
    >
    <template #extra
      ><Tag :color="props.item.status === 1 ? 'success' : 'error'">{{
        props.item.status === 1 ? '启用' : '停用'
      }}</Tag></template
    >
    <div class="enterprise-card__content">
      <div class="enterprise-card__meta">
        <span>信用代码</span><strong>{{ props.item.creditCode }}</strong>
      </div>
      <div class="enterprise-card__meta">
        <span>行业</span><strong>{{ props.item.industry || '-' }}</strong>
      </div>
      <div class="enterprise-card__meta">
        <span>地区</span
        ><strong>{{
          [props.item.province, props.item.city, props.item.district]
            .filter(Boolean)
            .join(' / ') || '-'
        }}</strong>
      </div>
      <div class="enterprise-card__meta">
        <span>资料状态</span
        ><Tag color="blue">{{
          profileStatusLabels[props.item.profileStatus] ??
          props.item.profileStatus
        }}</Tag>
      </div>
      <div class="enterprise-card__meta enterprise-card__declarations">
        <span>关联申报项目</span>
        <div v-if="props.item.declarationProjects.length" class="enterprise-card__project-list">
          <Tag v-for="project in props.item.declarationProjects" :key="project" color="purple">
            {{ project }}
          </Tag>
        </div>
        <strong v-else>-</strong>
      </div>
    </div>
    <div class="enterprise-card__actions">
      <Button size="small" @click="emit('declarations', props.item)">申报管理</Button>
      <Button size="small" @click="emit('detail', props.item)">详情</Button>
      <Button size="small" @click="emit('edit', props.item)">编辑</Button>
      <Button size="small" @click="emit('accounts', props.item)"
        >企业用户</Button
      >
    </div>
  </Card>
</template>

<style scoped>
.enterprise-card {
  height: 100%;
}

.enterprise-card__name {
  display: inline-block;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.enterprise-card__content {
  display: grid;
  gap: 10px;
}

.enterprise-card__meta {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
  font-size: 13px;
}

.enterprise-card__meta > span {
  color: #6b7280;
}

.enterprise-card__meta strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enterprise-card__declarations > span {
  padding-top: 2px;
}

.enterprise-card__project-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.enterprise-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}
</style>
