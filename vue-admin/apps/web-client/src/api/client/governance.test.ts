import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  downloadGovernanceIssuesApi,
  downloadGovernanceTemplateApi,
  exportGovernanceEnterprisesApi,
  getGovernanceOverviewApi,
  previewGovernanceExcelApi,
} from './governance';

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

describe('governance API response handling', () => {
  const filters = {
    keyword: 'enterprise',
    regionId: 'region-1',
    distribution: 'pending' as const,
  };
  const downloads = [
    {
      name: 'template',
      download: downloadGovernanceTemplateApi,
      url: '/client/governance/enterprises/excel/template',
      params: undefined,
    },
    {
      name: 'enterprise export',
      download: () => exportGovernanceEnterprisesApi(filters),
      url: '/client/governance/enterprises/excel/export',
      params: filters,
    },
    {
      name: 'issue report',
      download: () => downloadGovernanceIssuesApi('preview-token'),
      url: '/client/governance/enterprises/excel/issues/preview-token',
      params: undefined,
    },
  ];

  it.each(downloads)(
    'returns the $name workbook without JSON unwrapping',
    async ({ download, url, params }) => {
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

      expect(await download()).toBe(workbook);
      expect(transport.send.mock.lastCall![0]).toMatchObject({
        url,
        method: 'get',
        responseType: 'blob',
        responseReturn: 'body',
      });
      expect(transport.send.mock.lastCall![0].params).toEqual(params);
    },
  );

  it.each(downloads)(
    'rejects an unsuccessful $name download',
    async ({ download }) => {
      for (const status of [403, 500]) {
        transport.send.mockImplementation(async (config) => ({
          config,
          status,
          statusText: 'Error',
          headers: {},
          data: new Blob(['download failed']),
        }));

        await expect(download()).rejects.toBeDefined();
      }
    },
  );

  it('continues unwrapping the normal overview JSON response', async () => {
    const overview = {
      scope: 'overall',
      regions: [],
      projectAccounts: [],
      enterprises: [],
    };
    transport.send.mockImplementation(async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { code: 0, data: overview },
    }));

    expect(await getGovernanceOverviewApi()).toEqual(overview);
    expect(transport.send.mock.lastCall![0].responseReturn).toBe('data');
  });

  it.each([
    { name: 'automatic recognition', options: {} },
    {
      name: 'manual field mapping',
      options: {
        sheetName: 'Enterprises',
        headerRow: 3,
        mapping: { name: 2, region: 1 },
      },
    },
  ])('uploads a workbook as multipart for $name', async ({ options }) => {
    const file = new File(['workbook-bytes'], 'enterprises.xlsx');
    const preview = { token: 'preview-token', total: 20, ready: 0, failed: 20 };
    transport.send.mockImplementation(async (config) => ({
      config,
      status: 201,
      statusText: 'Created',
      headers: {},
      data: { code: 0, data: preview },
    }));

    expect(await previewGovernanceExcelApi(file, options)).toEqual(preview);
    expect(transport.send).toHaveBeenCalledOnce();
    const config = transport.send.mock.lastCall![0];
    expect(config).toMatchObject({
      url: '/client/governance/enterprises/excel/preview',
      method: 'post',
      responseReturn: 'data',
    });
    expect(config.headers.get('Content-Type')).toBe('multipart/form-data');
    expect(config.data).toBeInstanceOf(FormData);
    expect(config.data.get('file').name).toBe(file.name);
    expect(config.data.get('file').size).toBe(file.size);
    expect(config.data.get('sheetName')).toBe(options.sheetName ?? null);
    expect(config.data.get('headerRow')).toBe(
      options.headerRow ? String(options.headerRow) : null,
    );
    expect(config.data.get('mapping')).toBe(
      options.mapping ? JSON.stringify(options.mapping) : null,
    );
  });
});
