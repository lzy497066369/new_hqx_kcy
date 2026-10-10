import { ClientEnterpriseMediaApi } from '#/api/client';

import type {
  EnterpriseCertificateCategoryKey,
  EnterpriseMediaCategoryOption,
  EnterprisePhotoCategoryKey,
} from './types';

export const CERTIFICATE_CATEGORIES: Array<
  EnterpriseMediaCategoryOption<EnterpriseCertificateCategoryKey>
> = [
  {
    description: '展示企业取得的行业类资质、认定和许可文件。',
    key: 'industry',
    label: '行业资质',
    value: ClientEnterpriseMediaApi.CertificateClass.INDUSTRY,
  },
  {
    description: '展示安全生产、安全作业及相关许可资料。',
    key: 'safety',
    label: '安全许可',
    value: ClientEnterpriseMediaApi.CertificateClass.SAFETY,
  },
  {
    description: '展示 ISO、管理体系等质量认证资料。',
    key: 'quality',
    label: '质量体系',
    value: ClientEnterpriseMediaApi.CertificateClass.QUALITY,
  },
  {
    description: '展示企业获奖、评优及品牌荣誉证书。',
    key: 'honor',
    label: '荣誉证书',
    value: ClientEnterpriseMediaApi.CertificateClass.HONOR,
  },
  {
    description: '展示营业执照及统一主体资格证明材料。',
    key: 'license',
    label: '营业执照',
    value: ClientEnterpriseMediaApi.CertificateClass.LICENSE,
  },
  {
    description: '展示暂未归类的其他证书资料。',
    key: 'other',
    label: '其他',
    value: ClientEnterpriseMediaApi.CertificateClass.OTHER,
  },
];

export const PHOTO_CATEGORIES: Array<
  EnterpriseMediaCategoryOption<EnterprisePhotoCategoryKey>
> = [
  {
    description: '展示办公区、厂区、实验室等场地环境照片。',
    key: 'site',
    label: '场地照片',
    value: ClientEnterpriseMediaApi.PhotoStatus.SITE,
  },
  {
    description: '展示培训活动、课程过程和学习成果照片。',
    key: 'training',
    label: '培训照片',
    value: ClientEnterpriseMediaApi.PhotoStatus.TRAINING,
  },
  {
    description: '展示生产设备、检测设备及关键工装照片。',
    key: 'equipment',
    label: '设备照片',
    value: ClientEnterpriseMediaApi.PhotoStatus.EQUIPMENT,
  },
  {
    description: '展示核心产品、样品和成品展示照片。',
    key: 'product',
    label: '产品照片',
    value: ClientEnterpriseMediaApi.PhotoStatus.PRODUCT,
  },
];

export function getCertificateCategoryByValue(
  value: number | string | undefined,
) {
  const numericValue = Number(value);
  return (
    CERTIFICATE_CATEGORIES.find((item) => item.value === numericValue) ??
    CERTIFICATE_CATEGORIES[CERTIFICATE_CATEGORIES.length - 1]!
  );
}

export function getPhotoCategoryByValue(value: number | string | undefined) {
  const numericValue = Number(value);
  return (
    PHOTO_CATEGORIES.find((item) => item.value === numericValue) ??
    PHOTO_CATEGORIES[0]!
  );
}

export function getCertificateCategoryValue(
  key: EnterpriseCertificateCategoryKey,
) {
  return (
    CERTIFICATE_CATEGORIES.find((item) => item.key === key)?.value ??
    ClientEnterpriseMediaApi.CertificateClass.OTHER
  );
}

export function getPhotoCategoryValue(key: EnterprisePhotoCategoryKey) {
  return (
    PHOTO_CATEGORIES.find((item) => item.key === key)?.value ??
    ClientEnterpriseMediaApi.PhotoStatus.SITE
  );
}
