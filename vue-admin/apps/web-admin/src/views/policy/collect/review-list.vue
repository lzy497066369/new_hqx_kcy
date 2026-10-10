<script setup lang="ts">
import type { PolicyCollectRunItem } from '#/api';
import type { PolicyCollectRun } from '#/api';

import { computed, onMounted, shallowRef } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Alert, Button, Card, Empty, Tag } from 'antdv-next';

import {
  getPolicyCollectRunsApi,
  getPolicyCollectReviewItemsApi,
  ignorePolicyCollectReviewItemApi,
  importPolicyCollectReviewItemApi,
  linkPolicyCollectReviewItemExistingApi,
  savePolicyCollectReviewItemAsNewApi,
  updatePolicyCollectReviewItemExistingApi,
} from '#/api';
import {
  showActionFailure,
  showActionSuccess,
} from '../../system/shared/action-feedback';

const errorMessage = shallowRef('');
const items = shallowRef<PolicyCollectRunItem[]>([]);
const latestRun = shallowRef<PolicyCollectRun>();
const loading = shallowRef(false);
const activeItem = shallowRef<PolicyCollectRunItem>();
const router = useRouter();

const reviewStats = computed(() => ({
  changedCount: items.value.filter((item) => item.compareStatus === 'changed').length,
  newCount: items.value.filter((item) => item.compareStatus === 'new').length,
  totalCount: items.value.length,
  uncertainCount: items.value.filter((item) => item.compareStatus === 'uncertain').length,
}));

const [DetailDrawer, detailDrawerApi] = useVbenDrawer();

onMounted(() => {
  load();
});

async function load() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const [result, runResult] = await Promise.all([
      getPolicyCollectReviewItemsApi({ page: 1, pageSize: 50 }),
      getPolicyCollectRunsApi({ page: 1, pageSize: 1 }),
    ]);
    items.value = result.items;
    latestRun.value = runResult.items[0];
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '待审查政策加载失败';
  } finally {
    loading.value = false;
  }
}

async function importItem(item: PolicyCollectRunItem) {
  await handleReviewAction(item, importPolicyCollectReviewItemApi, '导入成功');
}

async function saveAsNew(item: PolicyCollectRunItem) {
  await handleReviewAction(item, savePolicyCollectReviewItemAsNewApi, '已另存为新政策');
}

async function updateExisting(item: PolicyCollectRunItem) {
  await handleReviewAction(
    item,
    (id) => updatePolicyCollectReviewItemExistingApi(id),
    '已更新原政策',
  );
}

async function linkExisting(item: PolicyCollectRunItem) {
  await handleReviewAction(
    item,
    (id) => linkPolicyCollectReviewItemExistingApi(id),
    '已关联已有政策',
  );
}

async function ignoreItem(item: PolicyCollectRunItem) {
  await handleReviewAction(item, ignorePolicyCollectReviewItemApi, '已忽略');
}

async function handleReviewAction(
  item: PolicyCollectRunItem,
  action: (id: string) => Promise<unknown>,
  successMessage: string,
) {
  loading.value = true;
  try {
    await action(item.id);
    await load();
    detailDrawerApi.close();
    showActionSuccess(successMessage);
  } catch (error) {
    showActionFailure(error);
  } finally {
    loading.value = false;
  }
}

function compareColor(status: string) {
  if (status === 'new') return 'blue';
  if (status === 'changed') return 'orange';
  if (status === 'uncertain') return 'purple';
  return 'default';
}

function compareLabel(status: string) {
  const labels: Record<string, string> = {
    changed: '疑似变更',
    new: '新增政策',
    uncertain: '待确认',
  };
  return labels[status] ?? status;
}

function openOfficialUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function openAiRecord(taskId?: null | string) {
  if (!taskId) {
    return;
  }
  router
    .push({ path: '/system/ai-record', query: { taskId } })
    .catch(() => {});
}

function openDetail(item: PolicyCollectRunItem) {
  activeItem.value = item;
  detailDrawerApi.open();
}

function navTo(path: string) {
  router.push(path).catch(() => {});
}
</script>

<template>
  <Page auto-content-height>
    <div class="policy-collect-page">
      <div class="policy-collect-header">
        <div>
          <h2 class="policy-collect-title">政策待审查</h2>
          <div class="policy-collect-subtitle">新增、疑似变更和待确认政策线索</div>
        </div>
        <div class="policy-collect-actions">
          <Button @click="navTo('/policy/collect-runs')">
            <IconifyIcon icon="lucide:list-checks" class="size-4" />
            采集结果
          </Button>
          <Button type="primary" @click="navTo('/policy/collect-jobs')">
            <IconifyIcon icon="lucide:calendar-search" class="size-4" />
            采集任务
          </Button>
        </div>
      </div>

      <Alert v-if="errorMessage" show-icon type="warning" :message="errorMessage" />

      <DetailDrawer
        :footer="false"
        :title="activeItem ? `待审查详情 #${activeItem.id}` : '待审查详情'"
        class="w-full max-w-180"
      >
        <div v-if="activeItem" class="grid gap-4">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <Tag :color="compareColor(activeItem.compareStatus)">
                {{ compareLabel(activeItem.compareStatus) }}
              </Tag>
              <Tag>{{ activeItem.policyCategoryName }}</Tag>
            </div>
            <h3 class="mt-3 text-base font-semibold text-slate-900">
              {{ activeItem.title }}
            </h3>
            <div class="mt-2 text-sm text-slate-500">
              {{ activeItem.regionName }} / {{ activeItem.projectName }} /
              {{ activeItem.issuingAgency || '未知机关' }}
            </div>
          </div>

          <div class="rounded-md border border-slate-200 p-3">
            <div class="text-sm font-medium text-slate-900">摘要</div>
            <div class="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {{ activeItem.summary || '-' }}
            </div>
          </div>

          <div class="rounded-md border border-slate-200 p-3">
            <div class="text-sm font-medium text-slate-900">AI 判断理由</div>
            <div class="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {{ activeItem.aiReason || '-' }}
            </div>
          </div>

          <div class="rounded-md border border-slate-200 p-3 text-sm text-slate-600">
            <div>发布日期：{{ activeItem.publishDate || '-' }}</div>
            <div class="mt-1">文号：{{ activeItem.documentNo || '-' }}</div>
            <div class="mt-1">状态：{{ activeItem.status }}</div>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button v-if="activeItem.officialUrl" @click="openOfficialUrl(activeItem.officialUrl)">
              <IconifyIcon icon="lucide:external-link" class="size-4" />
              官方链接
            </Button>
            <Button v-if="activeItem.aiTaskId" @click="openAiRecord(activeItem.aiTaskId)">
              <IconifyIcon icon="lucide:bot" class="size-4" />
              AI 记录
            </Button>
            <Button
              v-if="activeItem.compareStatus === 'changed' && activeItem.matchedPolicyFileId"
              :loading="loading"
              type="primary"
              @click="updateExisting(activeItem)"
            >
              更新原政策
            </Button>
            <Button
              v-if="activeItem.compareStatus !== 'changed'"
              :loading="loading"
              type="primary"
              @click="importItem(activeItem)"
            >
              生成政策文件
            </Button>
            <Button
              v-if="activeItem.compareStatus === 'changed'"
              :loading="loading"
              @click="saveAsNew(activeItem)"
            >
              另存为新政策
            </Button>
            <Button danger :loading="loading" @click="ignoreItem(activeItem)">
              忽略
            </Button>
          </div>
        </div>
      </DetailDrawer>

      <div class="policy-collect-stat-grid">
        <div class="policy-collect-stat">
          <span>待审查</span>
          <strong>{{ reviewStats.totalCount }}</strong>
        </div>
        <div class="policy-collect-stat">
          <span>新增</span>
          <strong>{{ reviewStats.newCount }}</strong>
        </div>
        <div class="policy-collect-stat">
          <span>疑似变更</span>
          <strong>{{ reviewStats.changedCount }}</strong>
        </div>
        <div class="policy-collect-stat">
          <span>待确认</span>
          <strong>{{ reviewStats.uncertainCount }}</strong>
        </div>
      </div>
      <div class="policy-collect-list">
        <Card v-if="items.length === 0 && !loading" variant="borderless">
          <div class="policy-collect-empty">
            <Empty description="暂无待审查政策" />
            <div class="text-sm text-slate-500">
              <template v-if="latestRun">
                最近一次采集：{{ latestRun.jobName }}，状态 {{ latestRun.status }}，
                返回候选 {{ latestRun.totalCount }} 条。
                <span v-if="latestRun.totalCount === 0">
                  当前没有待审查数据，是因为 AI 没有返回符合官方正式文件要求的候选政策。
                </span>
              </template>
              <template v-else>
                还没有采集执行记录，请先创建任务并手动执行。
              </template>
            </div>
            <div class="flex flex-wrap justify-center gap-2">
              <Button @click="navTo('/policy/collect-jobs')">
                政策采集任务
              </Button>
              <Button type="primary" @click="navTo('/policy/collect-runs')">
                政策采集结果
              </Button>
              <Button
                v-if="latestRun?.aiTaskId"
                @click="openAiRecord(latestRun.aiTaskId)"
              >
                <IconifyIcon icon="lucide:bot" class="size-4" />
                查看最近 AI 记录
              </Button>
            </div>
          </div>
        </Card>
        <Card
          v-for="item in items"
          :key="item.id"
          class="policy-collect-card"
          variant="borderless"
        >
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <Tag :color="compareColor(item.compareStatus)">
                  {{ compareLabel(item.compareStatus) }}
                </Tag>
                <Tag>{{ item.policyCategoryName }}</Tag>
                <h3 class="policy-collect-card-title">{{ item.title }}</h3>
              </div>
              <div class="policy-collect-card-meta">
                {{ item.regionName }} / {{ item.projectName }} / {{ item.issuingAgency || '未知机关' }}
              </div>
              <div class="policy-collect-card-body">{{ item.summary }}</div>
              <div class="policy-collect-card-note">{{ item.aiReason }}</div>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button @click="openDetail(item)">
                <IconifyIcon icon="lucide:eye" class="size-4" />
                详情
              </Button>
              <Button v-if="item.officialUrl" @click="openOfficialUrl(item.officialUrl)">
                <IconifyIcon icon="lucide:external-link" class="size-4" />
                官方链接
              </Button>
              <Button v-if="item.aiTaskId" @click="openAiRecord(item.aiTaskId)">
                <IconifyIcon icon="lucide:bot" class="size-4" />
                AI 记录
              </Button>
              <Button
                v-if="item.compareStatus === 'changed' && item.matchedPolicyFileId"
                :loading="loading"
                type="primary"
                @click="updateExisting(item)"
              >
                更新原政策
              </Button>
              <Button
                v-if="item.matchedPolicyFileId"
                :loading="loading"
                @click="linkExisting(item)"
              >
                确认关联
              </Button>
              <Button
                v-if="item.compareStatus !== 'changed'"
                :loading="loading"
                type="primary"
                @click="importItem(item)"
              >
                生成政策文件
              </Button>
              <Button
                v-if="item.compareStatus === 'changed'"
                :loading="loading"
                @click="saveAsNew(item)"
              >
                另存为新政策
              </Button>
              <Button danger :loading="loading" @click="ignoreItem(item)">
                忽略
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </Page>
</template>

<style src="./collect-page.css"></style>
