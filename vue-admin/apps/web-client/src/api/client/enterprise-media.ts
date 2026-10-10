import { requestClient } from '#/api/request';

export namespace ClientEnterpriseMediaApi {
  export enum CertificateClass {
    INDUSTRY = 2,
    SAFETY = 3,
    QUALITY = 4,
    HONOR = 5,
    LICENSE = 6,
    OTHER = 7,
  }

  export enum PhotoStatus {
    SITE = 1,
    TRAINING = 2,
    EQUIPMENT = 3,
    PRODUCT = 4,
  }

  export interface ClientEnterpriseCertificate {
    [key: string]: unknown;
    create_time?: string;
    id: number | string;
    qualification_code?: null | string;
    valid_until?: null | string;
    zs_class: CertificateClass | number | string;
    zs_name: string;
    zs_path: string;
  }

  export interface CreateClientEnterpriseCertificateParams {
    qualification_code?: null | string;
    valid_until?: null | string;
    zs_class: CertificateClass | number | string;
    zs_name: string;
    zs_path: string;
  }

  export interface DeleteClientEnterpriseCertificatesParams {
    ids: Array<number | string>;
  }

  export interface ClientEnterprisePhoto {
    [key: string]: unknown;
    create_time?: string;
    id: number | string;
    photo_des?: null | string;
    photo_files: string | string[];
    photo_status: PhotoStatus | number | string;
    photo_title: string;
    ps_date?: null | string;
  }

  export interface CreateClientEnterprisePhotoParams {
    photo_des?: null | string;
    photo_files: string;
    photo_status: PhotoStatus | number | string;
    photo_title: string;
    ps_date?: null | string;
  }

  export interface ClientEnterprisePhotoStats {
    equipment: number;
    product: number;
    site: number;
    total: number;
    training: number;
  }

  export interface EnterpriseMediaUploadItem {
    name: string;
    path: string;
    size: number;
  }
}

async function uploadClientEnterpriseMediaApi(files: File[]) {
  const data = new FormData();
  files.forEach((file) => data.append('files', file));
  return requestClient.post<ClientEnterpriseMediaApi.EnterpriseMediaUploadItem[]>(
    '/client/enterprise-media/uploads',
    data,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );
}

async function getClientEnterpriseCertificatesApi() {
  return requestClient.get<
    | ClientEnterpriseMediaApi.ClientEnterpriseCertificate[]
    | { items?: ClientEnterpriseMediaApi.ClientEnterpriseCertificate[] }
    | { list?: ClientEnterpriseMediaApi.ClientEnterpriseCertificate[] }
  >('/client/enterprise-media/certificates');
}

async function createClientEnterpriseCertificateApi(
  data: ClientEnterpriseMediaApi.CreateClientEnterpriseCertificateParams,
) {
  return requestClient.post<ClientEnterpriseMediaApi.ClientEnterpriseCertificate>(
    '/client/enterprise-media/certificates',
    data,
  );
}

async function deleteClientEnterpriseCertificateApi(id: number | string) {
  return requestClient.delete(`/client/enterprise-media/certificates/${id}`);
}

async function batchDeleteClientEnterpriseCertificatesApi(
  data: ClientEnterpriseMediaApi.DeleteClientEnterpriseCertificatesParams,
) {
  return requestClient.post('/client/enterprise-media/certificates/batch-delete', data);
}

async function getClientEnterprisePhotosApi() {
  return requestClient.get<
    | ClientEnterpriseMediaApi.ClientEnterprisePhoto[]
    | { items?: ClientEnterpriseMediaApi.ClientEnterprisePhoto[] }
    | { list?: ClientEnterpriseMediaApi.ClientEnterprisePhoto[] }
  >('/client/enterprise-media/photos');
}

async function getClientEnterprisePhotoStatsApi() {
  return requestClient.get<Partial<ClientEnterpriseMediaApi.ClientEnterprisePhotoStats>>(
    '/client/enterprise-media/photos/stats',
  );
}

async function createClientEnterprisePhotoApi(
  data: ClientEnterpriseMediaApi.CreateClientEnterprisePhotoParams,
) {
  return requestClient.post<ClientEnterpriseMediaApi.ClientEnterprisePhoto>(
    '/client/enterprise-media/photos',
    data,
  );
}

async function deleteClientEnterprisePhotoApi(id: number | string) {
  return requestClient.delete(`/client/enterprise-media/photos/${id}`);
}

export {
  batchDeleteClientEnterpriseCertificatesApi,
  createClientEnterpriseCertificateApi,
  createClientEnterprisePhotoApi,
  deleteClientEnterpriseCertificateApi,
  deleteClientEnterprisePhotoApi,
  getClientEnterpriseCertificatesApi,
  getClientEnterprisePhotosApi,
  getClientEnterprisePhotoStatsApi,
  uploadClientEnterpriseMediaApi,
};
