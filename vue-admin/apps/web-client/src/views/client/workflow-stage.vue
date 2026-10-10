<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { Button, Card, Empty, Steps } from 'antdv-next';
import { IconifyIcon } from '@vben/icons';

import { useClientEnterpriseStore } from '#/store';

defineOptions({ name: 'ClientWorkflowStage' });
type Stage = 'materials' | 'export' | 'archive';
const props = defineProps<{ stage: Stage }>();
const router = useRouter();
const store = useClientEnterpriseStore();
const stageMap = {
  materials: { title: '材料准备', eyebrow: '申报流程 03', description: '根据当前申报项目整理、上传并核对申报材料。', action: '进入申报列表' },
  export: { title: '材料导出', eyebrow: '申报流程 04', description: '确认材料完整后，导出本次申报所需的标准材料包。', action: '进入申报列表' },
  archive: { title: '申报结果归档', eyebrow: '申报流程 05', description: '归档已提交项目的结果、通知和最终材料，形成企业申报记录。', action: '查看申报记录' },
} as const;
const current = computed(() => stageMap[props.stage]);
const steps = [
  { title: '资料补齐' },
  { title: '创建申报' },
  { title: '材料准备' },
  { title: '材料导出' },
  { title: '结果归档' },
];
function goToDeclarations() { void router.push({ name: 'ClientDeclaration' }); }
</script>

<template>
  <main class="workflow-page">
    <header class="workflow-page__header">
      <div>
        <span class="eyebrow">{{ current.eyebrow }}</span>
        <h1>{{ current.title }}</h1>
        <p>{{ current.description }}</p>
      </div>
      <Button type="primary" @click="goToDeclarations"><IconifyIcon icon="lucide:arrow-right" />{{ current.action }}</Button>
    </header>
    <Card class="workflow-page__progress" title="企业申报五步流程">
      <Steps :current="props.stage === 'materials' ? 2 : props.stage === 'export' ? 3 : 4" :items="steps" />
    </Card>
    <Card class="workflow-page__empty">
      <Empty v-if="!store.hasCompanies" description="当前账号还没有可访问企业，请联系总负责人分发企业档案" />
      <div v-else class="workflow-page__content">
        <div class="workflow-icon"><IconifyIcon :icon="props.stage === 'archive' ? 'lucide:archive' : props.stage === 'export' ? 'lucide:file-output' : 'lucide:files'" /></div>
        <h2>{{ current.title }}</h2>
        <p>当前企业：{{ store.currentCompanyName || '未选择企业' }}</p>
        <Button @click="goToDeclarations">打开我的申报</Button>
      </div>
    </Card>
  </main>
</template>

<style scoped>
.workflow-page { display: grid; gap: 24px; max-width: 1440px; margin: 0 auto; padding: 28px 32px 40px; }
.workflow-page__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.eyebrow { color: #2563eb; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
h1 { margin: 7px 0 8px; color: #101828; font-size: 30px; }
.workflow-page__header p { margin: 0; color: #667085; }
.workflow-page__progress :deep(.ant-card-body) { padding: 26px 22px; }
.workflow-page__empty :deep(.ant-card-body) { min-height: 300px; display: grid; place-items: center; }
.workflow-page__content { display: grid; justify-items: center; gap: 10px; text-align: center; }
.workflow-page__content h2 { margin: 8px 0 0; color: #101828; }
.workflow-page__content p { margin: 0 0 8px; color: #667085; }
.workflow-icon { display: grid; place-items: center; width: 72px; height: 72px; border-radius: 20px; color: #2563eb; background: #eff6ff; font-size: 32px; }
@media (max-width: 860px) { .workflow-page { padding: 20px 16px 32px; } .workflow-page__header { flex-direction: column; } }
</style>
