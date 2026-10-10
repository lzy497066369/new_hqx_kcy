<script setup lang="ts">
import { computed } from 'vue';

import { Button, Card, Descriptions, DescriptionsItem, Empty, Tag } from 'antdv-next';

import type { ClientDeclarationApi } from '#/api/client';

defineOptions({ name: 'DeclarationSchemeSummaryPanel' });

interface Props {
  declaration: ClientDeclarationApi.DeclarationItem;
  schemeSyncing?: boolean;
  showApplyCurrentScheme?: boolean;
}

const props = defineProps<Props>();

const showCurrentMatchedScheme = computed(
  () => Boolean(
    props.declaration.matchedScheme
      && props.declaration.matchedScheme.id !== props.declaration.appliedScheme?.id,
  ),
);

const emit = defineEmits<{
  applyCurrentScheme: [];
}>();
</script>

<template>
  <Card :bordered="false" title="方案与准入">
    <Descriptions :column="1" bordered size="small">
      <DescriptionsItem label="已应用方案">
        <template v-if="declaration.appliedScheme">
          {{ declaration.appliedScheme.schemeName }}
          <Tag class="ml-2" color="blue">{{ declaration.appliedScheme.version }}</Tag>
        </template>
        <span v-else class="text-gray-500">尚未应用方案</span>
      </DescriptionsItem>
      <DescriptionsItem v-if="showCurrentMatchedScheme" label="当前可匹配方案">
        <template v-if="declaration.matchedScheme">
          {{ declaration.matchedScheme.schemeName }}
          <Tag class="ml-2" color="blue">{{ declaration.matchedScheme.version }}</Tag>
          <span class="ml-2 text-gray-500">{{ declaration.matchedScheme.regionName }}</span>
        </template>
        <span v-else class="text-gray-500">当前申报地区暂无可用方案</span>
      </DescriptionsItem>
      <DescriptionsItem v-if="declaration.qualification" label="准入状态">
        <Tag :color="declaration.qualification.status === 'eligible' ? 'green' : 'orange'">
          {{ declaration.qualification.status === 'eligible' ? '已满足' : '存在缺口' }}
        </Tag>
      </DescriptionsItem>
    </Descriptions>

    <div v-if="declaration.qualification?.missing.length" class="declaration-scheme-summary-panel__missing">
      <span v-for="item in declaration.qualification.missing" :key="item">{{ item }}</span>
    </div>

    <Button
      v-if="showApplyCurrentScheme"
      class="mt-3"
      :loading="schemeSyncing"
      type="primary"
      @click="emit('applyCurrentScheme')"
    >
      应用当前方案
    </Button>

    <Empty
      v-if="!declaration.appliedScheme && !declaration.matchedScheme"
      class="declaration-scheme-summary-panel__empty"
      description="当前暂无可用申报方案"
    />
  </Card>
</template>

<style scoped>
.declaration-scheme-summary-panel__missing {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  color: #ad6800;
}

.declaration-scheme-summary-panel__empty {
  margin-top: 16px;
}
</style>
