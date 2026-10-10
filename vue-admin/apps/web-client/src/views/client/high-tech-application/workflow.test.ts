import type { App } from 'vue';
import type { HighTechProject } from '#/api/client/high-tech';
import { createApp, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Receipts from '../enterprise-receipts/index.vue';
import Workflow from './index.vue';
import { documentTargets, syncWorkspace, emptyWorkspace } from './materials/workspace';
import { emptyDraft, IP_SUMMARY_FIELDS, newIpItem, newProject, PROJECT_FIELDS } from './model';
import { nameGenerationFixture } from './name-generation.fixture';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  export: vi.fn(),
  companies: vi.fn(),
  recognize: vi.fn(),
  importIp: vi.fn(),
  exportIp: vi.fn(),
  importProjects: vi.fn(),
  exportProjects: vi.fn(),
  allocation: vi.fn(),
  fieldCatalog: vi.fn(),
  recommendFields: vi.fn(),
  generateNames: vi.fn(),
  generateBook: vi.fn(),
  generateAttachment: vi.fn(),
  generateDocument: vi.fn(),
  exportDocument: vi.fn(),
  importMaterial: vi.fn(),
  staff: vi.fn(),
  staffTemplate: vi.fn(),
  uploadAttachment: vi.fn(),
  attachmentFile: vi.fn(),
  deleteAttachment: vi.fn(),
  reorderAttachments: vi.fn(),
  listAttachments: vi.fn(),
  exportBook: vi.fn(),
  exportAttachmentPdf: vi.fn(),
  exportMaterialZip: vi.fn(),
}));
vi.mock('#/api/client/high-tech', () => ({
  generateHighTechDocumentApi: api.generateDocument,
  exportHighTechDocumentApi: api.exportDocument,
  importHighTechMaterialApi: api.importMaterial,
  getHighTechMaterialStaffApi: api.staff,
  exportHighTechMaterialStaffTemplateApi: api.staffTemplate,
  uploadHighTechAttachmentApi: api.uploadAttachment,
  getHighTechAttachmentFileApi: api.attachmentFile,
  deleteHighTechAttachmentApi: api.deleteAttachment,
  reorderHighTechAttachmentsApi: api.reorderAttachments,
  getHighTechApplicationApi: api.get,
  saveHighTechApplicationApi: api.save,
  exportHighTechApplicationApi: api.export,
  recognizeHighTechIpPdfsApi: api.recognize,
  importHighTechIpSummaryApi: api.importIp,
  exportHighTechIpSummaryApi: api.exportIp,
  importHighTechProjectDetailsApi: api.importProjects,
  exportHighTechProjectDetailsApi: api.exportProjects,
  previewHighTechIpAllocationApi: api.allocation,
  getHighTechFieldCatalogApi: api.fieldCatalog,
  recommendHighTechFieldsApi: api.recommendFields,
  generateHighTechNamesApi: api.generateNames,
  generateHighTechBookApi: api.generateBook,
  generateHighTechAttachmentApi: api.generateAttachment,
  listHighTechAttachmentsApi: api.listAttachments,
  exportHighTechBookApi: api.exportBook,
  exportHighTechAttachmentPdfApi: api.exportAttachmentPdf,
  exportHighTechMaterialZipApi: api.exportMaterialZip,
}));
vi.mock('#/api/client', () => ({ getClientCompaniesApi: api.companies }));
vi.mock('@vben/icons', async () => {
  const { defineComponent, h } = await import('vue');
  return { createIconifyIcon: () => defineComponent({ setup: () => () => h('span') }) };
});
vi.mock('@vben/common-ui', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    Page: defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('main', slots.default?.()),
    }),
  };
});
vi.mock('antdv-next', async () => {
  const { defineComponent, h } = await import('vue');
  const wrap = (tag = 'div') =>
    defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h(tag, slots.default?.()),
    });
  const TextArea = defineComponent({
    props: ['value'],
    emits: ['update:value'],
    setup:
      (props, { attrs, emit }) =>
      () =>
        h('textarea', {
          ...attrs,
          value: props.value,
          onInput: (e: Event) =>
            emit('update:value', (e.target as HTMLTextAreaElement).value),
        }),
  });
  const Input = Object.assign(
    defineComponent({
      props: ['value'],
      emits: ['update:value'],
      setup:
        (props, { attrs, emit }) =>
        () =>
          h('input', {
            ...attrs,
            value: props.value,
            onInput: (e: Event) =>
              emit('update:value', (e.target as HTMLInputElement).value),
          }),
    }),
    { TextArea },
  );
  return {
    Input,
    Select: defineComponent({
      props: ['value', 'options', 'disabled', 'styles'],
      emits: ['update:value'],
      setup: (props, { attrs, emit }) => () => h('select', {
        ...attrs, value: props.value, disabled: props.disabled,
        'data-popup-min-width': props.styles?.popup?.root?.minWidth,
        onChange: (event: Event) => emit('update:value', (event.target as HTMLSelectElement).value),
      }, [...(props.options.some((option: any) => option.value === '') ? [] : [h('option', { value: '' }, '请选择')]), ...props.options.flatMap((option: any) => option.options ?? [option]).map((option: any) => h('option', { value: option.value, disabled: option.disabled }, option.label))]),
    }),
    Modal: defineComponent({
      props: ['open', 'title'],
      setup: (props, { slots }) => () => props.open ? h('section', { role: 'dialog' }, [h('h2', props.title), slots.default?.()]) : null,
    }),
    InputNumber: defineComponent({
      props: ['value'],
      emits: ['update:value', 'change'],
      setup:
        (props, { attrs, emit }) =>
        () =>
          h('input', {
            ...attrs,
            type: 'number',
            value: props.value,
            onInput: (e: Event) => {
              const raw = (e.target as HTMLInputElement).value;
              const value = raw === '' ? null : Number(raw);
              emit('update:value', value);
              emit('change', value);
            },
          }),
    }),
    Checkbox: defineComponent({
      props: ['checked', 'disabled'],
      emits: ['update:checked'],
      setup:
        (props, { slots, emit }) =>
        () =>
          h('label', [
            h('input', {
              type: 'checkbox',
              checked: props.checked,
              disabled: props.disabled,
              onChange: (e: Event) =>
                emit('update:checked', (e.target as HTMLInputElement).checked),
            }),
            slots.default?.(),
          ]),
    }),
    Button: defineComponent({
      props: ['loading', 'disabled', 'type'],
      setup:
        (props, { attrs, slots }) =>
        () =>
          h(
            'button',
            {
              ...attrs,
              type: 'button',
              disabled: props.loading || props.disabled,
            },
            slots.default?.(),
          ),
    }),
    Card: defineComponent({
      props: ['title'],
      setup:
        (props, { slots }) =>
        () =>
          h('section', [
            props.title ? h('h3', props.title) : null,
            slots.extra?.(),
            slots.default?.(),
          ]),
    }),
    Alert: defineComponent({
      props: ['message'],
      setup:
        (props, { slots }) =>
        () =>
          h('div', { role: 'alert' }, [props.message, slots.action?.()]),
    }),
    Drawer: defineComponent({
      props: ['open', 'title'],
      setup:
        (props, { slots }) =>
        () =>
          props.open
            ? h('aside', [
                h('h2', props.title),
                slots.default?.(),
                slots.footer?.(),
              ])
            : null,
    }),
    FormItem: defineComponent({
      props: ['label', 'htmlFor'],
      setup:
        (props, { slots }) =>
        () =>
          h('div', [
            h('label', { for: props.htmlFor }, props.label),
            slots.default?.(),
          ]),
    }),
    Steps: defineComponent({
      props: ['items', 'current', 'onChange'],
      setup: (props) => () =>
        h(
          'nav',
          props.items.map((item: any, index: number) =>
            h('button', { onClick: () => props.onChange(index) }, item.title),
          ),
        ),
    }),
    Table: defineComponent({
      props: ['columns', 'dataSource'],
      setup:
        (props, { slots }) =>
        () =>
          h('table', { 'data-project-table': props.columns.some((column: any) => column.key === 'rdNumber') ? '' : undefined }, [
            h(
              'thead',
              h(
                'tr',
                props.columns.map((column: any) => h('th', column.title)),
              ),
            ),
            h(
              'tbody',
              props.dataSource.length
                ? props.dataSource.map((record: any, index: number) =>
                    h(
                      'tr',
                      props.columns.map((column: any) => {
                        const cell = column.onCell?.(record) ?? {};
                        return cell.rowSpan === 0 ? null : h('td', { rowspan: cell.rowSpan }, slots.bodyCell?.({ record, column, index }));
                      }),
                    ),
                  )
                : [h('tr', [h('td', slots.emptyText?.())])],
            ),
          ]),
    }),
    Empty: defineComponent({
      props: ['description'],
      setup: (props) => () => h('p', props.description),
    }),
    Popconfirm: defineComponent({
      emits: ['confirm'],
      setup:
        (_, { emit, slots }) =>
        () =>
          h('div', { onClick: () => emit('confirm') }, slots.default?.()),
    }),
    Form: wrap('form'),
    Skeleton: wrap(),
    Tag: wrap('span'),
    Tooltip: wrap(),
    message: { success: vi.fn(), error: vi.fn() },
  };
});

const fieldFixtures = [
  { id: 'bi', label: '一、电子信息 / （一）软件 / 9. 企业管理软件 / 数据分析与决策支持的商业智能（BI）软件' },
  { id: 'control', label: '八、先进制造与自动化 / （一）工业生产过程控制系统 / 1. 现场总线与工业以太网技术 / 工业控制技术' },
];
let app: App;
let host: HTMLDivElement;
let router: ReturnType<typeof createRouter>;
let persisted: Record<string, any>;
async function settle() {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
async function mount(path = '/client/enterprise-receipts') {
  host = document.createElement('div');
  document.body.append(host);
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        name: 'ClientEnterpriseReceipts',
        path: '/client/enterprise-receipts',
        component: Receipts,
      },
      {
        name: 'ClientHighTechApplication',
        path: '/client/enterprise-receipts/:companyId/high-tech',
        component: Workflow,
      },
      {
        name: 'ClientHighTechSelfAssessment',
        path: '/client/enterprise-receipts/:companyId/self-assessment',
        component: { render: () => h('div') },
      },
    ],
  });
  await router.push(path);
  await router.isReady();
  app = createApp(RouterView);
  app.use(router);
  app.mount(host);
  await settle();
}
function button(label: string) {
  const node = [...document.body.querySelectorAll('button')].find(
    (item) => item.getAttribute('aria-label') === label || item.textContent?.trim() === label,
  );
  expect(node, `Missing button ${label}`).toBeTruthy();
  return node!;
}
async function input(id: string, value: string) {
  const node = host.querySelector<HTMLInputElement>(`#${id}`)!;
  expect(node, `Missing field ${id}`).toBeTruthy();
  node.value = value;
  node.dispatchEvent(new Event('input', { bubbles: true }));
  await settle();
}
function projectField(row: number, key: string) {
  const node = host
    .querySelectorAll('[data-project-table] tbody tr')
    [row]?.querySelector<HTMLInputElement | HTMLSelectElement>(`input[id$="-${key}"], select[id$="-${key}"]`);
  expect(node, `Missing project field ${row + 1}: ${key}`).toBeTruthy();
  return node!;
}
async function projectInput(row: number, key: string, value: string) {
  const node = projectField(row, key);
  node.value = value;
  node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  await settle();
}
function projectDraft(count = 0) {
  const draft = emptyDraft();
  draft.projects = [];
  draft.currentStep = 1;
  draft.scores = {
    intellectualProperty: 30,
    transformation: 30,
    organization: 20,
    salesGrowth: 10,
    netAssetGrowth: 10,
  };
  for (let index = 0; index < count; index++) {
    const row = newProject(draft.projects);
    for (const field of PROJECT_FIELDS) {
      if (field.key !== 'year')
        row[field.key] = `${field.label}示例${index + 1}`;
    }
    row.rdNumber = `RD${String(index + 1).padStart(2, '0')}`;
    row.achievementNumber = `成果${String(index + 1).padStart(2, '0')}`;
    row.applicationDate = '2025-01-01';
    row.authorizationDate = '2026-10-01';
    draft.projects.push(row);
  }
  persisted['101'] = {
    ...draft,
    companyId: '101',
    companyName: '测试企业101',
    updatedAt: '2026-10-01T08:00:00Z',
  };
  return draft;
}
function ipDraft(count = 0) {
  const draft = projectDraft(count);
  draft.currentStep = 0;
  persisted['101'].currentStep = 0;
  return draft;
}
beforeEach(() => {
  vi.resetAllMocks();
  api.fieldCatalog.mockResolvedValue({ fields: fieldFixtures });
  api.recommendFields.mockResolvedValue({ fields: [fieldFixtures[0]] });
  api.listAttachments.mockResolvedValue([]);
  api.generateDocument.mockImplementation(async (id: string, key: string) => {
    const draft = persisted[id]; draft.workspace ??= emptyWorkspace(); syncWorkspace(draft.workspace, draft, draft.companyName);
    return { key, content: '企业人员资料草稿', source: documentTargets(draft.workspace).find((t) => t.key === key)!.source };
  });
  persisted = {};
  api.companies.mockResolvedValue([
    {
      id: '101',
      name: '测试企业A',
      salesOwner: '张销售',
      enterpriseProjects: ['国家高新技术企业', '专精特新企业'],
    },
  ]);
  api.get.mockImplementation(async (companyId: string) =>
    structuredClone(
      persisted[companyId] ?? {
        ...emptyDraft(),
        companyId,
        companyName: `测试企业${companyId}`,
        updatedAt: null,
      },
    ),
  );
  api.save.mockImplementation(async (companyId: string, data: any) => {
    persisted[companyId] = {
      ...structuredClone(data),
      companyId,
      companyName: `测试企业${companyId}`,
      revision: data.revision + 1,
      updatedAt: '2026-10-01T08:00:00Z',
    };
    return structuredClone(persisted[companyId]);
  });
});
afterEach(() => {
  app?.unmount();
  host?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('enterprise receipt high-tech workflow', () => {
  async function uploadProjects() {
    const upload = host.querySelector<HTMLInputElement>('input[type=file][accept=".xlsx"]')!;
    Object.defineProperty(upload, 'files', { configurable: true, value: [new File(['fixture'], '项目详情.xlsx')] });
    upload.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  }
  it('scales only the project table and exports an empty template without saving', async () => {
    projectDraft();
    const click = mockIpDownload();
    api.exportProjects.mockResolvedValue(new Blob(['projects']));
    await mount('/client/enterprise-receipts/101/high-tech');
    await input('project-table-zoom', '50');
    expect(host.querySelector('.project-table-zoom')?.getAttribute('style')).toContain('zoom: 0.5');
    expect(host.querySelector('output[for="project-table-zoom"]')?.textContent).toBe('50%');
    button('重置').click();
    await settle();
    expect(host.querySelector('.project-table-zoom')?.getAttribute('style')).toContain('zoom: 1');
    button('导出项目详情').click();
    await settle();
    expect(api.exportProjects).toHaveBeenCalledExactlyOnceWith('101', []);
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('项目详情表.xlsx');
    expect(api.save).not.toHaveBeenCalled();
  });
  it('exports unsaved project edits and retains them after a failed export', async () => {
    projectDraft(1);
    mockIpDownload();
    api.exportProjects.mockRejectedValueOnce(new Error('项目导出失败')).mockResolvedValue(new Blob(['projects']));
    await mount('/client/enterprise-receipts/101/high-tech');
    await projectInput(0, 'activityName', '未保存的研发活动');
    button('导出项目详情').click();
    await settle();
    expect(host.textContent).toContain('项目导出失败');
    expect(projectField(0, 'activityName').value).toBe('未保存的研发活动');
    button('导出项目详情').click();
    await settle();
    expect(api.exportProjects.mock.lastCall![1][0].activityName).toBe('未保存的研发活动');
    expect(api.save).not.toHaveBeenCalled();
  });
  it('replaces all project rows only after confirmation, normalizes numbering and waits for save', async () => {
    projectDraft(2);
    const row = { ...newProject([]), id: 'file-row', rdNumber: 'RD99', year: 2025, activityName: '导入活动', psName: '导入产品', acquisitionMethod: '原始取得' };
    api.importProjects.mockResolvedValue({ rows: [row], total: 1 });
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    vi.stubGlobal('confirm', confirm);
    await mount('/client/enterprise-receipts/101/high-tech');
    await uploadProjects();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('替换当前全部 2 条'));
    expect(host.querySelectorAll('[data-project-table] tbody tr')).toHaveLength(2);
    await uploadProjects();
    expect(host.querySelectorAll('[data-project-table] tbody tr')).toHaveLength(1);
    expect(projectField(0, 'activityName').value).toBe('导入活动');
    expect(projectField(0, 'rdNumber').value).toBe('RD01');
    expect(projectField(0, 'acquisitionMethod').value).toBe('');
    expect(projectField(0, 'acquisitionMethod').disabled).toBe(true);
    expect(api.save).not.toHaveBeenCalled();
    expect(persisted['101'].projects).toHaveLength(2);
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].projects).toHaveLength(1);
    expect(persisted['101'].projects[0].id).not.toBe('file-row');
    expect(persisted['101'].projects[0].researchPeriod).toContain('2025');
    expect(persisted['101'].projects[0].acquisitionMethod).toBe('');
  });
  it('preserves project edits on validation failure and confirms empty imports before clearing', async () => {
    projectDraft(1);
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirm);
    api.importProjects.mockRejectedValueOnce({ response: { data: { errors: ['第2行：年份不正确'] } } });
    await mount('/client/enterprise-receipts/101/high-tech');
    await projectInput(0, 'activityName', '保留修改');
    await uploadProjects();
    expect(host.textContent).toContain('第2行：年份不正确');
    expect(projectField(0, 'activityName').value).toBe('保留修改');
    expect(confirm).not.toHaveBeenCalled();
    api.importProjects.mockResolvedValue({ rows: [], total: 0 });
    await uploadProjects();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('清空当前全部 1 条'));
    expect(host.querySelector('[id$="-activityName"]')).toBeNull();
    expect(api.save).not.toHaveBeenCalled();
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].projects).toEqual([]);
  });
  it('shows the first-round recommendation and fills an unnamed RD before name generation', async () => {
    const draft = projectDraft(0);
    const row = newProject([]);
    row.rdNumber = 'RD01';
    row.activityName = '';
    row.researchPeriod = '2025-01-01—2025-12-31';
    row.techField = '服务器/客户端操作系统';
    draft.projects = [row];
    const ip = { ...newIpItem([]), name: '门店商品推荐系统', number: 'IP01', patentType: '软件著作权',
      legalStatus: '授权', patentNumber: 'SR01', patentee: '测试企业', applicationDate: '2025-06-01', grantDate: '2025-09-01' };
    draft.ipSummary = [ip];
    persisted['101'] = { ...draft, companyId: '101', companyName: '测试企业101', updatedAt: null };
    api.allocation.mockResolvedValue({
      assignments: [{ ipId: ip.id, projectId: row.id, rdNumber: 'RD01', timing: 'within', round: 'spread', similarNames: [], reason: '第一轮优先一RD一个IP' }],
      strategy: 'spread_then_similar', nameGroups: [], preserved: [], unassigned: [], warnings: [],
      distribution: [{ projectId: row.id, rdNumber: 'RD01', existingCount: 0, addedCount: 1 }],
    });
    await mount('/client/enterprise-receipts/101/high-tech');
    button('IP自动分配').click(); await settle();
    expect(document.body.textContent).toContain('第一轮·分散分配');
    expect(document.body.textContent).not.toContain('IP临时主题相关度');
    expect(document.body.textContent).not.toContain('技术语义分析');
    button('确认分配，填入项目详情').click(); await settle();
    for (const [field, value] of Object.entries({ ipNumber: 'IP01', ipName: ip.name,
      authorizationNumber: 'SR01', authorizationDate: '2025-09-01', ipType: '软件著作权' })) {
      expect(projectField(0, field).value).toBe(value);
    }
    expect(projectField(0, 'activityName').value).toBe('');
    expect(api.save).not.toHaveBeenCalled();
    const names = nameGenerationFixture([{ ...row, ipNumber: ip.number, ipName: ip.name,
      authorizationNumber: ip.patentNumber, authorizationDate: ip.grantDate, ipType: ip.patentType }]);
    api.generateNames.mockResolvedValue(names);
    button('一键生成').click(); await settle();
    expect(api.generateNames).toHaveBeenCalledWith('101', { projects: expect.arrayContaining([expect.objectContaining({ ipName: ip.name, activityName: '' })]) });
    expect(projectField(0, 'activityName').value).toBe(names.rds[0]!.name);
    expect(projectField(0, 'achievementName').value).toBe(names.achievements[0]!.name);
    expect(projectField(0, 'psName').value).toBe(names.products[0]!.name);
    expect(projectField(0, 'ipName').value).toBe(ip.name);
    expect(api.save).not.toHaveBeenCalled();
  });
  it('shows similar-name append evidence and manual reminders, then fills only the five existing columns', async () => {
    const draft = projectDraft(0);
    const row = { ...newProject([]), rdNumber: 'RD01', activityName: '',
      researchPeriod: '2025-01-01—2025-12-31', achievementName: '保留成果一', psName: '保留产品一' };
    const branch = { ...newProject([row]), rdNumber: row.rdNumber, activityName: '',
      researchPeriod: row.researchPeriod, achievementName: '保留成果二', psName: '保留产品二' };
    draft.projects = [row, branch];
    const ips = ['门店库存管理系统V1.0', '门店库存管理系统V2.0', '历史供应链系统'].map((name, index) => ({
      ...newIpItem([]), id: `ip-round-${index}`, name, number: index === 2 ? 'IP01' : `IP0${index + 2}`, patentType: '软件著作权',
      legalStatus: '授权', patentNumber: `SR-round-${index}`, patentee: '测试企业',
      applicationDate: index === 2 ? '2025-01-01' : '2025-06-01', grantDate: '2025-09-01',
    }));
    draft.ipSummary = ips;
    persisted['101'] = { ...draft, companyId: '101', companyName: '测试企业101', updatedAt: null };
    api.allocation.mockResolvedValue({
      strategy: 'spread_then_similar',
      assignments: ips.slice(0, 2).map((ip, index) => ({ ipId: ip.id, projectId: row.id,
        rdNumber: row.rdNumber, timing: 'within', round: index ? 'append' : 'spread',
        similarNames: index ? [ips[0]!.name] : [], reason: index ? '第二轮名称相近追加' : '第一轮分散分配',
      })),
      nameGroups: [{ id: 'G1', names: ips.slice(0, 2).map((ip) => ip.name), reason: '技术对象和核心用途一致，仅版本号不同' }],
      preserved: [], unassigned: [{ ipId: ips[2]!.id, reason: '申请日期等于RD开始日期，请手动分配' }],
      warnings: ['IP01不自动分配，请手动核对'],
      distribution: [{ projectId: row.id, rdNumber: row.rdNumber, existingCount: 0, addedCount: 2 }],
    });
    await mount('/client/enterprise-receipts/101/high-tech');
    const originalColumns = [...host.querySelectorAll('[data-project-table] th')].map((cell) => cell.textContent);
    button('IP自动分配').click(); await settle();
    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('第二轮·相近名称追加');
    expect(dialog.textContent).toContain(`同RD相近IP名称：${ips[0]!.name}`);
    expect(dialog.textContent).toContain('查看第二轮IP名称分组（1组）');
    expect(dialog.textContent).toContain('技术对象和核心用途一致，仅版本号不同');
    expect(dialog.textContent).toContain('申请日期等于RD开始日期，请手动分配');
    expect(dialog.textContent).not.toContain('技术总分');
    expect(projectField(0, 'ipName').value).toBe('');
    expect(projectField(1, 'ipName').value).toBe('');
    button('确认分配，填入项目详情').click(); await settle();
    ips.slice(0, 2).forEach((ip, index) => {
      for (const [key, value] of Object.entries({ ipNumber: ip.number, ipName: ip.name,
        authorizationNumber: ip.patentNumber, authorizationDate: ip.grantDate, ipType: ip.patentType })) {
        expect(projectField(index, key).value).toBe(value);
      }
    });
    expect(host.querySelectorAll('[data-project-table] tbody tr')).toHaveLength(2);
    expect([...host.querySelectorAll('[data-project-table] th')].map((cell) => cell.textContent)).toEqual(originalColumns);
    expect(projectField(0, 'activityName').value).toBe('');
    expect(projectField(0, 'achievementName').value).toBe('保留成果一');
    expect(projectField(1, 'achievementName').value).toBe('保留成果二');
    expect(projectField(0, 'psName').value).toBe('保留产品一');
    expect(projectField(1, 'psName').value).toBe('保留产品二');
    expect(api.generateNames).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    expect(persisted['101'].projects.every((item: { ipName: string }) => !item.ipName)).toBe(true);
  });
  it('previews without saving, discards on cancel, and fills only on explicit confirmation', async () => {
    const draft = ipDraft();
    const row = newProject([]);
    row.rdNumber = 'RD01';
    row.activityName = '工业控制研发';
    row.researchPeriod = '2025-01-01—2025-12-31';
    draft.projects = [row];
    const ip = { ...newIpItem([]), name: '控制软件', number: 'IP01', patentType: '软件著作权', legalStatus: '授权', patentNumber: 'SR01', patentee: '测试企业', applicationDate: '2025-06-01', grantDate: '2025-09-01' };
    draft.ipSummary = [ip];
    persisted['101'] = { ...draft, companyId: '101', companyName: '测试企业101', updatedAt: null };
    api.allocation.mockImplementation(async (_company: string, source: typeof draft) => ({
      assignments: [{ ipId: source.ipSummary[0]!.id, projectId: source.projects[0]!.id, rdNumber: 'RD01', timing: 'within', round: 'spread', similarNames: [], reason: '第一轮分散分配' }],
      strategy: 'spread_then_similar', nameGroups: [], preserved: [], unassigned: [], warnings: [],
      distribution: [{ projectId: source.projects[0]!.id, rdNumber: 'RD01', existingCount: 0, addedCount: 1 }],
    }));
    await mount('/client/enterprise-receipts/101/high-tech');
    await input(`ip-${ip.id}-name`, '控制软件新名称');
    button('保存并下一步').click();
    await settle();
    expect(persisted['101'].ipSummary[0].name).toBe('控制软件新名称');
    api.save.mockClear();
    button('IP自动分配').click();
    await settle();
    expect(api.allocation).toHaveBeenCalledTimes(1);
    expect(api.save).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('第一轮分散分配');
    button('取消').click();
    await settle();
    expect((projectField(0, 'ipName') as HTMLInputElement).value).toBe('');
    button('IP自动分配').click();
    await settle();
    await projectInput(0, 'researchPeriod', '2025-01-01—2025-11-30');
    expect(button('确认分配，填入项目详情').disabled).toBe(true);
    button('取消').click();
    button('IP自动分配').click();
    await settle();
    button('确认分配，填入项目详情').click();
    await settle();
    expect((projectField(0, 'ipName') as HTMLInputElement).value).toBe('控制软件新名称');
    expect(api.save).not.toHaveBeenCalled();
    expect(persisted['101'].projects[0].ipName).toBe('');
  });
  it('generates from detail IP names, preserves other data, saves provenance and reloads PS names', async () => {
    const draft = projectDraft(2);
    const original = structuredClone(draft.projects);
    const result = nameGenerationFixture(draft.projects);
    api.generateNames.mockResolvedValue(result);
    await mount('/client/enterprise-receipts/101/high-tech');
    button('一键生成').click();
    await settle();
    expect(api.generateNames).toHaveBeenCalledWith('101', { projects: original });
    expect(projectField(0, 'activityName').value).toBe(result.rds[0]!.name);
    expect(projectField(0, 'achievementName').value).toBe(result.achievements[0]!.name);
    expect(projectField(0, 'psName').value).toBe('综合监测产品');
    expect(projectField(1, 'psName').value).toBe('综合监测产品');
    expect(projectField(0, 'psNumber').value).toBe('PS01');
    expect(projectField(0, 'ipName').value).toBe(original[0]!.ipName);
    expect(host.textContent).toContain('名称已生成');
    expect(host.textContent).toContain('1 项PS');
    expect(host.textContent).not.toContain('待资料确认');
    expect(api.save).not.toHaveBeenCalled();
    await projectInput(0, 'activityName', '企业修改研发名称');
    await projectInput(0, 'psName', '企业产品名称');
    expect(projectField(1, 'psName').value).toBe('企业产品名称');
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].nameGeneration.mappings).toEqual(result.mappings);
    expect(persisted['101'].projects[0].psName).toBe('企业产品名称');
    expect(persisted['101'].projects.every((row: HighTechProject) => row.psName === '企业产品名称')).toBe(true);
    app.unmount(); host.remove();
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(projectField(0, 'psName').value).toBe('企业产品名称');
    button('一键生成').click(); await settle();
    expect(api.generateNames).toHaveBeenCalledTimes(2);
    expect(projectField(0, 'psName').value).toBe('综合监测产品');
    await projectInput(0, 'ipName', '修改后的IP名称');
    button('保存草稿').click(); await settle();
    expect(persisted['101'].nameGeneration).toBeUndefined();
  });
  it('saves and reloads multiple PSs and only edits rows in the same PS', async () => {
    const draft = projectDraft(3);
    const result = nameGenerationFixture(draft.projects);
    result.products[0]!.achievementIds = ['A0', 'A1'];
    result.products.push({ id: 'P02', name: '数据加密服务', achievementIds: ['A2'], reason: '独立的数据安全用途' });
    result.mappings[2]!.productId = 'P02';
    api.generateNames.mockResolvedValue(result);
    await mount('/client/enterprise-receipts/101/high-tech');
    button('一键生成').click(); await settle();
    expect(host.textContent).toContain('2 项PS');
    expect([0, 1, 2].map((index) => projectField(index, 'psNumber').value)).toEqual(['PS01', 'PS01', 'PS02']);
    await projectInput(0, 'psName', '企业监测产品');
    expect(projectField(1, 'psName').value).toBe('企业监测产品');
    expect(projectField(2, 'psName').value).toBe('数据加密服务');
    button('保存草稿').click(); await settle();
    expect(persisted['101'].nameGeneration.version).toBe(3);
    expect(persisted['101'].nameGeneration.products).toHaveLength(2);
    app.unmount(); host.remove();
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(host.textContent).toContain('2 项PS');
    expect([0, 1, 2].map((index) => projectField(index, 'psName').value)).toEqual(['企业监测产品', '企业监测产品', '数据加密服务']);
    expect([0, 1, 2].map((index) => projectField(index, 'psNumber').value)).toEqual(['PS01', 'PS01', 'PS02']);
  });
  it('keeps earlier names and provenance after a model failure', async () => {
    const draft = projectDraft(1);
    persisted['101'].nameGeneration = nameGenerationFixture(draft.projects);
    api.generateNames.mockRejectedValue(new Error('模型检查未通过'));
    await mount('/client/enterprise-receipts/101/high-tech');
    button('一键生成').click(); await settle();
    expect(projectField(0, 'activityName').value).toBe(draft.projects[0]!.activityName);
    expect(host.textContent).toContain('模型检查未通过');
    expect(host.textContent).toContain('名称已生成');
    expect(api.save).not.toHaveBeenCalled();
  });
  it('blocks saving and detail edits while generation is pending', async () => {
    const draft = projectDraft(1);
    const result = nameGenerationFixture(draft.projects);
    let resolve!: (value: typeof result) => void;
    api.generateNames.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await mount('/client/enterprise-receipts/101/high-tech');
    button('一键生成').click(); await settle();
    expect(button('保存草稿').disabled).toBe(true);
    expect(button('一键生成').disabled).toBe(true);
    expect(projectField(0, 'ipName').disabled).toBe(true);
    await projectInput(0, 'ipName', '生成期间修改IP');
    resolve(result); await settle();
    expect(projectField(0, 'activityName').value).toBe(result.rds[0]!.name);
    expect(projectField(0, 'ipName').value).toBe(draft.projects[0]!.ipName);
    expect(button('保存草稿').disabled).toBe(false);
    expect(api.save).not.toHaveBeenCalled();
  });
  it('advances estimated button progress without reaching completion before a valid response', async () => {
    const draft = projectDraft(1);
    const result = nameGenerationFixture(draft.projects);
    let resolve!: (value: typeof result) => void;
    api.generateNames.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await mount('/client/enterprise-receipts/101/high-tech');
    vi.useFakeTimers();
    button('一键生成').click(); await settle();
    const progress = () => host.querySelector('[role="progressbar"]')!;
    expect(progress().getAttribute('aria-valuenow')).toBe('5');
    expect(progress().getAttribute('aria-label')).toContain('估算');
    expect(button('一键生成').textContent).toContain('5%');
    expect(button('一键生成').getAttribute('aria-busy')).toBe('true');
    expect(host.textContent).toContain('预计阶段：IP技术语义分析');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(Number(progress().getAttribute('aria-valuenow'))).toBeGreaterThan(5);
    expect(host.textContent).toContain('预计阶段：科技成果名称生成');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(host.textContent).toContain('预计阶段：PS产品服务归并');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(host.textContent).toContain('预计阶段：关联关系与一致性校验');
    await vi.advanceTimersByTimeAsync(450_000);
    expect(progress().getAttribute('aria-valuenow')).toBe('95');
    expect(host.textContent).toContain('仍在等待模型返回');
    expect(projectField(0, 'activityName').value).toBe(draft.projects[0]!.activityName);
    resolve(result); await settle();
    expect(progress().getAttribute('aria-valuenow')).toBe('100');
    expect(host.querySelector('.name-generation-control')?.getAttribute('data-state')).toBe('success');
    expect(host.textContent).toContain('名称生成完成');
    expect(button('一键生成').disabled).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(api.save).not.toHaveBeenCalled();
  });
  it('stops estimated progress on failure and restarts from the initial value on retry', async () => {
    const draft = projectDraft(1);
    const result = nameGenerationFixture(draft.projects);
    let reject!: (reason: Error) => void;
    let resolve!: (value: typeof result) => void;
    api.generateNames.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }))
      .mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    await mount('/client/enterprise-receipts/101/high-tech');
    vi.useFakeTimers();
    button('一键生成').click(); await settle();
    await vi.advanceTimersByTimeAsync(30_000);
    reject(new Error('模型服务超时')); await settle();
    const stopped = host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow');
    expect(host.querySelector('.name-generation-control')?.getAttribute('data-state')).toBe('error');
    expect(host.textContent).toContain('名称生成失败，可重新生成');
    expect(host.textContent).toContain('模型服务超时');
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(stopped);
    expect(projectField(0, 'activityName').value).toBe(draft.projects[0]!.activityName);
    button('一键生成').click(); await settle();
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('5');
    expect(host.textContent).not.toContain('模型服务超时');
    expect(vi.getTimerCount()).toBe(1);
    resolve(result); await settle();
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('100');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not show 100 percent or overwrite original names for an invalid response', async () => {
    const draft = projectDraft(1);
    const result = nameGenerationFixture(draft.projects);
    result.rds = [];
    api.generateNames.mockResolvedValue(result);
    await mount('/client/enterprise-receipts/101/high-tech');
    vi.useFakeTimers();
    button('一键生成').click(); await settle();
    expect(host.querySelector('.name-generation-control')?.getAttribute('data-state')).toBe('error');
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('5');
    expect(projectField(0, 'activityName').value).toBe(draft.projects[0]!.activityName);
    expect(vi.getTimerCount()).toBe(0);
    expect(api.save).not.toHaveBeenCalled();
  });
  it('blocks company switching during generation and resets progress after completion', async () => {
    const draft = projectDraft(1);
    persisted['102'] = { ...structuredClone(persisted['101']), companyId: '102', companyName: '测试企业102' };
    const result = nameGenerationFixture(draft.projects);
    let resolveFirst!: (value: typeof result) => void;
    api.generateNames.mockImplementationOnce(() => new Promise((done) => { resolveFirst = done; }))
      .mockResolvedValueOnce(result);
    vi.stubGlobal('confirm', vi.fn(() => true));
    await mount('/client/enterprise-receipts/101/high-tech');
    vi.useFakeTimers();
    button('一键生成').click(); await settle();
    await vi.advanceTimersByTimeAsync(30_000);
    await router.push('/client/enterprise-receipts/102/high-tech'); await settle();
    expect(router.currentRoute.value.params.companyId).toBe('101');
    expect(button('一键生成').disabled).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    expect(projectField(0, 'activityName').value).toBe(draft.projects[0]!.activityName);
    resolveFirst(result); await settle();
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('100');
    expect(vi.getTimerCount()).toBe(0);
    await router.push('/client/enterprise-receipts/102/high-tech'); await settle();
    expect(host.querySelector('[role="progressbar"]')).toBeNull();
    button('一键生成').click(); await settle();
    expect(api.generateNames).toHaveBeenCalledTimes(2);
  });
  it('clears the progress timer on unmount and ignores a late response', async () => {
    const draft = projectDraft(1);
    const result = nameGenerationFixture(draft.projects);
    let resolve!: (value: typeof result) => void;
    api.generateNames.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await mount('/client/enterprise-receipts/101/high-tech');
    vi.useFakeTimers();
    button('一键生成').click(); await settle();
    expect(resolve).toBeTypeOf('function');
    expect(vi.getTimerCount()).toBe(1);
    app.unmount();
    expect(vi.getTimerCount()).toBe(0);
    resolve(result); await settle();
    expect(host.querySelector('[role="progressbar"]')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(api.save).not.toHaveBeenCalled();
  });
  it('lets the backend resolve existing-RD fallback and report missing references without IP', async () => {
    projectDraft(1).projects[0]!.ipName = '';
    api.generateNames.mockRejectedValue(new Error('请填写IP名称，或为无IP项目提供其他可参考的RD名称'));
    await mount('/client/enterprise-receipts/101/high-tech');
    button('一键生成').click(); await settle();
    expect(api.generateNames).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('其他可参考的RD名称');
    expect(api.save).not.toHaveBeenCalled();
  });
  it('keeps floating controls in early steps and uses page toolbars for materials', async () => {
    await mount('/client/enterprise-receipts/101/high-tech');

    expect(document.body.querySelector('.floating-actions')).toBeTruthy();
    expect(host.querySelector('.page-footer')).toBeNull();
    expect(document.body.textContent).not.toContain('返回企业档案');
    expect(button('保存草稿')).toBeTruthy();
    expect(button('保存并下一步')).toBeTruthy();

    app.unmount();
    host.remove();
    const lastStep = emptyDraft();
    lastStep.currentStep = 2;
    lastStep.book[0]!.content = '材料内容';
    persisted['101'] = {
      ...lastStep,
      companyId: '101',
      companyName: '测试企业101',
      updatedAt: null,
    };
    await mount('/client/enterprise-receipts/101/high-tech');

    expect(button('上一步')).toBeTruthy();
    expect(button('导出申请书 PDF')).toBeTruthy();
    expect(host.querySelector('.mw-toolbar')?.firstElementChild?.textContent?.trim()).toBe('上一步');
    expect(document.body.querySelector('.floating-actions')).toBeNull();
    expect(host.querySelector('.mw-toolbar')?.textContent).not.toContain('保存草稿');

    button('制作高新附件').click(); await settle();
    expect(button('导出完整材料 ZIP')).toBeTruthy();
    expect(host.querySelector('.mw-toolbar')?.textContent).not.toContain('导出附件汇总 PDF');
    expect(host.querySelector('.mw-toolbar')?.firstElementChild?.textContent?.trim()).toBe('上一步');
    button('上一步').click(); await settle();
    expect(button('保存并下一步')).toBeTruthy();
    expect(document.body.querySelector('.floating-actions')).toBeTruthy();
  });

  it('generates and retains reviewed attachment text separately from the application book', async () => {
    projectDraft(1);
    persisted['101'].currentStep = 2;
    await mount('/client/enterprise-receipts/101/high-tech');
    button('制作高新附件').click();
    await settle();
    expect(host.querySelectorAll('article[id^="material-"]')).toHaveLength(14);
    button('撰写企业职工人员情况说明').click();
    await settle();
    button('AI 撰写').click();
    await settle();
    expect(api.generateDocument).toHaveBeenCalledWith('101', 'staff/statement', 1500);
    expect(host.querySelector<HTMLTextAreaElement>('textarea.mw-document')?.value).toBe('');
    button('应用到草稿').click();
    await settle();
    expect(host.querySelector<HTMLTextAreaElement>('textarea.mw-document')?.value).toBe('企业人员资料草稿');
    const review = host.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    review.checked = true; review.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(); button('保存草稿').click(); await settle();
    expect(persisted['101'].workspace.documents['staff/statement']).toMatchObject({ content: '企业人员资料草稿', reviewed: true });
    expect(persisted['101'].book.every((item: any) => !item.content)).toBe(true);
    app.unmount(); host.remove();
    await mount('/client/enterprise-receipts/101/high-tech');
    button('制作高新附件').click(); await settle();
    button('撰写企业职工人员情况说明').click(); await settle();
    expect(host.querySelector<HTMLTextAreaElement>('textarea.mw-document')?.value).toBe('企业人员资料草稿');
  });

  it('recommends from deduplicated patent names and fills every row only after selection', async () => {
    const draft = projectDraft(3);
    draft.projects[0]!.ipName = '智能分析软件';
    draft.projects[1]!.ipName = ' 智能分析软件 ';
    draft.projects[2]!.ipName = '数据处理装置';
    await mount('/client/enterprise-receipts/101/high-tech');
    const previous = draft.projects.map((row) => row.techField);
    button('高新技术领域推荐').click();
    await settle();
    expect(api.recommendFields).toHaveBeenCalledWith('101', ['智能分析软件', '数据处理装置']);
    expect(draft.projects.map((_, index) => projectField(index, 'techField').value)).toEqual(previous);
    const select = host.querySelector<HTMLSelectElement>('[aria-label="搜索全部高新技术领域"]')!;
    expect([...select.options].filter((option) => option.value === fieldFixtures[0]!.id)).toHaveLength(1);
    select.value = fieldFixtures[0]!.id;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(draft.projects.map((_, index) => projectField(index, 'techField').value)).toEqual(Array(3).fill(fieldFixtures[0]!.label));
    expect(api.save).not.toHaveBeenCalled();
    button('保存草稿').click();
    await settle();
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(persisted['101'].projects.every((row: any) => row.techField === fieldFixtures[0]!.label)).toBe(true);
  });
  it('keeps the full catalog selectable after recommendation failure', async () => {
    projectDraft(2);
    api.recommendFields.mockRejectedValueOnce(new Error('推荐服务离线'));
    await mount('/client/enterprise-receipts/101/high-tech');
    button('高新技术领域推荐').click();
    await settle();
    expect(host.textContent).toContain('推荐服务离线');
    const select = host.querySelector<HTMLSelectElement>('[aria-label="搜索全部高新技术领域"]')!;
    select.value = fieldFixtures[1]!.id;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(projectField(0, 'techField').value).toBe(fieldFixtures[1]!.label);
    expect(projectField(1, 'techField').value).toBe(fieldFixtures[1]!.label);
    expect(api.save).not.toHaveBeenCalled();
  });
  it('rejects stale recommendations when a patent name changes', async () => {
    projectDraft(1);
    let resolve!: (value: any) => void;
    api.recommendFields.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    await mount('/client/enterprise-receipts/101/high-tech');
    button('高新技术领域推荐').click();
    await settle();
    await projectInput(0, 'ipName', '新的专利名称');
    resolve({ fields: [{ id: 'stale', label: '过期推荐' }] });
    await settle();
    expect(host.textContent).not.toContain('过期推荐');
    expect(button('高新技术领域推荐').disabled).toBe(false);
  });
  it('blocks recommendation without names and allows catalog retry', async () => {
    projectDraft(1).projects[0]!.ipName = '';
    api.fieldCatalog.mockRejectedValueOnce(new Error('目录加载失败'));
    await mount('/client/enterprise-receipts/101/high-tech');
    button('高新技术领域推荐').click();
    await settle();
    expect(api.recommendFields).not.toHaveBeenCalled();
    button('重试领域目录').click();
    await settle();
    expect(api.fieldCatalog).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('请先填写项目详情表中的专利名称');
    expect(host.textContent).toContain(fieldFixtures[1]!.label);
  });
  it('shows IP summary in the first step and preserves existing basic information and scores', async () => {
    const info = { salesRevenue: 1200.25, employeeCount: 30, insuredEmployeeCount: 28, patentCount: 10, inventionPatentCount: 2, utilityModelCount: 3, softwareCopyrightCount: 5, hasRdExpenses: false };
    const scores = { intellectualProperty: 30, transformation: 30, organization: 20, salesGrowth: 10, netAssetGrowth: 10 };
    persisted['101'] = { ...emptyDraft(), basicInfo: info, scores, companyId: '101', companyName: '测试企业101', updatedAt: null };
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(host.querySelector('h2')?.textContent).toBe('知识产权汇总表');
    expect(host.querySelector('.workflow-steps')?.textContent).toContain('知识产权汇总表');
    expect(host.querySelector('section[aria-label="知识产权汇总表"]')).not.toBeNull();
    expect(host.textContent).not.toContain('操作手册教程');
    expect(host.querySelector('.manual-steps')).toBeNull();
    expect(host.querySelector('[data-project-table]')).toBeNull();
    expect(host.querySelector('[id^="score-"]')).toBeNull();
    expect(host.textContent).not.toContain('基础信息填写');
    expect(host.textContent).not.toContain('基本信息填写');
    expect(host.textContent).not.toContain('填写企业基本信息，并完成企业创新能力自评。支持留空保存草稿。');
    expect(host.querySelector('[id^="basic-"]')).toBeNull();
    expect(button('导入')).toBeTruthy();
    expect(button('导出')).toBeTruthy();
    expect(button('PDF上传识别')).toBeTruthy();
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].basicInfo).toEqual(info);
    expect(persisted['101'].scores).toEqual(scores);
    app.unmount();
    host.remove();
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(host.querySelector('.ip-table-section')).not.toBeNull();
    expect(host.querySelector('[id^="basic-"]')).toBeNull();
    button('保存并下一步').click();
    await settle();
    expect(persisted['101'].currentStep).toBe(1);
    expect(persisted['101'].basicInfo).toEqual(info);
    expect(persisted['101'].scores).toEqual(scores);
  });
  it('saves an empty IP summary and advances without scores or basic information', async () => {
    await mount('/client/enterprise-receipts/101/high-tech');
    button('保存草稿').click();
    await settle();
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(persisted['101'].basicInfo).toEqual(emptyDraft().basicInfo);
    button('保存并下一步').click();
    await settle();
    expect(api.save).toHaveBeenCalledTimes(2);
    expect(persisted['101'].currentStep).toBe(1);
    expect(persisted['101'].ipSummary).toEqual([]);
    expect(persisted['101'].basicInfo).toEqual(emptyDraft().basicInfo);
  });
  it('loads legacy drafts without basic information and saves blank fields', async () => {
    const legacy: any = emptyDraft();
    delete legacy.basicInfo;
    persisted['101'] = { ...legacy, companyId: '101', companyName: '旧企业', updatedAt: null };
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(host.querySelector('#basic-employeeCount')).toBeNull();
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].basicInfo).toEqual(emptyDraft().basicInfo);
  });
  const ipRow = { id: 'recognized', number: '', name: '识别名称', patentType: '发明专利', legalStatus: '授权', patentNumber: '20260001.X', patentee: '测试企业', grantDate: '2026-01-01', applicationDate: '2025-01-01' };
  const requiredIpFields = IP_SUMMARY_FIELDS.filter(({ key }) => key !== 'number');
  const summaryRows = () => host.querySelectorAll('.ip-table-section tbody tr');
  async function setIpField(prefix: string, label: string, value: string) {
    const field = host.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${prefix}${label}"]`)!;
    expect(field).toBeTruthy();
    field.value = value;
    field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    await settle();
  }
  async function uploadPdfs(names: string[]) {
    const node = host.querySelector<HTMLInputElement>('input[type=file][multiple]')!;
    Object.defineProperty(node, 'files', { configurable: true, value: names.map((name) => new File(['%PDF-synthetic'], name, { type: 'application/pdf' })) });
    node.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  }
  function mockIpDownload() {
    api.exportIp.mockResolvedValue(new Blob(['workbook']));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:ip-summary');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  }
  const summaryNames = () => [...host.querySelectorAll<HTMLInputElement>('.ip-table-section input[id$="-name"]')].map((node) => node.value);
  const summaryNumbers = () => [...host.querySelectorAll<HTMLInputElement>('.ip-table-section input[id$="-number"]')].map((node) => node.value);
  const mixedIpRows = () => [
    { ...ipRow, id: 'design', name: '外观', patentType: '外观设计', applicationDate: '2020-01-01' },
    { ...ipRow, id: 'late', name: '晚申请发明', applicationDate: '2025-01-01' },
    { ...ipRow, id: 'software', name: '软著', patentType: '软件著作权', applicationDate: '2021-01-01' },
    { ...ipRow, id: 'utility', name: '实用新型', patentType: '实用新型', applicationDate: '2022-01-01' },
    { ...ipRow, id: 'early', name: '早申请发明', applicationDate: '2023-01-01' },
    { ...ipRow, id: 'missing', name: '缺申请日期发明', applicationDate: '' },
  ];
  it('sorts loaded IP rows and unsaved date/type edits consistently with export', async () => {
    ipDraft();
    persisted['101'].ipSummary = mixedIpRows();
    const original = structuredClone(persisted['101'].ipSummary);
    mockIpDownload();
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(summaryNames()).toEqual(['早申请发明', '晚申请发明', '缺申请日期发明', '实用新型', '软著', '外观']);
    expect(summaryNumbers()).toEqual(['IP01', 'IP02', 'IP03', 'IP04', 'IP05', 'IP06']);
    expect(host.querySelector<HTMLInputElement>('[aria-label="知识产权第1行编号"]')?.disabled).toBe(true);
    await input('ip-late-applicationDate', '2022-01-01');
    expect(summaryNames().slice(0, 3)).toEqual(['晚申请发明', '早申请发明', '缺申请日期发明']);
    await setIpField('知识产权第1行', '专利类型', '外观设计');
    expect(summaryNames()).toEqual(['早申请发明', '缺申请日期发明', '实用新型', '软著', '外观', '晚申请发明']);
    button('导出').click();
    await settle();
    expect(api.exportIp.mock.lastCall![1].map((row: any) => row.name)).toEqual(summaryNames());
    expect(api.exportIp.mock.lastCall![1].map((row: any) => row.number)).toEqual(summaryNumbers());
    expect(persisted['101'].ipSummary).toEqual(original);
    expect(api.save).not.toHaveBeenCalled();
  });
  it('selects summary IPs, replaces mapped fields, persists dates and clears the selection', async () => {
    projectDraft(1);
    persisted['101'].ipSummary = [
      { ...ipRow, id: 'first', number: 'IP01', name: '控制软件' },
      { ...ipRow, id: 'second', number: 'IP02', name: '装置外观', patentType: '外观设计', patentNumber: 'CN002', applicationDate: '2025-02-01', grantDate: '2026-02-01' },
    ];
    await mount('/client/enterprise-receipts/101/high-tech');
    const select = projectField(0, 'ipNumber') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(select.options[0]!.textContent).toBe('无');
    expect([...select.options].filter((option) => !option.disabled).map((option) => option.value)).toEqual(['', 'IP01', 'IP02']);
    expect(select.textContent).toContain('IP01 · 控制软件');
    const dateInputs = [...host.querySelectorAll('[data-project-table] tbody tr')][0]!.querySelectorAll('input[type=date]');
    expect([...dateInputs].map((node) => node.id.split('-').at(-1))).toEqual(['applicationDate', 'authorizationDate']);
    const acquisition = projectField(0, 'acquisitionMethod').value;
    const activity = projectField(0, 'activityName').value;
    for (const number of ['IP01', 'IP02']) {
      await projectInput(0, 'ipNumber', number);
      const ip = persisted['101'].ipSummary.find((item: any) => item.number === number);
      for (const [key, value] of Object.entries({ ipName: ip.name, authorizationNumber: ip.patentNumber, applicationDate: ip.applicationDate, authorizationDate: ip.grantDate, ipType: ip.patentType })) {
        expect(projectField(0, key).value).toBe(value);
      }
      expect(projectField(0, 'acquisitionMethod').value).toBe(acquisition);
      expect(projectField(0, 'activityName').value).toBe(activity);
    }
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].projects[0]).toMatchObject({ ipNumber: 'IP02', applicationDate: '2025-02-01', authorizationDate: '2026-02-01' });
    app.unmount();
    host.remove();
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(projectField(0, 'applicationDate').value).toBe('2025-02-01');
    await projectInput(0, 'ipNumber', '');
    for (const key of ['ipNumber', 'ipName', 'authorizationNumber', 'applicationDate', 'authorizationDate', 'ipType', 'acquisitionMethod']) expect(projectField(0, key).value).toBe('');
    expect(projectField(0, 'acquisitionMethod').disabled).toBe(true);
    await projectInput(0, 'acquisitionMethod', '原始取得');
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].projects[0].acquisitionMethod).toBe('');
    app.unmount();
    host.remove();
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(projectField(0, 'ipNumber').value).toBe('');
    expect(projectField(0, 'acquisitionMethod').value).toBe('');
    expect(projectField(0, 'acquisitionMethod').disabled).toBe(true);
    await projectInput(0, 'ipNumber', 'IP01');
    expect(projectField(0, 'acquisitionMethod').disabled).toBe(false);
    await projectInput(0, 'acquisitionMethod', '转让取得');
    expect(projectField(0, 'acquisitionMethod').value).toBe('转让取得');
  });
  it('clears acquisition from historical unlinked rows on load and save', async () => {
    projectDraft(1);
    persisted['101'].projects[0].ipNumber = ' ';
    persisted['101'].projects[0].acquisitionMethod = '原始取得';
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(projectField(0, 'acquisitionMethod').value).toBe('');
    expect(projectField(0, 'acquisitionMethod').disabled).toBe(true);
    expect(projectField(0, 'ipName').value).toBe('知识产权名称示例1');
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].projects[0].acquisitionMethod).toBe('');
  });
  it('synchronizes project references on load and date/type edits, then saves and reloads consistently', async () => {
    projectDraft(1);
    persisted['101'].ipSummary = [
      { ...ipRow, id: 'design', number: 'IP01', patentType: '外观设计' },
      { ...ipRow, id: 'late', number: 'IP02' },
      { ...ipRow, id: 'early', number: 'IP03', applicationDate: '2023-01-01' },
    ];
    persisted['101'].projects[0].ipNumber = 'IP01、IP02,IP03';
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(projectField(0, 'ipNumber').value).toBe('IP03、IP02,IP01');
    await projectInput(0, 'activityName', '未保存的项目修改');
    button('上一步').click();
    await settle();
    expect(api.save).not.toHaveBeenCalled();
    expect(host.querySelector('[data-project-table]')).toBeNull();
    await input('ip-late-applicationDate', '2022-01-01');
    button('保存并下一步').click();
    await settle();
    expect(projectField(0, 'ipNumber').value).toBe('IP03、IP01,IP02');
    expect(projectField(0, 'activityName').value).toBe('未保存的项目修改');
    button('上一步').click();
    await settle();
    await setIpField('知识产权第1行', '专利类型', '软件著作权');
    button('保存并下一步').click();
    await settle();
    expect(projectField(0, 'ipNumber').value).toBe('IP03、IP02,IP01');
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].ipSummary.map((row: any) => row.id)).toEqual(['early', 'late', 'design']);
    expect(persisted['101'].ipSummary.map((row: any) => row.number)).toEqual(['IP01', 'IP02', 'IP03']);
    expect(persisted['101'].projects[0].ipNumber).toBe('IP03、IP02,IP01');
    app.unmount();
    host.remove();
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(projectField(0, 'ipNumber').value).toBe('IP03、IP02,IP01');
    expect(projectField(0, 'activityName').value).toBe('未保存的项目修改');
  });
  it('keeps references to existing records when imported numbers collide', async () => {
    ipDraft(1);
    persisted['101'].ipSummary = [{ ...ipRow, id: 'existing', number: 'IP01' }];
    persisted['101'].projects[0].ipNumber = 'IP01';
    api.importIp.mockResolvedValue({ rows: [{ ...ipRow, id: 'imported', number: 'IP01', applicationDate: '2023-01-01' }], total: 1 });
    await mount('/client/enterprise-receipts/101/high-tech');
    const upload = host.querySelector<HTMLInputElement>('input[type=file][accept=".xlsx,.xlsm"]')!;
    Object.defineProperty(upload, 'files', { configurable: true, value: [new File(['fixture'], '知识产权.xlsx')] });
    upload.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(summaryNumbers()).toEqual(['IP01', 'IP02']);
    expect(api.save).not.toHaveBeenCalled();
    button('保存并下一步').click();
    await settle();
    expect(projectField(0, 'ipNumber').value).toBe('IP02');
    expect(persisted['101'].projects[0].ipNumber).toBe('IP02');
  });
  it('clears deleted references before renumbering remaining records', async () => {
    ipDraft(2);
    persisted['101'].ipSummary = [
      { ...ipRow, id: 'early', number: 'IP01', applicationDate: '2023-01-01' },
      { ...ipRow, id: 'late', number: 'IP02' },
    ];
    persisted['101'].projects[0].ipNumber = 'IP01、IP02';
    persisted['101'].projects[1].ipNumber = 'IP01';
    await mount('/client/enterprise-receipts/101/high-tech');
    host.querySelector<HTMLButtonElement>('[aria-label="删除知识产权IP01"]')!.click();
    await settle();
    expect(summaryNumbers()).toEqual(['IP01']);
    expect(api.save).not.toHaveBeenCalled();
    button('保存并下一步').click();
    await settle();
    expect(projectField(0, 'ipNumber').value).toBe('IP01');
    expect(projectField(1, 'ipNumber').value).toBe('');
  });
  it('sorts newly added IP rows when their type and application date are filled', async () => {
    ipDraft();
    persisted['101'].ipSummary = [{ ...ipRow, id: 'existing', patentType: '软件著作权' }];
    await mount('/client/enterprise-receipts/101/high-tech');
    button('新增知识产权').click();
    await settle();
    await setIpField('知识产权第2行', '名称', '新增发明');
    await setIpField('知识产权第2行', '专利类型', '发明专利');
    expect(summaryNames()).toEqual(['新增发明', '识别名称']);
    await setIpField('知识产权第1行', '申请日期', '2024-01-01');
    expect(summaryNames()).toEqual(['新增发明', '识别名称']);
  });
  it('sorts imported IP rows together with existing rows without autosaving', async () => {
    ipDraft();
    persisted['101'].ipSummary = [{ ...ipRow, id: 'existing', name: '已有发明' }];
    const rows = mixedIpRows().filter((row) => row.applicationDate);
    api.importIp.mockResolvedValue({ rows, total: rows.length });
    await mount('/client/enterprise-receipts/101/high-tech');
    const upload = host.querySelector<HTMLInputElement>('input[type=file][accept=".xlsx,.xlsm"]')!;
    Object.defineProperty(upload, 'files', { configurable: true, value: [new File(['fixture'], '知识产权.xlsx')] });
    upload.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(summaryNames()).toEqual(['早申请发明', '已有发明', '晚申请发明', '实用新型', '软著', '外观']);
    expect(api.save).not.toHaveBeenCalled();
    expect(persisted['101'].ipSummary).toHaveLength(1);
  });
  it('reports validation errors using the displayed sorted IP row number', async () => {
    ipDraft();
    persisted['101'].ipSummary = mixedIpRows();
    await mount('/client/enterprise-receipts/101/high-tech');
    button('保存草稿').click();
    await settle();
    expect(host.textContent).toContain('第3行：请填写申请日期');
    expect(api.save).not.toHaveBeenCalled();
  });
  it('exports all IP rows with unsaved edits and additions without saving the draft', async () => {
    ipDraft();
    persisted['101'].ipSummary = Array.from({ length: 15 }, (_, index) => ({ ...ipRow, id: `ip-${index}`, number: `IP${index + 1}` }));
    const click = mockIpDownload();
    await mount('/client/enterprise-receipts/101/high-tech');
    await setIpField('知识产权第1行', '名称', '未保存的修改');
    button('新增知识产权').click();
    await settle();
    button('导出').click();
    await settle();
    const [companyId, rows] = api.exportIp.mock.lastCall!;
    expect(companyId).toBe('101');
    expect(rows).toHaveLength(16);
    expect(rows[0].name).toBe('未保存的修改');
    expect(rows[15].name).toBe('');
    expect(api.save).not.toHaveBeenCalled();
    expect(persisted['101'].ipSummary).toHaveLength(15);
    expect(persisted['101'].ipSummary[0].name).toBe(ipRow.name);
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('知识产权汇总表.xlsx');
  });
  it('exports an empty IP table without its input placeholder', async () => {
    ipDraft();
    mockIpDownload();
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(summaryRows()).toHaveLength(1);
    expect(button('导出').disabled).toBe(false);
    button('导出').click();
    await settle();
    expect(api.exportIp).toHaveBeenCalledExactlyOnceWith('101', []);
    expect(api.save).not.toHaveBeenCalled();
  });
  it('preserves unsaved IP input and allows retry after an export failure', async () => {
    ipDraft();
    const click = mockIpDownload();
    api.exportIp.mockRejectedValueOnce(new Error('导出失败测试'));
    await mount('/client/enterprise-receipts/101/high-tech');
    await setIpField('知识产权第1行', '名称', '待保留内容');
    button('导出').click();
    await settle();
    expect(host.textContent).toContain('导出失败测试');
    expect(host.querySelector<HTMLInputElement>('[aria-label="知识产权第1行名称"]')?.value).toBe('待保留内容');
    expect(button('导出').disabled).toBe(false);
    expect(click).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    button('导出').click();
    await settle();
    expect(click).toHaveBeenCalledOnce();
  });
  it('retains partial input without a trailing placeholder, adds rows explicitly and restores the empty placeholder after deletion', async () => {
    ipDraft();
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(summaryRows()).toHaveLength(1);
    expect(host.querySelector('[aria-label="知识产权第1行名称"]')?.closest('tr')?.textContent).toContain('待填写');
    await setIpField('知识产权第1行', '名称', '手工填写');
    expect(summaryRows()).toHaveLength(1);
    expect(host.querySelector('[aria-label="知识产权第2行名称"]')).toBeNull();
    button('保存草稿').click();
    await settle();
    expect(api.save).not.toHaveBeenCalled();
    expect(host.textContent).toContain('第1行：请填写专利类型');
    for (const { key, label } of requiredIpFields) await setIpField('知识产权第1行', label, ipRow[key]);
    button('新增知识产权').click();
    await settle();
    expect(summaryRows()).toHaveLength(2);
    expect(host.querySelector<HTMLInputElement>('[aria-label="知识产权第2行编号"]')?.value).toBe('IP02');
    button('保存草稿').click();
    await settle();
    expect(api.save).not.toHaveBeenCalled();
    expect(host.textContent).toContain('第2行：请填写名称');
    host.querySelector<HTMLButtonElement>('[aria-label="删除知识产权IP02"]')!.click();
    await settle();
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].ipSummary).toHaveLength(1);
    expect(summaryRows()).toHaveLength(1);
    host.querySelector<HTMLButtonElement>('[aria-label="删除知识产权IP01"]')!.click();
    await settle();
    expect(summaryRows()).toHaveLength(1);
    expect(host.querySelector<HTMLInputElement>('[aria-label="知识产权第1行名称"]')?.value).toBe('');
    expect(summaryRows()[0]?.textContent).toContain('待填写');
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].ipSummary).toEqual([]);
  });
  it.each(requiredIpFields)('blocks saving and advancing with missing $label until corrected', async ({ key, label }) => {
    ipDraft(1);
    persisted['101'].ipSummary = [{ ...ipRow, [key]: '' }];
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(summaryRows()).toHaveLength(1);
    button('保存草稿').click();
    await settle();
    button('保存并下一步').click();
    await settle();
    expect(api.save).not.toHaveBeenCalled();
    expect(host.textContent).toContain(`第1行：请填写${label}`);
    expect(host.querySelector('section[aria-label="知识产权汇总表"]')).not.toBeNull();
    await setIpField('知识产权第1行', label, ipRow[key]);
    button('保存草稿').click();
    await settle();
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(persisted['101'].ipSummary[0][key]).toBe(ipRow[key]);
    button('保存并下一步').click();
    await settle();
    expect(persisted['101'].currentStep).toBe(1);
    expect(host.querySelector('section[aria-label="制作高新核心信息"]')).not.toBeNull();
  });
  it.each(requiredIpFields)('blocks PDF append with missing $label until corrected', async ({ key, label }) => {
    ipDraft();
    api.recognize.mockResolvedValue({ rows: [{ ...ipRow, [key]: '' }], total: 1, errors: [], warnings: [] });
    await mount('/client/enterprise-receipts/101/high-tech');
    await uploadPdfs(['test.pdf']);
    button('核对无误，追加到汇总表').click();
    await settle();
    expect(host.querySelector('[role=dialog]')?.textContent).toContain(`第1行：请填写${label}`);
    expect(host.textContent).toContain('知识产权 · 0 项');
    expect(api.save).not.toHaveBeenCalled();
    await setIpField('识别结果第1项', label, ipRow[key]);
    button('核对无误，追加到汇总表').click();
    await settle();
    expect(host.querySelector('[role=dialog]')).toBeNull();
    expect(summaryRows()).toHaveLength(1);
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].ipSummary[0][key]).toBe(ipRow[key]);
  });
  it('imports Excel rows without a trailing placeholder and disables manual additions at the limit', async () => {
    ipDraft();
    api.importIp.mockResolvedValue({ rows: [{ ...ipRow, number: 'IP01' }], total: 1 });
    await mount('/client/enterprise-receipts/101/high-tech');
    const fileInput = host.querySelector<HTMLInputElement>('input[type=file][accept=".xlsx,.xlsm"]')!;
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [new File(['test'], 'test.xlsx')] });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(summaryRows()).toHaveLength(1);
    expect(button('新增知识产权').disabled).toBe(false);
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].ipSummary).toHaveLength(1);
    app.unmount();
    host.remove();
    persisted['101'].ipSummary = Array.from({ length: 200 }, (_, index) => ({ ...ipRow, id: `ip-${index}`, number: `IP${index + 1}` }));
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(summaryRows()).toHaveLength(200);
    expect(button('新增知识产权').disabled).toBe(true);
  });
  it('widens only the legal-status popup in the PDF recognition preview', async () => {
    ipDraft();
    api.recognize.mockResolvedValue({ rows: [ipRow], total: 1, errors: [], warnings: [] });
    await mount('/client/enterprise-receipts/101/high-tech');
    await uploadPdfs(['test.pdf']);

    const legalStatus = host.querySelector<HTMLSelectElement>('[aria-label="识别结果第1项法律状态"]')!;
    expect(legalStatus.getAttribute('data-popup-min-width')).toBe('180px');
    expect(Array.from(legalStatus.options, (option) => option.textContent)).toEqual(['请选择', '授权', '申请中', '失效', '终止', '驳回', '撤回']);
    expect(host.querySelector('[aria-label="识别结果第1项专利类型"]')?.hasAttribute('data-popup-min-width')).toBe(false);
    expect(host.querySelector('[aria-label="知识产权第1行法律状态"]')?.hasAttribute('data-popup-min-width')).toBe(false);
    expect(host.querySelectorAll('[data-popup-min-width]')).toHaveLength(1);
  });
  it('previews and edits PDF results before append, preserves existing rows and saves only on request', async () => {
    ipDraft();
    persisted['101'].ipSummary = [{ ...ipRow, id: 'existing', number: 'IP01', patentNumber: 'existing-1' }];
    api.recognize.mockResolvedValue({ rows: [ipRow], total: 1, errors: [], warnings: [] });
    await mount('/client/enterprise-receipts/101/high-tech');
    await uploadPdfs(['test.pdf']);
    expect(api.recognize).toHaveBeenCalledWith('101', [expect.any(File)]);
    const headings = IP_SUMMARY_FIELDS.map(({ label }) => label);
    expect(Array.from(host.querySelectorAll('.ip-table-section th'), (node) => node.textContent).slice(0, 8)).toEqual(headings);
    expect(Array.from(host.querySelectorAll('[role=dialog] th'), (node) => node.textContent).slice(0, 8)).toEqual(headings);
    expect(host.querySelector('[role=dialog]')?.textContent).not.toContain('来源文件');
    expect(host.querySelector('[role=dialog]')?.textContent).not.toContain('test.pdf');
    expect(summaryRows()).toHaveLength(1);
    expect(host.querySelector('[role=dialog]')).toBeTruthy();
    expect(api.save).not.toHaveBeenCalled();
    expect(persisted['101'].ipSummary).toHaveLength(1);
    const name = host.querySelector<HTMLInputElement>('[role=dialog] input[aria-label="识别结果第1项名称"]')!;
    name.value = '人工核对名称';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    button('核对无误，追加到汇总表').click();
    await settle();
    expect(host.querySelector('[role=dialog]')).toBeNull();
    expect(summaryRows()).toHaveLength(2);
    expect(api.save).not.toHaveBeenCalled();
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].ipSummary).toHaveLength(2);
    expect(persisted['101'].ipSummary[0].patentNumber).toBe('existing-1');
    expect(persisted['101'].ipSummary[1]).toMatchObject({ number: 'IP02', name: '人工核对名称' });
  });
  it('continues after one PDF fails and cancellation discards all preview results', async () => {
    ipDraft();
    api.recognize.mockRejectedValueOnce(new Error('网络错误')).mockResolvedValueOnce({ rows: [ipRow], total: 1, errors: [], warnings: ['日期请核对'] });
    await mount('/client/enterprise-receipts/101/high-tech');
    await uploadPdfs(['failed.pdf', 'test.pdf']);
    expect(api.recognize).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role=dialog]')?.textContent).toContain('第1个文件');
    expect(host.querySelector('[role=dialog]')?.textContent).not.toContain('failed.pdf');
    expect(host.querySelector('[role=dialog]')?.textContent).toContain('日期请核对');
    button('取消').click();
    await settle();
    expect(host.querySelector('[role=dialog]')).toBeNull();
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].ipSummary).toEqual([]);
  });
  it('rejects duplicate patent numbers and invalid file types without overwriting data', async () => {
    ipDraft();
    persisted['101'].ipSummary = [{ ...ipRow, id: 'existing', number: 'IP01' }];
    api.recognize.mockResolvedValue({ rows: [ipRow], total: 1, errors: [], warnings: [] });
    await mount('/client/enterprise-receipts/101/high-tech');
    await uploadPdfs(['not-pdf.txt']);
    expect(api.recognize).not.toHaveBeenCalled();
    await uploadPdfs(['test.pdf']);
    button('核对无误，追加到汇总表').click();
    await settle();
    expect(host.querySelector('[role=dialog]')?.textContent).toContain('重复');
    expect(api.save).not.toHaveBeenCalled();
    button('移除').click();
    await settle();
    expect(button('核对无误，追加到汇总表').disabled).toBe(true);
  });
  it('displays and saves nine default RDs with two branches each with period and all three action buttons', async () => {
    const defaults = emptyDraft(new Date('2026-10-01T04:00:00Z'));
    api.get.mockResolvedValueOnce({
      ...defaults,
      companyId: '101',
      companyName: '测试企业101',
      updatedAt: null,
    });
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(host.querySelector('.ip-table-section')).not.toBeNull();
    expect(host.querySelector('[data-project-table]')).toBeNull();
    expect(host.textContent).not.toContain('操作手册教程');
    button('保存并下一步').click();
    await settle();
    expect(host.querySelector('nav')?.textContent).toContain('制作高新核心信息');
    const projectSection = host.querySelector('section[aria-label="制作高新核心信息"]');
    expect(projectSection?.querySelector('h2')?.textContent).toBe('制作高新核心信息');
    expect(
      [...projectSection!.querySelectorAll('.project-table-card > .table-heading > .table-title > h3')]
        .map((heading) => heading.textContent),
    ).toEqual(['项目详情表']);
    expect(host.querySelector('.ip-table-section')).toBeNull();
    expect(host.textContent).not.toContain('制作项目详情表');
    expect(projectSection?.textContent).toContain('9 个RD / 18 条记录');
    expect(host.querySelectorAll('[data-project-table] tbody tr')).toHaveLength(18);
    for (let index = 0; index < 9; index++) {
      const rowIndex = index * 2;
      expect(projectField(rowIndex, 'rdNumber').value).toBe(
        `RD${String(index + 1).padStart(2, '0')}`,
      );
      expect(projectField(rowIndex, 'year').value).toBe(
        String(2023 + Math.floor(index / 3)),
      );
      expect(projectField(rowIndex, 'activityName').value).toBe('');
      expect(projectField(rowIndex, 'researchPeriod').value).not.toBe('');
      const records = host.querySelectorAll('[data-project-table] tbody tr');
      expect([...records[rowIndex]!.querySelectorAll('td')].slice(0, 4).map((cell) => cell.rowSpan)).toEqual([2, 2, 2, 2]);
      expect(records[rowIndex + 1]!.querySelector('input[id$="-rdNumber"]')).toBeNull();
      for (const branchIndex of [rowIndex, rowIndex + 1]) {
        expect(records[branchIndex]!.textContent).toContain('删除新增RD新增分支');
        expect(projectField(branchIndex, 'achievementNumber').value).toBe(`成果${String(branchIndex + 1).padStart(2, '0')}`);
      }
    }
    expect(projectField(16, 'rdNumber').value).toBe('RD09');
    expect(host.textContent).not.toContain('当前修改尚未保存');
    expect(persisted['101'].projects).toEqual(defaults.projects);
    await projectInput(0, 'year', '2020');
    button('保存草稿').click();
    await settle();
    app.unmount();
    host.remove();
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(projectField(0, 'year').value).toBe('2020');
    expect(host.querySelectorAll('[data-project-table] tbody tr')).toHaveLength(18);
    expect(persisted['101'].projects).toHaveLength(18);
    expect(persisted['101'].projects.slice(0, 2).map((row: any) => row.year)).toEqual([2020, 2020]);
  });
  it('shows the archive columns and opens high-tech from the company name', async () => {
    await mount();
    expect([...host.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual(['序号', '企业名称', '客户经理', '项目负责人', '申报年份', '进度']);
    expect(host.textContent).toContain('测试企业A');
    expect(host.textContent).toContain('张销售');
    expect(host.querySelector('tbody td')?.textContent).toBe('1');
    const link = host.querySelector('a')!;
    expect(link.getAttribute('href')).toBe(
      '/client/enterprise-receipts/101/high-tech',
    );
    expect(host.querySelectorAll('a')).toHaveLength(1);
    link.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await settle();
    expect(api.get).toHaveBeenCalledWith('101');
    expect(host.textContent).toContain('高新技术企业申报');
  });
  it('shows weighted progress and the leader, keeps non-high-tech companies unlinked', async () => {
    api.companies.mockResolvedValue([
      { id: '101', name: '高新企业', salesOwner: '客户经理甲', projectLeader: '项目负责人乙', preDeclarationYear: 2026, enterpriseProjects: ['国家高新技术企业'], highTechProgress: { percent: 32, stages: [
        { key: 'basic', title: '基础信息填写', weight: 20, percent: 50 },
        { key: 'core', title: '制作高新核心信息', weight: 30, percent: 40 },
        { key: 'materials', title: '制作高新材料', weight: 50, percent: 20 },
      ] } },
      { id: '102', name: '其他企业', enterpriseProjects: ['专精特新企业'], highTechProgress: null },
    ]);
    await mount();
    const progress = host.querySelector('[role="progressbar"]')!;
    expect(progress.getAttribute('aria-valuenow')).toBe('32');
    expect(progress.textContent).toContain('32%');
    expect(progress.getAttribute('aria-label')).toContain('基础信息填写：50%（权重 20%）');
    expect(host.textContent).toContain('项目负责人乙');
    expect(host.textContent).toContain('2026');
    expect(host.querySelectorAll('a')).toHaveLength(1);
    expect(host.querySelectorAll('tbody tr')[1]?.textContent).toContain('—');
  });
  it('shows zero progress as a number and reloads saved progress on return', async () => {
    const company = { id: '101', name: '测试企业A', enterpriseProjects: ['国家高新技术企业'], highTechProgress: { percent: 0, stages: [] } };
    api.companies.mockResolvedValue([company]);
    await mount();
    expect(host.querySelector('[role="progressbar"]')?.textContent).toContain('0%');
    await router.push('/client/enterprise-receipts/101/high-tech');
    await settle();
    api.companies.mockResolvedValue([{ ...company, highTechProgress: { percent: 20, stages: [] } }]);
    await router.push({ name: 'ClientEnterpriseReceipts' });
    await settle();
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('20');
  });
  it('saves IP summary, validates and edits all detail fields, creates materials and restores saved state', async () => {
    persisted['101'] = { ...emptyDraft(), companyId: '101', companyName: '测试企业101', updatedAt: null, ipSummary: [{ ...ipRow, number: 'IP01' }] };
    await mount('/client/enterprise-receipts/101/high-tech');
    button('保存并下一步').click();
    await settle();
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(persisted['101'].currentStep).toBe(1);
    button('保存并下一步').click();
    await settle();
    expect(host.textContent).toContain('第1行：请填写研发活动名称');
    expect(host.textContent).not.toContain('添加项目详情');
    expect(host.querySelector('aside')).toBeNull();
    expect(host.querySelectorAll('[data-project-table] tbody tr')).toHaveLength(18);
    expect(projectField(16, 'rdNumber').value).toBe('RD09');
    for (let row = 0; row < 18; row++)
      for (const field of PROJECT_FIELDS)
        if (!['rdNumber', 'year', 'achievementNumber'].includes(field.key) &&
            (row % 2 === 0 || !['activityName', 'researchPeriod'].includes(field.key)))
          await projectInput(
            row,
            field.key,
            field.key === 'ipNumber'
              ? 'IP01'
              : field.key === 'applicationDate'
                ? '2025-01-01'
                : field.key === 'authorizationDate'
              ? '2026-10-01'
              : field.key === 'ipType'
                ? '软件著作权'
                : field.key === 'acquisitionMethod'
                  ? '许可取得'
                  : `${field.label}示例`,
          );
    expect(host.querySelectorAll('[data-project-table] th')).toHaveLength(PROJECT_FIELDS.length + 1);
    expect(projectField(0, 'activityName').value).toBe('研发活动名称示例');
    button('保存并下一步').click();
    await settle();
    expect(persisted['101'].currentStep).toBe(2);
    expect(persisted['101'].projects).toHaveLength(18);
    expect(persisted['101'].projects[0].ipType).toBe('软件著作权');
    expect(persisted['101'].projects[0].acquisitionMethod).toBe('许可取得');
    button('AI 撰写企业简介').click(); await settle();
    button('AI 撰写').click(); await settle();
    expect(api.generateDocument).toHaveBeenCalledWith('101', 'field/company_intro', 1500);
    button('应用到草稿').click(); await settle();
    const text = host.querySelector<HTMLTextAreaElement>('textarea.mw-document')!;
    text.value = '已核对的企业简介'; text.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(); button('保存草稿').click(); await settle();
    expect(persisted['101'].workspace.fields.company_intro).toBe('已核对的企业简介');
    app.unmount(); host.remove(); await mount('/client/enterprise-receipts/101/high-tech');
    expect(host.querySelector<HTMLTextAreaElement>('textarea[aria-label="企业简介"]')?.value).toBe('已核对的企业简介');
  });
  it('fills only missing periods on load, persists them and keeps existing periods on reload', async () => {
    const draft = projectDraft(2);
    draft.projects[0]!.year = 2023;
    draft.projects[1]!.year = 2023;
    draft.projects[0]!.researchPeriod = '2023.01—2023.08';
    draft.projects[1]!.researchPeriod = '';
    draft.materials[0]!.reviewed = true;
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(projectField(0, 'researchPeriod').value).toBe('2023.01—2023.08');
    expect(projectField(1, 'researchPeriod').value).toBe('2023-05-01—2023-12-31');
    expect(host.querySelectorAll('[data-project-table] tbody tr')).toHaveLength(2);
    expect(host.textContent).toContain('有未保存的修改');
    expect(api.save).not.toHaveBeenCalled();
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].materials[0].reviewed).toBe(false);
    expect(persisted['101'].projects.map((row: any) => row.researchPeriod)).toEqual([
      '2023.01—2023.08', '2023-05-01—2023-12-31',
    ]);
    app.unmount();
    host.remove();
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(projectField(0, 'researchPeriod').value).toBe('2023.01—2023.08');
    expect(projectField(1, 'researchPeriod').value).toBe('2023-05-01—2023-12-31');
    expect(host.textContent).not.toContain('当前修改尚未保存');
    expect(host.textContent).not.toContain('尚未连续覆盖');
  });
  it('preserves filled periods and warns when deletion or a year change breaks coverage', async () => {
    const draft = projectDraft(2);
    draft.projects[0]!.year = 2023;
    draft.projects[1]!.year = 2023;
    draft.projects[0]!.researchPeriod = '2023-01-01—2023-08-31';
    draft.projects[1]!.researchPeriod = '2023-05-01—2023-12-31';
    await mount('/client/enterprise-receipts/101/high-tech');
    button('删除').click();
    await settle();
    expect(projectField(0, 'researchPeriod').value).toBe('2023-05-01—2023-12-31');
    expect(host.textContent).toContain('2023年研发周期尚未连续覆盖');
    await projectInput(0, 'year', '2024');
    expect(projectField(0, 'researchPeriod').value).toBe('2023-05-01—2023-12-31');
    expect(host.textContent).toContain('2024年有研发周期超出项目所属年份');
  });
  it('allocates a full year to a newly inserted project and never adds a trailing blank row', async () => {
    projectDraft();
    await mount('/client/enterprise-receipts/101/high-tech');
    button('新增RD').click();
    await settle();
    const year = Number(projectField(0, 'year').value);
    expect(projectField(0, 'researchPeriod').value).toBe(`${year}-01-01—${year}-12-31`);
    expect(host.querySelectorAll('[data-project-table] tbody tr')).toHaveLength(2);
    await projectInput(0, 'activityName', '新研发项目');
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].projects).toHaveLength(2);
    expect(persisted['101'].projects[0].achievementNumber).toBe('成果01');
    expect(persisted['101'].projects[1].achievementNumber).toBe('成果02');
    expect(persisted['101'].projects[1].researchPeriod).toBe(`${year}-01-01—${year}-12-31`);
  });
  it('shows an add button for an empty saved table without changing or saving any rows', async () => {
    projectDraft();
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(host.querySelectorAll('[data-project-table] tbody input')).toHaveLength(0);
    expect(button('新增RD').disabled).toBe(false);
    expect(host.textContent).not.toContain('当前修改尚未保存');
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].projects).toEqual([]);
    expect(host.querySelectorAll('[data-project-table] tbody input')).toHaveLength(0);
    await router.push({ name: 'ClientEnterpriseReceipts' });
    expect(confirm).not.toHaveBeenCalled();
  });
  it('inserts independent projects with stable inputs and read-only sequential numbers', async () => {
    projectDraft();
    await mount('/client/enterprise-receipts/101/high-tech');
    button('新增RD').click();
    await settle();
    const field = projectField(0, 'activityName');
    await input(field.id, '第一个项目');
    expect(projectField(0, 'activityName')).toBe(field);
    expect((projectField(0, 'rdNumber') as HTMLInputElement).readOnly).toBe(true);
    expect((projectField(0, 'achievementNumber') as HTMLInputElement).readOnly).toBe(true);
    expect(host.querySelectorAll('[data-project-table] tbody tr')).toHaveLength(2);
    button('新增RD').click();
    await settle();
    expect(projectField(2, 'rdNumber').value).toBe('RD02');
    await projectInput(2, 'activityName', '第二个项目');
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].projects.map((row: any) => row.activityName)).toEqual(['第一个项目', '第一个项目', '第二个项目', '第二个项目']);
    app.unmount();
    host.remove();
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(host.querySelectorAll('[data-project-table] tbody tr')).toHaveLength(4);
    expect(projectField(1, 'achievementNumber').value).toBe('成果02');
    expect(projectField(3, 'achievementNumber').value).toBe('成果04');
  });
  it('merges branch cells, synchronizes shared values, inserts RD after its branches, and reloads saved structure', async () => {
    projectDraft(2);
    await mount('/client/enterprise-receipts/101/high-tech');
    button('新增分支').click();
    await settle();
    let records = host.querySelectorAll('[data-project-table] tbody tr');
    expect(records).toHaveLength(3);
    expect([...records[0]!.querySelectorAll('td')].slice(0, 4).map((cell) => cell.rowSpan)).toEqual([2, 2, 2, 2]);
    expect(records[1]!.querySelector('input[id$="-rdNumber"]')).toBeNull();
    expect(records[1]!.querySelector('input[id$="-activityName"]')).toBeNull();
    await projectInput(0, 'activityName', '共享研发名称');
    await projectInput(1, 'ipName', '分支专利');
    await projectInput(1, 'achievementName', '分支成果');
    const add = [...records[1]!.querySelectorAll('button')].find((item) => item.textContent === '新增RD')!;
    add.click();
    await settle();
    expect(projectField(2, 'rdNumber').value).toBe('RD02');
    expect(projectField(4, 'rdNumber').value).toBe('RD03');
    await projectInput(2, 'activityName', '插入的独立项目');
    button('保存草稿').click();
    await settle();
    const saved = persisted['101'].projects;
    expect(saved.map((row: any) => row.rdNumber)).toEqual(['RD01', 'RD01', 'RD02', 'RD02', 'RD03']);
    expect(saved.map((row: any) => row.achievementNumber)).toEqual(['成果01', '成果02', '成果03', '成果04', '成果05']);
    expect(saved[2].activityName).toBe('插入的独立项目');
    expect(saved[3].activityName).toBe('插入的独立项目');
    expect(saved[0].activityName).toBe('共享研发名称');
    expect(saved[1].activityName).toBe('共享研发名称');
    expect(saved[1].ipName).toBe('分支专利');
    expect(saved[1].achievementName).toBe('分支成果');
    expect(saved[0].ipName).not.toBe('分支专利');
    app.unmount();
    host.remove();
    await mount('/client/enterprise-receipts/101/high-tech');
    records = host.querySelectorAll('[data-project-table] tbody tr');
    expect(records[0]!.querySelector('td')!.rowSpan).toBe(2);
    expect(host.textContent).not.toContain('当前修改尚未保存');
    button('删除').click();
    await settle();
    expect(projectField(0, 'rdNumber').value).toBe('RD01');
    expect(projectField(0, 'ipName').value).toBe('分支专利');
    expect(projectField(0, 'activityName').value).toBe('共享研发名称');
    expect(projectField(0, 'achievementNumber').value).toBe('成果01');
    button('删除').click();
    await settle();
    expect(projectField(0, 'activityName').value).toBe('插入的独立项目');
    expect(projectField(0, 'rdNumber').value).toBe('RD01');
    expect(projectField(2, 'rdNumber').value).toBe('RD02');
  });
  it('keeps legacy conflicts visible and resolves shared cells only after explicit editing', async () => {
    const draft = projectDraft(2);
    draft.projects[1]!.rdNumber = draft.projects[0]!.rdNumber;
    const period = draft.projects[1]!.researchPeriod;
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(host.textContent).toContain('暂不合并这些字段');
    expect(projectField(0, 'activityName').value).toBe('研发活动名称示例1');
    expect(projectField(1, 'activityName').value).toBe('研发活动名称示例2');
    expect(projectField(1, 'researchPeriod').value).toBe(period);
    await projectInput(0, 'activityName', '核对后的项目名');
    expect(host.querySelectorAll('input[id$="-activityName"]')).toHaveLength(1);
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].projects.map((row: any) => row.activityName)).toEqual(['核对后的项目名', '核对后的项目名']);
    expect(persisted['101'].projects[1].researchPeriod).toBe(period);
  });
  it('edits existing projects directly and invalidates reviewed materials', async () => {
    const draft = projectDraft(1);
    draft.materials[0]!.content = '已核对的材料';
    draft.materials[0]!.reviewed = true;
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(projectField(0, 'activityName').value).toBe('研发活动名称示例1');
    await projectInput(0, 'activityName', '修改后的研发活动');
    await projectInput(0, 'year', '2025');
    await projectInput(0, 'authorizationDate', '2025-12-31');
    button('保存并下一步').click();
    await settle();
    expect(persisted['101'].projects).toHaveLength(1);
    expect(persisted['101'].projects[0]).toMatchObject({
      activityName: '修改后的研发活动',
      year: 2025,
      authorizationDate: '2025-12-31',
    });
    expect(persisted['101'].materials[0]).toMatchObject({
      content: '已核对的材料',
      reviewed: false,
    });
  });
  it('validates inline fields before advancing to materials', async () => {
    projectDraft(1);
    await mount('/client/enterprise-receipts/101/high-tech');
    await projectInput(0, 'year', '');
    button('保存并下一步').click();
    await settle();
    expect(host.textContent).toContain('第1行：请填写年份');
    expect(api.save).not.toHaveBeenCalled();
    await projectInput(0, 'year', '2026');
    await projectInput(0, 'activityName', '');
    button('保存并下一步').click();
    await settle();
    expect(host.textContent).toContain('第1行：请填写研发活动名称');
    expect(api.save).not.toHaveBeenCalled();
  });
  it('allows adding RD01 again after the last project is deleted', async () => {
    projectDraft(1);
    await mount('/client/enterprise-receipts/101/high-tech');
    button('删除').click();
    await settle();
    expect(host.querySelectorAll('[data-project-table] tbody input')).toHaveLength(0);
    button('保存草稿').click();
    await settle();
    expect(persisted['101'].projects).toEqual([]);
    button('新增RD').click();
    await settle();
    expect(projectField(0, 'rdNumber').value).toBe('RD01');
    expect(projectField(0, 'achievementNumber').value).toBe('成果01');
    expect(host.querySelectorAll('[data-project-table] tbody tr')).toHaveLength(2);
    expect(projectField(1, 'achievementNumber').value).toBe('成果02');
  });
  it('requires two free slots for a new RD and one for an extra branch', async () => {
    projectDraft(200);
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(host.querySelectorAll('[data-project-table] tbody tr')).toHaveLength(200);
    expect(host.textContent).toContain('已达200条上限');
    expect(button('新增RD').disabled).toBe(true);
    expect(button('新增分支').disabled).toBe(true);
    button('删除').click();
    await settle();
    expect(host.querySelectorAll('[data-project-table] tbody tr')).toHaveLength(199);
    expect(button('新增RD').disabled).toBe(true);
    expect(button('新增分支').disabled).toBe(false);
    button('新增分支').click();
    await settle();
    expect(host.querySelectorAll('[data-project-table] tbody tr')).toHaveLength(200);
    button('删除').click();
    await settle();
    button('删除').click();
    await settle();
    expect(host.querySelectorAll('[data-project-table] tbody tr')).toHaveLength(198);
    expect(button('新增RD').disabled).toBe(false);
    button('新增RD').click();
    await settle();
    expect(host.querySelectorAll('[data-project-table] tbody tr')).toHaveLength(200);
    expect(host.textContent).toContain('已达200条上限');
  });
  it('preserves inline input on failed saves and warns before abandoning it', async () => {
    projectDraft();
    await mount('/client/enterprise-receipts/101/high-tech');
    button('新增RD').click();
    await settle();
    await projectInput(0, 'activityName', '不能丢失的项目');
    api.save.mockRejectedValueOnce(new Error('项目保存失败'));
    button('保存草稿').click();
    await settle();
    expect(projectField(0, 'activityName').value).toBe('不能丢失的项目');
    expect(host.textContent).toContain('项目保存失败');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    await router.push('/client/enterprise-receipts/102/high-tech');
    expect(router.currentRoute.value.params.companyId).toBe('101');
    expect(projectField(0, 'activityName').value).toBe('不能丢失的项目');
  });
  it('places personnel below audit imports and uses a button to open the file picker', async () => {
    projectDraft(1); persisted['101'].currentStep = 2;
    await mount('/client/enterprise-receipts/101/high-tech');
    const staff = host.querySelector('#material-staff')!;
    expect(staff.previousElementSibling?.querySelector('h2')?.textContent).toBe('审计资料导入与回填');
    expect(host.querySelectorAll('#material-staff')).toHaveLength(1);
    expect(host.querySelector('#material-hr')?.textContent).not.toContain('导入人员 Excel');
    const upload = staff.querySelector<HTMLInputElement>('input[type=file]')!;
    const click = vi.spyOn(upload, 'click').mockImplementation(() => {});
    expect(button('导入人员 Excel')).toBeInstanceOf(HTMLButtonElement);
    button('导入人员 Excel').click(); await settle();
    expect(click).toHaveBeenCalledOnce();
    expect(upload.hidden).toBe(true);
    expect(upload.accept).toBe('.xls,.xlsx,.xlsm');
  });
  it('downloads a personnel template without saving the draft and restores controls after failure', async () => {
    projectDraft(1); persisted['101'].currentStep = 2;
    const blob = new Blob(['template']);
    api.staffTemplate.mockRejectedValueOnce(new Error('模板下载失败')).mockResolvedValueOnce(blob);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:staff-template');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let filename = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      filename = this.download;
    });
    await mount('/client/enterprise-receipts/101/high-tech');
    button('导出人员模板').click(); await settle();
    expect(host.textContent).toContain('模板下载失败');
    expect(button('导出人员模板').disabled).toBe(false);
    expect(button('导入人员 Excel').disabled).toBe(false);
    button('导出人员模板').click(); await settle();
    expect(api.staffTemplate).toHaveBeenCalledWith('101');
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(filename).toBe('企业人员明细导入模板.xlsx');
    expect(api.save).not.toHaveBeenCalled();
  });
  it('previews personnel Excel imports before replacing rows and rejects unsupported files', async () => {
    projectDraft(1); persisted['101'].currentStep = 2;
    persisted['101'].workspace = emptyWorkspace();
    persisted['101'].workspace.tables.staff = [{ id: 'original', seq: '1', name: '原有人员' }];
    api.importMaterial.mockResolvedValue({ kind: 'staff', year: '2025', rows: [
      { seq: '99', name: '导入人员', id_no: '11010119900101123X' },
    ], source: '人员Excel' });
    await mount('/client/enterprise-receipts/101/high-tech');
    const upload = host.querySelector<HTMLInputElement>('#material-staff input[type=file]')!;
    const select = async (file: File) => {
      Object.defineProperty(upload, 'files', { configurable: true, value: [file] });
      upload.dispatchEvent(new Event('change', { bubbles: true })); await settle();
    };
    await select(new File(['fixture'], '名单.docx'));
    expect(api.importMaterial).not.toHaveBeenCalled();
    expect(host.textContent).toContain('人员Excel文件');
    const oversized = new File(['fixture'], '名单.xlsx');
    Object.defineProperty(oversized, 'size', { value: 20 * 1024 * 1024 + 1 });
    await select(oversized);
    expect(api.importMaterial).not.toHaveBeenCalled();
    expect(host.textContent).toContain('文件不得超过20MB');
    const file = new File(['fixture'], '名单.xlsx');
    await select(file);
    expect(api.importMaterial).toHaveBeenCalledWith('101', 'staff', 2025, file);
    expect(upload.value).toBe('');
    expect(document.querySelector('[aria-label="导入结果核对"]')?.textContent).toContain('11010119900101123X');
    expect(persisted['101'].workspace.tables.staff[0].name).toBe('原有人员');
    button('保留原数据').click(); await settle();
    await select(file);
    expect(api.importMaterial).toHaveBeenCalledTimes(2);
    button('应用到草稿').click(); await settle();
    expect(persisted['101'].workspace.tables.staff[0].name).toBe('原有人员');
    button('保存申请书').click(); await settle();
    expect(persisted['101'].workspace.tables.staff[0]).toMatchObject({
      seq: '1', name: '导入人员', id_no: '11010119900101123X',
    });
  });
  it('previews personnel sync and applies rows only after confirmation and explicit save', async () => {
    const draft = projectDraft(1);
    persisted['101'].currentStep = 2;
    draft.workspace = emptyWorkspace();
    draft.workspace.tables.staff = [{ id: 'original', seq: '1', name: '原有人员' }];
    persisted['101'].workspace = draft.workspace;
    api.staff.mockResolvedValue([{ id: 'imported', name: '同步人员', education: '本科' }]);
    await mount('/client/enterprise-receipts/101/high-tech');
    button('同步企业人员').click(); await settle();
    expect(document.querySelector('[aria-label="导入结果核对"]')?.textContent).toContain('同步人员');
    expect(persisted['101'].workspace.tables.staff[0].name).toBe('原有人员');
    button('保留原数据').click(); await settle();
    expect(persisted['101'].workspace.tables.staff[0].name).toBe('原有人员');
    button('同步企业人员').click(); await settle();
    button('应用到草稿').click(); await settle();
    expect(persisted['101'].workspace.tables.staff[0].name).toBe('原有人员');
    button('保存申请书').click(); await settle();
    expect(persisted['101'].workspace.tables.staff[0].name).toBe('同步人员');
  });
  it('updates human resources after import, edits, deletion and reopening the saved draft', async () => {
    projectDraft(1); persisted['101'].currentStep = 2;
    const w = emptyWorkspace(2026);
    w.fields = { hr_total: '99', hr_tech: '88', edu_phd: '7', hr_foreign: '2' };
    persisted['101'].workspace = w;
    api.importMaterial.mockResolvedValue({ kind: 'staff', year: '2025', rows: [
      { name: '导入人员', id_no: '11010119951231001X', education: '本科', title: '高级技工', is_tech: '是' },
    ], source: '人员Excel' });
    await mount('/client/enterprise-receipts/101/high-tech');
    const value = (label: string) => host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!.value;
    expect(value('企业职工：总数（人）')).toBe('99');
    expect(value('企业职工：其中：在职人员')).toBe('99');
    expect(value('科技人员：其中：在职人员')).toBe('88');
    expect(value('企业职工：兼职人员')).toBe('0');
    expect(value('科技人员：兼职人员')).toBe('0');
    const upload = host.querySelector<HTMLInputElement>('#material-staff input[type=file]')!;
    Object.defineProperty(upload, 'files', { configurable: true, value: [new File(['fixture'], '名单.xlsx')] });
    upload.dispatchEvent(new Event('change', { bubbles: true })); await settle();
    expect(value('企业职工：总数（人）')).toBe('99');
    button('应用到草稿').click(); await settle();
    expect(value('企业职工：总数（人）')).toBe('1');
    expect(value('科技人员：总数（人）')).toBe('1');
    expect(value('学历：博士人数')).toBe('0');
    expect(value('学历：本科人数')).toBe('1');
    expect(value('职称：高级技工人数')).toBe('1');
    expect(value('年龄：30岁及以下人数')).toBe('1');
    expect(value('企业职工：外籍人员')).toBe('2');
    const edit = async (label: string, text: string) => {
      const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true })); await settle();
    };
    expect(value('企业职工：其中：在职人员')).toBe('99');
    await edit('企业职工：其中：在职人员', '0');
    await edit('科技人员：其中：在职人员', '0');
    await edit('企业人员明细第1行学历', '硕士');
    await edit('企业人员明细第1行是否科技人员', '否');
    expect(value('学历：本科人数')).toBe('0');
    expect(value('学历：硕士人数')).toBe('1');
    expect(value('科技人员：总数（人）')).toBe('0');
    button('添加人员').click(); await settle();
    expect(value('企业职工：总数（人）')).toBe('1');
    await edit('企业人员明细第2行姓名', '新增人员');
    expect(value('企业职工：总数（人）')).toBe('2');
    button('保存申请书').click(); await settle();
    expect(persisted['101'].workspace.fields).toMatchObject({ hr_total: '2', hr_tech: '0', edu_master: '1', hr_foreign: '2' });
    app.unmount();
    await mount('/client/enterprise-receipts/101/high-tech');
    expect(value('企业职工：总数（人）')).toBe('2');
    expect(value('企业职工：其中：在职人员')).toBe('0');
    expect(value('科技人员：其中：在职人员')).toBe('0');
    for (let i = 0; i < 2; i++) {
      host.querySelector<HTMLButtonElement>('#material-staff tbody button')!.click(); await settle();
    }
    expect(value('企业职工：总数（人）')).toBe('0');
    expect(value('学历：硕士人数')).toBe('0');
    expect(value('企业职工：外籍人员')).toBe('2');
    button('保存申请书').click(); await settle();
    expect(persisted['101'].workspace.fields.hr_total).toBe('0');
  });
  it('preserves financial values until an audit preview is accepted and saved', async () => {
    projectDraft(1); persisted['101'].currentStep = 2;
    persisted['101'].workspace = emptyWorkspace();
    persisted['101'].workspace.fields.hitech_revenue = '12';
    api.importMaterial.mockResolvedValue({ kind: 'income', year: '2025', fields: { hitech_revenue: '35.5' }, source: '高新收入35.5万元' });
    await mount('/client/enterprise-receipts/101/high-tech');
    const upload = host.querySelector<HTMLInputElement>('input[type=file][accept=".xls,.xlsx,.xlsm,.docx"]')!;
    Object.defineProperty(upload, 'files', { configurable: true, value: [new File(['fixture'], '收入审计.xlsx')] });
    upload.dispatchEvent(new Event('change', { bubbles: true })); await settle();
    expect(api.importMaterial).toHaveBeenCalledWith('101', 'income', 2025, expect.any(File));
    expect(persisted['101'].workspace.fields.hitech_revenue).toBe('12');
    expect(document.querySelector('[aria-label="导入结果核对"]')?.textContent).toContain('35.5');
    button('应用到草稿').click(); await settle();
    expect(persisted['101'].workspace.fields.hitech_revenue).toBe('12');
    button('保存申请书').click(); await settle();
    expect(persisted['101'].workspace.fields.hitech_revenue).toBe('35.5');
  });
  it('keeps partial batch results reviewable after one AI request fails', async () => {
    projectDraft(1); persisted['101'].currentStep = 2;
    persisted['101'].book[0].content = '人工简介';
    api.generateDocument.mockRejectedValueOnce(new Error('单项生成失败'));
    await mount('/client/enterprise-receipts/101/high-tech');
    button('一键撰写申请书').click();
    for (let i = 0; i < 10; i++) await settle();
    expect(host.textContent).toContain('单项生成失败');
    expect(document.querySelector('[aria-label="批量生成结果"]')).toBeTruthy();
    expect(persisted['101'].workspace.fields.company_intro).toBe('人工简介');
    button('应用全部生成内容').click(); await settle();
    button('保存申请书').click(); await settle();
    expect(persisted['101'].workspace.fields.company_intro).toBe('人工简介');
    expect(persisted['101'].workspace.fields.business_scope).toBe('企业人员资料草稿');
  });
  it('retains manual book content when the generation service rejects oversized output', async () => {
    const draft = emptyDraft();
    draft.currentStep = 2;
    draft.scores = {
      intellectualProperty: 30,
      transformation: 30,
      organization: 20,
      salesGrowth: 10,
      netAssetGrowth: 10,
    };
    const row = newProject([]);
    for (const field of PROJECT_FIELDS) {
      if (field.key !== 'year') row[field.key] = `${field.label}示例`;
    }
    row.applicationDate = '2025-01-01';
    row.authorizationDate = '2026-10-01';
    row.ipName = '知'.repeat(512);
    draft.projects = Array.from({ length: 200 }, (_, index) => ({
      ...row,
      id: `row-${index}`,
    }));
    draft.book[0]!.content = '保留人工撰写的企业简介';
    persisted['101'] = {
      ...draft,
      companyId: '101',
      companyName: '测试企业101',
      updatedAt: null,
    };
    api.generateDocument.mockRejectedValueOnce(new Error('正文超过50000字，请重试'));
    await mount('/client/enterprise-receipts/101/high-tech');
    button('AI 撰写企业简介').click(); await settle();
    button('AI 撰写').click(); await settle();
    expect(api.generateDocument).toHaveBeenCalledWith('101', 'field/company_intro', 1500);
    expect(host.textContent).toContain('超过50000字');
    expect(host.querySelector<HTMLTextAreaElement>('textarea.mw-document')?.value).toBe('保留人工撰写的企业简介');
  });
  it('retains edits after a save failure and blocks accidental navigation', async () => {
    ipDraft();
    persisted['101'].ipSummary = [{ ...ipRow, id: 'existing', number: 'IP01' }];
    await mount('/client/enterprise-receipts/101/high-tech');
    await setIpField('知识产权第1行', '名称', '未保存的知识产权');
    api.save.mockRejectedValueOnce(new Error('保存失败测试'));
    button('保存并下一步').click();
    await settle();
    expect(host.textContent).toContain('保存失败测试');
    expect(
      host.querySelector<HTMLInputElement>('[aria-label="知识产权第1行名称"]')
        ?.value,
    ).toBe('未保存的知识产权');
    expect(host.querySelector('section[aria-label="知识产权汇总表"]')).not.toBeNull();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    await router.push({ name: 'ClientEnterpriseReceipts' });
    expect(router.currentRoute.value.name).toBe('ClientHighTechApplication');
  });
  it('loads another company explicitly rather than relying on the current-company session', async () => {
    await mount('/client/enterprise-receipts/101/high-tech');
    await router.push('/client/enterprise-receipts/102/high-tech');
    await settle();
    expect(api.get).toHaveBeenLastCalledWith('102');
    expect(host.textContent).toContain('测试企业102');
    expect(
      host.querySelector<HTMLInputElement>('[aria-label="知识产权第1行名称"]')
        ?.value,
    ).toBe('');
  });
  it('shows a retryable loading error without exposing an editable empty draft', async () => {
    api.get.mockRejectedValueOnce(new Error('无权访问该企业档案'));
    await mount('/client/enterprise-receipts/999/high-tech');
    expect(host.textContent).toContain('无权访问');
    expect(host.querySelector('.ip-table-section')).toBeNull();
    button('重新加载').click();
    await settle();
    expect(host.querySelector('.ip-table-section')).not.toBeNull();
  });
});
