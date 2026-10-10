export const ENTERPRISE_CERTIFICATE_TYPES = {
  KEY_LITTLE_GIANT: '重点“小巨人”企业',
  NATIONAL_HIGH_TECH: '国家高新技术企业',
  NATIONAL_TECH_SME: '国家科技型中小企业',
  OTHER: '其他',
  PROVINCIAL_INNOVATIVE_SME: '省级创新型中小企业',
  PROVINCIAL_SPECIALIZED_SME: '省级专精特新中小企业',
  PROVINCIAL_TECH_SME: '省级科技型中小企业',
  SPECIALIZED_LITTLE_GIANT: '专精特新“小巨人”企业',
} as const;

export type EnterpriseCertificateType = keyof typeof ENTERPRISE_CERTIFICATE_TYPES;

export function isEnterpriseCertificateType(value: unknown): value is EnterpriseCertificateType {
  return typeof value === 'string' && value in ENTERPRISE_CERTIFICATE_TYPES;
}
