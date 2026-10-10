import type { ClientEnterpriseApi } from '#/api/client';

export interface EnterpriseBasicCompleteness {
  completed: number;
  percent: number;
  total: number;
}

function normalizeShareholders(
  shareholders?: ClientEnterpriseApi.ClientEnterpriseShareholder[] | null,
) {
  return (shareholders ?? []).map((item) => ({
    citizen_type: item.citizen_type ?? null,
    id: item.id || '',
    idcard: item.idcard ?? '',
    invest_money:
      typeof item.invest_money === 'number' ? item.invest_money : null,
    xname: item.xname ?? '',
  }));
}

export function normalizeMainAreas(value?: null | string | string[]) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  return value
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createEmptyEnterpriseBasicProfile(): ClientEnterpriseApi.ClientEnterpriseBasicProfile {
  return {
    companyIntro: '',
    company_address: '',
    company_name: '',
    contacts_email: '',
    contacts_fax: '',
    contacts_idcard: '',
    contacts_mobile: '',
    contacts_name: '',
    contacts_phone: '',
    is_invest: 0,
    is_ipo: 0,
    js_areas: '',
    le_person_idcard: '',
    le_person_name: '',
    le_person_phone: '',
    listedCode: '',
    main_areas: [],
    register_capital: null,
    register_date: '',
    register_type: '',
    shareholders: [],
    tax_id: '',
    vcAmount: null,
    zip_code: '',
  };
}

export function cloneEnterpriseBasicProfile(
  profile?: ClientEnterpriseApi.ClientEnterpriseBasicProfile | null,
) {
  const nextProfile = {
    ...createEmptyEnterpriseBasicProfile(),
    ...(profile ?? {}),
  };

  nextProfile.main_areas = normalizeMainAreas(nextProfile.main_areas);
  nextProfile.shareholders = normalizeShareholders(nextProfile.shareholders);

  return nextProfile;
}

export function mapEnterpriseProfileToBasicProfile(
  profile?: ClientEnterpriseApi.ClientEnterpriseProfile,
) {
  const nextProfile = createEmptyEnterpriseBasicProfile();

  if (!profile) {
    return nextProfile;
  }

  nextProfile.company_name = profile.name ?? '';
  nextProfile.tax_id = profile.creditCode ?? '';
  nextProfile.register_type = profile.enterpriseType ?? '';
  nextProfile.company_address = profile.address ?? '';
  nextProfile.le_person_name = profile.legalPerson ?? '';
  nextProfile.contacts_name = profile.contactName ?? '';
  nextProfile.contacts_phone = profile.contactPhone ?? '';
  nextProfile.contacts_email = profile.contactEmail ?? '';
  nextProfile.js_areas = profile.industry ?? '';
  nextProfile.main_areas = profile.industry ? [profile.industry] : [];

  return nextProfile;
}

function isFilled(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  return Boolean(String(value ?? '').trim());
}

export function getEnterpriseBasicCompleteness(
  profile?: ClientEnterpriseApi.ClientEnterpriseBasicProfile | null,
): EnterpriseBasicCompleteness {
  const source = cloneEnterpriseBasicProfile(profile);
  const checkpoints = [
    source.company_name,
    source.register_type,
    source.tax_id,
    source.company_address,
    source.le_person_name,
    source.contacts_name,
    source.contacts_phone || source.contacts_mobile,
    source.contacts_email,
    source.js_areas || source.main_areas,
  ];
  const completed = checkpoints.filter(isFilled).length;
  const total = checkpoints.length;

  return {
    completed,
    percent: Math.round((completed / total) * 100),
    total,
  };
}

export function createEnterpriseBasicSavePayload(
  profile: ClientEnterpriseApi.ClientEnterpriseBasicProfile,
  shareholders: ClientEnterpriseApi.ClientEnterpriseShareholder[],
) {
  const nextProfile = cloneEnterpriseBasicProfile(profile);

  return {
    ...nextProfile,
    main_areas: normalizeMainAreas(nextProfile.main_areas).join(','),
    shareholders: normalizeShareholders(shareholders),
  };
}
