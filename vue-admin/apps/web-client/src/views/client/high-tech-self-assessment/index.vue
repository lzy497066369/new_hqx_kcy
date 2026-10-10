<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import { Page } from '@vben/common-ui';
import { createIconifyIcon } from '@vben/icons';
import { Alert, Button, InputNumber, Skeleton, Tag, message } from 'antdv-next';

import {
  getHighTechSelfAssessmentApi,
  saveHighTechSelfAssessmentApi,
  type HighTechSelfAssessment,
  type HighTechScores,
} from '#/api/client/high-tech';
import { SCORE_FIELDS, scoreError, totalScore } from '../high-tech-application/model';

defineOptions({ name: 'ClientHighTechSelfAssessment' });
const BackIcon = createIconifyIcon('lucide:arrow-left');
const SaveIcon = createIconifyIcon('lucide:save');
const route = useRoute();
const router = useRouter();
const companyId = computed(() => String(route.params.companyId ?? ''));
const assessment = ref<HighTechSelfAssessment | null>(null);
const scores = ref<HighTechScores>({ intellectualProperty: null, transformation: null, organization: null, salesGrowth: null, netAssetGrowth: null });
const snapshot = ref('');
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref('');
const validationMessage = ref('');
const count = computed(() => SCORE_FIELDS.filter(({ key }) => scores.value[key] !== null && scores.value[key] !== undefined).length);
const complete = computed(() => !scoreError(scores.value));
const dirty = computed(() => !!snapshot.value && JSON.stringify(scores.value) !== snapshot.value);
let sequence = 0;

async function load(company: string) {
  const current = ++sequence;
  loading.value = true;
  errorMessage.value = '';
  validationMessage.value = '';
  assessment.value = null;
  snapshot.value = '';
  try {
    const result = await getHighTechSelfAssessmentApi(company);
    if (current !== sequence) return;
    assessment.value = result;
    scores.value = { ...result.scores };
    snapshot.value = JSON.stringify(scores.value);
  } catch (error) {
    if (current === sequence) errorMessage.value = error instanceof Error ? error.message : '自评加载失败';
  } finally {
    if (current === sequence) loading.value = false;
  }
}

async function save(returnToList = false) {
  if (!assessment.value || saving.value || loading.value) return;
  validationMessage.value = scoreError(scores.value);
  if (validationMessage.value) return;
  saving.value = true;
  errorMessage.value = '';
  const current = sequence;
  try {
    const result = await saveHighTechSelfAssessmentApi(companyId.value, { revision: assessment.value.revision, scores: { ...scores.value } });
    if (current !== sequence) return;
    assessment.value = result;
    scores.value = { ...result.scores };
    snapshot.value = JSON.stringify(scores.value);
    message.success('自评已保存');
    if (returnToList) {
      saving.value = false;
      await router.push({ name: 'ClientEnterpriseReceipts' });
    }
  } catch (error) {
    if (current === sequence) errorMessage.value = error instanceof Error ? error.message : '保存失败，请重试';
  } finally {
    if (current === sequence) saving.value = false;
  }
}

function canLeave() {
  if (loading.value || saving.value) return false;
  return !dirty.value || window.confirm('自评分有未保存的修改，确定离开吗？');
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || saving.value) { event.preventDefault(); event.returnValue = ''; }
}
onBeforeRouteLeave(canLeave);
onBeforeRouteUpdate((to, from) => to.params.companyId === from.params.companyId || canLeave());
window.addEventListener('beforeunload', beforeUnload);
onBeforeUnmount(() => { sequence++; window.removeEventListener('beforeunload', beforeUnload); });
watch(companyId, load, { immediate: true });
</script>

<template>
  <Page auto-content-height>
    <div class="assessment-page">
      <header class="assessment-header">
        <div>
          <Button type="link" class="back-button" @click="router.push({ name: 'ClientEnterpriseReceipts' })"><template #icon><BackIcon /></template>返回企业档案</Button>
          <h1>{{ assessment?.companyName || '企业自评' }}</h1>
          <p>高新技术企业申报 · 自评</p>
        </div>
        <div class="assessment-actions" v-if="assessment">
          <Button :disabled="saving || loading" :loading="saving" @click="save(false)"><template #icon><SaveIcon /></template>保存自评</Button>
          <Button type="primary" :disabled="saving || loading" :loading="saving" @click="save(true)">保存并返回档案</Button>
        </div>
      </header>

      <Alert v-if="errorMessage" type="error" show-icon :message="errorMessage" role="alert" />
      <Alert v-if="validationMessage" type="warning" show-icon :message="validationMessage" role="alert" />
      <Skeleton v-if="loading" active />
      <template v-else-if="assessment">
        <div class="score-summary" aria-live="polite">
          <div><span>当前填写</span><strong>{{ count }} / 5 项</strong></div>
          <div><span>自评总分</span><strong>{{ complete ? totalScore(scores) : '—' }} <small>/ 100</small></strong></div>
          <Tag :color="dirty ? 'orange' : complete ? 'green' : 'default'">{{ dirty ? '未保存' : complete ? '已保存' : '未评分' }}</Tag>
        </div>
        <Alert type="info" show-icon message="请依据企业资料填写五项评分；0 分有效。五项完整且保存成功后，企业档案才显示自评总分。自评不代表最终认定结果。" />
        <div class="score-grid">
          <section v-for="field in SCORE_FIELDS.slice(0, 3)" :key="field.key" class="score-panel">
            <div class="score-panel__heading"><h2>{{ field.label }}</h2><Tag>满分 {{ field.max }} 分</Tag></div>
            <label :for="`score-${field.key}`">{{ field.label }}分数</label>
            <InputNumber :id="`score-${field.key}`" v-model:value="scores[field.key]" :aria-label="`${field.label}分数`" :min="0" :max="field.max" :precision="1" :disabled="saving" placeholder="请输入分数" class="score-input" @change="validationMessage = ''" />
            <p>分值范围：0—{{ field.max }} 分</p>
          </section>
          <section class="score-panel">
            <div class="score-panel__heading"><h2>企业成长性</h2><Tag>满分 20 分</Tag></div>
            <div v-for="field in SCORE_FIELDS.slice(3)" :key="field.key" class="growth-field">
              <label :for="`score-${field.key}`">{{ field.label }}（满分 10 分）</label>
              <InputNumber :id="`score-${field.key}`" v-model:value="scores[field.key]" :aria-label="`${field.label}分数`" :min="0" :max="10" :precision="1" :disabled="saving" placeholder="请输入分数" class="score-input" @change="validationMessage = ''" />
            </div>
          </section>
        </div>
      </template>
    </div>
  </Page>
</template>

<style scoped>
.assessment-page { width: 100%; max-width: 1200px; margin: 0 auto; padding: 28px 32px 48px; display: grid; gap: 20px; }
.assessment-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; flex-wrap: wrap; }
.assessment-header h1 { font-size: 28px; line-height: 1.25; color: #101828; margin: 12px 0 4px; overflow-wrap: anywhere; }
.assessment-header p { color: #667085; margin: 0; }
.back-button { padding: 0; }
.assessment-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.score-summary { display: flex; gap: 32px; align-items: center; flex-wrap: wrap; padding: 18px 0; border-top: 1px solid #e4e7ec; border-bottom: 1px solid #e4e7ec; }
.score-summary > div { display: grid; gap: 3px; }
.score-summary span { color: #667085; }
.score-summary strong { font-size: 23px; font-variant-numeric: tabular-nums; }
.score-summary small { font-size: 14px; font-weight: normal; color: #667085; }
.score-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 28px; }
.score-panel { min-width: 0; border-bottom: 1px solid #e4e7ec; padding: 20px 0 24px; }
.score-panel__heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 18px; }
.score-panel h2 { font-size: 17px; font-weight: 600; margin: 0; }
.score-panel label { display: block; margin-bottom: 8px; color: #344054; }
.score-panel p { font-size: 13px; color: #667085; margin: 8px 0 0; }
.score-input { width: min(100%, 240px); }
.growth-field + .growth-field { margin-top: 20px; }
@media (max-width: 760px) { .assessment-page { padding: 20px 16px 36px; } .score-grid { grid-template-columns: 1fr; } .assessment-actions { width: 100%; } }
</style>
