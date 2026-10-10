import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getBaseProfileMissing, useServiceJourney } from '@vben/common-ui';
import type { JourneyTarget } from '@vben/common-ui';
import {
  getClientDeclarationDetailApi,
  getClientDeclarationMaterialReadinessApi,
  getClientDeclarationsApi,
  getClientDeclareProjectsApi,
  getClientEnterpriseProfileApi,
  getClientEnterpriseProfileStatsApi,
} from '#/api/client';
import { useClientEnterpriseStore } from '#/store';
import { resolveJourneyRoute } from '../../components/journey-navigation';
import { message } from 'antdv-next';

const moduleRoutes: Record<string, string> = {
  basic: 'ClientCompanyBasic',
  finance: 'ClientCompanyTax',
  employee: 'ClientCompanyEmployees',
  property: 'ClientCompanyProperty',
  contract: 'ClientCompanyContract',
  document: 'ClientCompanyDocument',
  certificate: 'ClientCompanyCertificates',
  photo: 'ClientCompanyPhotos',
  account: 'ClientCompanyAccount',
};
export function useClientJourney() {
  const store = useClientEnterpriseStore();
  const router = useRouter();
  const route = useRoute();
  const journey = useServiceJourney({
    preferredId: computed(() =>
      typeof route.query.declarationId === 'string'
        ? route.query.declarationId
        : '',
    ),
    scopeId: computed(() => store.currentCompanyId),
    async loadOverview(scopeId) {
      const [profile, stats, projects, declarations] = await Promise.all([
        getClientEnterpriseProfileApi(),
        getClientEnterpriseProfileStatsApi(),
        getClientDeclareProjectsApi(),
        getClientDeclarationsApi(),
      ]);
      if (
        profile.id !== scopeId ||
        stats.enterpriseId !== scopeId ||
        declarations.items.some((item) => item.companyId !== scopeId)
      ) {
        throw new Error('当前企业已切换，请重新加载服务进度');
      }
      return {
        context: profile,
        overview: {
          enterpriseId: scopeId,
          baseMissing: getBaseProfileMissing(profile),
          profileItems: stats.items,
          completedModules: stats.completedModules,
          totalModules: stats.totalModules,
          candidateCount: projects.total,
          declarations: declarations.items.map((item) => ({
            ...item,
            updatedAt: item.updateTime,
          })),
        },
      };
    },
    async loadDetail(scopeId, declaration) {
      const [record, readiness] = await Promise.all([
        getClientDeclarationDetailApi(declaration.id),
        getClientDeclarationMaterialReadinessApi(declaration.id),
      ]);
      if (record.companyId !== scopeId || readiness.enterpriseId !== scopeId)
        throw new Error('企业上下文已变化，请重试材料核验');
      return { qualification: record.qualification, materialCheck: readiness };
    },
  });
  async function go(name: string, query?: Record<string, string>) {
    const resolved = resolveJourneyRoute(router, name);
    if (!resolved) {
      message.warning('当前账号暂无该功能入口，请联系管理员检查菜单配置');
      return;
    }
    await router.push({ name: resolved, query });
  }
  async function navigate(target: JourneyTarget) {
    if (!store.currentCompanyId || store.switching) return;
    if (
      ['materials', 'review', 'export', 'results', 'declaration'].includes(
        target.stage,
      ) &&
      target.declarationId
    ) {
      const name = resolveJourneyRoute(router, 'ClientMyProjectDetail');
      if (!name) {
        message.warning('当前账号暂无申报详情入口，请联系管理员检查菜单配置');
        return;
      }
      await router.push({
        name,
        params: { id: target.declarationId },
      });
      return;
    }
    if (target.stage === 'data') {
      await go(
        moduleRoutes[target.moduleKey ?? ''] ?? 'ClientCompany',
        target.tabKey ? { tab: target.tabKey } : undefined,
      );
      return;
    }
    const routes: Record<string, string> = {
      profile: 'ClientCompany',
      policy: 'ClientProjectList',
      declaration: 'ClientProjectList',
      materials: 'ClientProjectList',
      export: 'ClientMyProjectList',
      review: 'ClientMyProjectList',
      results: 'ClientMyProjectList',
    };
    await go(routes[target.stage] ?? 'ClientHome');
  }
  return { ...journey, navigate };
}
