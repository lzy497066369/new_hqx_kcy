<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ServiceJourneyTrail } from '@vben/common-ui';
import type { JourneyStageKey } from '@vben/common-ui';
const props = defineProps<{
  enterpriseId: string;
  stage?: JourneyStageKey;
  status?: string;
}>();
const route = useRoute();
const router = useRouter();
const stage = computed<JourneyStageKey>(() => {
  if (props.stage) return props.stage;
  if (['approved', 'completed', 'cancelled'].includes(props.status ?? ''))
    return 'results';
  return ['reviewing', 'submitted', 'rejected'].includes(props.status ?? '')
    ? 'review'
    : 'materials';
});
async function back() {
  if (!props.enterpriseId) return;
  await router.push({
    name: 'EnterpriseWorkspace',
    params: { enterpriseId: props.enterpriseId },
    query: route.params.declarationId
      ? { declarationId: String(route.params.declarationId) }
      : undefined,
  });
}
</script>
<template>
  <ServiceJourneyTrail v-if="enterpriseId" :stage="stage" @back="back" />
</template>
