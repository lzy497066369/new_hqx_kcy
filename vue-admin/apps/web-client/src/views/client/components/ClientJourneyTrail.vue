<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ServiceJourneyTrail } from '@vben/common-ui';
import type { JourneyStageKey } from '@vben/common-ui';
import { resolveJourneyRoute } from './journey-navigation';
const props = defineProps<{ stage?: JourneyStageKey; status?: string }>();
const router = useRouter();
const route = useRoute();
const stage = computed<JourneyStageKey>(() => {
  if (props.stage) return props.stage;
  if (route.name === 'ClientMyProjectDetail') {
    if (['approved', 'completed', 'cancelled'].includes(props.status ?? ''))
      return 'results';
    return ['reviewing', 'submitted', 'rejected'].includes(props.status ?? '')
      ? 'review'
      : 'materials';
  }
  if (route.name === 'ClientProjectDetail') return 'declaration';
  if (
    route.name === 'ClientProjectList' ||
    route.name === 'ClientPolicyLibrary'
  )
    return 'policy';
  if (route.name === 'ClientMyProjectList') return 'declaration';
  if (
    ['ClientCompany', 'ClientCompanyProfile', 'ClientEnterprise'].includes(
      String(route.name),
    )
  )
    return 'profile';
  return 'data';
});
async function back() {
  const name = resolveJourneyRoute(router, 'ClientHome');
  if (!name) return;
  await router.push({
    name,
    query:
      route.name === 'ClientMyProjectDetail'
        ? { declarationId: String(route.params.id) }
        : undefined,
  });
}
</script>
<template><ServiceJourneyTrail :stage="stage" :show-profile-step="false" back-label="返回总览 →" @back="back" /></template>
