<script setup lang="ts">
import type { EnterpriseWorkspaceGaoxinDocumentPackage } from '#/api';

import { computed, shallowRef, watch } from 'vue';

import { Alert, Button, Checkbox, Empty, Modal, Skeleton, Tag } from 'antdv-next';

import {
  adoptEnterpriseWorkspaceGaoxinDocumentPackageApi,
  getEnterpriseWorkspaceGaoxinDocumentPackageApi,
} from '#/api';
import { showActionFailure, showActionSuccess } from '../../../../system/shared/action-feedback';

const props = defineProps<{ enterpriseId: string; open: boolean }>();
const emit = defineEmits<{
  adopted: [];
  'update:open': [value: boolean];
}>();

const adopting = shallowRef(false);
const errorMessage = shallowRef('');
const loading = shallowRef(false);
const packageData = shallowRef<EnterpriseWorkspaceGaoxinDocumentPackage>();
const selectedKeys = shallowRef<string[]>([]);
const activeKey = shallowRef('');

const drafts = computed(() => packageData.value?.drafts ?? []);
const activeDraft = computed(() => drafts.value.find((item) => item.key === activeKey.value) ?? drafts.value[0]);
const selectedCount = computed(() => selectedKeys.value.length);

watch(
  () => props.open,
  (open) => {
    if (open) void loadPackage();
  },
);

async function loadPackage() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await getEnterpriseWorkspaceGaoxinDocumentPackageApi(props.enterpriseId);
    packageData.value = result;
    selectedKeys.value = result.drafts.filter((item) => item.recommended).map((item) => item.key);
    activeKey.value = result.drafts[0]?.key ?? '';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '制度文件草稿加载失败';
  } finally {
    loading.value = false;
  }
}

function toggleDraft(key: string, checked: boolean) {
  selectedKeys.value = checked
    ? [...new Set([...selectedKeys.value, key])]
    : selectedKeys.value.filter((item) => item !== key);
}

async function adopt() {
  if (!selectedKeys.value.length) return;
  adopting.value = true;
  try {
    const result = await adoptEnterpriseWorkspaceGaoxinDocumentPackageApi(props.enterpriseId, selectedKeys.value);
    showActionSuccess(result.summary);
    emit('adopted');
    emit('update:open', false);
  } catch (error) {
    showActionFailure(error);
  } finally {
    adopting.value = false;
  }
}
</script>

<template>
  <Modal
    :confirm-loading="adopting"
    :ok-button-props="{ disabled: loading || selectedCount === 0 }"
    :ok-text="`采纳 ${selectedCount} 份草稿`"
    :open="open"
    title="AI 生成研发组织管理制度文件包"
    width="1080px"
    @cancel="emit('update:open', false)"
    @ok="adopt"
  >
    <div class="gaoxin-document-package">
      <Alert v-if="errorMessage" show-icon type="warning" :message="errorMessage" />
      <Skeleton v-if="loading" active />
      <Empty v-else-if="!packageData" description="暂无可生成的制度文件" />
      <template v-else>
        <section class="gaoxin-document-package__summary">
          <div>
            <strong>{{ packageData.profileSummary.enterpriseName }}</strong>
            <p>{{ packageData.summary }}</p>
          </div>
          <div class="gaoxin-document-package__metrics">
            <span>RD {{ packageData.profileSummary.rdCount }}</span>
            <span>科技人员 {{ packageData.profileSummary.researchEmployeeCount }}/{{ packageData.profileSummary.totalEmployeeCount }}</span>
            <span>成果 {{ packageData.profileSummary.transformationCount }}</span>
            <span>制度 {{ packageData.profileSummary.documentCount }}</span>
          </div>
        </section>
        <div class="gaoxin-document-package__toolbar"><Button size="small" @click="loadPackage">重新生成预览</Button></div>
        <section class="gaoxin-document-package__content">
          <div class="gaoxin-document-package__list">
            <button
              v-for="draft in drafts"
              :key="draft.key"
              class="gaoxin-document-package__item"
              :class="{ 'gaoxin-document-package__item--active': draft.key === activeDraft?.key }"
              type="button"
              @click="activeKey = draft.key"
            >
              <Checkbox :checked="selectedKeys.includes(draft.key)" @click.stop @change="toggleDraft(draft.key, $event.target.checked)" />
              <span><strong>{{ draft.title }}</strong><small>{{ draft.scoreItem }} / {{ draft.scoreMax }} 分</small></span>
              <Tag :color="draft.recommended ? 'green' : 'default'">{{ draft.recommended ? '建议' : '已有' }}</Tag>
            </button>
          </div>
          <article v-if="activeDraft" class="gaoxin-document-package__preview">
            <div><h3>{{ activeDraft.title }}</h3><Tag color="blue">分类 {{ activeDraft.fileClass }}</Tag></div>
            <Alert v-if="activeDraft.missingEvidence.length" show-icon type="info" :message="`仍需补充真实佐证：${activeDraft.missingEvidence.join('、')}`" />
            <pre>{{ activeDraft.content }}</pre>
          </article>
        </section>
      </template>
    </div>
  </Modal>
</template>

<style scoped>
.gaoxin-document-package { display: grid; gap: 14px; }
.gaoxin-document-package__summary { display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; padding: 14px; background: hsl(var(--muted) / 45%); border: 1px solid hsl(var(--border)); border-radius: 8px; }
.gaoxin-document-package__summary p { max-width: 620px; margin: 6px 0 0; color: hsl(var(--muted-foreground)); }
.gaoxin-document-package__metrics { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 8px; }
.gaoxin-document-package__metrics span { padding: 4px 8px; font-size: 12px; background: hsl(var(--background)); border: 1px solid hsl(var(--border)); border-radius: 6px; }
.gaoxin-document-package__toolbar { display: flex; justify-content: flex-end; }
.gaoxin-document-package__content { display: grid; grid-template-columns: minmax(270px, 340px) minmax(0, 1fr); gap: 14px; min-height: 500px; }
.gaoxin-document-package__list { display: grid; align-content: start; gap: 8px; max-height: 550px; overflow: auto; }
.gaoxin-document-package__item { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; width: 100%; padding: 10px; text-align: left; cursor: pointer; background: hsl(var(--background)); border: 1px solid hsl(var(--border)); border-radius: 8px; }
.gaoxin-document-package__item--active { background: hsl(var(--primary) / 8%); border-color: hsl(var(--primary) / 30%); }
.gaoxin-document-package__item span { display: grid; min-width: 0; gap: 3px; }
.gaoxin-document-package__item strong, .gaoxin-document-package__item small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gaoxin-document-package__item small { color: hsl(var(--muted-foreground)); }
.gaoxin-document-package__preview { display: grid; gap: 12px; min-width: 0; padding: 14px; border: 1px solid hsl(var(--border)); border-radius: 8px; }
.gaoxin-document-package__preview > div { display: flex; gap: 10px; align-items: center; justify-content: space-between; }
.gaoxin-document-package__preview h3 { margin: 0; font-size: 18px; }
.gaoxin-document-package__preview pre { max-height: 430px; padding: 14px; overflow: auto; font: 13px/1.7 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap; background: hsl(var(--muted) / 35%); border: 1px solid hsl(var(--border)); border-radius: 8px; }
@media (max-width: 900px) { .gaoxin-document-package__content { grid-template-columns: 1fr; } }
</style>
