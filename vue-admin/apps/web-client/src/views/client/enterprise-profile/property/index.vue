<script setup lang="ts">
import type {
  ClientEnterpriseContractApi,
  ClientEnterprisePropertyApi,
  ClientMaterialApi,
} from '#/api/client';
import type {
  EnterpriseOption,
  EnterpriseRecordTab,
  EnterpriseTableColumn,
} from '../components/table-types';

import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Button, Modal } from 'antdv-next';
import { message } from 'antdv-next';

import {
  createClientIntellectualPropertyApi,
  createClientProductServiceApi,
  createClientResearchProjectApi,
  createClientTransformationApi,
  clearAllPropertyRecordsApi,
  clearClientIntellectualPropertyApi,
  clearClientProductServiceApi,
  clearClientResearchProjectApi,
  clearClientTransformationRecordsApi,
  classifyClientPropertyTechnologyFieldsApi,
  deleteClientIntellectualPropertyApi,
  deleteClientIpRecognitionDraftApi,
  deleteClientProductServiceApi,
  deleteClientProductServiceGenerationDraftApi,
  deleteClientResearchGenerationDraftApi,
  deleteClientResearchProjectApi,
  deleteClientTransformationApi,
  deleteClientTransformationGenerationDraftApi,
  downloadClientMaterialTemplateApi,
  getClientContractListApi,
  getClientInvoiceListApi,
  getClientIpRecognitionDraftsApi,
  getClientMaterialErrorsApi,
  getClientIntellectualPropertyListApi,
  getClientProductServiceGenerationDraftsApi,
  getClientPropertyAiReadinessApi,
  getClientPropertyEvidenceSummaryApi,
  getClientProductServiceListApi,
  getClientResearchGenerationDraftsApi,
  getClientResearchProjectListApi,
  getClientTransformationGenerationDraftsApi,
  getClientTransformationListApi,
  repairClientPropertyEvidenceRelationsApi,
  updateClientIntellectualPropertyApi,
  updateClientProductServiceApi,
  updateClientResearchProjectApi,
  updateClientTransformationApi,
  uploadClientMaterialApi,
} from '#/api/client';
import { useClientEnterpriseStore } from '#/store';

import EnterpriseRecordModule from '../modules/EnterpriseRecordModule.vue';
import AiTaskAuditModal from './components/AiTaskAuditModal.vue';
import EvidenceTopologyPanel from './components/EvidenceTopologyPanel.vue';
import IpPdfImportModal from './components/IpPdfImportModal.vue';
import ProductServiceBatchGenerateModal from './components/ProductServiceBatchGenerateModal.vue';
import ResearchProjectAiGenerateModal from './components/ResearchProjectAiGenerateModal.vue';
import TransformationBatchGenerateModal from './components/TransformationBatchGenerateModal.vue';
import {
  intellectualPropertyColumns,
  productServiceColumns,
  researchProjectColumns,
  transformationColumns,
} from './data';

defineOptions({ name: 'ClientEnterpriseProfileProperty' });

const store = useClientEnterpriseStore();
const route = useRoute();
const activeKey = shallowRef('intellectualProperty');
const loading = shallowRef(false);
const aiTaskAuditOpen = shallowRef(false);
const evidenceRepairing = shallowRef(false);
const techFieldClassifying = shallowRef(false);
const importing = shallowRef(false);
const ipImportOpen = shallowRef(false);
const productServiceGenerateOpen = shallowRef(false);
const researchGenerateOpen = shallowRef(false);
const transformationGenerateOpen = shallowRef(false);
const topologyOpen = shallowRef(false);
const errorMessage = shallowRef('');
const fileInputRef = shallowRef<HTMLInputElement | null>(null);
const clearingActiveTab = shallowRef(false);
const clearingAllTabs = shallowRef(false);
const importErrors = ref<ClientMaterialApi.ClientMaterialError[]>([]);
const importResultOpen = shallowRef(false);
const importResultTitle = shallowRef('导入结果');
const importResultDescription = shallowRef('');
const intellectualPropertyRows = ref<
  ClientEnterprisePropertyApi.IntellectualProperty[]
>([]);
const researchProjectRows = ref<ClientEnterprisePropertyApi.ResearchProject[]>(
  [],
);
const productServiceRows = ref<ClientEnterprisePropertyApi.ProductService[]>([]);
const transformationRows = ref<ClientEnterprisePropertyApi.Transformation[]>([]);
const contractRows = ref<ClientEnterpriseContractApi.Contract[]>([]);
const invoiceRows = ref<ClientEnterpriseContractApi.Invoice[]>([]);
const aiReadiness =
  ref<ClientEnterprisePropertyApi.PropertyAiReadiness | null>(null);
const evidenceSummary =
  ref<ClientEnterprisePropertyApi.PropertyEvidenceSummary | null>(null);

const hasCompany = computed(() => Boolean(store.currentCompany));
const moduleError = computed(() => errorMessage.value || store.errorMessage);
const aiReadinessStatus = computed(() => {
  if (!aiReadiness.value) {
    return {
      label: 'AI 状态加载中',
      tone: 'muted',
    };
  }

  const map = {
    ai_only: {
      label: 'AI 已就绪',
      tone: 'success',
    },
    fallback_only: {
      label: '需人工核对',
      tone: 'warning',
    },
  } as const;

  return map[aiReadiness.value.mode];
});
const aiReadinessMessages = computed(() =>
  aiReadiness.value
    ? [aiReadiness.value.ai.message]
    : ['正在读取 AI 配置状态'],
);
const evidenceChecklist = computed(() => evidenceSummary.value?.checklist ?? []);
const evidenceChecklistPassedCount = computed(
  () =>
    evidenceChecklist.value.filter((item) => item.status === 'passed').length,
);
const evidenceChecklistSummary = computed(() =>
  evidenceChecklist.value.length > 0
    ? `${evidenceChecklistPassedCount.value}/${evidenceChecklist.value.length} 项通过`
    : '等待证据链验收数据',
);
const relationOptions = computed(() => ({
  contract: toOptions(contractRows.value, 'ht_name', 'ht_num'),
  invoice: toOptions(invoiceRows.value, 'fp_num'),
  ip: toIpOptions(intellectualPropertyRows.value),
  ps: toOptions(
    sortPropertyRowsByIpCode(productServiceRows.value, 'product_service'),
    'ps_name',
    'ps_code',
  ),
  rd: toOptions(
    sortPropertyRowsByIpCode(researchProjectRows.value, 'research_project'),
    'ky_project_name',
    'ky_project_num',
  ),
  transformation: toOptions(
    sortPropertyRowsByIpCode(transformationRows.value, 'transformation'),
    'transformation_name',
    'transformation_code',
  ),
}));
const intellectualPropertyColumnsWithOptions = computed(() =>
  withRelationOptions(intellectualPropertyColumns, {
    related_ps_ids: relationOptions.value.ps,
    related_rd_ids: relationOptions.value.rd,
    related_transformation_ids: relationOptions.value.transformation,
  }),
);
const researchProjectColumnsWithOptions = computed(() =>
  withRelationOptions(researchProjectColumns, {
    related_ip_ids: relationOptions.value.ip,
    related_ps_ids: relationOptions.value.ps,
    related_transformation_ids: relationOptions.value.transformation,
  }),
);
const productServiceColumnsWithOptions = computed(() =>
  withRelationOptions(productServiceColumns, {
    related_contract_ids: relationOptions.value.contract,
    related_invoice_ids: relationOptions.value.invoice,
    related_ip_ids: relationOptions.value.ip,
    related_rd_ids: relationOptions.value.rd,
    related_transformation_ids: relationOptions.value.transformation,
  }),
);
const transformationColumnsWithOptions = computed(() =>
  withRelationOptions(transformationColumns, {
    related_contract_ids: relationOptions.value.contract,
    related_invoice_ids: relationOptions.value.invoice,
    related_ip_ids: relationOptions.value.ip,
    related_ps_ids: relationOptions.value.ps,
    related_rd_ids: relationOptions.value.rd,
  }),
);
const tabs = computed<EnterpriseRecordTab[]>(() => [
  {
    columns: intellectualPropertyColumnsWithOptions.value,
    description: '维护专利、软著、外观设计等知识产权证书和状态。',
    emptyDescription: '暂无知识产权资料',
    key: 'intellectualProperty',
    records: sortPropertyRowsByIpCode(
      intellectualPropertyRows.value,
      'intellectual_property',
    ),
    title: '知识产权',
  },
  {
    columns: transformationColumnsWithOptions.value,
    description: '记录成果转化年度、方式、收入和证明材料。',
    emptyDescription: '暂无成果转化资料',
    key: 'transformation',
    records: sortPropertyRowsByIpCode(
      transformationRows.value,
      'transformation',
    ),
    title: '成果转化',
  },
  {
    columns: researchProjectColumnsWithOptions.value,
    description: '维护研发项目立项、费用、核心技术、创新点和阶段成果。',
    emptyDescription: '暂无研发项目资料',
    key: 'researchProject',
    records: sortPropertyRowsByIpCode(
      researchProjectRows.value,
      'research_project',
    ),
    title: '研发项目 RD',
  },
  {
    columns: productServiceColumnsWithOptions.value,
    description: '沉淀高新技术产品/服务、收入口径和证明材料。',
    emptyDescription: '暂无高新产品/服务资料',
    key: 'productService',
    records: sortPropertyRowsByIpCode(
      productServiceRows.value,
      'product_service',
    ),
    title: '高新产品 PS',
  },
]);

watch(
  () => route.query.tab,
  (tab) => {
    const tabKey = Array.isArray(tab) ? tab[0] : tab;
    if (typeof tabKey !== 'string') {
      return;
    }
    if (tabs.value.some((item) => item.key === tabKey)) {
      activeKey.value = tabKey;
    }
  },
  { immediate: true },
);

const localEvidenceChains = computed(() =>
  sortPropertyRowsByIpCode(
    researchProjectRows.value,
    'research_project',
  ).map((rd) => {
    const rdId = String(rd.id ?? '');
    const ipIds = parseRelationIds(rd.related_ip_ids);
    const psIds = uniqueStrings([
      ...parseRelationIds(rd.related_ps_ids),
      ...productServiceRows.value
        .filter((ps) => includesRelationId(ps.related_rd_ids, rdId))
        .map((ps) => String(ps.id ?? ''))
        .filter(Boolean),
    ]);
    const transformationIds = uniqueStrings([
      ...parseRelationIds(rd.related_transformation_ids),
      ...transformationRows.value
        .filter((item) => {
          const transformationIpIds = parseRelationIds(item.related_ip_ids);
          return (
            includesRelationId(item.related_rd_ids, rdId) ||
            transformationIpIds.some((id) => ipIds.includes(id))
          );
        })
        .map((item) => String(item.id ?? ''))
        .filter(Boolean),
    ]);

    return {
      gaps: [
        ...(ipIds.length > 0 ? [] : ['未关联 IP']),
        ...(psIds.length > 0 ? [] : ['未关联 PS']),
        ...(transformationIds.length > 0 ? [] : ['未关联成果']),
      ],
      id: String(rd.id ?? rd.ky_project_num ?? rd.ky_project_name),
      ip: findRelatedNamesByIds(
        sortRelationIdsByIpCode(ipIds),
        intellectualPropertyRows.value,
        'soft_work_name',
      ),
      name: rd.ky_project_name || rd.ky_project_num || '未命名RD项目',
      number: rd.ky_project_num ?? null,
      ps: findRelatedNamesByIds(
        sortRelationIdsByIpCode(psIds, productServiceRows.value, 'product_service'),
        productServiceRows.value,
        'ps_name',
      ),
      transformation: findRelatedNamesByIds(
        sortRelationIdsByIpCode(
          transformationIds,
          transformationRows.value,
          'transformation',
        ),
        transformationRows.value,
        'transformation_name',
      ),
    };
  }),
);

const evidenceChains = computed(() => {
  if (!evidenceSummary.value) {
    return localEvidenceChains.value;
  }

  return evidenceSummary.value.chains.map((chain) => ({
    ...chain,
    ip: chain.ip.map(formatEvidenceNodeLabel),
    ps: chain.ps.map(formatEvidenceNodeLabel),
    transformation: chain.transformation.map(formatEvidenceNodeLabel),
  }));
});

function formatEvidenceNodeLabel(
  item: ClientEnterprisePropertyApi.PropertyEvidenceNode,
) {
  return item.number ? `${item.number} - ${item.name}` : item.name;
}

const localEvidenceGaps = computed(() => [
  ...localEvidenceChains.value.flatMap((chain) =>
    chain.gaps.map((gap) => `${chain.name} ${gap}`),
  ),
  ...productServiceRows.value.flatMap((ps) =>
    [
      hasRelationValue(ps.related_rd_ids)
        ? ''
        : `${ps.ps_name || '未命名 PS'} 未关联 RD`,
      hasRelationValue(ps.related_ip_ids)
        ? ''
        : `${ps.ps_name || '未命名 PS'} 未关联 IP`,
      hasRelationValue(ps.related_transformation_ids)
        ? ''
        : `${ps.ps_name || '未命名 PS'} 未关联成果转化`,
      hasRelationValue(ps.related_contract_ids) ||
      hasRelationValue(ps.related_invoice_ids)
        ? ''
        : `${ps.ps_name || '未命名 PS'} 未关联合同/发票证明`,
    ].filter(Boolean),
  ),
  ...transformationRows.value
    .filter((item) => !hasRelationValue(item.related_ip_ids))
    .map((item) => `${item.transformation_name || '未命名成果'} 未关联 IP`),
  ...transformationRows.value
    .filter(
      (item) =>
        !hasRelationValue(item.related_contract_ids) &&
        !hasRelationValue(item.related_invoice_ids),
    )
    .map((item) => `${item.transformation_name || '未命名成果'} 未关联合同/发票证明`),
  ...intellectualPropertyRows.value
    .filter((ip) => {
      const ipId = String(ip.id ?? '');
      if (!ipId) {
        return false;
      }
      return ![
        ...researchProjectRows.value.map((rd) => rd.related_ip_ids),
        ...productServiceRows.value.map((ps) => ps.related_ip_ids),
        ...transformationRows.value.map((item) => item.related_ip_ids),
      ].some((idsText) => includesRelationId(idsText, ipId));
    })
    .map((ip) => `${ip.soft_work_name || '未命名 IP'} 尚未进入 RD/PS/成果链路`),
]);

const evidenceGaps = computed(
  () => evidenceSummary.value?.gaps ?? localEvidenceGaps.value,
);

const localPropertyReadinessStats = computed(() => {
  const rdTotal = researchProjectRows.value.length;
  const psTotal = productServiceRows.value.length;
  const transformationTotal = transformationRows.value.length;
  const rdWithIp = researchProjectRows.value.filter((item) =>
    hasRelationValue(item.related_ip_ids),
  ).length;
  const psWithRd = productServiceRows.value.filter((item) =>
    hasRelationValue(item.related_rd_ids),
  ).length;
  const psWithIp = productServiceRows.value.filter((item) =>
    hasRelationValue(item.related_ip_ids),
  ).length;
  const transformationWithIp = transformationRows.value.filter((item) =>
    hasRelationValue(item.related_ip_ids),
  ).length;
  const ipUsedInChain = intellectualPropertyRows.value.filter((ip) => {
    const ipId = String(ip.id ?? '');
    return (
      Boolean(ipId) &&
      [
        ...researchProjectRows.value.map((rd) => rd.related_ip_ids),
        ...productServiceRows.value.map((ps) => ps.related_ip_ids),
        ...transformationRows.value.map((item) => item.related_ip_ids),
      ].some((idsText) => includesRelationId(idsText, ipId))
    );
  }).length;
  const completeRdChains = localEvidenceChains.value.filter(
    (item) => item.gaps.length === 0,
  ).length;
  const readinessItems = [
    rdTotal === 0 ? 0 : rdWithIp / rdTotal,
    psTotal === 0 ? 0 : psWithRd / psTotal,
    psTotal === 0 ? 0 : psWithIp / psTotal,
    transformationTotal === 0 ? 0 : transformationWithIp / transformationTotal,
    intellectualPropertyRows.value.length === 0
      ? 0
      : ipUsedInChain / intellectualPropertyRows.value.length,
    localEvidenceChains.value.length === 0
      ? 0
      : completeRdChains / localEvidenceChains.value.length,
  ];
  const readinessPercent = Math.round(
    (readinessItems.reduce((sum, item) => sum + item, 0) /
      readinessItems.length) *
      100,
  );

  return {
    completeRdChains,
    gapTotal: evidenceGaps.value.length,
    intellectualPropertyTotal: intellectualPropertyRows.value.length,
    ipUsedInChain,
    psTotal,
    psWithIp,
    psWithRd,
    readinessPercent,
    rdTotal,
    rdWithIp,
    transformationTotal,
    transformationWithIp,
  };
});

const propertyReadinessStats = computed(
  () => evidenceSummary.value?.stats ?? localPropertyReadinessStats.value,
);
const totalPropertyRecordCount = computed(
  () =>
    intellectualPropertyRows.value.length +
    researchProjectRows.value.length +
    productServiceRows.value.length +
    transformationRows.value.length,
);

function getEvidenceChecklistStatusText(
  status: ClientEnterprisePropertyApi.PropertyEvidenceChecklistItem['status'],
) {
  const labels: Record<
    ClientEnterprisePropertyApi.PropertyEvidenceChecklistItem['status'],
    string
  > = {
    missing: '缺失',
    passed: '通过',
    warning: '待完善',
  };
  return labels[status];
}

function getEvidenceChecklistStatusClass(
  status: ClientEnterprisePropertyApi.PropertyEvidenceChecklistItem['status'],
) {
  return `evidence-chain__check-status--${status}`;
}

const activeTemplateId = computed(() => {
  const map: Record<string, string> = {
    intellectualProperty: 'ip-info',
    productService: 'ps-info',
    researchProject: 'rd-info',
    transformation: 'transformation-info',
  };
  return map[activeKey.value] ?? 'ip-info';
});

const activeTemplateFileName = computed(() => {
  const map: Record<string, string> = {
    intellectualProperty: '知识产权模板.csv',
    productService: '高新产品PS模板.csv',
    researchProject: '研发项目RD模板.csv',
    transformation: '成果转化模板.csv',
  };
  return map[activeKey.value] ?? '研发与知识产权模板.csv';
});

onMounted(async () => {
  if (!store.initialized) {
    await store.refreshContext().catch(() => {});
  }
  await loadRecords();
});

async function loadRecords() {
  if (!store.currentCompany) {
    intellectualPropertyRows.value = [];
    researchProjectRows.value = [];
    productServiceRows.value = [];
    transformationRows.value = [];
    contractRows.value = [];
    invoiceRows.value = [];
    aiReadiness.value = null;
    evidenceSummary.value = null;
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  try {
    const [
      propertyResult,
      projectResult,
      productServiceResult,
      transformationResult,
      contractResult,
      invoiceResult,
      readinessResult,
      summaryResult,
    ] = await Promise.all([
      getClientIntellectualPropertyListApi(),
      getClientResearchProjectListApi(),
      getClientProductServiceListApi(),
      getClientTransformationListApi(),
      getClientContractListApi(),
      getClientInvoiceListApi(),
      getClientPropertyAiReadinessApi().catch(() => null),
      getClientPropertyEvidenceSummaryApi().catch(() => null),
    ]);
    intellectualPropertyRows.value = propertyResult.items;
    researchProjectRows.value = projectResult.items;
    productServiceRows.value = productServiceResult.items;
    transformationRows.value = transformationResult.items;
    contractRows.value = contractResult.items;
    invoiceRows.value = invoiceResult.items;
    aiReadiness.value = readinessResult;
    evidenceSummary.value = summaryResult;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : '研发与知识产权资料加载失败';
  } finally {
    loading.value = false;
  }
}

function invalidateEvidenceSummary() {
  evidenceSummary.value = null;
}

async function handleRepairEvidenceRelations() {
  if (!store.currentCompany) {
    message.warning('请先选择当前企业');
    return;
  }

  evidenceRepairing.value = true;
  try {
    const result = await repairClientPropertyEvidenceRelationsApi();
    await loadRecords();
    message.success(
      result.changedRecords > 0
        ? `已修复 ${result.changedRecords} 条证据链关联`
        : '证据链关联已是最新',
    );
  } catch (error) {
    message.error(error instanceof Error ? error.message : '证据链修复失败');
  } finally {
    evidenceRepairing.value = false;
  }
}

async function handleClassifyTechnologyFields() {
  if (!store.currentCompany) {
    message.warning('请先选择当前企业');
    return;
  }

  techFieldClassifying.value = true;
  try {
    const result = await classifyClientPropertyTechnologyFieldsApi();
    await loadRecords();
    message.success(
      result.updated > 0
        ? `已识别并回填 ${result.updated} 条技术领域`
        : '没有需要识别的技术领域',
    );
  } catch (error) {
    message.error(error instanceof Error ? error.message : '技术领域识别失败');
  } finally {
    techFieldClassifying.value = false;
  }
}

async function handleCreateRecord(tabKey: string, record: Record<string, unknown>) {
  if (tabKey === 'intellectualProperty') {
    await createClientIntellectualPropertyApi(
      record as unknown as ClientEnterprisePropertyApi.IntellectualProperty,
    );
    await loadRecords();
    invalidateEvidenceSummary();
    message.success('知识产权资料已新增');
    return;
  }

  if (tabKey === 'researchProject') {
    const saved = await createClientResearchProjectApi(
      record as unknown as ClientEnterprisePropertyApi.ResearchProject,
    );
    researchProjectRows.value = [
      saved,
      ...researchProjectRows.value,
    ];
    invalidateEvidenceSummary();
    message.success('科研项目资料已新增');
    return;
  }

  if (tabKey === 'productService') {
    const saved = await createClientProductServiceApi(
      record as unknown as ClientEnterprisePropertyApi.ProductService,
    );
    productServiceRows.value = [
      saved,
      ...productServiceRows.value,
    ];
    invalidateEvidenceSummary();
    message.success('高新产品/服务资料已新增');
    return;
  }

  if (tabKey === 'transformation') {
    const saved = await createClientTransformationApi(
      record as unknown as ClientEnterprisePropertyApi.Transformation,
    );
    transformationRows.value = [
      saved,
      ...transformationRows.value,
    ];
    invalidateEvidenceSummary();
    message.success('成果转化资料已新增');
  }
}

async function handleUpdateRecord(tabKey: string, record: Record<string, unknown>) {
  if (!record.id) {
    return;
  }

  if (tabKey === 'intellectualProperty') {
    await updateClientIntellectualPropertyApi(
      record.id as number | string,
      record as unknown as ClientEnterprisePropertyApi.IntellectualProperty,
    );
    await loadRecords();
    invalidateEvidenceSummary();
    message.success('知识产权资料已更新');
    return;
  }

  if (tabKey === 'researchProject') {
    const saved = await updateClientResearchProjectApi(
      record.id as number | string,
      record as unknown as ClientEnterprisePropertyApi.ResearchProject,
    );
    researchProjectRows.value = researchProjectRows.value.map((item) =>
      String(item.id) === String(saved.id) ? saved : item,
    );
    invalidateEvidenceSummary();
    message.success('科研项目资料已更新');
    return;
  }

  if (tabKey === 'productService') {
    const saved = await updateClientProductServiceApi(
      record.id as number | string,
      record as unknown as ClientEnterprisePropertyApi.ProductService,
    );
    productServiceRows.value = productServiceRows.value.map((item) =>
      String(item.id) === String(saved.id) ? saved : item,
    );
    invalidateEvidenceSummary();
    message.success('高新产品/服务资料已更新');
    return;
  }

  if (tabKey === 'transformation') {
    const saved = await updateClientTransformationApi(
      record.id as number | string,
      record as unknown as ClientEnterprisePropertyApi.Transformation,
    );
    transformationRows.value = transformationRows.value.map((item) =>
      String(item.id) === String(saved.id) ? saved : item,
    );
    invalidateEvidenceSummary();
    message.success('成果转化资料已更新');
  }
}

async function handleDeleteRecord(tabKey: string, record: Record<string, unknown>) {
  if (!record.id) {
    return;
  }

  if (tabKey === 'intellectualProperty') {
    await deleteClientIntellectualPropertyApi(record.id as number | string);
    await loadRecords();
    invalidateEvidenceSummary();
    message.success('知识产权资料已删除');
    return;
  }

  if (tabKey === 'researchProject') {
    await deleteClientResearchProjectApi(record.id as number | string);
    researchProjectRows.value = researchProjectRows.value.filter(
      (item) => String(item.id) !== String(record.id),
    );
    invalidateEvidenceSummary();
    message.success('科研项目资料已删除');
    return;
  }

  if (tabKey === 'productService') {
    await deleteClientProductServiceApi(record.id as number | string);
    productServiceRows.value = productServiceRows.value.filter(
      (item) => String(item.id) !== String(record.id),
    );
    invalidateEvidenceSummary();
    message.success('高新产品/服务资料已删除');
    return;
  }

  if (tabKey === 'transformation') {
    await deleteClientTransformationApi(record.id as number | string);
    transformationRows.value = transformationRows.value.filter(
      (item) => String(item.id) !== String(record.id),
    );
    invalidateEvidenceSummary();
    message.success('成果转化资料已删除');
  }
}

async function handleClearActiveTab(tabKey: string, title: string, count: number) {
  const draftIds = await getPendingDraftIdsByTab(tabKey);
  const totalCount = count + draftIds.length;
  if (totalCount <= 0) {
    message.warning(`当前${title}暂无可删除的上传记录`);
    return;
  }

  Modal.confirm({
    content: `确认一键删除当前“${title}”下的上传记录吗？将删除 ${count} 条正式记录和 ${draftIds.length} 条待审核草稿。由于系统当前不区分手工新增和上传导入来源，正式记录会按当前分类全部删除，且不可恢复。`,
    okText: '确认删除',
    okType: 'danger',
    title: `一键删除${title}上传记录`,
    async onOk() {
      clearingActiveTab.value = true;
      try {
        const deletedDraftCount = await deletePendingDraftsByTab(tabKey);
        if (tabKey === 'intellectualProperty' && count > 0) {
          await clearClientIntellectualPropertyApi();
        } else if (tabKey === 'researchProject' && count > 0) {
          await clearClientResearchProjectApi();
        } else if (tabKey === 'productService' && count > 0) {
          await clearClientProductServiceApi();
        } else if (tabKey === 'transformation' && count > 0) {
          await clearClientTransformationRecordsApi();
        }
        await loadRecords();
        invalidateEvidenceSummary();
        message.success(
          `${title}上传记录已一键删除，含 ${deletedDraftCount} 条待审核草稿`,
        );
      } catch (error) {
        message.error(error instanceof Error ? error.message : `${title}上传记录删除失败`);
        throw error;
      } finally {
        clearingActiveTab.value = false;
      }
    },
  });
}

async function handleClearAllPropertyRecords() {
  const draftCount = await getAllPendingDraftCount();
  const totalCount = totalPropertyRecordCount.value + draftCount;
  if (totalCount <= 0) {
    message.warning('当前研发与知识产权模块暂无可删除的上传记录');
    return;
  }

  Modal.confirm({
    content: `确认一键删除知识产权、成果转化、研发项目 RD、高新产品 PS 的上传记录吗？将删除 ${totalPropertyRecordCount.value} 条正式记录和 ${draftCount} 条待审核草稿。由于系统当前不区分手工新增和上传导入来源，正式记录会按四类全部删除，且不可恢复。`,
    okText: '全部删除',
    okType: 'danger',
    title: '一键删除全部上传记录',
    async onOk() {
      clearingAllTabs.value = true;
      try {
        const deletedDraftCount = await deleteAllPendingDrafts();
        if (totalPropertyRecordCount.value > 0) {
          await clearAllPropertyRecordsApi();
        }
        await loadRecords();
        invalidateEvidenceSummary();
        message.success(
          `研发与知识产权上传记录已全部删除，含 ${deletedDraftCount} 条待审核草稿`,
        );
      } catch (error) {
        message.error(
          error instanceof Error ? error.message : '研发与知识产权上传记录删除失败',
        );
        throw error;
      } finally {
        clearingAllTabs.value = false;
      }
    },
  });
}

async function getPendingDraftIdsByTab(tabKey: string) {
  if (tabKey === 'intellectualProperty') {
    const result = await getClientIpRecognitionDraftsApi();
    return result.items.filter(isPendingReviewDraft).map((draft) => draft.id);
  }
  if (tabKey === 'researchProject') {
    const result = await getClientResearchGenerationDraftsApi();
    return result.items.filter(isPendingReviewDraft).map((draft) => draft.id);
  }
  if (tabKey === 'productService') {
    const result = await getClientProductServiceGenerationDraftsApi();
    return result.items.filter(isPendingReviewDraft).map((draft) => draft.id);
  }
  if (tabKey === 'transformation') {
    const result = await getClientTransformationGenerationDraftsApi();
    return result.items.filter(isPendingReviewDraft).map((draft) => draft.id);
  }
  return [];
}

async function deletePendingDraftsByTab(tabKey: string) {
  const ids = await getPendingDraftIdsByTab(tabKey);
  if (tabKey === 'intellectualProperty') {
    await Promise.all(ids.map((id) => deleteClientIpRecognitionDraftApi(id)));
  } else if (tabKey === 'researchProject') {
    await Promise.all(ids.map((id) => deleteClientResearchGenerationDraftApi(id)));
  } else if (tabKey === 'productService') {
    await Promise.all(
      ids.map((id) => deleteClientProductServiceGenerationDraftApi(id)),
    );
  } else if (tabKey === 'transformation') {
    await Promise.all(
      ids.map((id) => deleteClientTransformationGenerationDraftApi(id)),
    );
  }
  return ids.length;
}

async function getAllPendingDraftCount() {
  const counts = await Promise.all(
    ['intellectualProperty', 'researchProject', 'productService', 'transformation'].map(
      async (tabKey) => (await getPendingDraftIdsByTab(tabKey)).length,
    ),
  );
  return counts.reduce((sum, count) => sum + count, 0);
}

async function deleteAllPendingDrafts() {
  const counts = await Promise.all(
    ['intellectualProperty', 'researchProject', 'productService', 'transformation'].map(
      (tabKey) => deletePendingDraftsByTab(tabKey),
    ),
  );
  return counts.reduce((sum, count) => sum + count, 0);
}

function isPendingReviewDraft(draft: { status: string }) {
  return draft.status !== 'approved' && draft.status !== 'rejected';
}

async function handleDownloadTemplate() {
  try {
    const blob = await downloadClientMaterialTemplateApi(activeTemplateId.value);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeTemplateFileName.value;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '模板下载失败');
  }
}

function handleOpenImport() {
  if (!store.currentCompany) {
    message.warning('请先选择当前企业');
    return;
  }
  fileInputRef.value?.click();
}

function handleOpenIpImport() {
  if (!store.currentCompany) {
    message.warning('请先选择当前企业');
    return;
  }
  ipImportOpen.value = true;
}

function handleOpenAiTaskAudit() {
  if (!store.currentCompany) {
    message.warning('请先选择当前企业');
    return;
  }
  aiTaskAuditOpen.value = true;
}

async function handleIpImportApproved() {
  await loadRecords();
}

function handleOpenResearchGenerate() {
  if (!store.currentCompany) {
    message.warning('请先选择当前企业');
    return;
  }
  researchGenerateOpen.value = true;
}

async function handleResearchGenerateApproved() {
  await loadRecords();
}

function handleOpenProductServiceGenerate() {
  if (!store.currentCompany) {
    message.warning('请先选择当前企业');
    return;
  }
  productServiceGenerateOpen.value = true;
}

async function handleProductServiceGenerateApproved() {
  await loadRecords();
}

function handleOpenTransformationGenerate() {
  if (!store.currentCompany) {
    message.warning('请先选择当前企业');
    return;
  }
  transformationGenerateOpen.value = true;
}

async function handleTransformationGenerateApproved() {
  await loadRecords();
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) {
    return;
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    message.warning('当前版本请上传 CSV 文件');
    return;
  }

  importing.value = true;
  try {
    const result = await uploadClientMaterialApi(activeTemplateId.value, file);
    await loadRecords();
    const successCount = Number(result.importSummary?.successCount ?? 0);
    importResultTitle.value =
      result.status === 'valid'
        ? '导入成功'
        : result.status === 'partial'
          ? '部分导入成功'
          : '导入失败';
    importResultDescription.value = `已写入 ${successCount} 条记录。`;
    importErrors.value = result.errorCount
      ? await getClientMaterialErrorsApi(result.id)
      : [];
    importResultOpen.value = true;
    if (result.status === 'valid') {
      message.success('资料已导入');
    } else if (result.status === 'partial') {
      message.warning('部分资料已导入，请查看错误行');
    } else {
      message.error('导入失败，请查看错误行');
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '资料导入失败');
  } finally {
    importing.value = false;
  }
}

function toOptions<T extends Record<string, unknown>>(
  rows: T[],
  nameField: keyof T,
  codeField?: keyof T,
): EnterpriseOption[] {
  return [...rows]
    .filter((row) => row.id !== undefined && row.id !== null)
    .map((row) => {
      const code = codeField ? row[codeField] : null;
      const name = row[nameField] ?? code ?? row.id;
      const label =
        code && String(code) !== String(name)
          ? `${String(code)} ${String(name)}`
          : String(name);
      return {
        label,
        value: String(row.id),
      };
    });
}

function toIpOptions(
  rows: ClientEnterprisePropertyApi.IntellectualProperty[],
): EnterpriseOption[] {
  return sortPropertyRowsByIpCode(rows, 'intellectual_property')
    .filter((row) => row.id !== undefined && row.id !== null)
    .map((row) => {
      const code = row.ip_code || row.soft_work_num || '';
      const name = row.soft_work_name || row.soft_work_num || row.id;
      return {
        label: row.ip_code ? `${row.ip_code}-${name}` : `${code} ${name}`.trim(),
        value: String(row.id),
      };
    });
}

function withRelationOptions(
  columns: EnterpriseTableColumn[],
  optionsMap: Record<string, EnterpriseOption[]>,
) {
  return columns.map((column) => ({
    ...column,
    options: optionsMap[column.field] ?? column.options,
  }));
}

function sortPropertyRowsByIpCode<T>(
  rows: T[],
  recordType: string,
): T[] {
  return [...rows].sort((left, right) => {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const rankDiff =
      getPropertyRowIpRank(leftRecord, recordType) -
      getPropertyRowIpRank(rightRecord, recordType);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    return getPropertyRowCode(leftRecord, recordType).localeCompare(
      getPropertyRowCode(rightRecord, recordType),
      'zh-CN',
      { numeric: true },
    );
  });
}

function getPropertyRowIpRank(
  row: Record<string, unknown>,
  recordType: string,
): number {
  if (recordType === 'intellectual_property') {
    return getIpCodeRank(row.ip_code);
  }

  const relatedIpIds = parseRelationIds(row.related_ip_ids as null | string | undefined);
  return relatedIpIds.length > 0
    ? Math.min(...relatedIpIds.map((id) => getIpCodeRankById(id)))
    : Number.MAX_SAFE_INTEGER;
}

function getPropertyRowCode(
  row: Record<string, unknown>,
  recordType: string,
): string {
  const codeField = {
    intellectual_property: 'ip_code',
    product_service: 'ps_code',
    research_project: 'ky_project_num',
    transformation: 'transformation_code',
  }[recordType];
  return codeField ? String(row[codeField] ?? '') : '';
}

function getIpCodeRank(value: unknown): number {
  const match = String(value ?? '').match(/^IP(\d+)$/u);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function getIpCodeRankById(id: string): number {
  const row = intellectualPropertyRows.value.find(
    (item) => String(item.id ?? '') === id,
  );
  return getIpCodeRank(row?.ip_code);
}

function sortRelationIdsByIpCode(
  ids: string[],
  rows: Record<string, unknown>[] = intellectualPropertyRows.value,
  recordType = 'intellectual_property',
) {
  if (recordType === 'intellectual_property') {
    return [...ids].sort(
      (left, right) => getIpCodeRankById(left) - getIpCodeRankById(right),
    );
  }

  const rowById = new Map(rows.map((row) => [String(row.id ?? ''), row]));
  return [...ids].sort((left, right) => {
    const rankDiff =
      getPropertyRowIpRank(rowById.get(left) ?? {}, recordType) -
      getPropertyRowIpRank(rowById.get(right) ?? {}, recordType);
    return rankDiff || getPropertyRowCode(rowById.get(left) ?? {}, recordType).localeCompare(
      getPropertyRowCode(rowById.get(right) ?? {}, recordType),
      'zh-CN',
      { numeric: true },
    );
  });
}

function findRelatedNamesByIds<T extends Record<string, unknown>>(
  ids: string[],
  rows: T[],
  nameField: keyof T,
) {
  if (ids.length === 0) {
    return [];
  }

  return ids.map((id) => {
    const matched = rows.find((row) => String(row.id ?? '') === id);
    return matched ? String(matched[nameField] ?? id) : id;
  });
}

function hasRelationValue(value: null | string | undefined) {
  return parseRelationIds(value).length > 0;
}

function parseRelationIds(value: null | string | undefined) {
  return String(value ?? '')
    .split(/[,，\s]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function includesRelationId(value: null | string | undefined, id: string) {
  return Boolean(id) && parseRelationIds(value).includes(id);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
</script>

<template>
  <EnterpriseRecordModule
    v-model:active-key="activeKey"
    :company-name="store.currentCompanyName"
    description="集中维护企业 IP、RD、PS、成果转化和证据链关系。"
    :error-message="moduleError"
    :has-company="hasCompany"
    :loading="loading || store.loading"
    module-key="property"
    :tabs="tabs"
    title="研发与知识产权"
    @create-record="handleCreateRecord"
    @delete-record="handleDeleteRecord"
    @update-record="handleUpdateRecord"
  >
    <template #actions="{ activeTab }">
      <Button
        danger
        :disabled="!hasCompany || !activeTab"
        :loading="clearingActiveTab"
        @click="
          activeTab &&
            handleClearActiveTab(activeTab.key, activeTab.title, activeTab.records.length)
        "
      >
        一键删除当前上传记录
      </Button>
      <Button
        danger
        :disabled="!hasCompany"
        :loading="clearingAllTabs"
        @click="handleClearAllPropertyRecords"
      >
        一键删除全部上传记录
      </Button>
      <Button
        v-if="activeTab?.key === 'intellectualProperty'"
        type="primary"
        @click="handleOpenIpImport"
      >
        上传识别知识产权
      </Button>
      <Button
        v-if="activeTab?.key === 'researchProject'"
        type="primary"
        @click="handleOpenResearchGenerate"
      >
        新增研发项目并生成立项报告
      </Button>
      <Button
        v-if="activeTab?.key === 'productService'"
        type="primary"
        @click="handleOpenProductServiceGenerate"
      >
        按 RD 批量生成 PS
      </Button>
      <Button
        v-if="activeTab?.key === 'transformation'"
        type="primary"
        @click="handleOpenTransformationGenerate"
      >
        按知识产权批量生成成果
      </Button>
      <Button :disabled="importing" @click="handleDownloadTemplate">
        下载当前模板
      </Button>
      <Button :loading="importing" @click="handleOpenImport">
        导入当前资料
      </Button>
      <Button @click="handleOpenAiTaskAudit">
        AI生成记录
      </Button>
    </template>

    <template #before-table>
      <div class="evidence-chain">
        <div class="evidence-chain__header">
          <div>
            <h3>证据链概览</h3>
            <p>按 RD 查看已关联的 IP、PS 和成果转化，后续申报可直接引用。</p>
          </div>
          <div class="evidence-chain__header-actions">
            <span>
              {{ evidenceChains.length }} 条 RD 链路，{{ evidenceGaps.length }} 个缺口
            </span>
            <Button
              size="small"
              :loading="evidenceRepairing"
              @click="handleRepairEvidenceRelations"
            >
              修复证据链
            </Button>
            <Button
              size="small"
              :loading="techFieldClassifying"
              @click="handleClassifyTechnologyFields"
            >
              识别技术领域
            </Button>
            <Button size="small" type="primary" @click="topologyOpen = true">
              查看关系拓扑图
            </Button>
          </div>
        </div>
        <div
          class="evidence-chain__ai-readiness"
          :class="`evidence-chain__ai-readiness--${aiReadinessStatus.tone}`"
        >
          <strong>{{ aiReadinessStatus.label }}</strong>
          <span>{{ aiReadinessMessages.join('；') }}</span>
        </div>
        <div v-if="evidenceChecklist.length" class="evidence-chain__checklist">
          <div class="evidence-chain__checklist-header">
            <strong>链路验收状态</strong>
            <span>{{ evidenceChecklistSummary }}</span>
          </div>
          <div class="evidence-chain__checklist-items">
            <div
              v-for="item in evidenceChecklist"
              :key="item.key"
              class="evidence-chain__check-item"
            >
              <span
                class="evidence-chain__check-status"
                :class="getEvidenceChecklistStatusClass(item.status)"
              >
                {{ getEvidenceChecklistStatusText(item.status) }}
              </span>
              <strong>{{ item.label }}</strong>
              <em>{{ item.detail }}</em>
            </div>
          </div>
        </div>
        <div class="evidence-chain__readiness">
          <div class="evidence-chain__score">
            <strong>{{ propertyReadinessStats.readinessPercent }}%</strong>
            <span>资料完整度</span>
          </div>
          <div class="evidence-chain__metrics">
            <div class="evidence-chain__metric">
              <strong>{{ propertyReadinessStats.intellectualPropertyTotal }}</strong>
              <span>知识产权</span>
            </div>
            <div class="evidence-chain__metric">
              <strong>
                {{ propertyReadinessStats.rdWithIp }}/{{ propertyReadinessStats.rdTotal }}
              </strong>
              <span>RD 已关联 IP</span>
            </div>
            <div class="evidence-chain__metric">
              <strong>
                {{ propertyReadinessStats.psWithRd }}/{{ propertyReadinessStats.psTotal }}
              </strong>
              <span>PS 已关联 RD</span>
            </div>
            <div class="evidence-chain__metric">
              <strong>
                {{ propertyReadinessStats.psWithIp }}/{{ propertyReadinessStats.psTotal }}
              </strong>
              <span>PS 已关联 IP</span>
            </div>
            <div class="evidence-chain__metric">
              <strong>
                {{ propertyReadinessStats.transformationWithIp }}/{{
                  propertyReadinessStats.transformationTotal
                }}
              </strong>
              <span>成果已关联 IP</span>
            </div>
            <div class="evidence-chain__metric">
              <strong>
                {{ propertyReadinessStats.ipUsedInChain }}/{{
                  propertyReadinessStats.intellectualPropertyTotal
                }}
              </strong>
              <span>IP 已入链路</span>
            </div>
            <div class="evidence-chain__metric">
              <strong>
                {{ propertyReadinessStats.completeRdChains }}/{{
                  propertyReadinessStats.rdTotal
                }}
              </strong>
              <span>完整 RD 链路</span>
            </div>
            <div class="evidence-chain__metric evidence-chain__metric--warning">
              <strong>{{ propertyReadinessStats.gapTotal }}</strong>
              <span>待补缺口</span>
            </div>
          </div>
        </div>
        <div v-if="evidenceChains.length" class="evidence-chain__list">
          <div
            v-for="chain in evidenceChains"
            :key="chain.id"
            class="evidence-chain__item"
          >
            <strong>
              <template v-if="chain.number">{{ chain.number }} - </template>
              {{ chain.name }}
            </strong>
            <span>IP：{{ chain.ip.join('、') || '未关联' }}</span>
            <span>PS：{{ chain.ps.join('、') || '未关联' }}</span>
            <span>成果：{{ chain.transformation.join('、') || '未关联' }}</span>
            <span
              class="evidence-chain__gap"
              :class="{ 'evidence-chain__gap--ok': chain.gaps.length === 0 }"
            >
              {{ chain.gaps.length ? chain.gaps.join('、') : '链路完整' }}
            </span>
          </div>
        </div>
        <div v-else class="evidence-chain__empty">
          还没有 RD 项目，新增 RD 后可在关联字段中填写对应记录 ID。
        </div>
        <div v-if="evidenceGaps.length" class="evidence-chain__quality">
          <strong>质量检查</strong>
          <span
            v-for="gap in evidenceGaps.slice(0, 8)"
            :key="gap"
          >
            {{ gap }}
          </span>
          <em v-if="evidenceGaps.length > 8">
            还有 {{ evidenceGaps.length - 8 }} 个缺口，请在对应记录中补充关联字段。
          </em>
        </div>
      </div>
    </template>
  </EnterpriseRecordModule>

  <IpPdfImportModal
    v-model:open="ipImportOpen"
    @approved="handleIpImportApproved"
  />

  <AiTaskAuditModal v-model:open="aiTaskAuditOpen" />

  <ResearchProjectAiGenerateModal
    v-model:open="researchGenerateOpen"
    @approved="handleResearchGenerateApproved"
  />

  <ProductServiceBatchGenerateModal
    v-model:open="productServiceGenerateOpen"
    @approved="handleProductServiceGenerateApproved"
  />

  <TransformationBatchGenerateModal
    v-model:open="transformationGenerateOpen"
    @approved="handleTransformationGenerateApproved"
  />

  <Modal
    v-model:open="topologyOpen"
    destroy-on-hidden
    :footer="null"
    title="关系拓扑图"
    width="96vw"
  >
    <div class="property-topology-modal">
      <EvidenceTopologyPanel
        :contracts="contractRows"
        :gaps="evidenceGaps"
        :intellectual-properties="intellectualPropertyRows"
        :invoices="invoiceRows"
        :product-services="productServiceRows"
        :readiness-percent="propertyReadinessStats.readinessPercent"
        :research-projects="researchProjectRows"
        :transformations="transformationRows"
      />
    </div>
  </Modal>

  <input
    ref="fileInputRef"
    accept=".csv"
    class="property-import-input"
    type="file"
    @change="handleFileChange"
  />

  <Modal
    v-model:open="importResultOpen"
    :footer="null"
    :title="importResultTitle"
    width="720px"
  >
    <div class="property-import-result">
      <p>{{ importResultDescription }}</p>
      <div v-if="importErrors.length" class="property-import-result__errors">
        <h4>需要处理的错误行</h4>
        <ul>
          <li v-for="error in importErrors" :key="error.id">
            第 {{ error.rowNumber ?? '-' }} 行
            <span v-if="error.fieldName">，{{ error.fieldName }}</span>
            ：{{ error.message }}
            <span v-if="error.suggestion">。建议：{{ error.suggestion }}</span>
          </li>
        </ul>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.property-import-input {
  display: none;
}

.property-topology-modal {
  max-height: 78vh;
  overflow: auto;
}

.evidence-chain {
  padding: 16px;
  margin-bottom: 16px;
  background:
    radial-gradient(circle at top right, hsl(var(--primary) / 12%), transparent 34%),
    hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
}

.evidence-chain__header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.evidence-chain__header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.evidence-chain__header p,
.evidence-chain__header span,
.evidence-chain__item span,
.evidence-chain__empty {
  color: hsl(var(--muted-foreground));
}

.evidence-chain__header p {
  margin: 6px 0 0;
}

.evidence-chain__header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.evidence-chain__ai-readiness {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  margin-top: 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  background: hsl(var(--card));
}

.evidence-chain__ai-readiness strong {
  flex-shrink: 0;
}

.evidence-chain__ai-readiness span {
  color: hsl(var(--muted-foreground));
}

.evidence-chain__ai-readiness--success {
  border-color: hsl(var(--success) / 35%);
}

.evidence-chain__ai-readiness--warning {
  border-color: hsl(var(--warning) / 35%);
}

.evidence-chain__checklist {
  display: grid;
  gap: 10px;
  padding: 12px;
  margin-top: 14px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.evidence-chain__checklist-header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.evidence-chain__checklist-header span {
  color: hsl(var(--muted-foreground));
}

.evidence-chain__checklist-items {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.evidence-chain__check-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 8px;
  align-items: center;
  padding: 10px;
  background: hsl(var(--muted) / 24%);
  border-radius: 10px;
}

.evidence-chain__check-item em {
  grid-column: 1 / -1;
  font-size: 12px;
  font-style: normal;
  color: hsl(var(--muted-foreground));
}

.evidence-chain__check-status {
  padding: 2px 7px;
  font-size: 12px;
  border-radius: 999px;
}

.evidence-chain__check-status--passed {
  color: hsl(145 60% 28%);
  background: hsl(145 70% 92%);
}

.evidence-chain__check-status--warning {
  color: hsl(36 80% 32%);
  background: hsl(42 100% 92%);
}

.evidence-chain__check-status--missing {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

.evidence-chain__readiness {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 12px;
  margin-top: 14px;
}

.evidence-chain__score,
.evidence-chain__metric {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
}

.evidence-chain__score {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 104px;
  padding: 16px;
  background:
    linear-gradient(135deg, hsl(var(--primary) / 14%), transparent),
    hsl(var(--card));
}

.evidence-chain__score strong {
  font-size: 34px;
  line-height: 1;
}

.evidence-chain__score span,
.evidence-chain__metric span {
  margin-top: 6px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.evidence-chain__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px;
}

.evidence-chain__metric {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 84px;
  padding: 12px;
}

.evidence-chain__metric strong {
  font-size: 20px;
  line-height: 1.1;
}

.evidence-chain__metric--warning strong {
  color: hsl(var(--destructive, 0 84% 60%));
}

.evidence-chain__list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.evidence-chain__item {
  display: grid;
  grid-template-columns: minmax(160px, 1.2fr) repeat(4, minmax(120px, 1fr));
  gap: 8px;
  padding: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.evidence-chain__empty {
  margin-top: 12px;
  font-size: 14px;
}

.evidence-chain__gap {
  color: hsl(var(--destructive, 0 84% 60%));
}

.evidence-chain__gap--ok {
  color: hsl(var(--primary));
}

.evidence-chain__quality {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px dashed hsl(var(--border));
}

.evidence-chain__quality span,
.evidence-chain__quality em {
  padding: 4px 8px;
  font-size: 12px;
  font-style: normal;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.property-import-result {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.property-import-result__errors {
  padding: 12px;
  background: hsl(var(--muted) / 45%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.property-import-result__errors h4 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.property-import-result__errors ul {
  padding-left: 18px;
  margin: 0;
}

.property-import-result__errors li + li {
  margin-top: 6px;
}

@media (max-width: 900px) {
  .evidence-chain__item,
  .evidence-chain__header {
    grid-template-columns: 1fr;
  }

  .evidence-chain__header {
    flex-direction: column;
  }

  .evidence-chain__header-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .evidence-chain__readiness {
    grid-template-columns: 1fr;
  }

  .evidence-chain__checklist-items {
    grid-template-columns: 1fr;
  }

  .evidence-chain__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
