<script setup lang="ts">
import EnterpriseJourneyTrail from '#/views/enterprise/workspace/components/EnterpriseJourneyTrail.vue';

import type { EnterpriseWorkspaceDeclarationDetail } from '#/api';
import { computed, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Page } from '@vben/common-ui';
import {
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Empty,
  Spin,
  Tag,
  Timeline,
  TimelineItem,
} from 'antdv-next';
import { getEnterpriseWorkspaceDeclarationDetailApi } from '#/api';
import { useEnterpriseContextStore } from '#/store';
import { showActionFailure } from '../../system/shared/action-feedback';
import { getDeclarationMaterialTarget } from './declaration-material-link';
import {
  buildDeclarationListQuery,
  parseDeclarationListQuery,
} from './declaration-list-query';
import GaoxinScoreSummary from './components/GaoxinScoreSummary.vue';
import GaoxinAdmissionFlowSummary from './components/GaoxinAdmissionFlowSummary.vue';
import DeclarationConfigurationSummary from './components/DeclarationConfigurationSummary.vue';
import DeclarationMaterialSummary from './components/DeclarationMaterialSummary.vue';
defineOptions({ name: 'EnterpriseDeclarationDetail' });
const route = useRoute();
const router = useRouter();
const enterpriseContextStore = useEnterpriseContextStore();
const detail = shallowRef<EnterpriseWorkspaceDeclarationDetail>();
const loading = shallowRef(false);
const enterpriseId = computed(() => String(route.params.enterpriseId ?? ''));
const declarationId = computed(() => String(route.params.declarationId ?? ''));
function formatDate(value: Date | string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleString('zh-CN', { hour12: false });
}
const materialCheckItems = computed(
  () => detail.value?.materialCheck?.items ?? [],
);
function formatMissingFields(fields: string[] | undefined) {
  return fields?.length ? fields.join('、') : '无明确缺失字段';
}
function checkStatusLabel(status: string | undefined) {
  return (
    (
      {
        complete: '已齐备',
        missing: '待补齐',
        partial: '部分齐备',
        passed: '已齐备',
        pending: '待检查',
      } as Record<string, string>
    )[status ?? ''] ??
    status ??
    '待检查'
  );
}
function checkStatusColor(status: string | undefined) {
  return (
    (
      {
        complete: 'green',
        missing: 'orange',
        partial: 'orange',
        passed: 'green',
        pending: 'default',
      } as Record<string, string>
    )[status ?? ''] ?? 'default'
  );
}
async function openMaterialLedger(
  item: NonNullable<
    EnterpriseWorkspaceDeclarationDetail['materialCheck']
  >['items'][number],
) {
  const target = getDeclarationMaterialTarget(item);
  if (!target) return;
  enterpriseContextStore.setCurrentEnterprise(enterpriseId.value);
  if (target.tab)
    enterpriseContextStore.setMaterialLedgerTab(target.section, target.tab);
  await router.push({
    name: 'EnterpriseMaterialSection',
    params: { section: target.section },
  });
}
async function load() {
  if (!enterpriseId.value || !declarationId.value) return;
  loading.value = true;
  try {
    detail.value = await getEnterpriseWorkspaceDeclarationDetailApi(
      enterpriseId.value,
      declarationId.value,
    );
  } catch (error) {
    showActionFailure(error);
  } finally {
    loading.value = false;
  }
}
async function back() {
  await router.push({
    name: 'EnterpriseDeclarationList',
    query: buildDeclarationListQuery(parseDeclarationListQuery(route.query)),
  });
}
watch(
  [enterpriseId, declarationId],
  () => {
    if (enterpriseId.value)
      enterpriseContextStore.setCurrentEnterprise(enterpriseId.value);
    void load();
  },
  { immediate: true },
);
</script>
<template>
  <Page auto-content-height>
    <EnterpriseJourneyTrail
      :enterprise-id="enterpriseId"
      :status="detail?.status"
    />
    <div class="declaration-detail__toolbar">
      <Button @click="back">返回申报列表</Button>
    </div>
    <Spin :spinning="loading"
      ><Empty
        v-if="!loading && !detail"
        description="申报记录不存在或无权访问"
      />
      <div v-else-if="detail" class="declaration-detail">
        <Card title="申报总览"
          ><Descriptions bordered :column="2"
            ><DescriptionsItem label="项目名称">{{
              detail.projectName
            }}</DescriptionsItem
            ><DescriptionsItem label="状态"
              ><Tag color="blue">{{ detail.status }}</Tag></DescriptionsItem
            ><DescriptionsItem label="当前节点">{{
              detail.currentNodeName || '-'
            }}</DescriptionsItem
            ><DescriptionsItem label="申报进度"
              >{{ detail.progress }}%</DescriptionsItem
            ><DescriptionsItem label="待补材料"
              >{{ detail.missingMaterialCount }} 项</DescriptionsItem
            ><DescriptionsItem label="截止日期">{{
              formatDate(detail.deadline)
            }}</DescriptionsItem
            ><DescriptionsItem label="更新时间">{{
              formatDate(detail.updatedAt)
            }}</DescriptionsItem
            ><DescriptionsItem label="退回原因">{{
              detail.rejectedReason || '-'
            }}</DescriptionsItem></Descriptions
          ></Card
        ><Card title="方案与准入核验"
          ><DeclarationConfigurationSummary
            :configuration="detail.configuration"
            :matched-scheme="detail.matchedScheme" /></Card
        ><Card title="材料核验结果"
          ><template v-if="detail.materialCheck"
            ><Descriptions :column="3"
              ><DescriptionsItem label="检查状态">{{
                detail.materialCheck.checkStatus
              }}</DescriptionsItem
              ><DescriptionsItem label="准备度">{{
                detail.materialCheck.readinessScore
              }}</DescriptionsItem
              ><DescriptionsItem label="缺失项">{{
                detail.materialCheck.missingItems
              }}</DescriptionsItem></Descriptions
            ></template
          ><Empty v-else description="暂无材料检查记录" /></Card
        ><Card title="待补材料明细"
          ><div
            v-if="materialCheckItems.length"
            class="declaration-detail__material-checks"
          >
            <article
              v-for="(item, index) in materialCheckItems"
              :key="`${item.moduleKey}-${item.tabKey}-${index}`"
            >
              <div class="declaration-detail__material-check-content">
                <div>
                  <strong>{{ item.itemName || '材料检查项' }}</strong>
                  <p>缺失字段：{{ formatMissingFields(item.missingFields) }}</p>
                  <p v-if="item.suggestion">建议：{{ item.suggestion }}</p>
                </div>
                <Tag :color="checkStatusColor(item.checkStatus)">{{
                  checkStatusLabel(item.checkStatus)
                }}</Tag>
              </div>
              <Button
                v-if="getDeclarationMaterialTarget(item)"
                size="small"
                type="link"
                @click="openMaterialLedger(item)"
                >去补充材料</Button
              >
            </article>
          </div>
          <Empty v-else description="暂无待补材料明细" /></Card
        ><Card title="方案材料要求"
          ><DeclarationMaterialSummary
            :configuration="detail.configuration.material"
            :material-check="detail.materialCheck" /></Card
        ><Card title="申报流程与节点前置条件"
          ><GaoxinAdmissionFlowSummary
            :flow-template="detail.flowTemplate"
            :qualification="detail.qualification" /></Card
        ><Card title="高企评分测算"
          ><GaoxinScoreSummary
            :configuration="detail.configuration.score"
            :score="detail.gaoxinScore" /></Card
        ><Card title="流程历史"
          ><Timeline
            ><TimelineItem
              v-for="(item, index) in detail.flowHistory"
              :key="index"
              ><strong
                >{{ item.from || '流程节点' }} →
                {{ item.to || '流程节点' }}</strong
              >
              <p v-if="item.reason">{{ item.reason }}</p>
              <p v-if="item.at">{{ formatDate(item.at) }}</p></TimelineItem
            ><TimelineItem v-if="!detail.flowHistory.length"
              >暂无流程记录</TimelineItem
            ></Timeline
          ></Card
        >
      </div></Spin
    ></Page
  >
</template>
<style scoped>
.declaration-detail {
  display: grid;
  gap: 16px;
}
.declaration-detail__toolbar {
  display: flex;
  gap: 8px;
  justify-content: space-between;
  margin-bottom: 16px;
}
.declaration-detail__material-checks {
  display: grid;
  gap: 10px;
}
.declaration-detail__material-checks article {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
}
.declaration-detail__material-check-content {
  display: flex;
  flex: 1;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}
.declaration-detail__material-check-content p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 13px;
}
@media (max-width: 640px) {
  .declaration-detail__material-checks article,
  .declaration-detail__material-check-content {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
}
</style>
