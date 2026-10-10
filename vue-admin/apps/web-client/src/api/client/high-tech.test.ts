import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportHighTechApplicationApi,
  exportHighTechIpSummaryApi,
  exportHighTechProjectDetailsApi,
  importHighTechProjectDetailsApi,
  getHighTechApplicationApi,
  generateHighTechNamesApi,
  recognizeHighTechIpPdfsApi,
  previewHighTechIpAllocationApi,
  saveHighTechApplicationApi,
} from './high-tech';
import { emptyDraft } from '../../views/client/high-tech-application/model';

const transport = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('#/api/request', async () => {
  const { RequestClient, defaultResponseInterceptor } =
    await import('@vben/request');
  const requestClient = new RequestClient({
    responseReturn: 'data',
    adapter: transport.send,
  });
  requestClient.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: 'data',
      successCode: 0,
    }),
  );
  return { requestClient };
});
beforeEach(() => vi.clearAllMocks());
describe('high-tech API response handling', () => {
  it('exports even empty project snapshots and imports a company-scoped workbook', async () => {
    const workbook = new Blob(['projects']);
    transport.send.mockImplementation(async (config) => ({ config, status: 200, statusText: 'OK', headers: {}, data: workbook }));
    expect(await exportHighTechProjectDetailsApi('101', [])).toBe(workbook);
    expect(transport.send.mock.lastCall![0].url).toBe('/client/companies/101/high-tech-application/project-details/export');
    expect(JSON.parse(transport.send.mock.lastCall![0].data)).toEqual({ rows: [] });
    const data = { rows: [], total: 0 };
    transport.send.mockImplementation(async (config) => ({ config, status: 200, statusText: 'OK', headers: {}, data: { code: 0, data } }));
    const file = new File(['projects'], '项目详情.xlsx');
    expect(await importHighTechProjectDetailsApi('102', file)).toEqual(data);
    const config = transport.send.mock.lastCall![0];
    expect(config.url).toBe('/client/companies/102/high-tech-application/project-details/import');
    expect(config.data.get('file')).toBe(file);
  });
  it('sends only the current unsaved IP and RD snapshot to the scoped preview route', async () => {
    const preview = { assignments: [], unassigned: [], warnings: [], profiles: [], distribution: [] };
    transport.send.mockImplementation(async (config) => ({ config, status: 201, statusText: 'Created', headers: {}, data: { code: 0, data: preview } }));
    const { projects, ipSummary } = emptyDraft();
    expect(await previewHighTechIpAllocationApi('101', { projects, ipSummary })).toEqual(preview);
    const config = transport.send.mock.lastCall![0];
    expect(config.url).toBe('/client/companies/101/high-tech-application/ip-allocation/preview');
    expect(config.method).toBe('post');
    expect(config.timeout).toBe(300_000);
    expect(JSON.parse(config.data)).toEqual({ projects, ipSummary });
  });
  it('posts the current detail snapshot to the scoped generation route with a bounded timeout', async () => {
    const result = { status: 'generated', version: 2 };
    transport.send.mockImplementation(async (config) => ({ config, status: 201, statusText: 'Created', headers: {}, data: { code: 0, data: result } }));
    const projects = emptyDraft().projects;
    expect(await generateHighTechNamesApi('101', { projects })).toEqual(result);
    const config = transport.send.mock.lastCall![0];
    expect(config.url).toBe('/client/companies/101/high-tech-application/names/generate');
    expect(config.method).toBe('post');
    expect(config.timeout).toBe(300_000);
    expect(JSON.parse(config.data)).toEqual({ projects });
  });
  it('uploads PDFs as multipart files with a recognition timeout and unwraps partial results', async () => {
    const result = { rows: [], total: 0, errors: ['失败文件'], warnings: [] };
    transport.send.mockImplementation(async (config) => ({ config, status: 201, statusText: 'Created', headers: {}, data: { code: 0, data: result } }));
    const files = [new File(['%PDF-test'], 'one.pdf'), new File(['%PDF-test2'], 'two.pdf')];
    expect(await recognizeHighTechIpPdfsApi('101', files)).toEqual(result);
    const config = transport.send.mock.calls[0]![0];
    expect(config.url).toBe('/client/companies/101/high-tech-application/ip-summary/recognize-pdfs');
    expect(config.timeout).toBe(300_000);
    expect(config.data.getAll('files')).toHaveLength(2);
  });
  it('unwraps normal API responses and explicitly scopes read and save requests to the company', async () => {
    const draft = {
      ...emptyDraft(),
      companyId: '101',
      companyName: '测试企业',
      updatedAt: null,
    };
    transport.send.mockImplementation(async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { code: 0, data: draft },
    }));
    expect(await getHighTechApplicationApi('101')).toEqual(draft);
    expect(transport.send.mock.calls[0]![0].url).toBe(
      '/client/companies/101/high-tech-application',
    );
    expect(await saveHighTechApplicationApi('102', emptyDraft())).toEqual(
      draft,
    );
    expect(transport.send.mock.calls[1]![0].url).toBe(
      '/client/companies/102/high-tech-application',
    );
    expect(JSON.parse(transport.send.mock.calls[1]![0].data).revision).toBe(0);
  });
  it('returns the raw workbook Blob instead of trying to unwrap a JSON success envelope', async () => {
    const workbook = new Blob(['workbook-bytes'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    transport.send.mockImplementation(async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: workbook,
    }));
    expect(await exportHighTechApplicationApi('101')).toBe(workbook);
    expect(transport.send.mock.calls[0]![0].responseType).toBe('blob');
    expect(transport.send.mock.calls[0]![0].url).toBe(
      '/client/companies/101/high-tech-application/export',
    );
  });
  it('posts the current IP snapshot, including empty data, and returns the workbook Blob', async () => {
    const workbook = new Blob(['ip-workbook']);
    transport.send.mockImplementation(async (config) => ({ config, status: 201, statusText: 'Created', headers: {}, data: workbook }));
    const rows = [{ id: 'unsaved', number: 'IP01', name: '未保存名称', patentType: '', legalStatus: '', patentNumber: '00123', patentee: '', applicationDate: '', grantDate: '' }];
    for (const snapshot of [rows, []]) {
      expect(await exportHighTechIpSummaryApi('101', snapshot)).toBe(workbook);
      const config = transport.send.mock.lastCall![0];
      expect(config.url).toBe('/client/companies/101/high-tech-application/ip-summary/export');
      expect(config.method).toBe('post');
      expect(config.responseType).toBe('blob');
      expect(JSON.parse(config.data)).toEqual({ rows: snapshot });
    }
  });
  it('does not treat an unsuccessful export response as a workbook', async () => {
    transport.send.mockImplementation(async (config) => ({
      config,
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      data: new Blob(['Forbidden']),
    }));
    await expect(exportHighTechApplicationApi('101')).rejects.toBeDefined();
  });
});
