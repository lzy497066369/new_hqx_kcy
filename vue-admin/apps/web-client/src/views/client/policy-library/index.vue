<script setup lang="ts">
import ClientJourneyTrail from '#/views/client/components/ClientJourneyTrail.vue';

import { computed, onMounted, shallowRef } from 'vue';

import {
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Empty,
  Input,
  Space,
  Tag,
  TypographyParagraph,
} from 'antdv-next';

import {
  getClientPolicyFileDetailApi,
  getClientPolicyFilesApi,
} from '#/api/client';
import type { ClientPolicyApi } from '#/api/client';
import { useClientEnterpriseStore } from '#/store';

const store = useClientEnterpriseStore();

const keyword = shallowRef('');
const loading = shallowRef(false);
const detailLoading = shallowRef(false);
const policies = shallowRef<ClientPolicyApi.PolicyFile[]>([]);
const selectedPolicy = shallowRef<ClientPolicyApi.PolicyFile | null>(null);

const regionHint = computed(() => {
  const profile = store.enterpriseProfile;
  const parts = [profile?.province, profile?.city, profile?.district].filter(
    Boolean,
  );

  return parts.length > 0 ? parts.join(' / ') : '企业地区待完善';
});

const filteredPolicies = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  if (!value) {
    return policies.value;
  }

  return policies.value.filter((policy) =>
    [policy.title, policy.projectName, policy.regionName]
      .filter(Boolean)
      .some((item) => item.toLowerCase().includes(value)),
  );
});

function formatSubsidy(policy: ClientPolicyApi.PolicyFile) {
  if (policy.subsidyText) {
    return policy.subsidyText;
  }

  const min = policy.subsidyAmountMin;
  const max = policy.subsidyAmountMax;
  if (min && max) {
    return `${min} - ${max}`;
  }
  if (max) {
    return `最高 ${max}`;
  }
  if (min) {
    return `不低于 ${min}`;
  }

  return '-';
}

async function loadPolicies() {
  loading.value = true;
  try {
    const result = await getClientPolicyFilesApi({
      page: 1,
      pageSize: 100,
      title: keyword.value || undefined,
    });
    policies.value = result.items;
  } finally {
    loading.value = false;
  }
}

async function selectPolicy(policy: ClientPolicyApi.PolicyFile) {
  selectedPolicy.value = policy;
  detailLoading.value = true;
  try {
    selectedPolicy.value = await getClientPolicyFileDetailApi(policy.id);
  } finally {
    detailLoading.value = false;
  }
}

onMounted(loadPolicies);
</script>

<template>
  <div class="client-policy-library">
    <ClientJourneyTrail />
    <Card :bordered="false" class="client-policy-library__summary">
      <div class="client-policy-library__summary-main">
        <div>
          <p class="client-policy-library__eyebrow">
            {{ store.currentCompanyName || '当前企业' }}
          </p>
          <h1 class="client-policy-library__title">政策库</h1>
          <p class="client-policy-library__description">
            按当前企业所在省市区优先查看可申报政策，后续将逐步接入区域精准召回。
          </p>
        </div>
        <div class="client-policy-library__region">
          <span>匹配地区</span>
          <strong>{{ regionHint }}</strong>
        </div>
      </div>
    </Card>

    <div class="client-policy-library__grid">
      <Card :bordered="false" title="政策列表">
        <div class="client-policy-library__toolbar">
          <Input.Search
            v-model:value="keyword"
            allow-clear
            placeholder="搜索政策标题、项目或地区"
            @search="loadPolicies"
          />
        </div>

        <div v-if="loading" class="client-policy-library__loading">
          正在加载政策...
        </div>
        <Empty
          v-else-if="filteredPolicies.length === 0"
          description="暂无匹配政策"
        />
        <div v-else class="client-policy-library__policies">
          <button
            v-for="item in filteredPolicies"
            :key="item.id"
            class="client-policy-library__policy"
            type="button"
            @click="selectPolicy(item)"
          >
            <div class="client-policy-library__policy-title">
              <span>{{ item.title }}</span>
              <Tag color="green">已发布</Tag>
            </div>
            <Space wrap>
              <Tag color="blue">{{ item.regionName }}</Tag>
              <Tag>{{ item.projectName }}</Tag>
              <span>更新：{{ item.updateTime }}</span>
            </Space>
            <TypographyParagraph
              :ellipsis="{ rows: 2 }"
              class="client-policy-library__policy-content"
            >
              {{ item.content || item.remark || '暂无政策摘要' }}
            </TypographyParagraph>
          </button>
        </div>
      </Card>

      <Card :bordered="false" :loading="detailLoading" title="政策详情">
        <Empty v-if="!selectedPolicy" description="请选择左侧政策查看详情" />
        <div v-else class="client-policy-library__detail">
          <div class="client-policy-library__detail-header">
            <div>
              <p class="client-policy-library__eyebrow">政策文件</p>
              <h2>{{ selectedPolicy.title }}</h2>
            </div>
            <Tag color="green">已发布</Tag>
          </div>
          <Space wrap>
            <Tag color="blue">{{ selectedPolicy.regionName }}</Tag>
            <Tag>{{ selectedPolicy.projectName }}</Tag>
            <Tag>{{ selectedPolicy.ownerName }}</Tag>
          </Space>

          <Descriptions
            :column="1"
            bordered
            class="client-policy-library__descriptions"
            size="small"
          >
            <DescriptionsItem label="政策标题">
              {{ selectedPolicy.title }}
            </DescriptionsItem>
            <DescriptionsItem label="适用地区">
              {{ selectedPolicy.regionName }}
            </DescriptionsItem>
            <DescriptionsItem label="关联项目">
              {{ selectedPolicy.projectName }}
            </DescriptionsItem>
            <DescriptionsItem label="负责人">
              {{ selectedPolicy.ownerName }}
            </DescriptionsItem>
            <DescriptionsItem label="状态">
              {{ selectedPolicy.status }}
            </DescriptionsItem>
            <DescriptionsItem label="申报级别">
              {{ selectedPolicy.applicationLevel || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="申报时间">
              <span v-if="selectedPolicy.startDate || selectedPolicy.endDate">
                {{ selectedPolicy.startDate || '未设置' }} 至
                {{ selectedPolicy.endDate || '未设置' }}
              </span>
              <span v-else>-</span>
            </DescriptionsItem>
            <DescriptionsItem label="奖补金额">
              {{ formatSubsidy(selectedPolicy) }}
            </DescriptionsItem>
            <DescriptionsItem label="适用对象">
              {{ selectedPolicy.targetObjects || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="创建时间">
              {{ selectedPolicy.createTime }}
            </DescriptionsItem>
            <DescriptionsItem label="更新时间">
              {{ selectedPolicy.updateTime }}
            </DescriptionsItem>
            <DescriptionsItem label="附件名称">
              {{ selectedPolicy.fileName || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="模板文件">
              {{ selectedPolicy.templateFileName || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="备注">
              {{ selectedPolicy.remark || '-' }}
            </DescriptionsItem>
          </Descriptions>

          <div class="client-policy-library__detail-section">
            <h3>政策正文</h3>
            <TypographyParagraph class="client-policy-library__detail-content">
              {{ selectedPolicy.content || '暂无政策正文' }}
            </TypographyParagraph>
          </div>

          <div class="client-policy-library__detail-section">
            <h3>前置条件</h3>
            <TypographyParagraph class="client-policy-library__detail-content">
              {{ selectedPolicy.conditionText || '暂无前置条件说明' }}
            </TypographyParagraph>
          </div>

          <div class="client-policy-library__detail-section">
            <h3>材料要求</h3>
            <TypographyParagraph class="client-policy-library__detail-content">
              {{ selectedPolicy.materialText || '暂无材料要求说明' }}
            </TypographyParagraph>
          </div>

          <div class="client-policy-library__detail-section">
            <h3>文件附件</h3>
            <Space wrap>
              <Button
                v-if="selectedPolicy.fileUrl"
                :href="selectedPolicy.fileUrl"
                target="_blank"
              >
                下载附件
              </Button>
              <Button
                v-if="selectedPolicy.officialFileUrl"
                :href="selectedPolicy.officialFileUrl"
                target="_blank"
              >
                官方文件
              </Button>
              <span
                v-if="
                  !selectedPolicy.fileUrl && !selectedPolicy.officialFileUrl
                "
                class="client-policy-library__muted"
              >
                暂无附件
              </span>
            </Space>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.client-policy-library {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.client-policy-library__summary-main {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.client-policy-library__eyebrow,
.client-policy-library__description {
  margin: 0;
  color: rgb(0 0 0 / 45%);
}

.client-policy-library__title {
  margin: 6px 0;
  font-size: 24px;
  font-weight: 600;
}

.client-policy-library__region {
  min-width: 180px;
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fafafa;
}

.client-policy-library__region span {
  display: block;
  margin-bottom: 4px;
  color: rgb(0 0 0 / 45%);
}

.client-policy-library__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 16px;
}

.client-policy-library__toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.client-policy-library__policy {
  display: block;
  width: 100%;
  padding: 16px 0;
  border: 0;
  border-bottom: 1px solid #f0f0f0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.client-policy-library__loading {
  padding: 40px 0;
  color: rgb(0 0 0 / 45%);
  text-align: center;
}

.client-policy-library__policy-title {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.client-policy-library__policy-content,
.client-policy-library__detail-content {
  margin-top: 12px;
  white-space: pre-wrap;
}

.client-policy-library__detail-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.client-policy-library__detail-header h2 {
  margin: 4px 0 0;
  font-size: 20px;
  font-weight: 600;
}

.client-policy-library__descriptions,
.client-policy-library__detail-section {
  margin-top: 16px;
}

.client-policy-library__detail-section h3 {
  margin-bottom: 8px;
  font-size: 15px;
  font-weight: 600;
}

.client-policy-library__muted {
  color: rgb(0 0 0 / 45%);
}

@media (max-width: 900px) {
  .client-policy-library__summary-main,
  .client-policy-library__toolbar {
    flex-direction: column;
  }

  .client-policy-library__grid {
    grid-template-columns: 1fr;
  }
}
</style>
