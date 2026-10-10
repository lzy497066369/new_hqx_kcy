<script setup lang="ts">
import MaterialWorkspace from './materials/workspace.vue';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRoute,
} from 'vue-router';
import { Page } from '@vben/common-ui';
import { createIconifyIcon } from '@vben/icons';
import {
  Alert,
  Button,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Steps,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antdv-next';

import type {
  HighTechDraft,
  HighTechFieldOption,
  HighTechIpItem,
  HighTechAttachment,
  HighTechProject,
  IpAllocationPreview,
  RecognizedIpRow,
} from '#/api/client/high-tech';
import {
  exportHighTechIpSummaryApi,
  exportHighTechProjectDetailsApi,
  listHighTechAttachmentsApi,
  getHighTechApplicationApi,
  getHighTechFieldCatalogApi,
  generateHighTechNamesApi,
  importHighTechIpSummaryApi,
  importHighTechProjectDetailsApi,
  previewHighTechIpAllocationApi,
  recognizeHighTechIpPdfsApi,
  recommendHighTechFieldsApi,
  saveHighTechApplicationApi,
} from '#/api/client/high-tech';
import {
  DEFAULT_PROJECT_BRANCH_COUNT,
  BOOK_SECTIONS,
  ATTACHMENT_SECTIONS,
  emptyBasicInfo,
  emptyDraft,
  IP_LEGAL_STATUSES,
  IP_PATENT_TYPES,
  IP_SUMMARY_FIELDS,
  ipSummaryError,
  newIpItem,
  PROJECT_ACQUISITION_METHODS,
  PROJECT_FIELDS,
  PROJECT_IP_TYPES,
  sortIpSummaryRows,
  synchronizeIpNumbers,
  stepError,
} from './model';
import { normalizeProjectAcquisitionMethods, projectIpOptions, selectProjectIp } from './project-ip';
import { prepareRecognizedIpRows } from './ip-recognition';
import { allocationSnapshot, applyIpAllocation } from './ip-allocation';
import { applyGeneratedNames, generatedNameReasons } from './name-generation';
import { matchesTechField, projectPatentNames, techFieldOptions } from './tech-fields';
import { assignMissingResearchPeriods, researchPeriodWarnings } from './research-period';
import { deleteProjectRow, groupProjectRows, insertProjectRow, normalizeProjectRows, projectGroupWarnings, projectRowSpan, PROJECT_ROW_LIMIT, SHARED_PROJECT_FIELDS, updateProjectRow } from './project-rows';

type ProjectFieldKey = Exclude<keyof HighTechProject, 'id'>;
type IpFieldKey = Exclude<keyof HighTechIpItem, 'id'>;

const UploadIcon = createIconifyIcon('lucide:upload');
const DownloadIcon = createIconifyIcon('lucide:download');
const DeleteIcon = createIconifyIcon('lucide:trash-2');
const PlusIcon = createIconifyIcon('lucide:plus');
const RecommendIcon = createIconifyIcon('lucide:sparkles');

defineOptions({ name: 'ClientHighTechApplication' });
const route = useRoute();
const companyId = computed(() => String(route.params.companyId ?? ''));
const companyName = ref('');
const draft = ref<HighTechDraft>(emptyDraft());
const fieldCatalog = ref<HighTechFieldOption[]>([]);
const recommendedFields = ref<HighTechFieldOption[]>([]);
const fieldCatalogLoading = ref(false);
const fieldsRecommending = ref(false);
const fieldCatalogError = ref('');
const fieldRecommendationError = ref('');
const namesGenerating = ref(false);
const nameGenerationError = ref('');
const nameGenerationProgress = ref(0);
const nameGenerationProgressState = ref<'idle' | 'running' | 'success' | 'error'>('idle');
let nameGenerationProgressTimer: ReturnType<typeof setInterval> | undefined;
const nameGenerationProgressText = computed(() => {
  if (nameGenerationProgressState.value === 'success') return '名称生成完成';
  if (nameGenerationProgressState.value === 'error') return '名称生成失败，可重新生成';
  if (nameGenerationProgress.value >= 95) return '估算进度 · 仍在等待模型返回，请稍候';
  const stage = nameGenerationProgress.value < 20 ? 'IP技术语义分析'
    : nameGenerationProgress.value < 45 ? '科技成果名称生成'
      : nameGenerationProgress.value < 65 ? '既有RD名称生成'
        : nameGenerationProgress.value < 85 ? 'PS产品服务归并' : '关联关系与一致性校验';
  return `估算进度 · 预计阶段：${stage}`;
});
let nameGenerationSequence = 0;
const nameReasons = computed(() => new Map(draft.value.projects.map((row) => [row.id,
  generatedNameReasons(draft.value.nameGeneration, draft.value.projects, row.id)])));
let fieldRecommendationSequence = 0;
let fieldCatalogSequence = 0;
const patentNames = computed(() => projectPatentNames(draft.value.projects));
const fieldOptions = computed(() => techFieldOptions(fieldCatalog.value, recommendedFields.value));
const selectedField = computed(() => {
  const label = draft.value.projects[0]?.techField;
  if (!label || !draft.value.projects.every((row) => row.techField === label)) return undefined;
  return [...fieldCatalog.value, ...recommendedFields.value].find((field) => field.label === label)?.id;
});
const savedSnapshot = ref('');
const loading = ref(true);
const saving = ref(false);
const materialBusy = ref(false);
const workspaceBusy = ref(false);
const attachmentRows = ref<HighTechAttachment[]>([]);
const previewUrl = ref('');
const previewOpen = ref(false);
const materialError = ref('');
const importing = ref(false);
const projectZoom = ref(100);
const importingProjects = ref(false);
const exportingProjects = ref(false);
const projectImportInput = ref<HTMLInputElement | null>(null);
const exportingIpSummary = ref(false);
const importInput = ref<HTMLInputElement | null>(null);
const importErrors = ref<string[]>([]);
const importErrorOpen = ref(false);
const recognizePdfInput = ref<HTMLInputElement | null>(null);
const recognizingPdf = ref(false);
const recognitionProgress = ref('');
const recognitionRows = ref<RecognizedIpRow[]>([]);
const recognitionErrors = ref<string[]>([]);
const recognitionWarnings = ref<string[]>([]);
const recognitionValidation = ref('');
const recognitionModalOpen = ref(false);
const allocating = ref(false);
const allocationPreview = ref<IpAllocationPreview | null>(null);
const allocationModalOpen = ref(false);
const allocationError = ref('');
let allocationSequence = 0;
const allocationSource = ref('');
const allocationCompany = ref('');
const errorMessage = ref('');
const validationMessage = ref('');
const blankIpItem = ref<HighTechIpItem>(newIpItem([]));
const ipRows = computed(() =>
  draft.value.ipSummary.length
    ? sortIpSummaryRows(draft.value.ipSummary)
    : [blankIpItem.value],
);
const projectGroups = computed(() => groupProjectRows(draft.value.projects));
const projectGroupById = computed(() => new Map(
  projectGroups.value.flatMap((group) => group.map((row) => [row.id, group] as const)),
));
const periodWarnings = computed(() => [
  ...projectGroupWarnings(projectGroups.value),
  ...researchPeriodWarnings(draft.value.projects),
]);
let loadSequence = 0;
const busy = computed(() => workspaceBusy.value || loading.value || saving.value || materialBusy.value || importing.value || importingProjects.value || exportingProjects.value || recognizingPdf.value || exportingIpSummary.value || namesGenerating.value || allocating.value);
const allocationStale = computed(() => allocationCompany.value !== companyId.value || allocationSnapshot(draft.value) !== allocationSource.value);
const dirty = computed(
  () =>
    Boolean(savedSnapshot.value) &&
    JSON.stringify(draft.value) !== savedSnapshot.value,
);
const steps = [
  { title: '知识产权汇总表' },
  { title: '制作高新核心信息' },
  { title: '制作高新材料' },
];
const projectFieldExamples = Object.fromEntries(
  PROJECT_FIELDS.map(({ key, example }) => [key, example]),
);
const columns = [
  ...PROJECT_FIELDS.map((field, index) => ({
    title: field.label,
    dataIndex: field.key,
    key: field.key,
    width:
      field.key === 'year'
        ? 120
        : (field.key === 'applicationDate' || field.key === 'authorizationDate')
          ? 180
          : field.width,
    ...(index === 0 ? { fixed: 'left' as const } : {}),
    onCell: (row: HighTechProject) => {
      const shared = SHARED_PROJECT_FIELDS.find((key) => key === field.key);
      return shared ? { rowSpan: projectRowSpan(projectGroupById.value.get(row.id) ?? [row], row, shared) } : {};
    },
  })),
  { title: '操作', key: 'actions', width: 240, fixed: 'right' as const },
];
const ipColumns = [
  ...IP_SUMMARY_FIELDS.map((field, index) => ({
    title: field.label,
    dataIndex: field.key,
    key: field.key,
    width: field.width,
    ...(index === 0 ? { fixed: 'left' as const } : {}),
  })),
  { title: '操作', key: 'actions', width: 90, fixed: 'right' as const },
];
const ipFieldExamples = Object.fromEntries(IP_SUMMARY_FIELDS.map(({ key, example }) => [key, example]));
const recognitionColumns = [
  ...ipColumns,
];
const projectIpTypeOptions = PROJECT_IP_TYPES.map((value) => ({ label: value, value }));
const projectAcquisitionMethodOptions = PROJECT_ACQUISITION_METHODS.map((value) => ({ label: value, value }));
const patentTypeOptions = IP_PATENT_TYPES.map((value) => ({ label: value, value }));
const legalStatusOptions = IP_LEGAL_STATUSES.map((value) => ({ label: value, value }));

function errorText(error: unknown, fallback: string) {
  const body = (error as { response?: { data?: { message?: string } } })
    ?.response?.data;
  return body?.message || (error as { message?: string })?.message || fallback;
}
async function loadDraft() {
  const sequence = ++loadSequence;
  allocationSequence++;
  allocating.value = false;
  allocationPreview.value = null;
  allocationModalOpen.value = false;
  allocationError.value = '';
  nameGenerationSequence++;
  stopNameGenerationProgress();
  nameGenerationProgress.value = 0;
  nameGenerationProgressState.value = 'idle';
  namesGenerating.value = false;
  nameGenerationError.value = '';
  fieldCatalogSequence++;
  resetFieldRecommendations();
  fieldCatalog.value = [];
  fieldCatalogError.value = '';
  fieldCatalogLoading.value = false;
  loading.value = true;
  errorMessage.value = '';
  savedSnapshot.value = '';
  validationMessage.value = '';
  recognitionModalOpen.value = false;
  recognitionRows.value = [];
  attachmentRows.value = [];
  materialError.value = '';
  closePreview();
  try {
    const data = await getHighTechApplicationApi(companyId.value);
    if (sequence !== loadSequence) return;
    const {
      companyName: name,
      updatedAt: _updatedAt,
      companyId: _id,
      ...value
    } = data;
    companyName.value = name;
    value.basicInfo = { ...emptyBasicInfo(), ...value.basicInfo };
    value.ipSummary ??= [];
    for (const row of value.projects) row.applicationDate ??= '';
    normalizeProjectAcquisitionMethods(value.projects);
    value.book = BOOK_SECTIONS.map(({ key }) => value.book?.find((item) => item.key === key) ?? { key, content: '', reviewed: false });
    value.attachments = ATTACHMENT_SECTIONS.map(({ key }) => ({ key, note: '', content: '', reviewed: false, ...value.attachments?.find((item) => item.key === key) }));
    if (value.nameGeneration && value.nameGeneration.version !== 2 && value.nameGeneration.version !== 3) delete value.nameGeneration;
    synchronizeIpNumbers(value);
    draft.value = value;
    blankIpItem.value = newIpItem(value.ipSummary);
    savedSnapshot.value = JSON.stringify(value);
    if (normalizeProjectRows(draft.value.projects)) invalidateMaterials();
    fillMissingPeriods();
    void loadFieldCatalog();
    if (value.currentStep >= 2) void loadAttachments(companyId.value, sequence);
  } catch (error) {
    if (sequence === loadSequence)
      errorMessage.value = errorText(error, '申报草稿加载失败，请重试');
  } finally {
    if (sequence === loadSequence) loading.value = false;
  }
}
function resetFieldRecommendations() {
  fieldRecommendationSequence++;
  recommendedFields.value = [];
  fieldRecommendationError.value = '';
  fieldsRecommending.value = false;
}
async function loadFieldCatalog() {
  const sequence = ++fieldCatalogSequence;
  const company = companyId.value;
  fieldCatalogLoading.value = true;
  fieldCatalogError.value = '';
  try {
    const data = await getHighTechFieldCatalogApi(company);
    if (sequence === fieldCatalogSequence && company === companyId.value) fieldCatalog.value = data.fields;
  } catch (error) {
    if (sequence === fieldCatalogSequence) fieldCatalogError.value = errorText(error, '领域目录加载失败，请重试');
  } finally {
    if (sequence === fieldCatalogSequence) fieldCatalogLoading.value = false;
  }
}
async function recommendFields() {
  if (busy.value || fieldsRecommending.value) return;
  if (!patentNames.value.length) {
    fieldRecommendationError.value = '请先填写项目详情表中的专利名称';
    return;
  }
  const sequence = ++fieldRecommendationSequence;
  const company = companyId.value;
  const names = [...patentNames.value];
  const signature = JSON.stringify(names);
  fieldsRecommending.value = true;
  fieldRecommendationError.value = '';
  try {
    const data = await recommendHighTechFieldsApi(company, names);
    if (sequence !== fieldRecommendationSequence || company !== companyId.value || signature !== JSON.stringify(patentNames.value)) return;
    recommendedFields.value = data.fields;
    if (!data.fields.length) fieldRecommendationError.value = '未找到匹配的推荐领域，可搜索全部领域后选择';
  } catch (error) {
    if (sequence === fieldRecommendationSequence) fieldRecommendationError.value = errorText(error, '推荐失败，可重试或搜索全部领域后选择');
  } finally {
    if (sequence === fieldRecommendationSequence) fieldsRecommending.value = false;
  }
}
function selectField(value: unknown) {
  if (busy.value) return;
  const field = [...fieldCatalog.value, ...recommendedFields.value].find((item) => item.id === value);
  if (!field) return;
  let changed = false;
  for (const row of draft.value.projects) {
    if (row.techField !== field.label) {
      row.techField = field.label;
      changed = true;
    }
  }
  if (changed) {
    validationMessage.value = '';
    invalidateMaterials();
  }
}
function stopNameGenerationProgress() {
  if (nameGenerationProgressTimer !== undefined) {
    clearInterval(nameGenerationProgressTimer);
    nameGenerationProgressTimer = undefined;
  }
}
function startNameGenerationProgress() {
  stopNameGenerationProgress();
  nameGenerationProgress.value = 5;
  nameGenerationProgressState.value = 'running';
  const startedAt = Date.now();
  // The API returns one final response; estimated progress must never imply completion.
  nameGenerationProgressTimer = setInterval(() => {
    const elapsed = Math.max(0, Date.now() - startedAt);
    nameGenerationProgress.value = Math.min(95, Math.floor(5 + 91 * (1 - Math.exp(-elapsed / 60_000))));
    if (nameGenerationProgress.value === 95) stopNameGenerationProgress();
  }, 1000);
}
async function generateNames() {
  if (busy.value || fieldsRecommending.value) return;
  const sequence = ++nameGenerationSequence;
  const company = companyId.value;
  const signature = JSON.stringify(draft.value.projects);
  const input = { projects: JSON.parse(signature) as HighTechProject[] };
  namesGenerating.value = true;
  nameGenerationError.value = '';
  startNameGenerationProgress();
  try {
    const result = await generateHighTechNamesApi(company, input);
    if (sequence !== nameGenerationSequence || company !== companyId.value) return;
    if (JSON.stringify(draft.value.projects) !== signature) {
      nameGenerationError.value = '项目详情已变化，本次结果未应用，请重新生成';
      nameGenerationProgressState.value = 'error';
      return;
    }
    const projects = applyGeneratedNames(draft.value.projects, result);
    draft.value = { ...draft.value, projects, nameGeneration: result };
    invalidateMaterials();
    validationMessage.value = '';
    nameGenerationProgress.value = 100;
    nameGenerationProgressState.value = 'success';
    message.success('成果、RD及PS产品服务名称已生成');
  } catch (error) {
    if (sequence === nameGenerationSequence) {
      nameGenerationError.value = errorText(error, '名称生成失败，原有数据已保留，请重试');
      nameGenerationProgressState.value = 'error';
    }
  } finally {
    if (sequence === nameGenerationSequence) {
      stopNameGenerationProgress();
      namesGenerating.value = false;
    }
  }
}
async function saveDraft(target = draft.value.currentStep, notify = true) {
  if (busy.value) return false;
  synchronizeIpNumbers(draft.value);
  if (normalizeProjectAcquisitionMethods(draft.value.projects)) invalidateMaterials();
  if (normalizeProjectRows(draft.value.projects)) invalidateMaterials();
  fillMissingPeriods();
  validationMessage.value = ipSummaryError(sortIpSummaryRows(draft.value.ipSummary)) || stepError(draft.value, target);
  if (validationMessage.value) return false;
  saving.value = true;
  const company = companyId.value;
  const sequence = loadSequence;
  try {
    const input = JSON.parse(
      JSON.stringify({ ...draft.value, currentStep: target }),
    ) as HighTechDraft;
    const data = await saveHighTechApplicationApi(company, input);
    if (company !== companyId.value || sequence !== loadSequence) return false;
    const {
      companyName: name,
      updatedAt: _updatedAt,
      companyId: _id,
      ...value
    } = data;
    value.basicInfo = { ...emptyBasicInfo(), ...value.basicInfo };
    value.ipSummary ??= [];
    for (const row of value.projects) row.applicationDate ??= '';
    normalizeProjectAcquisitionMethods(value.projects);
    value.book = BOOK_SECTIONS.map(({ key }) => value.book?.find((item) => item.key === key) ?? { key, content: '', reviewed: false });
    value.attachments = ATTACHMENT_SECTIONS.map(({ key }) => ({ key, note: '', content: '', reviewed: false, ...value.attachments?.find((item) => item.key === key) }));
    synchronizeIpNumbers(value);
    draft.value = value;
    blankIpItem.value = newIpItem(value.ipSummary);
    companyName.value = name;
    savedSnapshot.value = JSON.stringify(value);
    if (notify) message.success('草稿已保存');
    return true;
  } catch (error) {
    if (company !== companyId.value || sequence !== loadSequence) return false;
    validationMessage.value = errorText(
      error,
      '保存失败，当前修改已保留，请重试',
    );
    return false;
  } finally {
    saving.value = false;
  }
}
async function changeStep(target: number) {
  if (target === draft.value.currentStep || busy.value) return;
  // Navigating back preserves unsaved input; forward navigation validates and persists it.
  if (target < draft.value.currentStep) {
    draft.value.currentStep = target;
    validationMessage.value = '';
  } else {
    if (await saveDraft(target, false) && target === 2) void loadAttachments(companyId.value, loadSequence);
  }
}
function fillMissingPeriods() {
  if (assignMissingResearchPeriods(draft.value.projects)) invalidateMaterials();
}
function invalidateMaterials() {
  for (const material of draft.value.materials) material.reviewed = false;
  for (const section of draft.value.book) section.reviewed = false;
}
function allocationIpName(id: string) {
  const ip = draft.value.ipSummary.find((item) => item.id === id);
  return ip ? `${ip.number}｜${ip.name}` : '已变化的知识产权';
}
async function previewAllocation() {
  if (busy.value || !draft.value.ipSummary.length || !draft.value.projects.length) return;
  const sequence = ++allocationSequence;
  const company = companyId.value;
  const source = allocationSnapshot(draft.value);
  allocating.value = true;
  allocationError.value = '';
  allocationPreview.value = null;
  allocationModalOpen.value = false;
  try {
    const preview = await previewHighTechIpAllocationApi(company, JSON.parse(source) as Pick<HighTechDraft, 'projects' | 'ipSummary'>);
    if (sequence !== allocationSequence || company !== companyId.value) return;
    if (source !== allocationSnapshot(draft.value)) {
      allocationError.value = '分析期间数据已变化，请重新生成预览';
      return;
    }
    allocationSource.value = source;
    allocationCompany.value = company;
    allocationPreview.value = preview;
    allocationModalOpen.value = true;
  } catch (error) {
    if (sequence === allocationSequence && company === companyId.value) allocationError.value = errorText(error, '自动分配预览失败，请重试');
  } finally {
    if (sequence === allocationSequence) allocating.value = false;
  }
}
function confirmAllocation() {
  if (!allocationPreview.value?.assignments.length || !allocationModalOpen.value || allocationStale.value || busy.value) return;
  try {
    const rows = applyIpAllocation(draft.value, allocationPreview.value, allocationSource.value);
    draft.value.projects = rows;
    delete draft.value.nameGeneration;
    invalidateMaterials();
    validationMessage.value = '';
    const count = allocationPreview.value.assignments.length;
    allocationModalOpen.value = false;
    allocationPreview.value = null;
    message.success(`已填入${count}项IP，未覆盖已有分配；请检查新增分支的PS及成果信息，并点击保存草稿`);
  } catch (error) {
    allocationError.value = error instanceof Error ? error.message : '分配预览已失效，请重新生成';
  }
}
function updateProjectIp(row: HighTechProject, value: unknown) {
  if (busy.value || (value != null && typeof value !== 'string')) return;
  if (!selectProjectIp(row, draft.value.ipSummary, String(value ?? ''))) return;
  delete draft.value.nameGeneration;
  invalidateMaterials();
  validationMessage.value = '';
}
function updateProjectField(
  row: HighTechProject,
  key: ProjectFieldKey,
  value?: number | string | null,
) {
  if (key === 'acquisitionMethod' && !row.ipNumber.trim()) return;
  if (busy.value || !updateProjectRow(draft.value.projects, row.id, key, value)) return;
  if (['ipName', 'ipType', 'authorizationNumber', 'applicationDate', 'authorizationDate', 'rdNumber', 'psNumber'].includes(key)) delete draft.value.nameGeneration;
  // Keep free-text period editing uninterrupted; blanks are filled on save.
  if (key !== 'researchPeriod') fillMissingPeriods();
  invalidateMaterials();
  validationMessage.value = '';
}
function addProject(afterId?: string, branch = false) {
  if (busy.value || !insertProjectRow(draft.value.projects, afterId, branch)) return;
  delete draft.value.nameGeneration;
  invalidateMaterials();
  validationMessage.value = '';
}
function deleteRow(id: string) {
  if (busy.value || !deleteProjectRow(draft.value.projects, id)) return;
  delete draft.value.nameGeneration;
  fillMissingPeriods();
  invalidateMaterials();
  validationMessage.value = '';
}
function updateIpField(row: HighTechIpItem, key: IpFieldKey, value?: number | string | null) {
  if (busy.value || key === 'number') return;
  const text = String(value ?? '');
  if (row[key] === text) return;
  row[key] = text;
  if (row.id === blankIpItem.value.id) {
    draft.value.ipSummary.push(row);
  }
  synchronizeIpNumbers(draft.value);
  blankIpItem.value = newIpItem(draft.value.ipSummary);
  validationMessage.value = '';
}
function addIpRow() {
  if (busy.value || draft.value.ipSummary.length >= 200) return;
  draft.value.ipSummary.push(newIpItem(draft.value.ipSummary));
  synchronizeIpNumbers(draft.value);
  blankIpItem.value = newIpItem(draft.value.ipSummary);
  validationMessage.value = '';
}
function deleteIpRow(id: string) {
  if (busy.value) return;
  const removedNumber = draft.value.ipSummary.find((row) => row.id === id)?.number;
  if (removedNumber) {
    for (const project of draft.value.projects) {
      const numbers = project.ipNumber.split(/[、,，;；\s]+/u);
      if (numbers.includes(removedNumber)) {
        project.ipNumber = numbers.filter((number) => number && number !== removedNumber).join('、');
        invalidateMaterials();
      }
    }
  }
  draft.value.ipSummary = draft.value.ipSummary.filter((row) => row.id !== id);
  synchronizeIpNumbers(draft.value);
  blankIpItem.value = newIpItem(draft.value.ipSummary);
  validationMessage.value = '';
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function showImportErrors(errors: string[]) {
  importErrors.value = errors;
  importErrorOpen.value = true;
}
async function importIpFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || busy.value) return;
  if (!/\.(xlsx|xlsm)$/iu.test(file.name) || file.size > 5 * 1024 * 1024) {
    showImportErrors(['请选择不超过5MB的 .xlsx 或 .xlsm 文件，不支持 .xls']);
    return;
  }
  const sequence = loadSequence;
  const id = companyId.value;
  importing.value = true;
  try {
    const data = await importHighTechIpSummaryApi(id, file);
    if (sequence !== loadSequence || id !== companyId.value) return;
    if (draft.value.ipSummary.length + data.rows.length > 200) {
      showImportErrors(['追加后超过200条上限，未导入任何数据']);
      return;
    }
    // Imported numbering belongs to the file, not to existing project references.
    for (const row of data.rows) {
      draft.value.ipSummary.push({ ...row, number: newIpItem(draft.value.ipSummary).number });
    }
    synchronizeIpNumbers(draft.value);
    blankIpItem.value = newIpItem(draft.value.ipSummary);
    validationMessage.value = '';
    message.success(`已导入 ${data.total} 项`);
  } catch (error) {
    if (sequence !== loadSequence || id !== companyId.value) return;
    const body = (error as { response?: { data?: { errors?: unknown } } })?.response?.data ?? error as { errors?: unknown };
    const errors = body?.errors;
    showImportErrors(Array.isArray(errors) && errors.length ? errors.map(String) : [errorText(error, '导入失败，请重试')]);
  } finally {
    importing.value = false;
  }
}
async function exportIpSummary() {
  if (busy.value) return;
  const id = companyId.value;
  const sequence = loadSequence;
  const rows = sortIpSummaryRows(draft.value.ipSummary).map((row, index) => ({ ...row, number: `IP${String(index + 1).padStart(2, '0')}` }));
  exportingIpSummary.value = true;
  validationMessage.value = '';
  try {
    const blob = await exportHighTechIpSummaryApi(id, rows);
    if (id !== companyId.value || sequence !== loadSequence) return;
    downloadBlob(blob, '知识产权汇总表.xlsx');
  } catch (error) {
    if (id !== companyId.value || sequence !== loadSequence) return;
    validationMessage.value = errorText(error, '知识产权汇总表导出失败，请重试');
  } finally {
    exportingIpSummary.value = false;
  }
}
async function importProjectFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || busy.value || fieldsRecommending.value) return;
  if (!/\.xlsx$/iu.test(file.name) || file.size > 5 * 1024 * 1024) {
    showImportErrors(['请选择不超过5MB的 .xlsx 文件']);
    return;
  }
  const sequence = loadSequence;
  const id = companyId.value;
  importingProjects.value = true;
  try {
    const data = await importHighTechProjectDetailsApi(id, file);
    if (sequence !== loadSequence || id !== companyId.value) return;
    const description = data.rows.length
      ? `已解析 ${data.rows.length} 条记录，将替换当前全部 ${draft.value.projects.length} 条项目详情。`
      : `文件没有数据，将清空当前全部 ${draft.value.projects.length} 条项目详情。`;
    if (!window.confirm(`${description}\n替换后需点击“保存草稿”保存。确定替换吗？`)) return;
    const rows = data.rows.map((row) => ({ ...row, id: crypto.randomUUID() }));
    normalizeProjectRows(rows);
    normalizeProjectAcquisitionMethods(rows);
    assignMissingResearchPeriods(rows);
    draft.value.projects = rows;
    delete draft.value.nameGeneration;
    allocationPreview.value = null;
    allocationModalOpen.value = false;
    allocationError.value = '';
    nameGenerationError.value = '';
    nameGenerationProgressState.value = 'idle';
    recommendedFields.value = [];
    fieldRecommendationError.value = '';
    invalidateMaterials();
    validationMessage.value = '';
    message.success(`已替换为 ${rows.length} 条项目详情，请保存草稿`);
  } catch (error) {
    if (sequence !== loadSequence || id !== companyId.value) return;
    const body = (error as { response?: { data?: { errors?: unknown } } })?.response?.data ?? error as { errors?: unknown };
    showImportErrors(Array.isArray(body?.errors) && body.errors.length ? body.errors.map(String) : [errorText(error, '项目详情导入失败，请重试')]);
  } finally {
    importingProjects.value = false;
  }
}
async function exportProjectDetails() {
  if (busy.value) return;
  const id = companyId.value;
  const sequence = loadSequence;
  exportingProjects.value = true;
  validationMessage.value = '';
  try {
    const blob = await exportHighTechProjectDetailsApi(id, draft.value.projects.map((row) => ({ ...row })));
    if (id !== companyId.value || sequence !== loadSequence) return;
    downloadBlob(blob, '项目详情表.xlsx');
  } catch (error) {
    if (id !== companyId.value || sequence !== loadSequence) return;
    validationMessage.value = errorText(error, '项目详情表导出失败，请重试');
  } finally {
    exportingProjects.value = false;
  }
}
async function recognizeIpPdfs(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (busy.value || !files.length) return;
  if (files.length > 10 || files.some((file) => !/\.pdf$/i.test(file.name) || file.size > 10 * 1024 * 1024) || files.reduce((total, file) => total + file.size, 0) > 30 * 1024 * 1024) {
    validationMessage.value = '每次最多10个PDF，单个不超过10MB，总大小不超过30MB';
    return;
  }
  const id = companyId.value;
  const sequence = loadSequence;
  recognizingPdf.value = true;
  validationMessage.value = '';
  recognitionRows.value = [];
  recognitionValidation.value = '';
  recognitionErrors.value = [];
  recognitionWarnings.value = [];
  try {
    const assigned = [...draft.value.ipSummary];
    // One request per file avoids a long batch exhausting the reverse proxy timeout.
    for (const [index, file] of files.entries()) {
      recognitionProgress.value = `${index + 1}/${files.length}`;
      try {
        const result = await recognizeHighTechIpPdfsApi(id, [file]);
        if (id !== companyId.value || sequence !== loadSequence) return;
        for (const row of result.rows) {
          const item = { ...row, id: crypto.randomUUID(), number: newIpItem(assigned).number };
          assigned.push(item);
          recognitionRows.value.push(item);
        }
        recognitionErrors.value.push(...result.errors);
        recognitionWarnings.value.push(...result.warnings);
      } catch (error) {
        if (id !== companyId.value || sequence !== loadSequence) return;
        recognitionErrors.value.push(`第${index + 1}个文件：${errorText(error, '识别失败，请稍后重试')}`);
      }
    }
    recognitionModalOpen.value = true;
  } catch (error) {
    if (id === companyId.value && sequence === loadSequence) validationMessage.value = errorText(error, 'PDF识别失败，请稍后重试');
  } finally {
    recognizingPdf.value = false;
  }
}
function appendRecognitionRows() {
  recognitionValidation.value = '';
  if (busy.value || !recognitionRows.value.length) return;
  let rows: HighTechIpItem[];
  try { rows = prepareRecognizedIpRows(draft.value.ipSummary, recognitionRows.value); }
  catch (error) { recognitionValidation.value = error instanceof Error ? error.message : '识别结果校验失败'; return; }
  draft.value.ipSummary.push(...rows);
  synchronizeIpNumbers(draft.value);
  blankIpItem.value = newIpItem(draft.value.ipSummary);
  recognitionRows.value = [];
  recognitionModalOpen.value = false;
  message.success(`已追加${rows.length}项知识产权，请点击保存以保留修改`);
}
function closePreview() {
  previewOpen.value = false;
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
}
async function loadAttachments(company: string, sequence: number) {
  try {
    const rows = await listHighTechAttachmentsApi(company);
    if (company === companyId.value && sequence === loadSequence) attachmentRows.value = rows;
  } catch (error) {
    if (company === companyId.value && sequence === loadSequence) materialError.value = errorText(error, '附件目录加载失败');
  }
}
function canLeave() {
  if (busy.value) return false;
  return (
    !(dirty.value || (recognitionModalOpen.value && recognitionRows.value.length)) || window.confirm('有未保存或尚未追加的修改，确定离开并放弃这些修改吗？')
  );
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || busy.value || (recognitionModalOpen.value && recognitionRows.value.length)) {
    event.preventDefault();
    event.returnValue = '';
  }
}
onBeforeRouteLeave(canLeave);
onBeforeRouteUpdate(
  (to, from) => to.params.companyId === from.params.companyId || canLeave(),
);
window.addEventListener('beforeunload', beforeUnload);
onBeforeUnmount(() => {
  allocationSequence++;
  nameGenerationSequence++;
  stopNameGenerationProgress();
  loadSequence++;
  fieldCatalogSequence++;
  fieldRecommendationSequence++;
  closePreview();
  window.removeEventListener('beforeunload', beforeUnload);
});
watch(() => JSON.stringify(patentNames.value), resetFieldRecommendations);
watch(companyId, loadDraft, { immediate: true });
</script>

<template>
  <Page auto-content-height content-class="p-0">
    <div class="high-tech-page" :class="{ 'high-tech-page--project': draft.currentStep === 1 && !loading && !errorMessage }">
      <header class="page-header">
        <div class="page-heading">
          <div class="page-title-row">
            <h1>高新技术企业申报</h1>
            <Tag
              v-if="!loading && !errorMessage"
              :color="dirty ? 'orange' : 'blue'"
              >{{ dirty ? '有未保存的修改' : '申报草稿' }}</Tag
            >
          </div>
          <p class="page-subtitle">{{ loading ? '正在加载企业档案…' : companyName }}</p>
        </div>
      </header>

      <Skeleton v-if="loading" active />
      <Alert
        v-else-if="errorMessage"
        type="error"
        show-icon
        :message="errorMessage"
      >
        <template #action
          ><Button @click="loadDraft">重新加载</Button></template
        >
      </Alert>
      <template v-else>
        <div class="workflow-steps"
          ><Steps
            size="small"
            :current="draft.currentStep"
            :items="steps"
            :on-change="changeStep"
        /></div>
        <Alert
          v-if="validationMessage"
          role="alert"
          type="error"
          show-icon
          :message="validationMessage"
        />

        <section
          v-if="draft.currentStep === 0"
          aria-label="知识产权汇总表"
          class="step-section"
        >
          <div class="project-table-card ip-table-section">
            <div class="table-heading ip-table-heading">
              <div class="table-title">
                <h2>知识产权汇总表</h2>
                <span class="field-hint">知识产权 · {{ draft.ipSummary.length }} 项</span>
              </div>
              <div class="ip-toolbar">
                <Button v-if="draft.ipSummary.length" :disabled="busy || draft.ipSummary.length >= 200" @click="addIpRow">
                  <template #icon><PlusIcon /></template>新增知识产权
                </Button>
                <input ref="recognizePdfInput" type="file" accept=".pdf,application/pdf" multiple hidden @change="recognizeIpPdfs" />
                <Button :disabled="busy || draft.ipSummary.length >= 200" :loading="recognizingPdf" @click="recognizePdfInput?.click()">
                  <template #icon><UploadIcon /></template>{{ recognizingPdf ? `正在识别PDF ${recognitionProgress}…` : 'PDF上传识别' }}
                </Button>
                <input ref="importInput" type="file" accept=".xlsx,.xlsm" hidden @change="importIpFile" />
                <Button :disabled="busy || draft.ipSummary.length >= 200" :loading="importing" @click="importInput?.click()">
                  <template #icon><UploadIcon /></template>导入
                </Button>
                <Button :disabled="busy" :loading="exportingIpSummary" @click="exportIpSummary">
                  <template #icon><DownloadIcon /></template>导出
                </Button>
              </div>
            </div>
            <p class="field-hint" role="status">PDF识别：每批最多10个，单个10MB、总计30MB；每份读取前6页。文档内容将发送至配置的AI服务，核对后追加，不覆盖已有数据。</p>
            <Table
              :columns="ipColumns"
              :data-source="ipRows"
              row-key="id"
              :pagination="{ pageSize: 10, showSizeChanger: false }"
              :scroll="{ x: 1640 }"
            >
              <template #bodyCell="{ column, record, index }">
                <div v-if="column.key === 'actions'" class="row-actions">
                  <span v-if="record.id === blankIpItem.id" class="field-hint">待填写</span>
                  <Popconfirm v-else title="确定删除这项知识产权吗？" ok-text="删除" cancel-text="取消" @confirm="deleteIpRow(record.id)">
                    <Button type="text" danger :disabled="busy" :aria-label="`删除知识产权${record.number || index + 1}`" title="删除知识产权">
                      <template #icon><DeleteIcon /></template>
                    </Button>
                  </Popconfirm>
                </div>
                <Select
                  v-else-if="column.key === 'patentType' || column.key === 'legalStatus'"
                  :value="record[column.key] || undefined"
                  :options="column.key === 'patentType' ? patentTypeOptions : legalStatusOptions"
                  :aria-label="`知识产权第${index + 1}行${column.title}`"
                  :placeholder="`选择${column.title}`"
                  :disabled="busy"
                  class="project-input"
                  @update:value="(value) => { if (typeof value === 'string') updateIpField(record, column.key as IpFieldKey, value); }"
                />
                <Input
                  v-else
                  :id="`ip-${record.id}-${column.key}`"
                  :value="record[column.key as IpFieldKey]"
                  :aria-label="`知识产权第${index + 1}行${column.title}`"
                  :type="column.key === 'grantDate' || column.key === 'applicationDate' ? 'date' : 'text'"
                  :placeholder="ipFieldExamples[String(column.key)]"
                  :maxlength="512"
                  :disabled="busy || column.key === 'number'"
                  class="project-input"
                  @update:value="(value) => updateIpField(record, column.key as IpFieldKey, value)"
                />
              </template>
            </Table>
          </div>
        </section>

        <section
          v-else-if="draft.currentStep === 1"
          aria-label="制作高新核心信息"
          class="step-section project-section"
        >
          <div class="section-heading project-section-heading">
            <div>
              <h2>制作高新核心信息</h2>
              <p>
                关联研发活动、知识产权、PS与科技成果。同一RD的前四列合并共享，分支分别填写知识产权和成果。
                空白研发周期按年份自动分配，通常约8个月，单项目为全年；已填写时间保留，请结合实际研发情况核对。
              </p>
            </div>
          </div>
          <Alert
            v-for="warning in periodWarnings"
            :key="warning"
            :message="warning"
            type="warning"
            show-icon
          />
          <div class="project-table-card">
            <div class="table-heading">
              <div class="table-title">
                <h3>项目详情表</h3>
                <span class="field-hint">{{ projectGroups.length }} 个RD / {{ draft.projects.length }} 条记录</span>
                <div class="tech-field-toolbar">
                  <Button :disabled="busy || !draft.ipSummary.length || !draft.projects.length" :loading="allocating" @click="previewAllocation">
                    <template #icon><RecommendIcon /></template>{{ allocating ? '正在进行两轮分配…' : 'IP自动分配' }}
                  </Button>
                  <div class="name-generation-control" :data-state="nameGenerationProgressState">
                    <Button class="name-generation-button" aria-label="一键生成" :aria-busy="namesGenerating"
                            :aria-describedby="nameGenerationProgressState !== 'idle' ? 'name-generation-progress-feedback' : undefined"
                            :disabled="busy || fieldsRecommending || !draft.projects.length" :loading="namesGenerating" @click="generateNames">
                      <template #icon><RecommendIcon /></template>
                      <span class="name-generation-button-content">
                        <span>一键生成</span>
                        <span class="name-generation-percent" :class="{ 'name-generation-percent--hidden': nameGenerationProgressState === 'idle' }" aria-hidden="true">{{ nameGenerationProgress }}%</span>
                      </span>
                    </Button>
                    <span v-if="nameGenerationProgressState !== 'idle'" class="name-generation-progress" role="progressbar"
                          :aria-label="nameGenerationProgressState === 'success' ? '名称生成进度' : '名称生成进度（估算）'"
                          :aria-valuenow="nameGenerationProgress" :aria-valuemin="0" :aria-valuemax="100"
                          :aria-valuetext="`${nameGenerationProgress}% · ${nameGenerationProgressText}`">
                      <span class="name-generation-progress-fill" :style="{ width: `${nameGenerationProgress}%` }"></span>
                    </span>
                  </div>
                  <Button :disabled="busy || !draft.projects.length" :loading="fieldsRecommending" @click="recommendFields">
                    <template #icon><RecommendIcon /></template>
                    高新技术领域推荐
                  </Button>
                  <Select
                    class="tech-field-select"
                    aria-label="搜索全部高新技术领域"
                    placeholder="搜索全部领域并选择"
                    :value="selectedField"
                    :options="fieldOptions"
                    :show-search="{ filterOption: matchesTechField }"
                    :loading="fieldCatalogLoading"
                    :disabled="busy || !draft.projects.length"
                    :popup-match-select-width="false"
                    :virtual="false"
                    :styles="{ popup: { root: { width: 'min(760px, calc(100vw - 32px))', maxWidth: 'calc(100vw - 32px)' } } }"
                    :classes="{ popup: { root: 'high-tech-field-popup' } }"
                    @update:value="selectField"
                  />
                  <Button v-if="fieldCatalogError" size="small" :disabled="fieldCatalogLoading" @click="loadFieldCatalog">重试领域目录</Button>
                </div>
              </div>
              <div class="project-table-tools">
                <div class="project-file-actions">
                  <input ref="projectImportInput" type="file" accept=".xlsx" hidden aria-label="导入项目详情Excel文件" @change="importProjectFile" />
                  <Button :disabled="busy || fieldsRecommending" :loading="importingProjects" @click="projectImportInput?.click()">
                    <template #icon><UploadIcon /></template>导入项目详情
                  </Button>
                  <Button :disabled="busy" :loading="exportingProjects" @click="exportProjectDetails">
                    <template #icon><DownloadIcon /></template>导出项目详情
                  </Button>
                </div>
                <div class="project-zoom-control">
                  <label for="project-table-zoom">表格缩放</label>
                  <input id="project-table-zoom" v-model.number="projectZoom" type="range" min="50" max="100" step="5" :aria-valuetext="`${projectZoom}%`" />
                  <output for="project-table-zoom">{{ projectZoom }}%</output>
                  <Button size="small" aria-label="重置表格缩放" :disabled="projectZoom === 100" @click="projectZoom = 100">重置</Button>
                </div>
                <span class="field-hint">共{{ PROJECT_FIELDS.length }}项信息，可缩放或横向滚动查看</span>
              </div>
            </div>
            <p class="field-hint">可先分配IP，再生成研发活动、成果与PS名称。第一轮尽量一RD一个IP，同等时间条件优先靠前RD；第二轮仅将剩余IP追加到已有相近名称IP的RD，尽量均衡数量。无需填写RD名称或技术领域，不使用技术评分和分数门槛。先预览，确认后填入IP序号、名称、授权号、申请日期、授权日期和类型，不覆盖已有内容、不自动保存。仅第二轮所需的IP名称会发送至配置的AI服务；没有合适对象可留空。</p>
            <p class="field-hint project-edit-hint">
              直接在字段下方填写或修改，点击“保存草稿”保存；进入材料制作前需填写完整。
              {{
                draft.projects.length >= PROJECT_ROW_LIMIT
                  ? '已达200条上限。'
                  : '点击新增RD插入独立项目，点击新增分支添加关联记录；RD和成果序号按行序自动排列。'
              }}
            </p>
            <Alert v-if="allocationError" type="error" show-icon :message="allocationError" role="alert" />
            <div v-if="fieldCatalogError || fieldRecommendationError" class="tech-field-error" role="status">{{ fieldCatalogError || fieldRecommendationError }}</div>
            <div v-if="nameGenerationProgressState !== 'idle'" id="name-generation-progress-feedback" class="name-generation-feedback" role="status">{{ nameGenerationProgressText }}</div>
            <div v-if="nameGenerationError" class="tech-field-error" role="alert">{{ nameGenerationError }}</div>
            <div v-if="draft.nameGeneration" class="name-generation-status">
              <Tooltip :title="draft.nameGeneration.warnings.join('\n')"><Tag color="blue">名称已生成</Tag></Tooltip>
              <span class="field-hint">{{ draft.nameGeneration.products.length }} 项PS</span>
            </div>
            <Button v-if="!draft.projects.length" type="primary" :disabled="busy" @click="addProject()">
              <template #icon><PlusIcon /></template>新增RD
            </Button>
            <div class="project-table-zoom" :style="{ zoom: projectZoom / 100 }">
            <Table
              :columns="columns"
              :data-source="draft.projects"
              row-key="id"
              :pagination="false"
              :scroll="{ x: 3080, y: 600 }"
            >
              <template #bodyCell="{ column, record, index }">
                <div v-if="column.key === 'actions'" class="row-actions">
                  <Popconfirm
                    title="确定删除这条项目详情吗？"
                    ok-text="删除"
                    cancel-text="取消"
                    @confirm="deleteRow(record.id)"
                    ><Button
                      type="link"
                      danger
                      :disabled="busy"
                      :aria-label="`删除${record.rdNumber}`"
                      >删除</Button
                    ></Popconfirm
                  >
                  <Button type="link" :disabled="busy || draft.projects.length + DEFAULT_PROJECT_BRANCH_COUNT > PROJECT_ROW_LIMIT" :aria-label="`在第${index + 1}条记录后新增RD`" @click="addProject(record.id)">新增RD</Button>
                  <Button type="link" :disabled="busy || draft.projects.length >= PROJECT_ROW_LIMIT" :aria-label="`在第${index + 1}条记录后新增分支`" @click="addProject(record.id, true)">新增分支</Button>
                </div>
                <InputNumber
                  v-else-if="column.key === 'year'"
                  :id="`project-${record.id}-${column.key}`"
                  :value="record.year"
                  :aria-label="`第${index + 1}行${column.title}`"
                  :min="1900"
                  :max="2100"
                  :precision="0"
                  :disabled="busy"
                  class="project-input"
                  @update:value="
                    (value) => updateProjectField(record, 'year', value)
                  "
                />
                <Select
                  v-else-if="column.key === 'ipNumber'"
                  :id="`project-${record.id}-ipNumber`"
                  :value="record.ipNumber"
                  :options="projectIpOptions(draft.ipSummary, record.ipNumber)"
                  :aria-label="`第${index + 1}行${column.title}`"
                  placeholder="选择知识产权"
                  :not-found-content="draft.ipSummary.length ? '未找到匹配的知识产权' : '请先填写知识产权汇总表'"
                  :disabled="busy"
                  show-search
                  option-filter-prop="label"
                  allow-clear
                  class="project-input"
                  @update:value="(value) => updateProjectIp(record, value)"
                />
                <Select
                  v-else-if="column.key === 'ipType' || column.key === 'acquisitionMethod'"
                  :id="`project-${record.id}-${column.key}`"
                  :value="record[column.key] || undefined"
                  :options="column.key === 'ipType' ? projectIpTypeOptions : projectAcquisitionMethodOptions"
                  :aria-label="`第${index + 1}行${column.title}`"
                  :placeholder="column.key === 'acquisitionMethod' && !record.ipNumber.trim() ? '' : projectFieldExamples[String(column.key)]"
                  :disabled="busy || (column.key === 'acquisitionMethod' && !record.ipNumber.trim())"
                  class="project-input"
                  @update:value="(value) => { if (typeof value === 'string') updateProjectField(record, column.key as ProjectFieldKey, value); }"
                />
                <div v-else-if="column.key === 'psNumber'" class="ps-name-cell">
                  <Input
                    :id="`project-${record.id}-psNumber`"
                    :value="record.psNumber"
                    :aria-label="`第${index + 1}行${column.title}`"
                    :placeholder="projectFieldExamples.psNumber"
                    :maxlength="512"
                    :disabled="busy"
                    class="project-input"
                    @update:value="(value) => updateProjectField(record, 'psNumber', value)"
                  />
                  <Input
                    :id="`project-${record.id}-psName`"
                    :value="record.psName"
                    :aria-label="`第${index + 1}行PS名称`"
                    placeholder="PS名称"
                    :maxlength="512"
                    :disabled="busy"
                    class="project-input"
                    @update:value="(value) => updateProjectField(record, 'psName', value)"
                  />
                  <Tooltip v-if="nameReasons.get(record.id)" :title="nameReasons.get(record.id)"><Tag>关联依据</Tag></Tooltip>
                </div>
                <Input
                  v-else
                  :id="`project-${record.id}-${column.key}`"
                  :value="record[column.key as ProjectFieldKey]"
                  :readonly="column.key === 'rdNumber' || column.key === 'achievementNumber'"
                  :aria-label="`第${index + 1}行${column.title}`"
                  :type="(column.key === 'applicationDate' || column.key === 'authorizationDate') ? 'date' : 'text'"
                  :placeholder="projectFieldExamples[String(column.key)]"
                  :maxlength="512"
                  :disabled="busy"
                  class="project-input"
                  @update:value="
                    (value) =>
                      updateProjectField(
                        record,
                        column.key as ProjectFieldKey,
                        value,
                      )
                  "
                />
              </template>
            </Table>
            </div>
          </div>
        </section>

        <MaterialWorkspace v-else :key="companyId" :draft="draft" :company-id="companyId" :company-name="companyName" :busy="busy" :save="() => saveDraft(2, false)" @working="workspaceBusy = $event" @core="changeStep(1)" />

        <Teleport v-if="draft.currentStep < 2" to="body">
          <div class="floating-actions" role="group" aria-label="申报流程操作">
            <Button
              v-if="draft.currentStep > 0"
              :disabled="busy"
              @click="changeStep(draft.currentStep - 1)"
              >上一步</Button
            >
            <Button
              :loading="saving"
              :disabled="busy"
              @click="saveDraft()"
              >保存草稿</Button
            >
            <Button
              v-if="draft.currentStep < 2"
              type="primary"
              :loading="saving"
              :disabled="busy"
              @click="changeStep(draft.currentStep + 1)"
              >保存并下一步</Button
            >
          </div>
        </Teleport>
      </template>
    </div>
    <Modal v-model:open="previewOpen" title="附件预览" :width="'min(1000px, 95vw)'" :footer="null" @cancel="closePreview" @after-close="closePreview">
      <iframe v-if="previewUrl" :src="previewUrl" class="attachment-preview" title="PDF 附件预览" />
    </Modal>
    <Modal v-model:open="allocationModalOpen" title="IP → RD 自动分配预览" :width="'min(1100px, 95vw)'" :footer="null">
      <div v-if="allocationPreview" class="allocation-preview">
        <Alert type="info" show-icon message="以下为业务分配建议，不作法律或资格认定。核对后仅填入当前草稿，仍需保存。新增分支的PS、成果等空白信息请另行补充。" />
        <p class="field-hint">
          发明、实用新型、软著使用相同规则：申请日期 ≤ RD开始日期须手动分配；RD开始日期 &lt; 申请日期 ≤ RD结束日期优先，申请日期 &gt; RD结束日期作为后备。
          第一轮先在可选RD中尽量每个RD分配一个IP，已有IP计入数量；同等时间条件优先表格靠前的RD。还有剩余IP时，第二轮仅追加到已有相近名称IP的RD，时间优先后尽量均衡数量。不再采用四维评分或60分门槛，也不强制所有RD或IP均被分配。
        </p>
        <p role="status">建议新增 <strong>{{ allocationPreview.assignments.length }}</strong> 项 · 保留已有 {{ allocationPreview.preserved.length }} 项 · 未分配 {{ allocationPreview.unassigned.length }} 项</p>
        <h3>RD数量分布</h3>
        <div class="allocation-distribution">
          <span v-for="item in allocationPreview.distribution" :key="item.projectId" class="allocation-count">
            {{ item.rdNumber }}：{{ item.existingCount }} → <strong>{{ item.existingCount + item.addedCount }}</strong><span class="field-hint">（新增{{ item.addedCount }}）</span>
          </span>
        </div>
        <h3>建议分配及两轮依据</h3>
        <p v-if="!allocationPreview.assignments.length">暂无符合条件的自动分配，原有项目详情保持不变。</p>
        <div class="allocation-scroll">
          <article v-for="item in allocationPreview.assignments" :key="item.ipId" class="allocation-item">
            <strong>{{ allocationIpName(item.ipId) }} → {{ item.rdNumber }}</strong>
            <p><Tag :color="item.round === 'spread' ? 'blue' : 'orange'">{{ item.round === 'spread' ? '第一轮·分散分配' : '第二轮·相近名称追加' }}</Tag><Tag>{{ item.timing === 'within' ? '研发期内（优先）' : '研发期后（后备）' }}</Tag></p>
            <p v-if="item.similarNames.length" class="field-hint">同RD相近IP名称：{{ item.similarNames.join('；') }}</p>
            <p>{{ item.reason }}</p>
          </article>
        </div>
        <details v-if="allocationPreview.unassigned.length || allocationPreview.warnings.length" open>
          <summary>未分配原因及手动核对提醒</summary>
          <ul class="recognition-notices">
            <li v-for="item in allocationPreview.unassigned" :key="item.ipId">{{ allocationIpName(item.ipId) }}：{{ item.reason }}</li>
            <li v-for="(warning, index) in allocationPreview.warnings" :key="`warning-${index}`">{{ warning }}</li>
          </ul>
        </details>
        <details v-if="allocationPreview.nameGroups.length">
          <summary>查看第二轮IP名称分组（{{ allocationPreview.nameGroups.length }}组）</summary>
          <div class="allocation-scroll">
            <article v-for="item in allocationPreview.nameGroups" :key="item.id" class="allocation-item">
              <strong>{{ item.names.join('；') }}</strong>
              <p>{{ item.reason }}</p>
            </article>
          </div>
        </details>
        <Alert v-if="allocationStale" type="warning" show-icon message="知识产权或项目详情已变化，请关闭并重新生成预览，旧结果不能填入。" />
        <Alert v-if="allocationError" type="error" show-icon :message="allocationError" role="alert" />
        <div class="recognition-actions">
          <Button @click="allocationModalOpen = false">取消</Button>
          <Button type="primary" :disabled="busy || allocationStale || !allocationPreview.assignments.length" @click="confirmAllocation">确认分配，填入项目详情</Button>
        </div>
      </div>
    </Modal>
    <Modal v-model:open="recognitionModalOpen" title="知识产权PDF识别结果 · 核对后追加" :width="'95vw'" :mask-closable="false" :footer="null">
      <Alert type="warning" show-icon message="识别结果可能存在遗漏。请补齐空白字段、核对日期和权利人；历史证书不能证明当前法律状态。追加后仍需点击页面保存。" />
      <ul v-if="recognitionErrors.length || recognitionWarnings.length" class="recognition-notices" role="status">
        <li v-for="(error, index) in recognitionErrors" :key="`error-${index}`">识别失败：{{ error }}</li>
        <li v-for="(warning, index) in recognitionWarnings" :key="`warning-${index}`">待核对：{{ warning }}</li>
      </ul>
      <Table :columns="recognitionColumns" :data-source="recognitionRows" row-key="id" :pagination="{ pageSize: 5, showSizeChanger: false }" :scroll="{ x: 1820 }">
        <template #bodyCell="{ column, record, index }">
          <Button v-if="column.key === 'actions'" type="text" danger :aria-label="`移除识别结果第${index + 1}项`" @click="recognitionRows = recognitionRows.filter((row) => row.id !== record.id)">移除</Button>
          <Select
            v-else-if="column.key === 'patentType' || column.key === 'legalStatus'"
            v-model:value="record[column.key]"
            :options="column.key === 'patentType' ? patentTypeOptions : legalStatusOptions"
            :styles="column.key === 'legalStatus' ? { popup: { root: { minWidth: '180px' } } } : undefined"
            :aria-label="`识别结果第${index + 1}项${column.title}`"
            class="project-input"
          />
          <Input v-else v-model:value="record[column.key as IpFieldKey]" :type="column.key === 'grantDate' || column.key === 'applicationDate' ? 'date' : 'text'" :maxlength="512" :aria-label="`识别结果第${index + 1}项${column.title}`" class="project-input" />
        </template>
      </Table>
      <Alert v-if="recognitionValidation" type="error" show-icon :message="recognitionValidation" role="alert" />
      <div class="recognition-actions">
        <span class="field-hint">识别{{ recognitionRows.length }}项 · 原表{{ draft.ipSummary.length }}项 / 最多200项</span>
        <Button @click="recognitionModalOpen = false; recognitionRows = []">取消</Button>
        <Button type="primary" :disabled="busy || !recognitionRows.length" @click="appendRecognitionRows">核对无误，追加到汇总表</Button>
      </div>
    </Modal>
    <Modal v-model:open="importErrorOpen" title="知识产权导入失败" :footer="null">
      <ul class="import-error-list" role="alert">
        <li v-for="(error, index) in importErrors" :key="index">{{ error }}</li>
      </ul>
    </Modal>
  </Page>
</template>

<style scoped>
.allocation-preview { display: grid; gap: 12px; min-width: 0; overflow-wrap: anywhere; }
.allocation-preview h3, .allocation-preview p { margin: 0; }
.allocation-preview summary { cursor: pointer; padding-block: 8px; font-weight: 600; }
.allocation-distribution { display: flex; flex-wrap: wrap; gap: 8px; }
.allocation-count { padding: 6px 10px; border: 1px solid hsl(var(--border)); border-radius: 6px; }
.allocation-scroll { max-height: 340px; overflow-y: auto; }
.allocation-item { display: grid; gap: 6px; padding: 12px 0; border-bottom: 1px solid hsl(var(--border)); }
.high-tech-page {
  display: grid;
  gap: 10px;
  width: 100%;
  min-width: 0;
  padding: 8px 12px calc(44px + max(12px, env(safe-area-inset-bottom)));
}
.high-tech-page--project { padding-inline: 8px; }
.workflow-steps { padding: 6px 4px 10px; border-bottom: 1px solid hsl(var(--border)); }
.project-table-card { min-width: 0; }
.project-table-card .project-edit-hint { margin: 6px 0 8px; }
.ip-table-section { padding-block: 12px 16px; }
.table-title, .ip-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.table-title h2, .table-title h3 { margin: 0; font-size: 16px; font-weight: 600; }
.tech-field-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; max-width: 100%; min-width: 0; }
.name-generation-control { position: relative; flex: 0 0 160px; width: 160px; height: 32px; }
.name-generation-button { width: 100%; height: 100%; }
.name-generation-button-content { display: inline-flex; align-items: center; gap: 8px; }
.name-generation-percent { display: inline-block; width: 34px; font-size: 12px; font-variant-numeric: tabular-nums; text-align: right; }
.name-generation-percent--hidden { visibility: hidden; }
.name-generation-progress { position: absolute; right: 1px; bottom: 1px; left: 1px; height: 3px; overflow: hidden; border-radius: 0 0 6px 6px; background: hsl(var(--muted)); pointer-events: none; }
.name-generation-progress-fill { display: block; height: 100%; background: hsl(var(--primary)); transition: width 0.3s ease; }
.name-generation-control[data-state='success'] .name-generation-progress-fill { background: #15803d; }
.name-generation-control[data-state='error'] .name-generation-progress-fill { background: #b42318; }
.name-generation-feedback { margin-bottom: 8px; color: hsl(var(--muted-foreground)); font-size: 13px; overflow-wrap: anywhere; }
@media (prefers-reduced-motion: reduce) { .name-generation-progress-fill { transition: none; } }
.tech-field-select { width: 360px; max-width: 100%; min-width: 0; }
.tech-field-error { color: #b42318; font-size: 13px; margin-bottom: 8px; overflow-wrap: anywhere; }
.name-generation-status { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
.ps-name-cell { display: grid; grid-template-columns: 88px minmax(0, 1fr); align-items: center; justify-items: start; gap: 6px; min-width: 0; }
:global(.high-tech-field-popup .ant-select-item-option-content) { white-space: normal; overflow-wrap: anywhere; line-height: 1.5; }
.import-error-list { max-height: 60vh; overflow-y: auto; padding-left: 20px; overflow-wrap: anywhere; }
.import-error-list li { margin-block: 8px; }
.recognition-notices { max-height: 160px; overflow-y: auto; padding-left: 20px; overflow-wrap: anywhere; }
.recognition-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 16px; }
.high-tech-page > *,
.step-section > * {
  min-width: 0;
}
.page-header,
.section-heading,
.table-heading {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}
.page-header {
  min-height: 44px;
  align-items: center;
}
.page-heading {
  min-width: 0;
}
.page-title-row,
.page-subtitle {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: center;
}
.page-title-row {
  margin-bottom: 0;
}
.page-subtitle {
  overflow-wrap: anywhere;
}
.floating-actions {
  position: fixed;
  bottom: max(12px, env(safe-area-inset-bottom));
  right: max(24px, env(safe-area-inset-right));
  z-index: 100;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  max-width: calc(100vw - 32px);
}
.floating-actions :deep(button) {
  color: hsl(var(--foreground));
  background: rgb(255 255 255 / 68%);
  border-color: rgb(255 255 255 / 88%);
  box-shadow:
    0 3px 12px rgb(31 41 55 / 14%),
    inset 0 1px 0 rgb(255 255 255 / 78%);
  backdrop-filter: blur(12px) saturate(150%);
  transition:
    background-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}
.floating-actions :deep(button:hover:not(:disabled)) {
  background: rgb(255 255 255 / 86%);
  box-shadow:
    0 5px 16px rgb(31 41 55 / 18%),
    inset 0 1px 0 rgb(255 255 255 / 90%);
  transform: translateY(-1px);
}
.floating-actions :deep(.ant-btn-primary) {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 14%);
  border-color: hsl(var(--primary) / 30%);
}
.floating-actions :deep(.ant-btn-primary:hover:not(:disabled)) {
  background: hsl(var(--primary) / 22%);
  border-color: hsl(var(--primary) / 42%);
}
h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
  line-height: 1.35;
}
h2 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
}
.page-header p,
.section-heading p {
  margin: 0;
  color: hsl(var(--muted-foreground));
}
.step-section {
  display: grid;
  min-width: 0;
  gap: 20px;
}
.project-section {
  gap: 4px;
}
.project-section-heading > div {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  align-items: baseline;
}
.project-section-heading h2 {
  margin: 0;
  font-size: 18px;
}
.project-section-heading p {
  font-size: 13px;
}
.field-hint {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}
.project-input {
  width: 100%;
}
.field-hint {
  margin: 10px 0 0;
}
.table-heading {
  margin-bottom: 6px;
}
.project-table-tools {
  display: grid;
  flex: 0 0 auto;
  gap: 8px;
  justify-items: end;
  max-width: 100%;
}
.project-file-actions,
.project-zoom-control {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.project-zoom-control { font-size: 13px; }
.project-zoom-control input { width: 120px; accent-color: hsl(var(--primary)); }
.project-zoom-control output { min-width: 36px; font-variant-numeric: tabular-nums; }
.project-table-zoom { min-width: 0; }
.table-heading .field-hint {
  margin: 0;
}
.row-actions,
.material-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.row-actions {
  flex-wrap: nowrap;
  gap: 0;
}
.row-actions .field-hint {
  margin: 0;
}
.row-actions :deep(button) {
  padding-inline: 8px;
}
.material-footer {
  gap: 16px;
  margin-top: 24px;
}
.material-footer .field-hint {
  margin: 0;
}
.material-tabs,
.material-section-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.material-section {
  padding: 20px 0;
  border-bottom: 1px solid hsl(var(--border));
}
.material-section-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.material-section-heading h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.attachment-file {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid hsl(var(--border));
}
.attachment-filename {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
  overflow-wrap: anywhere;
}
.attachment-filename small { color: hsl(var(--muted-foreground)); }
.attachment-preview { width: 100%; height: min(75vh, 900px); border: 0; }
.visually-hidden { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; }
@media (max-width: 760px) {
  .high-tech-page {
    gap: 8px;
    padding-inline: 10px;
  }
  .high-tech-page--project { padding-inline: 6px; }
  .floating-actions {
    right: max(12px, env(safe-area-inset-right));
    max-width: calc(100vw - 24px);
  }
  .page-header,
  .section-heading,
  .table-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }
}
@media (max-width: 360px) {
  .high-tech-page {
    padding-bottom: calc(84px + max(12px, env(safe-area-inset-bottom)));
  }
}
</style>
