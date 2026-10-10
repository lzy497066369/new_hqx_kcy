<script setup lang="ts">
import { reactive, watch } from 'vue';

import { Button, Empty, Input, Progress, Space, Tag, TypographyParagraph } from 'antdv-next';

import type { ClientDeclarationApi } from '#/api/client';

defineOptions({ name: 'GaoxinBookDraftPanel' });

interface Props {
  draft: ClientDeclarationApi.GaoxinBookDraft | null;
  loading?: boolean;
  saving?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  saving: false,
});

const emit = defineEmits<{
  openProfile: [payload: { moduleKey: string; tabKey: string }];
  refresh: [];
  save: [supplemental: Record<string, string>];
}>();

const supplementalForm = reactive<Record<string, string>>({});

watch(
  () => props.draft?.supplemental,
  (value) => {
    Object.keys(supplementalForm).forEach((key) => {
      delete supplementalForm[key];
    });
    Object.entries(value ?? {}).forEach(([key, nextValue]) => {
      supplementalForm[key] = nextValue ?? '';
    });
  },
  { immediate: true },
);

function openProfile(field: ClientDeclarationApi.GaoxinBookField) {
  if (!field.moduleKey || !field.tabKey) {
    return;
  }
  emit('openProfile', {
    moduleKey: field.moduleKey,
    tabKey: field.tabKey,
  });
}

function saveSupplemental() {
  emit('save', { ...supplementalForm });
}
</script>

<template>
  <div class="gaoxin-book-draft-panel">
    <div v-if="loading" class="gaoxin-book-draft-panel__loading">
      正在生成申报书草稿...
    </div>
    <Empty v-else-if="!draft" description="暂无申报书草稿">
      <Button @click="emit('refresh')">生成草稿</Button>
    </Empty>
    <template v-else>
      <div class="gaoxin-book-draft-panel__hero">
        <div>
          <p class="gaoxin-book-draft-panel__eyebrow">
            草稿状态：{{ draft.status }} · 生成时间：{{ draft.generatedAt }}
          </p>
          <h3 class="gaoxin-book-draft-panel__title">
            申报书草稿
          </h3>
          <TypographyParagraph class="gaoxin-book-draft-panel__text">
            企业资料字段只读引用；如需修改，请跳转企业资料维护。申报补充说明可在本页保存。
          </TypographyParagraph>
        </div>
        <Space wrap>
          <Button @click="emit('refresh')">重新生成</Button>
          <Button :loading="saving" type="primary" @click="saveSupplemental">
            保存补充说明
          </Button>
        </Space>
      </div>

      <div class="gaoxin-book-draft-panel__completion">
        <span>草稿完整度</span>
        <Progress :percent="draft.completionRate" />
      </div>

      <div class="gaoxin-book-draft-panel__sections">
        <div
          v-for="section in draft.sections"
          :key="section.key"
          class="gaoxin-book-draft-panel__section"
        >
          <div class="gaoxin-book-draft-panel__section-head">
            <div>
              <strong>{{ section.title }}</strong>
              <p>{{ section.description }}</p>
            </div>
            <Tag>{{ section.records.length }} 条记录</Tag>
          </div>

          <div v-if="section.fields.length" class="gaoxin-book-draft-panel__fields">
            <div
              v-for="field in section.fields"
              :key="field.key"
              class="gaoxin-book-draft-panel__field"
            >
              <label>{{ field.label }}</label>
              <Input.TextArea
                v-if="field.editable"
                v-model:value="supplementalForm[field.key]"
                :auto-size="{ minRows: 2, maxRows: 6 }"
                placeholder="请输入本次申报补充说明"
              />
              <div v-else class="gaoxin-book-draft-panel__readonly">
                <span>{{ field.value || '-' }}</span>
                <Button size="small" type="link" @click="openProfile(field)">
                  去企业资料修改
                </Button>
              </div>
            </div>
          </div>

          <div v-if="section.records.length" class="gaoxin-book-draft-panel__records">
            <div
              v-for="record in section.records"
              :key="record.id"
              class="gaoxin-book-draft-panel__record"
            >
              <strong>{{ record.title }}</strong>
              <div class="gaoxin-book-draft-panel__record-fields">
                <div
                  v-for="field in record.fields"
                  :key="`${record.id}-${field.key}`"
                  class="gaoxin-book-draft-panel__record-field"
                >
                  <span>{{ field.label }}</span>
                  <p>{{ field.value || '-' }}</p>
                </div>
              </div>
              <Button
                v-if="record.fields[0]?.moduleKey && record.fields[0]?.tabKey"
                size="small"
                type="link"
                @click="openProfile(record.fields[0])"
              >
                去企业资料修改
              </Button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.gaoxin-book-draft-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.gaoxin-book-draft-panel__loading {
  padding: 32px 0;
  color: rgb(0 0 0 / 45%);
  text-align: center;
}

.gaoxin-book-draft-panel__hero,
.gaoxin-book-draft-panel__section-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.gaoxin-book-draft-panel__eyebrow,
.gaoxin-book-draft-panel__text,
.gaoxin-book-draft-panel__section-head p,
.gaoxin-book-draft-panel__completion span,
.gaoxin-book-draft-panel__record-field span {
  margin: 0;
  color: rgb(0 0 0 / 45%);
}

.gaoxin-book-draft-panel__title {
  margin: 4px 0;
  font-size: 16px;
  font-weight: 600;
}

.gaoxin-book-draft-panel__completion,
.gaoxin-book-draft-panel__section,
.gaoxin-book-draft-panel__record {
  padding: 16px;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  background: #fafafa;
}

.gaoxin-book-draft-panel__sections,
.gaoxin-book-draft-panel__fields,
.gaoxin-book-draft-panel__records {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gaoxin-book-draft-panel__section,
.gaoxin-book-draft-panel__record {
  background: #fff;
}

.gaoxin-book-draft-panel__field {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 12px;
  align-items: flex-start;
}

.gaoxin-book-draft-panel__field label {
  color: rgb(0 0 0 / 65%);
  font-weight: 600;
}

.gaoxin-book-draft-panel__readonly {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
}

.gaoxin-book-draft-panel__readonly span {
  white-space: pre-wrap;
}

.gaoxin-book-draft-panel__record-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  margin-top: 12px;
}

.gaoxin-book-draft-panel__record-field p {
  margin: 4px 0 0;
  white-space: pre-wrap;
}

@media (max-width: 900px) {
  .gaoxin-book-draft-panel__hero,
  .gaoxin-book-draft-panel__section-head,
  .gaoxin-book-draft-panel__readonly {
    flex-direction: column;
  }

  .gaoxin-book-draft-panel__field,
  .gaoxin-book-draft-panel__record-fields {
    grid-template-columns: 1fr;
  }
}
</style>
