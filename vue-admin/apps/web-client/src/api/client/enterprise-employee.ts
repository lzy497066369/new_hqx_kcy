import { requestClient } from '#/api/request';

export namespace ClientEnterpriseEmployeeApi {
  export type AgeRange = 1 | 2 | 3 | 4;
  export type EmployeeEducation = 1 | 2 | 3 | 4;
  export type EmployeeGender = 1 | 2;
  export type EmployeeType = 1 | 2 | 3 | 4;
  export type JobTitle = 1 | 2 | 3 | 4 | 5;
  export type YesNoStatus = 0 | 1;

  export interface EnterpriseRecordList<T> {
    items: T[];
    total: number;
  }

  export interface Employee {
    annual_work_days?: null | number;
    department?: null | string;
    education_file?: null | string;
    entry_date?: null | string;
    id?: number | string;
    id_card?: null | string;
    is_active?: null | YesNoStatus;
    is_kjyf: YesNoStatus;
    labor_contract_file?: null | string;
    position?: null | string;
    remark?: null | string;
    rd_projects?: null | string;
    social_security_file?: null | string;
    title_file?: null | string;
    yg_files?: null | string;
    yg_lx: EmployeeType;
    yg_lxgg: YesNoStatus;
    yg_name: string;
    yg_nl: AgeRange;
    yg_qr: YesNoStatus;
    yg_sex: EmployeeGender;
    yg_wj: YesNoStatus;
    yg_xl: EmployeeEducation;
    yg_zc: JobTitle;
  }

  export interface EmployeeStats {
    activeCount: number;
    attachmentCount: number;
    education: Record<string, number>;
    researchCount: number;
    researchRatio: number;
    title: Record<string, number>;
    total: number;
  }

  export type EmployeeImportAction = 'create' | 'error' | 'skip' | 'update';

  export interface EmployeeImportError {
    fieldName?: null | string;
    message: string;
    rawValue?: null | string;
    rowNumber: number;
    sheetName?: null | string;
    suggestion?: null | string;
  }

  export interface EmployeeImportSummary {
    createCount: number;
    errorCount: number;
    importableCount: number;
    readCount: number;
    skippedCount: number;
    status: 'invalid' | 'partial' | 'valid';
    updateCount: number;
  }

  export interface EmployeeImportPreviewRow {
    action: EmployeeImportAction;
    data: Partial<Employee> & Record<string, unknown>;
    errors: EmployeeImportError[];
    importable: boolean;
    key: string;
    matchedEmployeeId?: null | string;
    rowNumber: number;
    sheetName: string;
  }

  export interface EmployeeImportPreviewResult {
    materialId: string;
    rows: EmployeeImportPreviewRow[];
    summary: EmployeeImportSummary;
  }

  export interface EmployeeImportConfirmResult {
    materialId: string;
    summary: {
      createCount?: number;
      employeeCount: number;
      errorCount: number;
      importableCount?: number;
      skippedCount?: number;
      status: 'invalid' | 'partial' | 'valid';
      updateCount?: number;
    };
  }

  export interface EmployeeListParams {
    is_kjyf?: YesNoStatus;
    keyword?: string;
    yg_lx?: EmployeeType;
  }
}

async function getClientEmployeeListApi(
  _params: ClientEnterpriseEmployeeApi.EmployeeListParams = {},
) {
  return requestClient.get<
    ClientEnterpriseEmployeeApi.EnterpriseRecordList<ClientEnterpriseEmployeeApi.Employee>
  >('/client/enterprise-records/employee/employees');
}

async function getClientEmployeeStatsApi() {
  return requestClient.get<ClientEnterpriseEmployeeApi.EmployeeStats>(
    '/client/enterprise/employees/stats',
  );
}

async function downloadClientEmployeeExportApi() {
  return requestClient.get<Blob>('/client/enterprise/employees/export', {
    responseType: 'blob',
  });
}

async function downloadClientEmployeeTemplateApi() {
  return requestClient.get<Blob>('/client/enterprise/employees/template', {
    responseType: 'blob',
  });
}

async function previewClientEmployeeImportApi(file: File) {
  const data = new FormData();
  data.append('file', file);

  return requestClient.post<ClientEnterpriseEmployeeApi.EmployeeImportPreviewResult>(
    '/client/enterprise/employees/import/preview',
    data,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );
}

async function confirmClientEmployeeImportApi(
  materialId: string,
  skippedKeys: string[] = [],
) {
  return requestClient.post<ClientEnterpriseEmployeeApi.EmployeeImportConfirmResult>(
    '/client/enterprise/employees/import/confirm',
    {
      materialId,
      skippedKeys,
    },
  );
}

async function createClientEmployeeApi(data: ClientEnterpriseEmployeeApi.Employee) {
  return requestClient.post<ClientEnterpriseEmployeeApi.Employee>(
    '/client/enterprise-records/employee/employees',
    { data },
  );
}

async function updateClientEmployeeApi(
  id: number | string,
  data: ClientEnterpriseEmployeeApi.Employee,
) {
  return requestClient.put<ClientEnterpriseEmployeeApi.Employee>(
    `/client/enterprise-records/employee/employees/${id}`,
    { data },
  );
}

async function deleteClientEmployeeApi(id: number | string) {
  return requestClient.delete(`/client/enterprise-records/employee/employees/${id}`);
}

export {
  confirmClientEmployeeImportApi,
  createClientEmployeeApi,
  deleteClientEmployeeApi,
  downloadClientEmployeeExportApi,
  downloadClientEmployeeTemplateApi,
  getClientEmployeeListApi,
  getClientEmployeeStatsApi,
  previewClientEmployeeImportApi,
  updateClientEmployeeApi,
};
