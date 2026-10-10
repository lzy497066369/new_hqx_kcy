import type { ClientEnterpriseMediaApi } from '#/api/client';

export type EnterpriseMediaMode = 'certificate' | 'photo';

export type EnterpriseCertificateQualificationCode =
  | 'KEY_LITTLE_GIANT'
  | 'NATIONAL_HIGH_TECH'
  | 'NATIONAL_TECH_SME'
  | 'OTHER'
  | 'PROVINCIAL_INNOVATIVE_SME'
  | 'PROVINCIAL_SPECIALIZED_SME'
  | 'PROVINCIAL_TECH_SME'
  | 'SPECIALIZED_LITTLE_GIANT';

export type EnterpriseCertificateCategoryKey =
  | 'honor'
  | 'industry'
  | 'license'
  | 'other'
  | 'quality'
  | 'safety';

export type EnterprisePhotoCategoryKey =
  | 'equipment'
  | 'product'
  | 'site'
  | 'training';

export interface EnterpriseMediaCategoryOption<T extends string> {
  description: string;
  key: T;
  label: string;
  value: number;
}

export interface EnterpriseMediaGalleryCard {
  categoryKey: EnterpriseCertificateCategoryKey | EnterprisePhotoCategoryKey;
  categoryLabel: string;
  coverUrl: string;
  createdAt: string;
  description?: string;
  files: string[];
  id: string;
  imageCount: number;
  mode: EnterpriseMediaMode;
  rawId: ClientEnterpriseMediaApi.ClientEnterpriseCertificate['id'];
  title: string;
}

export interface EnterpriseMediaPreviewPayload {
  categoryLabel: string;
  createdAt: string;
  description?: string;
  id: string;
  images: string[];
  initialIndex?: number;
  mode: EnterpriseMediaMode;
  title: string;
}

export type EnterpriseMediaUploadPayload =
  | {
      certificateCategoryKey: EnterpriseCertificateCategoryKey;
      files: File[];
      mode: 'certificate';
      name: string;
      qualificationCode: EnterpriseCertificateQualificationCode;
      validUntil?: string;
    }
  | {
      description: string;
      files: File[];
      mode: 'photo';
      photoCategoryKey: EnterprisePhotoCategoryKey;
      photoDate: string;
      title: string;
    };
