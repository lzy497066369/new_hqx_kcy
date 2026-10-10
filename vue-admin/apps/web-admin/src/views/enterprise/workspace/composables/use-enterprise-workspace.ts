import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getBaseProfileMissing, useServiceJourney } from '@vben/common-ui';
import {
  getEnterpriseWorkspaceCandidateProjectsApi,
  getEnterpriseWorkspaceDeclarationDetailApi,
  getEnterpriseWorkspaceDeclarationsApi,
  getEnterpriseWorkspaceSummaryApi,
} from '#/api';
import { useEnterpriseContextStore } from '#/store';

export function useEnterpriseWorkspace() {
  const route = useRoute();
  const router = useRouter();
  const enterpriseContextStore = useEnterpriseContextStore();
  const enterpriseId = computed(() => String(route.params.enterpriseId ?? ''));
  const journey = useServiceJourney({
    scopeId: enterpriseId,
    preferredId: computed(() =>
      typeof route.query.declarationId === 'string'
        ? route.query.declarationId
        : '',
    ),
    async loadOverview(scopeId) {
      const [summary, projects, declarations] = await Promise.all([
        getEnterpriseWorkspaceSummaryApi(scopeId),
        getEnterpriseWorkspaceCandidateProjectsApi(scopeId),
        getEnterpriseWorkspaceDeclarationsApi(scopeId),
      ]);
      return {
        context: summary,
        overview: {
          enterpriseId: summary.profile.id,
          baseMissing: getBaseProfileMissing(summary.profile),
          profileItems: summary.moduleStats,
          completedModules: summary.metrics.completedModules,
          totalModules: summary.metrics.totalModules,
          candidateCount: projects.length,
          declarations,
        },
      };
    },
    async loadDetail(scopeId, declaration) {
      return getEnterpriseWorkspaceDeclarationDetailApi(
        scopeId,
        declaration.id,
      );
    },
  });
  watch(journey.context, (summary) => {
    if (summary)
      enterpriseContextStore.setCurrentEnterprise({
        id: summary.profile.id,
        name: summary.profile.name,
      });
  });
  async function backToEnterpriseList() {
    await router.push({ name: 'EnterpriseProfileList' });
  }
  return {
    backToEnterpriseList,
    enterpriseId,
    ...journey,
    summary: journey.context,
  };
}
