<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { createIconifyIcon } from '@vben/icons';
import type {
  AttachmentKey,
  HighTechAttachment,
  HighTechDraft,
} from '#/api/client/high-tech';
import type { MaterialImportResult } from '#/api/client/high-tech';
import {
  getHighTechMaterialStaffApi,
  exportHighTechMaterialStaffTemplateApi,
  importHighTechMaterialApi,
  deleteHighTechAttachmentApi,
  exportHighTechDocumentApi,
  exportHighTechMaterialZipApi,
  generateHighTechDocumentApi,
  getHighTechAttachmentFileApi,
  listHighTechAttachmentsApi,
  reorderHighTechAttachmentsApi,
  uploadHighTechAttachmentApi,
} from '#/api/client/high-tech';
import {
  ATTACHMENT_SECTIONS,
  BOOK_FORM_SECTIONS,
  HITECH_PRODUCT_EVIDENCE_TYPES,
  ACHIEVEMENT_EVIDENCE_UPLOAD_TYPES,
  SYSTEM_BASE_FIELDS,
  SYSTEM_DOC_TYPES,
  SYSTEM_EVIDENCE_FILE_TEMPLATES,
} from './catalog';
import type { MaterialField } from './catalog';
import {
  activeRows,
  isActiveReference,
  materialTemplate,
  validateWorkspace,
  recalculateWorkspace,
  recalculateStaff,
  documentTargets,
  emptyWorkspace,
  feeValue,
  FEE_FIELDS,
  FRAMEWORK_FIELDS,
  MONTH_FIELDS,
  monthAverage,
  PS_FIELDS,
  RD_FIELDS,
  setTargetContent,
  STAFF_FIELDS,
  STANDARD_FIELDS,
  syncWorkspace,
  targetContent,
} from './workspace';
import FieldGrid from './field-grid.vue';
import MainSituationTable from './main-situation-table.vue';
import HumanResourcesTable from './human-resources-table.vue';
import DataTable from './data-table.vue';
import EvidenceFiles from './evidence-files.vue';
const DownloadIcon = createIconifyIcon('lucide:download');
const UploadIcon = createIconifyIcon('lucide:upload');
const staffFileInput = ref<HTMLInputElement>();
const props = defineProps<{
  draft: HighTechDraft;
  companyId: string;
  companyName: string;
  busy: boolean;
  save: () => Promise<boolean>;
}>();
const emit = defineEmits<{ working: [value: boolean]; core: [] }>();
const view = ref<'book' | 'attachments'>('book');
const selection = ref('');
const documentKey = ref('');
const files = ref<HighTechAttachment[]>([]);
const error = ref('');
const notice = ref('');
const working = ref(false);
const words = ref(1500);
const previewUrl = ref('');
const previewTitle = ref('');
const previewMime = ref('application/pdf');
const pendingDelete = ref<HighTechAttachment>();
const imported = ref<MaterialImportResult>();
const batch = ref<{ key: string; content: string; source: string }[]>([]);
const progress = ref('');
const cancelBatch = ref(false);
const generated = ref<{ key: string; content: string; source: string }>();
const evidencePage = ref<{ table: 'ps' | 'achievements'; id: string }>();
let alive = true;
const w = computed(() => props.draft.workspace!);
function synchronize() {
  props.draft.workspace ??= emptyWorkspace();
  syncWorkspace(props.draft.workspace, props.draft, props.companyName);
}
synchronize();
watch(
  () => JSON.stringify([w.value.tables.staff, w.value.applicationYear]),
  () => recalculateStaff(w.value),
  { immediate: true },
);
watch(
  () =>
    JSON.stringify([
      props.draft.projects,
      props.draft.ipSummary,
      props.draft.basicInfo,
    ]),
  synchronize,
);
const disabled = computed(() => props.busy || working.value);
const targets = computed(() => documentTargets(w.value));
const target = computed(() =>
  targets.value.find((t) => t.key === documentKey.value),
);
const content = computed({
  get: () => (target.value ? targetContent(w.value, target.value) : ''),
  set: (value) => {
    if (target.value) setTargetContent(w.value, target.value, value);
  },
});
const years = computed(() => [
  w.value.applicationYear - 3,
  w.value.applicationYear - 2,
  w.value.applicationYear - 1,
]);
const linkedIpFiles = computed(() => {
  const numbers = currentEvidence.value?.ip?.split(/[、,，;；\s]+/) || [];
  const ids = props.draft.ipSummary
    .filter((r) => numbers.includes(r.number))
    .map((r) => `ip/${r.id}`);
  return files.value.filter((f) => ids.includes(f.reference || ''));
});
const currentEvidence = computed(() =>
  evidencePage.value
    ? activeRows(w.value, evidencePage.value.table).find(
        (r) => r.id === evidencePage.value?.id,
      )
    : undefined,
);
const nav = computed(() =>
  view.value === 'book'
    ? BOOK_FORM_SECTIONS.map((s) => ({ key: s.key, title: s.title }))
    : ATTACHMENT_SECTIONS.map((s) => ({
        key: s.key,
        title: `${s.no}. ${s.title}`,
      })),
);
const readonlyFields = [
  'company_name',
  'ip_class1_count',
  'ip_class2_count',
  'ip_invention',
  'ip_utility',
  'ip_design',
  'ip_copyright',
];
const rdForm: MaterialField[] = RD_FIELDS.map(([key, label], i) => ({
  key: key!,
  label: label!,
  type:
    i >= RD_FIELDS.length - 3
      ? 'textarea'
      : ['budget', 'total', 'y1', 'y2', 'y3'].includes(key!)
        ? 'number'
        : 'text',
}));
const psForm: MaterialField[] = PS_FIELDS.map(([key, label], i) => ({
  key: key!,
  label: label!,
  type:
    i >= PS_FIELDS.length - 3
      ? 'textarea'
      : key === 'revenue'
        ? 'number'
        : 'text',
  ...(key === 'is_main'
    ? {
        options: [
          { value: '', label: '请选择' },
          { value: 'yes', label: '是' },
          { value: 'no', label: '否' },
        ],
      }
    : {}),
}));
const systemForm: MaterialField[] = SYSTEM_BASE_FIELDS.map(([key, label]) => ({
  key: key!,
  label: label!,
  type: [
    'generation_notes',
    'main_business',
    'main_products',
    'main_rd_projects',
    'evidence_project_content',
    'evidence_project_innovation',
    'evidence_project_goal',
    'evidence_expected_result',
  ].includes(key!)
    ? 'textarea'
    : 'text',
}));
const ipFields = [
  ['number', '编号'],
  ['name', '名称'],
  ['patentType', '专利类型'],
  ['legalStatus', '法律状态'],
  ['patentNumber', '专利号'],
  ['patentee', '专利权人'],
  ['grantDate', '授权日期'],
];
const rdSummary = [
  ['year', '年份'],
  ['no', 'RD编号'],
  ['name', '研发活动'],
  ['period', '研发周期'],
  ['ip', '知识产权'],
  ['ps', '产品'],
];
const psSummary = [
  ['no', 'PS编号'],
  ['name', '产品名称'],
  ['rds', 'RD项目'],
  ['ip', '知识产权'],
  ['revenue', '收入（万元）'],
];
const achievementFields = [
  ['year', '年度'],
  ['no', '成果编号'],
  ['name', '成果名称'],
  ['rd', 'RD项目'],
  ['ip', '知识产权'],
  ['ps', '产品'],
];
function rows(table: string) {
  return activeRows(w.value, table);
}
function fileRows(category: string, reference = '') {
  return files.value.filter(
    (f) => f.category === category && (f.reference || '') === reference,
  );
}
function closePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
}
onBeforeUnmount(() => {
  alive = false;
  closePreview();
  emit('working', false);
});
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function errorText(err: unknown) {
  const e = err as {
    message?: string;
    response?: { data?: { message?: string } };
  };
  return e.response?.data?.message || e.message || '操作未完成，请重试';
}
async function run(action: () => Promise<void>, saveFirst = true) {
  if (disabled.value) return;
  error.value = '';
  notice.value = '';
  if (saveFirst) {
    try {
      validateWorkspace(w.value);
    } catch (err) {
      error.value = errorText(err);
      return;
    }
    if (!(await props.save())) return;
  }
  if (!alive) return;
  working.value = true;
  emit('working', true);
  try {
    await action();
  } catch (err) {
    if (alive) error.value = errorText(err);
  } finally {
    if (alive) {
      working.value = false;
      emit('working', false);
    }
  }
}
async function reloadFiles() {
  const result = await listHighTechAttachmentsApi(props.companyId);
  if (alive) files.value = result;
}
void reloadFiles().catch((err) => {
  if (alive) error.value = errorText(err);
});
function switchView(value: 'book' | 'attachments') {
  view.value = value;
  selection.value = '';
  documentKey.value = '';
  evidencePage.value = undefined;
}
function jump(key: string) {
  selection.value = key;
  documentKey.value = '';
  evidencePage.value = undefined;
  requestAnimationFrame(() =>
    document
      .getElementById(`material-${key}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
  );
}
function openDocument(key: string) {
  documentKey.value = key;
  evidencePage.value = undefined;
}
function back() {
  documentKey.value = '';
  evidencePage.value = undefined;
}
async function saveWorkspace() {
  try {
    validateWorkspace(w.value);
    if (await props.save()) notice.value = '材料草稿已保存。';
  } catch (err) {
    error.value = errorText(err);
  }
}
async function generate(key: string) {
  await run(async () => {
    const result = await generateHighTechDocumentApi(
      props.companyId,
      key,
      words.value,
    );
    if (alive) generated.value = result;
  });
}
function applyGenerated() {
  if (!generated.value) return;
  const t = targets.value.find((item) => item.key === generated.value!.key);
  if (!t || t.source !== generated.value.source) {
    error.value = '关联资料已变化，请重新生成';
    return;
  }
  setTargetContent(w.value, t, generated.value.content);
  generated.value = undefined;
  notice.value = '已应用生成内容，请保存草稿。';
}
async function exportDocument(
  key: string,
  format: 'word' | 'pdf' | 'zip',
  preview = false,
) {
  await run(async () => {
    const blob = await exportHighTechDocumentApi(props.companyId, key, format);
    if (!alive) return;
    const title =
      targets.value.find((t) => t.key === key)?.title ||
      '高新技术企业认定申请书';
    if (preview) {
      closePreview();
      previewTitle.value = title;
      previewMime.value = 'application/pdf';
      previewUrl.value = URL.createObjectURL(blob);
    } else download(blob, `${title}.${format === 'pdf' ? 'pdf' : format === 'zip' ? 'zip' : 'docx'}`);
  });
}
async function exportAll() {
  await run(async () => {
    const blob = await exportHighTechMaterialZipApi(props.companyId);
    if (alive) download(blob, '高新申报材料.zip');
  });
}
async function upload(
  category: AttachmentKey,
  reference: string,
  selected: File[],
) {
  if (
    selected.length > 20 ||
    selected.some(
      (f) => !/\.(pdf|png|jpe?g)$/i.test(f.name) || f.size > 20 * 1024 * 1024,
    )
  ) {
    error.value = '每次最多20份PDF或图片，单份不得超过20MB';
    return;
  }
  await run(async () => {
    try {
      for (const file of selected) {
        await uploadHighTechAttachmentApi(
          props.companyId,
          category,
          file,
          reference,
        );
        if (!alive) return;
      }
      notice.value = '附件已上传。';
    } finally {
      if (alive) await reloadFiles();
    }
  });
}
async function openFile(file: HighTechAttachment, preview: boolean) {
  await run(async () => {
    const blob = await getHighTechAttachmentFileApi(props.companyId, file.id);
    if (!alive) return;
    if (preview) {
      closePreview();
      previewTitle.value = file.name;
      previewMime.value = file.mime || 'application/pdf';
      previewUrl.value = URL.createObjectURL(blob);
    } else download(blob, file.name);
  }, false);
}
async function removeFile() {
  const file = pendingDelete.value;
  if (!file) return;
  await run(async () => {
    await deleteHighTechAttachmentApi(props.companyId, file.id);
    if (alive) {
      pendingDelete.value = undefined;
      await reloadFiles();
    }
  }, false);
}
async function moveFile(file: HighTechAttachment, direction: number) {
  const visible = fileRows(file.category, file.reference);
  const neighbor =
    visible[visible.findIndex((f) => f.id === file.id) + direction];
  if (!neighbor) return;
  const ordered = files.value
    .filter((f) => f.category === file.category)
    .map((f) => f.id);
  const index = ordered.indexOf(file.id),
    next = ordered.indexOf(neighbor.id);
  [ordered[index], ordered[next]] = [ordered[next]!, ordered[index]!];
  await run(async () => {
    const result = await reorderHighTechAttachmentsApi(
      props.companyId,
      file.category,
      ordered,
    );
    if (alive) files.value = result;
  }, false);
}
const evidenceEvents = {
  upload,
  preview: (f: HighTechAttachment) => openFile(f, true),
  download: (f: HighTechAttachment) => openFile(f, false),
  remove: (f: HighTechAttachment) => {
    pendingDelete.value = f;
  },
  move: moveFile,
};
function addRow(table: string) {
  w.value.tables[table] ??= [];
  w.value.tables[table]!.push({ id: crypto.randomUUID() });
}
function deleteRow(table: string, row: Record<string, string>) {
  w.value.tables[table] = w.value.tables[table]!.filter((r) => r.id !== row.id);
}
function changeYear(event: Event) {
  const year = Number((event.target as HTMLInputElement).value);
  if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
    w.value.applicationYear = year;
    synchronize();
  }
}
function annualAverage(type: 'total' | 'tech') {
  const values = rows('months').map((r) => monthAverage(r, type));
  return values.length === 12 && values.every((n) => n !== null)
    ? (values.reduce<number>((s, n) => s + (n ?? 0), 0) / 12).toFixed(2)
    : '待补齐12个月';
}
function feeRows(year: number) {
  return rows('fees').filter((r) => r.year === String(year));
}
function feeTotal(year: number, key: string) {
  const values = feeRows(year).map((r) => feeValue(r, key));
  return values.some(Boolean)
    ? values.reduce((s, n) => s + Number(n || 0), 0).toFixed(2)
    : '—';
}
function feeInput(row: Record<string, string>, key: string, event: Event) {
  row[key] = (event.target as HTMLInputElement).value;
  recalculateWorkspace(w.value);
}
function markReviewed(event: Event) {
  if (target.value)
    w.value.documents[target.value.key] = {
      content: content.value,
      source: target.value.source,
      reviewed: (event.target as HTMLInputElement).checked,
    };
}
const isGeneratedSummary = computed(() =>
  [
    'staff/tables',
    'ps/summary',
    'achievement/summary',
    'system/summary',
  ].includes(documentKey.value),
);

const auditCards = computed(() => [
  { kind: 'income' as const, year: w.value.applicationYear - 1 },
  ...years.value.map((year) => ({ kind: 'rd' as const, year })),
]);
async function exportStaffTemplate() {
  await run(async () => {
    const blob = await exportHighTechMaterialStaffTemplateApi(props.companyId);
    if (alive) download(blob, '企业人员明细导入模板.xlsx');
  }, false);
}
async function importFile(
  kind: 'income' | 'rd' | 'staff',
  year: number,
  event: Event,
) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || disabled.value) return;
  if (kind === 'staff' && !/\.(xls|xlsx|xlsm)$/i.test(file.name)) {
    error.value = '请上传.xls、.xlsx或.xlsm格式的人员Excel文件';
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    error.value = '文件不得超过20MB';
    return;
  }
  await run(async () => {
    const result = await importHighTechMaterialApi(
      props.companyId,
      kind,
      year,
      file,
    );
    if (alive) {
      imported.value = result;
      await reloadFiles();
    }
  });
}
async function syncStaff() {
  await run(async () => {
    const rows = await getHighTechMaterialStaffApi(props.companyId);
    if (alive)
      imported.value = {
        kind: 'staff',
        year: String(w.value.applicationYear - 1),
        rows,
        source: '来自企业人员档案，应用后替换当前人员明细。',
      };
  });
}
function applyImport() {
  const result = imported.value;
  if (!result) return;
  if (result.kind === 'staff') {
    w.value.tables.staff = (result.rows || []).map((row, index) => ({
      ...row,
      id: row.id || crypto.randomUUID(),
      seq: String(index + 1),
    }));
    recalculateStaff(w.value, true);
  } else {
    Object.assign(w.value.fields, result.fields || {});
    for (const [table, values] of [
      ['fees', result.fees],
      ['ps', result.products],
    ] as const)
      for (const patch of values || []) {
        const row = rows(table).find((r) => r.id === patch.id);
        if (row) Object.assign(row, patch);
      }
    w.value.fields[`audit_${result.kind}_${result.year}`] =
      '已回填，请核对并保存';
    recalculateWorkspace(w.value);
  }
  imported.value = undefined;
  notice.value = '已应用导入结果，请保存草稿。';
}
const importPreview = computed(() =>
  imported.value
    ? JSON.stringify(
        {
          fields: imported.value.fields,
          fees: imported.value.fees,
          products: imported.value.products,
        },
        null,
        2,
      )
    : '',
);
function dismissDialog() {
  batch.value = [];
  generated.value = undefined;
  imported.value = undefined;
  pendingDelete.value = undefined;
  closePreview();
}
let returnFocus: HTMLElement | null = null;
watch(
  () =>
    Boolean(
      generated.value ||
      imported.value ||
      pendingDelete.value ||
      previewUrl.value ||
      batch.value.length,
    ),
  async (open) => {
    if (open) {
      returnFocus = document.activeElement as HTMLElement;
      await nextTick();
      document
        .querySelector<HTMLElement>('.mw-overlay button, .mw-overlay textarea')
        ?.focus();
    } else returnFocus?.focus();
  },
);
function dialogKey(event: KeyboardEvent) {
  const dialog = document.querySelector<HTMLElement>('.mw-overlay');
  if (!dialog) return;
  if (event.key === 'Escape' && !disabled.value) {
    event.preventDefault();
    dismissDialog();
  }
  if (event.key === 'Tab') {
    const nodes = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled),textarea,input,select,iframe',
      ),
    );
    const first = nodes[0],
      last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
}
document.addEventListener('keydown', dialogKey);
onBeforeUnmount(() => document.removeEventListener('keydown', dialogKey));

async function generateBatch(scope: string) {
  await run(async () => {
    const selected = targets.value.filter(
      (t) =>
        ![
          'staff/tables',
          'achievement/summary',
          'system/summary',
        ].includes(t.key) &&
        (scope === 'book'
          ? t.category === 'book'
          : scope === 'rd'
            ? t.category === 'book' && t.table === 'rd'
            : scope === 'system'
              ? t.category === 'system_docs'
              : scope === 'rd-projects'
                ? t.category === 'rd_project_table'
                : scope === 'achievements'
                  ? t.category === 'achievement_transform'
                  : t.category !== 'book'),
    );
    cancelBatch.value = false;
    const results: typeof batch.value = [];
    const failures: string[] = [];
    try {
      for (const [index, t] of selected.entries()) {
        if (!alive || cancelBatch.value) break;
        progress.value = `正在生成 ${index + 1} / ${selected.length}：${t.title}`;
        try {
          results.push(
            await generateHighTechDocumentApi(
              props.companyId,
              t.key,
              words.value,
            ),
          );
        } catch (err) {
          failures.push(`${t.title}：${errorText(err)}`);
        }
      }
    } finally {
      if (alive) {
        progress.value = '';
        batch.value = results;
        if (failures.length)
          error.value = `${failures.length}项未生成：${failures.join('；')}`;
        if (!results.length && !failures.length)
          notice.value = '没有可生成的材料，请先维护核心信息。';
      }
    }
  });
}
function applyBatch() {
  for (const result of batch.value) {
    const t = targets.value.find((item) => item.key === result.key);
    if (!t || t.source !== result.source) {
      error.value = '关联资料已变化，请重新生成';
      return;
    }
  }
  for (const result of batch.value)
    setTargetContent(
      w.value,
      targets.value.find((t) => t.key === result.key)!,
      result.content,
    );
  batch.value = [];
  notice.value = '已应用批量生成内容，请核对并保存草稿。';
}
</script>

<template>
  <section class="material-workspace" aria-label="制作高新材料">
    <header class="mw-header">
      <div>
        <span class="mw-kicker">高新技术企业认定 · 材料制作</span>
        <h2>{{ companyName }}</h2>
        <p>按照申请书模板组织 IP、RD、研发费用、PS 产品和成果转化材料。</p>
      </div>
      <label class="mw-year"
        >申报年度<input
          type="number"
          :value="w.applicationYear"
          min="2000"
          max="2100"
          :disabled="disabled"
          @change="changeYear"
      /></label>
    </header>
    <div class="mw-tabs" role="tablist" aria-label="材料类别">
      <button
        type="button"
        role="tab"
        aria-label="制作高新认定申请书"
        :aria-selected="view === 'book'"
        :class="{ active: view === 'book' }"
        @click="switchView('book')"
      >
        <span>01</span>制作高新认定申请书</button
      ><button
        type="button"
        role="tab"
        aria-label="制作高新附件"
        :aria-selected="view === 'attachments'"
        :class="{ active: view === 'attachments' }"
        @click="switchView('attachments')"
      >
        <span>02</span>制作高新附件
      </button>
    </div>
    <p v-if="error" class="mw-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="mw-notice" role="status">{{ notice }}</p>
    <p v-if="working" class="mw-notice" role="status">
      {{ progress || '正在处理，请稍候…'
      }}<button v-if="progress" type="button" @click="cancelBatch = true">
        停止后续生成
      </button>
    </p>
    <details
      v-if="files.some((f) => !isActiveReference(w, draft, f.reference))"
      class="mw-card"
    >
      <summary>历史关联附件（关联项目或年度已变化，不纳入本次导出）</summary>
      <div
        v-for="file in files.filter(
          (f) => !isActiveReference(w, draft, f.reference),
        )"
        :key="file.id"
        class="mw-row"
      >
        <span>{{ file.name }} · {{ file.reference }}</span
        ><button
          type="button"
          :disabled="disabled"
          @click="openFile(file, false)"
        >
          下载留存</button
        ><button
          type="button"
          :disabled="disabled"
          @click="pendingDelete = file"
        >
          删除
        </button>
      </div>
    </details>
    <div class="mw-shell">
      <aside class="mw-nav" aria-label="材料目录">
        <strong>{{
          view === 'book' ? '申请书模板材料目录' : '附件制作目录'
        }}</strong
        ><button
          v-for="item in nav"
          :key="item.key"
          type="button"
          :class="{ active: selection === item.key }"
          @click="jump(item.key)"
        >
          <span class="mw-dot" />{{ item.title }}
        </button>
      </aside>
      <main class="mw-main">
        <template v-if="target">
          <div class="mw-row">
            <button type="button" @click="back">
              ← 返回{{ view === 'book' ? '申请书' : '附件制作' }}</button
            ><span class="mw-badge">{{
              w.documents[target.key]?.reviewed
                ? '已核对'
                : content
                  ? '已有草稿'
                  : '待制作'
            }}</span>
          </div>
          <article class="mw-card">
            <h2>{{ target.title }}</h2>
            <p class="mw-hint">{{ target.guide }}</p>
            <p
              v-if="
                w.documents[target.key]?.source &&
                w.documents[target.key]?.source !== target.source
              "
              class="mw-error"
            >
              关联资料已变化，请核对正文。
            </p>
            <template v-if="isGeneratedSummary"
              ><p>汇总表根据当前申请书及附件数据制作，保存后可预览和导出。</p>
              <DataTable
                v-if="target.key === 'staff/tables'"
                title="研发人员名单"
                :fields="STAFF_FIELDS"
                :rows="rows('staff')"
                readonly
              /><DataTable
                v-if="target.key === 'ps/summary'"
                title="产品汇总表"
                :fields="psSummary"
                :rows="rows('ps')"
                readonly
              /><DataTable
                v-if="target.key === 'achievement/summary'"
                title="成果转化汇总表"
                :fields="achievementFields"
                :rows="rows('achievements')"
                readonly
              />
              <ol v-if="target.key === 'system/summary'">
                <li v-for="doc in SYSTEM_DOC_TYPES" :key="doc.key">
                  {{ doc.title }}
                </li>
              </ol></template
            >
            <template v-if="!isGeneratedSummary || target.key === 'ps/summary'"
              ><div class="mw-actions">
                <label
                  >目标字数
                  <input
                    v-model.number="words"
                    type="number"
                    min="100"
                    max="10000"
                    :disabled="disabled" /></label
                ><button
                  type="button"
                  :disabled="disabled"
                  @click="
                    generated = {
                      key: target.key,
                      source: target.source,
                      content: materialTemplate(w, target),
                    }
                  "
                >
                  套用模板</button
                ><button
                  type="button"
                  class="mw-primary"
                  :disabled="disabled"
                  @click="generate(target.key)"
                >
                  AI 撰写
                </button>
              </div>
              <textarea
                v-model="content"
                class="mw-document"
                :aria-label="target.title"
                rows="24"
                maxlength="50000"
                :disabled="disabled"
                placeholder="撰写或生成材料正文"
              /><small>{{ content.length }} / 50000 字</small
              ><label class="mw-review"
                ><input
                  type="checkbox"
                  :checked="w.documents[target.key]?.reviewed || false"
                  :disabled="
                    disabled || !content.trim() || /【待补充/.test(content)
                  "
                  @change="markReviewed"
                />已核对本项内容</label
              ></template
            >
            <div class="mw-actions">
              <button
                type="button"
                class="mw-primary"
                :disabled="disabled"
                @click="saveWorkspace"
              >
                保存草稿</button
              ><button
                type="button"
                :disabled="disabled"
                @click="exportDocument(target.key, 'pdf', true)"
              >
                预览 PDF</button
              ><button
                type="button"
                :disabled="disabled"
                @click="exportDocument(target.key, 'word')"
              >
                导出 Word</button
              ><button
                type="button"
                :disabled="disabled"
                @click="exportDocument(target.key, 'pdf')"
              >
                导出 PDF
              </button>
            </div>
          </article>
        </template>
        <template v-else-if="evidencePage && currentEvidence">
          <button type="button" @click="back">← 返回附件制作</button>
          <article class="mw-card">
            <h2>
              {{ currentEvidence.no }} {{ currentEvidence.name }} · 附件制作
            </h2>
            <section v-if="linkedIpFiles.length" class="mw-subcard">
              <h3>关联知识产权证明（沿用 IP 材料）</h3>
              <div v-for="file in linkedIpFiles" :key="file.id" class="mw-row">
                <span>{{ file.name }}</span
                ><button
                  type="button"
                  :disabled="disabled"
                  @click="openFile(file, true)"
                >
                  预览</button
                ><button
                  type="button"
                  :disabled="disabled"
                  @click="openFile(file, false)"
                >
                  下载
                </button>
              </div>
            </section>
            <template v-if="evidencePage.table === 'ps'"
              ><EvidenceFiles
                v-for="kind in HITECH_PRODUCT_EVIDENCE_TYPES"
                :key="kind.key"
                :title="kind.title"
                category="hitech_products"
                :reference="`ps/${currentEvidence.id}/${kind.key}`"
                :files="
                  fileRows(
                    'hitech_products',
                    `ps/${currentEvidence.id}/${kind.key}`,
                  )
                "
                :disabled="disabled"
                v-on="evidenceEvents"
              /><button
                type="button"
                @click="openDocument(`ps/${currentEvidence.id}/test_report`)"
              >
                撰写性能测试报告
              </button></template
            >
            <template v-else
              ><EvidenceFiles
                v-for="kind in ACHIEVEMENT_EVIDENCE_UPLOAD_TYPES"
                :key="kind.key"
                :title="kind.title"
                category="achievement_transform"
                :reference="`achievement/${currentEvidence.id}/${kind.key}`"
                :files="
                  fileRows(
                    'achievement_transform',
                    `achievement/${currentEvidence.id}/${kind.key}`,
                  )
                "
                :disabled="disabled"
                v-on="evidenceEvents"
              />
              <div class="mw-actions">
                <button
                  type="button"
                  @click="
                    openDocument(
                      `achievement/${currentEvidence.id}/test_report`,
                    )
                  "
                >
                  撰写性能测试报告</button
                ><button
                  type="button"
                  @click="
                    openDocument(
                      `achievement/${currentEvidence.id}/user_report`,
                    )
                  "
                >
                  撰写用户使用报告
                </button>
              </div></template
            >
          </article>
        </template>
        <template v-else-if="view === 'book'">
          <article class="mw-card">
            <h2>审计资料导入与回填</h2>
            <p class="mw-hint">
              上传 Excel 或 Word
              审计资料，核对提取结果后回填金额（万元）。原始文件会保留在对应附件目录。
            </p>
            <div class="mw-fields">
              <label
                v-for="card in auditCards"
                :key="`${card.kind}/${card.year}`"
                ><span
                  >{{ card.year }}年{{
                    card.kind === 'income' ? '高新收入' : '研发费用'
                  }}</span
                ><input
                  type="file"
                  accept=".xls,.xlsx,.xlsm,.docx"
                  :disabled="disabled"
                  @change="importFile(card.kind, card.year, $event)"
                /><small>{{
                  w.fields[`audit_${card.kind}_${card.year}`] || '尚未回填'
                }}</small></label
              >
            </div>
          </article>
          <article id="material-staff" class="mw-card">
            <h2>企业人员明细</h2>
            <p>应用导入、同步结果或修改明细后，自动覆盖人力资源表中的总人数、科技人员数及学历、职称、年龄统计。年龄按申报上一年度12月31日计算；无法识别的信息不计入对应分类，在职人数为空时默认取对应总数，其他人员类别为空时默认填0，已有值保留。</p>
            <div class="mw-actions mw-staff-actions">
              <button type="button" :disabled="disabled" @click="syncStaff">
                同步企业人员
              </button>
              <button type="button" :disabled="disabled" @click="exportStaffTemplate">
                <DownloadIcon aria-hidden="true" class="size-4" />导出人员模板
              </button>
              <button type="button" :disabled="disabled" @click="staffFileInput?.click()">
                <UploadIcon aria-hidden="true" class="size-4" />导入人员 Excel
              </button>
              <input
                ref="staffFileInput"
                type="file"
                hidden
                accept=".xls,.xlsx,.xlsm"
                :disabled="disabled"
                @change="importFile('staff', w.applicationYear - 1, $event)"
              />
              <button type="button" :disabled="disabled" @click="addRow('staff')">
                添加人员
              </button>
            </div>
            <DataTable
              title="企业人员明细"
              :fields="STAFF_FIELDS"
              :rows="rows('staff')"
              :disabled="disabled"
              removable
              @remove="(row) => deleteRow('staff', row)"
            />
          </article>
          <details v-if="draft.book.some((s) => s.content)" class="mw-card">
            <summary>历史申请书正文（保留并随申请书导出）</summary>
            <label
              v-for="legacy in draft.book.filter((s) => s.content)"
              :key="legacy.key"
              class="mw-note"
              >{{ legacy.key
              }}<textarea
                v-model="legacy.content"
                rows="4"
                maxlength="30000"
                :disabled="disabled"
              />
            </label>
          </details>
          <div class="mw-overview">
            <div>
              <small>知识产权</small
              ><strong>{{ draft.ipSummary.length }}</strong>
            </div>
            <div>
              <small>研发活动</small><strong>{{ rows('rd').length }}</strong>
            </div>
            <div>
              <small>高新产品</small><strong>{{ rows('ps').length }}</strong>
            </div>
            <div>
              <small>成果转化</small
              ><strong>{{ rows('achievements').length }}</strong>
            </div>
          </div>
          <article
            v-for="section in BOOK_FORM_SECTIONS"
            :id="`material-${section.key}`"
            :key="section.key"
            class="mw-card"
          >
            <h2>{{ section.title }}</h2>
            <button
              v-if="section.key === 'rd'"
              type="button"
              :disabled="disabled"
              @click="generateBatch('rd')"
            >
              一键撰写全部研发活动</button>
            <MainSituationTable
              v-if="section.key === 'main'"
              :values="w.fields"
              :year="w.applicationYear"
              :disabled="disabled"
              :readonly-keys="readonlyFields"
            />
            <HumanResourcesTable
              v-else-if="section.key === 'hr'"
              :values="w.fields"
              :disabled="disabled"
            />
            <FieldGrid
              v-else-if="section.fields.length"
              :fields="section.fields"
              :values="w.fields"
              :year="w.applicationYear"
              :disabled="disabled"
              :readonly-keys="readonlyFields"
              @generate="(key) => openDocument(`field/${key}`)"
            />
            <template v-if="section.key === 'ip'"
              ><div class="mw-row">
                <h3>知识产权明细</h3>
                <button
                  type="button"
                  :disabled="disabled"
                  @click="emit('core')"
                >
                  编辑知识产权及关系表
                </button>
              </div>
              <DataTable
                title="知识产权明细"
                :fields="ipFields"
                :rows="draft.ipSummary.map((row) => ({ ...row }))"
                readonly
            /></template>
            <template v-if="section.key === 'rd'"
              ><p class="mw-hint">
                项目名称、周期及 IP—RD—PS 关系沿用第二步核心信息。
              </p>
              <section
                v-for="row in rows('rd')"
                :key="row.id"
                class="mw-subcard"
              >
                <h3>{{ row.no }} · {{ row.name || '研发活动' }}</h3>
                <FieldGrid
                  :fields="rdForm"
                  :values="row"
                  :prefix="`${row.no} `"
                  :disabled="disabled"
                  :readonly-keys="['no', 'name', 'period', 'field', 'ip', 'ps']"
                  @generate="(key) => openDocument(`rd/${row.id}/${key}`)"
                /></section
            ></template>
            <template v-if="section.key === 'fee'"
              ><section v-for="year in years" :key="year" class="mw-subcard">
                <h3>{{ year }}年度（万元）</h3>
                <div class="mw-table-scroll">
                  <table class="mw-table">
                    <thead>
                      <tr>
                        <th>科目</th>
                        <th v-for="rd in feeRows(year)" :key="rd.id">
                          {{ rd.no }}
                        </th>
                        <th>合计</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="[key, label] in FEE_FIELDS" :key="key">
                        <th>{{ label }}</th>
                        <td v-for="row in feeRows(year)" :key="row.id">
                          <span v-if="key === 'internal' || key === 'total'">{{
                            feeValue(row, key) || '—'
                          }}</span
                          ><input
                            v-else
                            type="number"
                            min="0"
                            step="0.01"
                            :aria-label="`${year}年${row.no}${label}`"
                            :value="row[key!] || ''"
                            :disabled="disabled"
                            @input="feeInput(row, key!, $event)"
                          />
                        </td>
                        <td>{{ feeTotal(year, key!) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section></template
            >
            <template v-if="section.key === 'ps'"
              ><p v-if="!rows('ps').length" class="mw-hint">
                请先在第二步维护 PS 编号和产品名称。
              </p>
              <section
                v-for="row in rows('ps')"
                :key="row.id"
                class="mw-subcard"
              >
                <h3>{{ row.no }} · {{ row.name || '高新产品（服务）' }}</h3>
                <FieldGrid
                  :fields="psForm"
                  :values="row"
                  :prefix="`${row.no} `"
                  :disabled="disabled"
                  :readonly-keys="['no', 'rds', 'ip']"
                  @change="recalculateWorkspace(w)"
                  @generate="(key) => openDocument(`ps/${row.id}/${key}`)"
                /></section
            ></template>
            <template v-if="section.key === 'standards'"
              ><DataTable
                title="标准制定情况"
                :fields="STANDARD_FIELDS"
                :rows="rows('standards')"
                :disabled="disabled"
                removable
                @remove="(row) => deleteRow('standards', row)"
              /><button
                type="button"
                :disabled="disabled"
                @click="addRow('standards')"
              >
                添加标准
              </button></template
            >
          </article>
          <div class="mw-toolbar">
            <button
              type="button"
              class="mw-previous"
              :disabled="disabled"
              @click="emit('core')"
            >
              上一步
            </button>
            <div class="mw-toolbar-actions">
              <button
                type="button"
                :disabled="disabled"
                @click="generateBatch('book')"
              >
                一键撰写申请书</button
              ><button
                type="button"
                class="mw-primary"
                :disabled="disabled"
                @click="saveWorkspace"
              >
                保存申请书</button
              ><button
                type="button"
                :disabled="disabled"
                @click="exportDocument('book', 'word')"
              >
                导出申请书 Word</button
              ><button
                type="button"
                :disabled="disabled"
                @click="exportDocument('book', 'pdf', true)"
              >
                预览申请书</button
              ><button
                type="button"
                :disabled="disabled"
                @click="exportDocument('book', 'pdf')"
              >
                导出申请书 PDF
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <article
            v-for="section in ATTACHMENT_SECTIONS"
            :id="`material-${section.key}`"
            :key="section.key"
            class="mw-card"
          >
            <h2>{{ section.no }}. {{ section.title }}</h2>
            <p class="mw-hint">
              {{
                section.key === 'rd_expense_audit'
                  ? `按年度上传${years.join('、')}年研发费用专项审计报告。`
                  : section.hint
              }}
            </p>
            <template v-if="section.key === 'ip'"
              ><DataTable
                title="知识产权附件"
                :fields="ipFields"
                :rows="draft.ipSummary.map((row) => ({ ...row }))"
                readonly
              />
            </template>
            <template v-else-if="section.key === 'staff_statement'"
              ><div class="mw-actions">
                <button type="button" @click="openDocument('staff/statement')">
                  撰写企业职工人员情况说明</button
                ><button type="button" @click="openDocument('staff/tables')">
                  人员表格预览与导出
                </button>
              </div>
              <h3>{{ w.applicationYear - 1 }}年12月份研发人员名单</h3>
              <DataTable
                title="研发人员名单"
                :fields="STAFF_FIELDS"
                :rows="rows('staff')"
                readonly />
              <h3>企业职工总数、科技人员数统计表</h3>
              <DataTable
                title="月度人员统计"
                :fields="MONTH_FIELDS"
                :rows="rows('months')"
                :numeric="[
                  'start_total',
                  'start_tech',
                  'end_total',
                  'end_tech',
                ]"
                :disabled="disabled"
                ><template #actions="{ row }"
                  >月平均职工：{{ monthAverage(row, 'total') ?? '—'
                  }}<br />月平均科技人员：{{
                    monthAverage(row, 'tech') ?? '—'
                  }}</template
                ></DataTable
              >
              <p>
                年平均职工总数：{{ annualAverage('total') }} ·
                年平均科技人员数：{{ annualAverage('tech') }}
              </p>
              <EvidenceFiles
                v-for="[key, title] in [
                  ['social_december', `${w.applicationYear - 1}年12月份社保单`],
                  ['social_latest', '最新月份社保单'],
                  ['education', '毕业证书'],
                  ['contracts', '劳动合同'],
                ]"
                :key="key"
                :title="title!"
                category="staff_statement"
                :reference="`staff/${key}`"
                :files="fileRows('staff_statement', `staff/${key}`)"
                :disabled="disabled"
                v-on="evidenceEvents"
            /></template>
            <template v-else-if="section.key === 'rd_project_table'"
              ><button
                type="button"
                :disabled="disabled"
                @click="generateBatch('rd-projects')"
              >
                一键生成所有科研项目书</button
              ><button type="button" :disabled="disabled" @click="emit('core')">
                编辑 RD—IP—PS 关系表</button
              ><DataTable
                title="科研项目表"
                :fields="rdSummary"
                :rows="rows('rd')"
                readonly
                ><template #actions="{ row }"
                  ><button
                    type="button"
                    @click="openDocument(`rd/${row.id}/application`)"
                  >
                    撰写科研项目书</button
                  ></template></DataTable
            ></template>
            <template
              v-else-if="
                ['rd_expense_audit', 'annual_audit', 'tax_settlement'].includes(
                  section.key,
                )
              "
              ><EvidenceFiles
                v-for="year in years"
                :key="year"
                :title="`${year}年度${section.title}`"
                :category="section.key as AttachmentKey"
                :reference="`year/${year}`"
                :files="fileRows(section.key, `year/${year}`)"
                :disabled="disabled"
                v-on="evidenceEvents"
            /></template>
            <template v-else-if="section.key === 'hitech_products'"
              ><button type="button" @click="openDocument('ps/summary')">
                撰写汇总表</button
              ><DataTable
                title="高新产品材料"
                :fields="psSummary"
                :rows="rows('ps')"
                readonly
                ><template #actions="{ row }"
                  ><div class="mw-actions">
                    <button
                      type="button"
                      @click="openDocument(`ps/${row.id}/statement`)"
                    >
                      撰写{{ row.no }}情况说明</button
                    ><button
                      type="button"
                      @click="evidencePage = { table: 'ps', id: row.id! }"
                    >
                      附件制作
                    </button>
                  </div></template
                ></DataTable
              ></template
            >
            <template v-else-if="section.key === 'achievement_transform'"
              ><button
                type="button"
                :disabled="disabled"
                @click="generateBatch('achievements')"
              >
                一键生成所有成果材料</button
              ><button
                type="button"
                @click="openDocument('achievement/summary')"
              >
                成果转化汇总表</button
              ><DataTable
                title="成果转化明细"
                :fields="achievementFields"
                :rows="rows('achievements')"
                readonly
                ><template #actions="{ row }"
                  ><div class="mw-actions">
                    <button
                      type="button"
                      @click="openDocument(`achievement/${row.id}/description`)"
                    >
                      撰写转化结果描述</button
                    ><button
                      type="button"
                      @click="
                        evidencePage = { table: 'achievements', id: row.id! }
                      "
                    >
                      附件制作
                    </button>
                  </div></template
                ></DataTable
              ></template
            >
            <template v-else-if="section.key === 'system_docs'"
              ><button
                type="button"
                :disabled="disabled"
                @click="generateBatch('system')"
              >
                自动生成全部制度正文和佐证文件
              </button>
              <button type="button" :disabled="disabled" @click="exportDocument('system-bundle', 'zip')">打包导出制度 Word</button><h3>制度框架</h3>
              <FieldGrid
                v-for="[key, title] in FRAMEWORK_FIELDS"
                :key="key"
                :fields="[
                  {
                    key: `system_${key}_files`,
                    label: `${title}：制度文件`,
                    type: 'textarea',
                  },
                  {
                    key: `system_${key}_points`,
                    label: `${title}：管理要点`,
                    type: 'textarea',
                  },
                ]"
                :values="w.fields"
                :disabled="disabled" />
              <details>
                <summary>企业及制度佐证基础信息</summary>
                <FieldGrid
                  :fields="systemForm"
                  :values="w.fields"
                  :disabled="disabled"
                />
              </details>
              <div class="mw-row">
                <h3>制度正文及佐证文件</h3>
                <button type="button" @click="openDocument('system/summary')">
                  制度汇总表
                </button>
              </div>
              <section
                v-for="doc in SYSTEM_DOC_TYPES"
                :key="doc.key"
                class="mw-subcard"
              >
                <div class="mw-row">
                  <h3>{{ doc.title }}</h3>
                  <span class="mw-badge">{{
                    w.documents[`system/${doc.key}`]?.content
                      ? '已有草稿'
                      : '待制作'
                  }}</span>
                </div>
                <p class="mw-hint">{{ doc.guide }}</p>
                <div class="mw-actions">
                  <button
                    type="button"
                    class="mw-primary"
                    @click="openDocument(`system/${doc.key}`)"
                  >
                    生成制度正文</button
                  ><button
                    type="button"
                    @click="openDocument(`system/${doc.key}/notice`)"
                  >
                    制度发布通知</button
                  ><button
                    v-for="([title], index) in SYSTEM_EVIDENCE_FILE_TEMPLATES[
                      doc.key as keyof typeof SYSTEM_EVIDENCE_FILE_TEMPLATES
                    ]"
                    :key="index"
                    type="button"
                    @click="openDocument(`system/${doc.key}/evidence/${index}`)"
                  >
                    {{ title }}
                  </button>
                </div>
                <EvidenceFiles
                  title="制度及佐证扫描件"
                  category="system_docs"
                  :reference="`system/${doc.key}`"
                  :files="fileRows('system_docs', `system/${doc.key}`)"
                  :disabled="disabled"
                  v-on="evidenceEvents"
                /></section
            ></template>
            <section
              v-if="
                ['hitech_income_audit', 'rd_expense_audit'].includes(
                  section.key,
                )
              "
            >
              <div
                v-for="file in files.filter(
                  (f) =>
                    f.category === section.key &&
                    f.reference?.startsWith('audit/'),
                )"
                :key="file.id"
                class="mw-row"
              >
                <span>{{ file.name }} · 导入原件</span>
                <div class="mw-actions">
                  <button
                    type="button"
                    :disabled="disabled"
                    @click="openFile(file, false)"
                  >
                    下载原件</button
                  ><button
                    type="button"
                    :disabled="disabled"
                    @click="pendingDelete = file"
                  >
                    删除
                  </button>
                </div>
              </div>
            </section>
            <EvidenceFiles
              v-if="
                [
                  'cover',
                  'application_pdf',
                  'business_license',
                  'hitech_income_audit',
                  'commitment',
                ].includes(section.key)
              "
              :title="section.title"
              :category="section.key as AttachmentKey"
              :files="fileRows(section.key)"
              :disabled="disabled"
              v-on="evidenceEvents"
            />
            <details
              v-if="
                draft.attachments.find((a) => a.key === section.key)?.content
              "
            >
              <summary>原有附件正文</summary>
              <textarea
                v-model="
                  draft.attachments.find((a) => a.key === section.key)!.content
                "
                rows="8"
                maxlength="30000"
                :disabled="disabled"
              />
            </details>
          </article>
          <div class="mw-toolbar">
            <button
              type="button"
              class="mw-previous"
              :disabled="disabled"
              @click="emit('core')"
            >
              上一步
            </button>
            <div class="mw-toolbar-actions">
              <button
                type="button"
                :disabled="disabled"
                @click="generateBatch('attachments')"
              >
                一键撰写附件</button
              ><button
                type="button"
                class="mw-primary"
                :disabled="disabled"
                @click="saveWorkspace"
              >
                保存附件资料</button
              ><button
                type="button"
                :disabled="disabled"
                @click="exportAll()"
              >
                导出完整材料 ZIP
              </button>
            </div>
          </div>
        </template>
      </main>
    </div>
    <div
      v-if="batch.length"
      class="mw-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="批量生成结果"
    >
      <div class="mw-dialog">
        <h2>批量生成结果（{{ batch.length }}项）</h2>
        <p>应用后替换下列对应正文，其他内容保留。</p>
        <details v-for="item in batch" :key="item.key">
          <summary>
            {{ targets.find((t) => t.key === item.key)?.title }}
          </summary>
          <textarea
            v-model="item.content"
            rows="12"
            maxlength="50000"
            :aria-label="item.key"
          />
        </details>
        <div class="mw-actions">
          <button type="button" @click="batch = []">保留原内容</button
          ><button type="button" class="mw-primary" @click="applyBatch">
            应用全部生成内容
          </button>
        </div>
      </div>
    </div>
    <div
      v-if="imported"
      class="mw-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="导入结果核对"
    >
      <div class="mw-dialog">
        <h2>导入结果核对</h2>
        <p>应用后替换对应字段；请核实年度、单位与项目归属后保存。</p>
        <DataTable
          v-if="imported.kind === 'staff'"
          title="待导入人员"
          :fields="STAFF_FIELDS"
          :rows="imported.rows || []"
          readonly
        />
        <pre v-else class="mw-preserve">{{ importPreview }}</pre>
        <details>
          <summary>原文提取预览</summary>
          <pre class="mw-preserve">{{ imported.source }}</pre>
        </details>
        <div class="mw-actions">
          <button type="button" @click="imported = undefined">保留原数据</button
          ><button type="button" class="mw-primary" @click="applyImport">
            应用到草稿
          </button>
        </div>
      </div>
    </div>
    <div
      v-if="generated"
      class="mw-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="生成内容预览"
    >
      <div class="mw-dialog">
        <h2>生成内容预览</h2>
        <p>核对后应用到草稿；现有正文会被替换。</p>
        <textarea
          v-model="generated.content"
          rows="18"
          maxlength="50000"
          aria-label="生成内容"
        />
        <div class="mw-actions">
          <button type="button" @click="generated = undefined">
            保留原内容</button
          ><button type="button" class="mw-primary" @click="applyGenerated">
            应用到草稿
          </button>
        </div>
      </div>
    </div>
    <div
      v-if="previewUrl"
      class="mw-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="previewTitle"
    >
      <div class="mw-dialog mw-preview">
        <div class="mw-row">
          <h2>{{ previewTitle }}</h2>
          <button type="button" @click="closePreview">关闭预览</button>
        </div>
        <img
          v-if="previewMime.startsWith('image/')"
          :src="previewUrl"
          :alt="previewTitle"
        /><iframe v-else :src="previewUrl" :title="previewTitle" />
      </div>
    </div>
    <div
      v-if="pendingDelete"
      class="mw-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="删除附件"
    >
      <div class="mw-dialog">
        <h2>删除附件</h2>
        <p>确定删除“{{ pendingDelete.name }}”？</p>
        <div class="mw-actions">
          <button
            type="button"
            :disabled="disabled"
            @click="pendingDelete = undefined"
          >
            取消</button
          ><button
            type="button"
            class="mw-danger"
            :disabled="disabled"
            @click="removeFile"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
<style src="./workspace.css"></style>
