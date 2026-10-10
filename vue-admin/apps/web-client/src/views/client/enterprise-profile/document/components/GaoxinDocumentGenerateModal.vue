<script setup lang="ts">
import type { ClientEnterpriseDocumentApi } from '#/api/client';

import { computed, shallowRef, watch } from 'vue';

import {
  adoptClientGaoxinDocumentPackageApi,
  getClientGaoxinDocumentPackageApi,
} from '#/api/client';

import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Modal,
  Skeleton,
  Tag,
  message,
} from 'antdv-next';

defineOptions({ name: 'ClientGaoxinDocumentGenerateModal' });

const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{
  adopted: [items: ClientEnterpriseDocumentApi.RuleDocument[]];
}>();

const loading = shallowRef(false);
const adopting = shallowRef(false);
const errorMessage = shallowRef('');
const packageData = shallowRef<ClientEnterpriseDocumentApi.GaoxinDocumentPackage | null>(
  null,
);
const selectedKeys = shallowRef<string[]>([]);
const activeKey = shallowRef('');

const drafts = computed(() => packageData.value?.drafts ?? []);
const activeDraft = computed(() =>
  drafts.value.find((item) => item.key === activeKey.value) ?? drafts.value[0],
);
const selectedCount = computed(() => selectedKeys.value.length);

watch(
  open,
  (value) => {
    if (value) {
      loadPackage();
    }
  },
);

async function loadPackage() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await getClientGaoxinDocumentPackageApi();
    packageData.value = result;
    selectedKeys.value = result.drafts
      .filter((item) => item.recommended)
      .map((item) => item.key);
    activeKey.value = result.drafts[0]?.key ?? '';
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : '制度文件包生成失败';
  } finally {
    loading.value = false;
  }
}

function toggleDraft(key: string, checked: boolean) {
  selectedKeys.value = checked
    ? [...new Set([...selectedKeys.value, key])]
    : selectedKeys.value.filter((item) => item !== key);
}

function selectAllRecommended() {
  selectedKeys.value = drafts.value
    .filter((item) => item.recommended)
    .map((item) => item.key);
}

async function adoptSelected() {
  if (selectedKeys.value.length === 0) {
    message.warning('请选择需要采纳的制度文件');
    return;
  }

  adopting.value = true;
  try {
    const result = await adoptClientGaoxinDocumentPackageApi(selectedKeys.value);
    emit('adopted', result.savedItems);
    message.success(result.summary);
    open.value = false;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '制度文件采纳失败');
  } finally {
    adopting.value = false;
  }
}
</script>

<template>
  <Modal
    v-model:open="open"
    destroy-on-hidden
    title="AI 生成研发组织管理制度文件包"
    width="1080px"
    :confirm-loading="adopting"
    :ok-button-props="{ disabled: selectedCount === 0 || loading }"
    :ok-text="`采纳 ${selectedCount} 份草稿`"
    cancel-text="关闭"
    @ok="adoptSelected"
  >
    <div class="gaoxin-document-modal">
      <Alert
        v-if="errorMessage"
        show-icon
        type="warning"
        :message="errorMessage"
      />

      <Skeleton v-if="loading" active />

      <Empty
        v-else-if="!packageData"
        description="暂无可生成的制度文件包"
      />

      <template v-else>
        <section class="gaoxin-document-modal__summary">
          <div>
            <div class="gaoxin-document-modal__company">
              {{ packageData.profileSummary.enterpriseName }}
            </div>
            <p class="gaoxin-document-modal__text">
              {{ packageData.summary }}
            </p>
          </div>
          <div class="gaoxin-document-modal__metrics">
            <span>RD {{ packageData.profileSummary.rdCount }}</span>
            <span>
              科技人员
              {{ packageData.profileSummary.researchEmployeeCount }}/{{
                packageData.profileSummary.totalEmployeeCount
              }}
            </span>
            <span>成果 {{ packageData.profileSummary.transformationCount }}</span>
            <span>制度 {{ packageData.profileSummary.documentCount }}</span>
          </div>
        </section>

        <div class="gaoxin-document-modal__toolbar">
          <Button size="small" @click="selectAllRecommended">
            选择建议采纳
          </Button>
          <Button size="small" @click="loadPackage">重新生成预览</Button>
        </div>

        <section class="gaoxin-document-modal__content">
          <div class="gaoxin-document-modal__list">
            <button
              v-for="draft in drafts"
              :key="draft.key"
              class="gaoxin-document-modal__item"
              :class="{
                'gaoxin-document-modal__item--active': draft.key === activeDraft?.key,
              }"
              type="button"
              @click="activeKey = draft.key"
            >
              <Checkbox
                :checked="selectedKeys.includes(draft.key)"
                @click.stop
                @change="toggleDraft(draft.key, $event.target.checked)"
              />
              <span class="gaoxin-document-modal__item-main">
                <strong>{{ draft.title }}</strong>
                <small>{{ draft.scoreItem }} / {{ draft.scoreMax }} 分项</small>
              </span>
              <Tag v-if="draft.recommended" color="green">建议</Tag>
              <Tag v-else>已有</Tag>
            </button>
          </div>

          <article v-if="activeDraft" class="gaoxin-document-modal__preview">
            <div class="gaoxin-document-modal__preview-header">
              <div>
                <h3>{{ activeDraft.title }}</h3>
                <p>{{ activeDraft.scoreItem }}，最高 {{ activeDraft.scoreMax }} 分</p>
              </div>
              <Tag color="blue">分类 {{ activeDraft.fileClass }}</Tag>
            </div>

            <Alert
              v-if="activeDraft.missingEvidence.length > 0"
              show-icon
              type="info"
              :message="`仍需补充真实佐证：${activeDraft.missingEvidence.join('、')}`"
            />

            <pre class="gaoxin-document-modal__draft">{{ activeDraft.content }}</pre>
          </article>
        </section>
      </template>
    </div>
  </Modal>
</template>

<style scoped>
.gaoxin-document-modal {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.gaoxin-document-modal__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 14px;
  background: hsl(var(--muted) / 45%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.gaoxin-document-modal__company {
  font-size: 16px;
  font-weight: 700;
}

.gaoxin-document-modal__text {
  max-width: 640px;
  margin: 6px 0 0;
  color: hsl(var(--muted-foreground));
}

.gaoxin-document-modal__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.gaoxin-document-modal__metrics span {
  padding: 4px 8px;
  font-size: 12px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.gaoxin-document-modal__toolbar {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.gaoxin-document-modal__content {
  display: grid;
  grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
  gap: 14px;
  min-height: 520px;
}

.gaoxin-document-modal__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 560px;
  overflow: auto;
}

.gaoxin-document-modal__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 10px;
  text-align: left;
  cursor: pointer;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.gaoxin-document-modal__item--active {
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 30%);
}

.gaoxin-document-modal__item-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.gaoxin-document-modal__item-main strong,
.gaoxin-document-modal__item-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gaoxin-document-modal__item-main small {
  color: hsl(var(--muted-foreground));
}

.gaoxin-document-modal__preview {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.gaoxin-document-modal__preview-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.gaoxin-document-modal__preview-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.gaoxin-document-modal__preview-header p {
  margin: 5px 0 0;
  color: hsl(var(--muted-foreground));
}

.gaoxin-document-modal__draft {
  min-height: 400px;
  max-height: 460px;
  padding: 14px;
  overflow: auto;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

@media (max-width: 900px) {
  .gaoxin-document-modal__content {
    grid-template-columns: 1fr;
  }
}
</style>
