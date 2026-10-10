<script setup lang="ts">
import type {
  ClientEnterpriseApi,
  ClientEnterpriseFinanceApi,
  ClientEnterpriseProfileStatApi,
  ClientMaterialApi,
} from '#/api/client';

import { computed, onMounted, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Progress,
  Tag,
} from 'antdv-next';

import {
  getClientFinancialDataListApi,
  getClientMaterialsApi,
} from '#/api/client';

import type { EnterpriseBasicCompleteness } from '../basic/profile-helpers';

import { normalizeMainAreas } from '../basic/profile-helpers';

defineOptions({ name: 'ClientEnterpriseProfileOverview' });

interface Props {
  basicProfile: ClientEnterpriseApi.ClientEnterpriseBasicProfile;
  companyCreditCode?: string;
  companyName: string;
  companyStatus: {
    color: string;
    label: string;
  };
  completeness: EnterpriseBasicCompleteness;
  profileStatus: {
    color: string;
    label: string;
  };
  profileStat?: ClientEnterpriseProfileStatApi.Stat | null;
  statsLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  companyCreditCode: '',
  profileStat: null,
  statsLoading: false,
});

const router = useRouter();

type EnterpriseProfileModule = {
  description: string;
  enabled: boolean;
  icon: string;
  statModuleKey: string;
  routeName?: string;
  title: string;
};

type ProfileNextAction = {
  actionText: string;
  description: string;
  key: string;
  priority: number;
  query?: Record<string, string>;
  routeName?: string;
  tagColor: string;
  tagText: string;
  title: string;
};

const summaryItems = computed(() => [
  { label: '企业名称', value: props.basicProfile.company_name || '-' },
  { label: '注册类型', value: props.basicProfile.register_type || '-' },
  { label: '法人姓名', value: props.basicProfile.le_person_name || '-' },
  { label: '联系人', value: props.basicProfile.contacts_name || '-' },
  {
    label: '股东数量',
    value: String(props.basicProfile.shareholders?.length ?? 0),
  },
  {
    label: '技术领域',
    value:
      props.basicProfile.js_areas ||
      normalizeMainAreas(props.basicProfile.main_areas).join('、') ||
      '-',
  },
]);

const modules: EnterpriseProfileModule[] = [
  {
    description: '企业信息、法人、联系人、资本与股东信息',
    enabled: true,
    icon: 'lucide:building-2',
    routeName: 'ClientCompanyBasic',
    statModuleKey: 'basic',
    title: '基本信息',
  },
  {
    description: '纳税审计文件、营收、研发费用、资产负债等财税资料',
    enabled: true,
    icon: 'lucide:receipt-text',
    routeName: 'ClientCompanyTax',
    statModuleKey: 'finance',
    title: '财税',
  },
  {
    description: '员工花名册、学历职称、研发人员等高企申报口径资料',
    enabled: true,
    icon: 'lucide:users',
    routeName: 'ClientCompanyEmployees',
    statModuleKey: 'employee',
    title: '员工',
  },
  {
    description: 'IP、RD、PS、成果转化和创新证据链',
    enabled: true,
    icon: 'lucide:badge-percent',
    routeName: 'ClientCompanyProperty',
    statModuleKey: 'property',
    title: '研发与知识产权',
  },
  {
    description: '销售合同、项目合同、发票开具与支付资料',
    enabled: true,
    icon: 'lucide:file-text',
    routeName: 'ClientCompanyContract',
    statModuleKey: 'contract',
    title: '合同和发票',
  },
  {
    description: '管理制度、研发组织、成果转化相关制度文件',
    enabled: true,
    icon: 'lucide:book-text',
    routeName: 'ClientCompanyDocument',
    statModuleKey: 'document',
    title: '制度文件',
  },
  {
    description: '营业执照、行业资质、荣誉证书、体系认证等图片资料',
    enabled: true,
    icon: 'lucide:award',
    routeName: 'ClientCompanyCertificates',
    statModuleKey: 'certificate',
    title: '企业证书',
  },
  {
    description: '办公场地、培训、设备、产品等企业照片资料',
    enabled: true,
    icon: 'lucide:image',
    routeName: 'ClientCompanyPhotos',
    statModuleKey: 'photo',
    title: '照片',
  },
  {
    description: '高企、税务、软著、知识产权等企业平台账号',
    enabled: true,
    icon: 'lucide:key-round',
    routeName: 'ClientCompanyAccount',
    statModuleKey: 'account',
    title: '企业账号',
  },
];

const moduleCards = computed(() =>
  modules.map((module) => {
    const statItems =
      props.profileStat?.items.filter(
        (item) => item.moduleKey === module.statModuleKey,
      ) ?? [];
    const completedItems = statItems.filter((item) => item.isCompleted).length;
    const recordCount = statItems.reduce(
      (total, item) => total + item.recordCount,
      0,
    );
    const attachmentCount = statItems.reduce(
      (total, item) => total + item.attachmentCount,
      0,
    );
    const score =
      statItems.length > 0
        ? Math.round(
            statItems.reduce((total, item) => total + item.score, 0) /
              statItems.length,
          )
        : 0;

    return {
      ...module,
      attachmentCount,
      completedItems,
      recordCount,
      score,
      statItems,
      totalItems: statItems.length,
    };
  }),
);

const missingModules = computed(() =>
  (props.profileStat?.missingModules ?? []).map((item) => {
    const module = modules.find((entry) => entry.statModuleKey === item.key);
    return {
      key: item.key,
      name: item.name,
      routeName: module?.routeName,
    };
  }),
);

const getStatItemRecordCount = (tabKey: string) => {
  return (
    props.profileStat?.items.find((item) => item.tabKey === tabKey)?.recordCount ?? 0
  );
};

const highTechIndicators = computed(() => [
  { label: '财务年度', routeName: 'ClientCompanyTax', value: getStatItemRecordCount('financial') },
  { label: '科技人员资料', routeName: 'ClientCompanyEmployees', value: getStatItemRecordCount('employees') },
  { label: 'IP 数量', routeName: 'ClientCompanyProperty', value: getStatItemRecordCount('intellectualProperty') },
  { label: 'RD 数量', routeName: 'ClientCompanyProperty', value: getStatItemRecordCount('researchProject') },
  { label: 'PS 数量', routeName: 'ClientCompanyProperty', value: getStatItemRecordCount('productService') },
  { label: '成果转化', routeName: 'ClientCompanyProperty', value: getStatItemRecordCount('transformation') },
]);

const highTechStatusMeta = computed(() => {
  const status = props.profileStat?.highTechReadiness.status ?? 'high_risk';
  const map = {
    high_risk: { color: 'error', label: '高风险' },
    needs_completion: { color: 'warning', label: '需补齐' },
    ready: { color: 'success', label: '已齐备' },
  };
  return map[status];
});

const profileRouteNameMap: Record<string, string> = {
  account: 'ClientCompanyAccount',
  basic: 'ClientCompanyBasic',
  certificate: 'ClientCompanyCertificates',
  contract: 'ClientCompanyContract',
  document: 'ClientCompanyDocument',
  employee: 'ClientCompanyEmployees',
  finance: 'ClientCompanyTax',
  photo: 'ClientCompanyPhotos',
  property: 'ClientCompanyProperty',
};

const nextCompletionActions = computed<ProfileNextAction[]>(() => {
  const actions: ProfileNextAction[] = [
    ...(props.profileStat?.highTechReadiness.gaps ?? []).map((gap) => ({
      actionText: gap.actionText || '去企业资料补齐',
      description: gap.description,
      key: `high-tech-${gap.moduleKey}-${gap.tabKey}-${gap.itemName}`,
      priority: gap.blocking ? 1 : 2,
      query: {
        from: 'profile-next-action',
        tab: gap.tabKey,
      },
      routeName: profileRouteNameMap[gap.moduleKey] ?? 'ClientCompany',
      tagColor: gap.blocking ? 'error' : 'warning',
      tagText: gap.blocking ? '高企阻断' : '高企缺口',
      title: gap.itemName,
    })),
    ...missingModules.value.map((module) => ({
      actionText: '进入模块完善',
      description: `${module.name}还没有达到企业资料完整度要求，建议优先补齐基础记录和附件。`,
      key: `missing-module-${module.key}`,
      priority: 3,
      routeName: module.routeName,
      tagColor: 'warning',
      tagText: '缺失模块',
      title: module.name,
    })),
    ...moduleCards.value
      .filter((module) => module.enabled && module.totalItems > 0 && module.score < 80)
      .map((module) => ({
        actionText: '查看模块明细',
        description: `${module.title}当前得分 ${module.score}，建议检查缺失字段、记录数量和附件。`,
        key: `low-score-${module.statModuleKey}`,
        priority: 4,
        routeName: module.routeName,
        tagColor: 'default',
        tagText: '完整度偏低',
        title: module.title,
      })),
  ];
  const usedKeys = new Set<string>();

  return actions
    .sort((left, right) => left.priority - right.priority)
    .filter((action) => {
      const routeKey = `${action.routeName ?? ''}-${action.query?.tab ?? action.title}`;
      if (usedKeys.has(routeKey)) {
        return false;
      }
      usedKeys.add(routeKey);
      return true;
    })
    .slice(0, 6);
});

const financeRows = shallowRef<ClientEnterpriseFinanceApi.FinancialData[]>([]);
const materialRows = shallowRef<ClientMaterialApi.ClientMaterialRecord[]>([]);
const extraLoading = shallowRef(false);

const financeTrendRows = computed(() =>
  [...financeRows.value]
    .filter((row) => row.year)
    .sort((left, right) => String(left.year).localeCompare(String(right.year)))
    .slice(-3),
);

const recentMaterials = computed(() => materialRows.value.slice(0, 5));
const materialErrorCount = computed(() =>
  materialRows.value.reduce((total, item) => total + Number(item.errorCount ?? 0), 0),
);

const materialStatusMap: Record<string, { color: string; label: string }> = {
  invalid: { color: 'error', label: '失败' },
  partial: { color: 'warning', label: '部分成功' },
  uploaded: { color: 'processing', label: '已上传' },
  valid: { color: 'success', label: '成功' },
};

onMounted(loadOverviewExtra);

watch(
  () => props.companyName,
  () => {
    void loadOverviewExtra();
  },
);

function goToModule(routeName?: string) {
  if (!routeName) {
    return;
  }

  router.push({ name: routeName });
}

function goToProfileGap(gap: ClientEnterpriseProfileStatApi.HighTechReadinessGap) {
  router.push({
    name: profileRouteNameMap[gap.moduleKey] ?? 'ClientCompany',
    query: {
      from: 'high-tech-readiness',
      tab: gap.tabKey,
    },
  });
}

function goToNextAction(action: ProfileNextAction) {
  if (!action.routeName) {
    return;
  }

  router.push({
    name: action.routeName,
    query: action.query,
  });
}

async function loadOverviewExtra() {
  if (!props.companyName) {
    financeRows.value = [];
    materialRows.value = [];
    return;
  }

  extraLoading.value = true;
  try {
    const [financeResult, materials] = await Promise.all([
      getClientFinancialDataListApi(),
      getClientMaterialsApi(),
    ]);
    financeRows.value = financeResult.items;
    materialRows.value = materials;
  } catch {
    financeRows.value = [];
    materialRows.value = [];
  } finally {
    extraLoading.value = false;
  }
}

function toAmount(value: null | number | string | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const numberValue = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(numberValue) ? String(numberValue) : String(value);
}

function getMaterialStatus(status: string) {
  return materialStatusMap[status] ?? { color: 'default', label: status || '未知' };
}
</script>

<template>
  <div class="space-y-5">
    <div class="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div class="text-sm text-foreground/60">企业资料总入口</div>
          <div class="mt-2 text-2xl font-semibold">{{ companyName || '未命名企业' }}</div>
          <div class="mt-1 text-sm text-foreground/60">
            {{ companyCreditCode || '统一社会信用代码待补充' }}
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <Tag :color="companyStatus.color">{{ companyStatus.label }}</Tag>
          <Tag :color="profileStatus.color">{{ profileStatus.label }}</Tag>
        </div>
      </div>
    </div>

    <div class="grid gap-4 xl:grid-cols-4">
      <Card :loading="statsLoading" variant="borderless">
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm text-foreground/60">企业资料健康分</div>
        </div>
        <div class="mt-2 text-3xl font-semibold">
          {{ profileStat?.healthScore ?? 0 }}
        </div>
        <Progress
          class="mt-2"
          :percent="profileStat?.healthScore ?? 0"
          size="small"
          :show-info="false"
        />
      </Card>

      <Card variant="borderless">
        <div class="text-sm text-foreground/60">全模块完整率</div>
        <div class="mt-2 text-3xl font-semibold">
          {{ profileStat?.completenessRate ?? 0 }}%
        </div>
        <div class="mt-2 text-sm text-foreground/60">
          已完善 {{ profileStat?.completedModules ?? 0 }}/{{
            profileStat?.totalModules ?? 0
          }} 个资料模块
        </div>
      </Card>

      <Card variant="borderless">
        <div class="text-sm text-foreground/60">基础信息完整度</div>
        <div class="mt-2 text-3xl font-semibold">{{ completeness.percent }}%</div>
        <div class="mt-2 text-sm text-foreground/60">
          已完成 {{ completeness.completed }}/{{ completeness.total }} 个基础检查项
        </div>
      </Card>

      <Card variant="borderless">
        <div class="text-sm text-foreground/60">资料沉淀</div>
        <div class="mt-2 text-3xl font-semibold">
          {{ profileStat?.totalRecords ?? 0 }}
        </div>
        <div class="mt-2 text-sm text-foreground/60">
          有附件资料 {{ profileStat?.attachmentRecords ?? 0 }} 条
        </div>
      </Card>
    </div>

    <Card title="下一步补齐入口" variant="borderless">
      <div
        v-if="nextCompletionActions.length > 0"
        class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        <button
          v-for="action in nextCompletionActions"
          :key="action.key"
          class="rounded-lg border border-border bg-background p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
          type="button"
          @click="goToNextAction(action)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="font-medium">{{ action.title }}</div>
            <Tag :color="action.tagColor">{{ action.tagText }}</Tag>
          </div>
          <div class="mt-2 min-h-10 text-sm text-foreground/60">
            {{ action.description }}
          </div>
          <div class="mt-3 flex items-center gap-1 text-sm text-primary">
            <span>{{ action.actionText }}</span>
            <IconifyIcon icon="lucide:arrow-right" class="size-4" />
          </div>
        </button>
      </div>
      <div
        v-else
        class="rounded-lg border border-dashed border-border p-5 text-sm text-foreground/60"
      >
        当前企业资料暂无明显缺口，可以继续查看申报项目或按需补充更多附件资料。
      </div>
    </Card>

    <Card title="高企申报资料完整度" variant="borderless">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <div class="text-3xl font-semibold">
              {{ profileStat?.highTechReadiness.readinessRate ?? 0 }}%
            </div>
            <Tag :color="highTechStatusMeta.color">
              {{ highTechStatusMeta.label }}
            </Tag>
          </div>
          <div class="mt-2 text-sm text-foreground/60">
            {{
              profileStat?.highTechReadiness.summary ||
              '系统会根据财税、人员、IP、RD、PS、成果转化、合同发票和制度文件自动判断高企申报资料完整度。'
            }}
          </div>
          <div class="mt-3 text-sm text-foreground/60">
            已齐备 {{ profileStat?.highTechReadiness.readyItems ?? 0 }}/{{
              profileStat?.highTechReadiness.totalItems ?? 0
            }} 个高企关键资料项
          </div>
        </div>
        <Progress
          class="lg:w-72"
          :percent="profileStat?.highTechReadiness.readinessRate ?? 0"
          :status="
            profileStat?.highTechReadiness.status === 'high_risk'
              ? 'exception'
              : 'normal'
          "
        />
      </div>

      <div
        v-if="profileStat?.highTechReadiness.gaps.length"
        class="mt-4 grid gap-3 md:grid-cols-2"
      >
        <button
          v-for="gap in profileStat.highTechReadiness.gaps"
          :key="`${gap.moduleKey}-${gap.tabKey}-${gap.itemName}`"
          class="rounded-lg border border-warning/30 bg-warning/10 p-3 text-left transition hover:border-warning/60 hover:bg-warning/15"
          type="button"
          @click="goToProfileGap(gap)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="font-medium">{{ gap.itemName }}</div>
            <Tag :color="gap.blocking ? 'error' : 'warning'">
              {{ gap.blocking ? '阻断项' : '提醒项' }}
            </Tag>
          </div>
          <div class="mt-2 text-sm text-foreground/60">
            {{ gap.description }}
          </div>
          <div class="mt-2 text-sm text-primary">{{ gap.actionText }}</div>
        </button>
      </div>
    </Card>

    <Card
      v-if="missingModules.length > 0"
      title="待完善模块"
      variant="borderless"
    >
      <div class="flex flex-wrap gap-2">
        <button
          v-for="module in missingModules"
          :key="module.key"
          class="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-sm text-warning transition hover:border-warning/60 hover:bg-warning/15"
          type="button"
          @click="goToModule(module.routeName)"
        >
          {{ module.name }}
        </button>
      </div>
    </Card>

    <Card title="高企关键指标" variant="borderless">
      <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <button
          v-for="indicator in highTechIndicators"
          :key="indicator.label"
          class="rounded-lg border border-border bg-background p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
          type="button"
          @click="goToModule(indicator.routeName)"
        >
          <div class="text-sm text-foreground/60">{{ indicator.label }}</div>
          <div class="mt-2 text-2xl font-semibold">{{ indicator.value }}</div>
        </button>
      </div>
    </Card>

    <div class="grid gap-4 xl:grid-cols-2">
      <Card :loading="extraLoading" title="财税趋势" variant="borderless">
        <div
          v-if="financeTrendRows.length"
          class="grid gap-3 md:grid-cols-3"
        >
          <button
            v-for="row in financeTrendRows"
            :key="String(row.id ?? row.year)"
            class="rounded-lg border border-border bg-background p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
            type="button"
            @click="goToModule('ClientCompanyTax')"
          >
            <div class="text-sm font-medium">{{ row.year }}</div>
            <div class="mt-3 text-xs text-foreground/60">销售收入</div>
            <div class="text-base font-semibold">{{ toAmount(row.xxsr) }}</div>
            <div class="mt-2 text-xs text-foreground/60">研发费用</div>
            <div class="text-base font-semibold">{{ toAmount(row.yffy) }}</div>
            <div class="mt-2 text-xs text-foreground/60">高新收入</div>
            <div class="text-base font-semibold">
              {{ toAmount(row.high_tech_income) }}
            </div>
          </button>
        </div>
        <div v-else class="rounded-lg border border-dashed border-border p-5 text-sm text-foreground/60">
          暂无财税趋势数据，导入或维护年度财务数据后可查看近三年收入、研发费用和高新收入。
        </div>
      </Card>

      <Card :loading="extraLoading" title="最近导入与错误提醒" variant="borderless">
        <div class="mb-3 flex items-center justify-between gap-3 text-sm text-foreground/60">
          <span>最近 5 条模板上传记录</span>
          <Tag :color="materialErrorCount > 0 ? 'warning' : 'success'">
            {{ materialErrorCount > 0 ? `待处理错误 ${materialErrorCount}` : '暂无错误' }}
          </Tag>
        </div>
        <div v-if="recentMaterials.length" class="space-y-2">
          <button
            v-for="material in recentMaterials"
            :key="material.id"
            class="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
            type="button"
            @click="goToModule('ClientCompanyMaterials')"
          >
            <div>
              <div class="font-medium">
                {{ material.templateName || material.fileName || '未命名材料' }}
              </div>
              <div class="mt-1 text-xs text-foreground/60">
                {{ material.uploadTime || '暂无上传时间' }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Tag v-if="Number(material.errorCount ?? 0) > 0" color="warning">
                {{ material.errorCount }} 个错误
              </Tag>
              <Tag :color="getMaterialStatus(material.status).color">
                {{ getMaterialStatus(material.status).label }}
              </Tag>
            </div>
          </button>
        </div>
        <div v-else class="rounded-lg border border-dashed border-border p-5 text-sm text-foreground/60">
          暂无导入记录，可从财税、员工、研发与知识产权模块下载模板并导入。
        </div>
      </Card>
    </div>

    <Card title="模块导航" variant="borderless">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="module in moduleCards"
          :key="module.title"
          class="rounded-lg border border-border bg-background px-4 py-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <IconifyIcon :icon="module.icon" class="size-5" />
              </div>
              <div class="font-medium">{{ module.title }}</div>
            </div>
            <Tag :color="module.enabled ? 'success' : 'default'">
              {{
                module.totalItems > 0 && module.completedItems === module.totalItems
                  ? '已完善'
                  : module.enabled
                    ? '待完善'
                    : '预留'
              }}
            </Tag>
          </div>
          <div class="mt-3 min-h-10 text-sm text-foreground/60">
            {{ module.description }}
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-3 text-center text-xs">
            <div>
              <div class="font-semibold">{{ module.recordCount }}</div>
              <div class="mt-1 text-foreground/60">资料</div>
            </div>
            <div>
              <div class="font-semibold">{{ module.attachmentCount }}</div>
              <div class="mt-1 text-foreground/60">附件</div>
            </div>
            <div>
              <div class="font-semibold">{{ module.score }}</div>
              <div class="mt-1 text-foreground/60">得分</div>
            </div>
          </div>
          <div
            v-if="module.totalItems > 0"
            class="mt-3 text-xs text-foreground/60"
          >
            子项完成 {{ module.completedItems }}/{{ module.totalItems }}
          </div>
          <Button
            class="mt-4"
            :disabled="!module.enabled"
            @click="goToModule(module.routeName)"
          >
            {{ module.enabled ? '进入模块' : '规划中' }}
          </Button>
        </div>
      </div>
    </Card>

    <Card title="基础资料预览" variant="borderless">
      <Descriptions bordered :column="{ md: 2, sm: 1, xs: 1 }">
        <DescriptionsItem
          v-for="item in summaryItems"
          :key="item.label"
          :label="item.label"
        >
          {{ item.value }}
        </DescriptionsItem>
      </Descriptions>
      <div class="mt-4">
        <Button type="primary" @click="goToModule('ClientCompanyBasic')">
          <IconifyIcon icon="lucide:pen-square" class="size-4" />
          维护基础资料
        </Button>
      </div>
    </Card>
  </div>
</template>
