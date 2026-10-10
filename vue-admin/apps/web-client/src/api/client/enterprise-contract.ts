import { requestClient } from '#/api/request';

export namespace ClientEnterpriseContractApi {
  export type ContractStatus = 1 | 2 | 3;
  export type InvoiceStatus = 1 | 2 | 3;

  export interface EnterpriseRecordList<T> {
    items: T[];
    total: number;
  }

  export interface Contract {
    end_date: string;
    ht_des?: null | string;
    ht_money: number | string;
    ht_name: string;
    ht_num: string;
    ht_path?: null | string;
    ht_status: ContractStatus;
    id?: number | string;
    kh_name: string;
    qd_date: string;
    start_date: string;
  }

  export interface Invoice {
    fp_date: string;
    fp_money: number | string;
    fp_num: string;
    fp_status: InvoiceStatus;
    ht_id?: number | string;
    id?: number | string;
    remark?: null | string;
    zf_date?: null | string;
  }

  export interface ContractListParams {
    ht_status?: ContractStatus;
    keyword?: string;
    year?: string;
  }

  export interface InvoiceListParams {
    fp_status?: InvoiceStatus;
    ht_id?: number | string;
    keyword?: string;
  }
}

async function listRecords<T>(tabKey: string) {
  return requestClient.get<ClientEnterpriseContractApi.EnterpriseRecordList<T>>(
    `/client/enterprise-records/contract/${tabKey}`,
  );
}

async function createRecord<T>(tabKey: string, data: T) {
  return requestClient.post<T>(`/client/enterprise-records/contract/${tabKey}`, {
    data,
  });
}

async function updateRecord<T>(tabKey: string, id: number | string, data: T) {
  return requestClient.put<T>(
    `/client/enterprise-records/contract/${tabKey}/${id}`,
    { data },
  );
}

async function deleteRecord(tabKey: string, id: number | string) {
  return requestClient.delete(`/client/enterprise-records/contract/${tabKey}/${id}`);
}

async function getClientContractListApi(
  _params: ClientEnterpriseContractApi.ContractListParams = {},
) {
  return listRecords<ClientEnterpriseContractApi.Contract>('contracts');
}

async function getClientInvoiceListApi(
  _params: ClientEnterpriseContractApi.InvoiceListParams = {},
) {
  return listRecords<ClientEnterpriseContractApi.Invoice>('invoices');
}

async function createClientContractApi(data: ClientEnterpriseContractApi.Contract) {
  return createRecord('contracts', data);
}

async function createClientInvoiceApi(data: ClientEnterpriseContractApi.Invoice) {
  return createRecord('invoices', data);
}

async function updateClientContractApi(
  id: number | string,
  data: ClientEnterpriseContractApi.Contract,
) {
  return updateRecord('contracts', id, data);
}

async function updateClientInvoiceApi(
  id: number | string,
  data: ClientEnterpriseContractApi.Invoice,
) {
  return updateRecord('invoices', id, data);
}

async function deleteClientContractApi(id: number | string) {
  return deleteRecord('contracts', id);
}

async function deleteClientInvoiceApi(id: number | string) {
  return deleteRecord('invoices', id);
}

export {
  createClientContractApi,
  createClientInvoiceApi,
  deleteClientContractApi,
  deleteClientInvoiceApi,
  getClientContractListApi,
  getClientInvoiceListApi,
  updateClientContractApi,
  updateClientInvoiceApi,
};
