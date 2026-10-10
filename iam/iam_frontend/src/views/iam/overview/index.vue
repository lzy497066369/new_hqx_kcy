<script setup lang="ts">
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Card, Tag } from 'antdv-next';

const domains = [
  { description: 'OAuth2 授权码 + PKCE、RS256 JWT/JWKS、刷新令牌轮换与统一注销。', icon: 'lucide:log-in', title: '统一认证' },
  { description: '按应用维护用户、角色、权限码、菜单和 OAuth Client，并支持停用而非删除。', icon: 'lucide:shield-check', title: '应用授权' },
  { description: '维护公司摘要、负责人、成员、默认公司和应用级数据范围，变更可立即收回。', icon: 'lucide:building-2', title: '公司范围' },
  { description: '记录认证、SSO、令牌轮换与管理写操作，支持筛选、分页和敏感字段脱敏。', icon: 'lucide:scroll-text', title: '安全审计' },
];
</script>

<template>
  <Page auto-content-height>
    <main class="iam-overview">
      <section class="iam-overview__header">
        <div>
          <div class="iam-overview__eyebrow">IAM / SSO</div>
          <h1 class="iam-overview__title">统一身份与访问管理中心</h1>
          <p class="iam-overview__summary">为多个业务系统提供统一登录、用户、权限、菜单和公司数据范围。</p>
        </div>
        <Tag color="success">本地服务已就绪</Tag>
      </section>

      <section class="iam-overview__domains" aria-label="IAM 核心能力">
        <Card v-for="domain in domains" :key="domain.title" class="iam-overview__domain">
          <IconifyIcon :icon="domain.icon" class="iam-overview__domain-icon" />
          <div>
            <h2 class="iam-overview__domain-title">{{ domain.title }}</h2>
            <p class="iam-overview__domain-description">{{ domain.description }}</p>
          </div>
        </Card>
      </section>
    </main>
  </Page>
</template>

<style scoped>
.iam-overview { min-height: 100%; padding: 24px; background: #f6f8fb; }
.iam-overview__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding: 28px; background: #fff; border: 1px solid #d9e1e8; border-radius: 8px; }
.iam-overview__eyebrow { color: #0f766e; font-size: 14px; font-weight: 600; }
.iam-overview__title { margin: 8px 0 0; color: #172033; font-size: 26px; font-weight: 650; line-height: 1.3; }
.iam-overview__summary { margin: 10px 0 0; color: #5e6b7a; font-size: 14px; }
.iam-overview__domains { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-top: 20px; }
.iam-overview__domain :deep(.ant-card-body) { display: flex; align-items: flex-start; gap: 14px; min-height: 116px; }
.iam-overview__domain-icon { flex: 0 0 auto; width: 24px; height: 24px; color: #0f766e; }
.iam-overview__domain-title { margin: 0; color: #172033; font-size: 16px; font-weight: 600; }
.iam-overview__domain-description { margin: 8px 0 0; color: #667085; font-size: 13px; line-height: 1.6; }
@media (max-width: 960px) { .iam-overview__domains { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .iam-overview { padding: 16px; }.iam-overview__header { flex-direction: column; }.iam-overview__domains { grid-template-columns: 1fr; } }
</style>
