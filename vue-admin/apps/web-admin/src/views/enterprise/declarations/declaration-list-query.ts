export interface DeclarationListQuery {
  deadlineWithinDays?: number;
  enterpriseId?: string;
  keyword?: string;
  missingMaterials?: boolean;
  page?: number;
  pageSize?: number;
  status?: string;
}

type RouteQueryValue = null | string | Array<null | string> | undefined;
type RouteQuery = Record<string, RouteQueryValue>;

function getSingleValue(value: RouteQueryValue) {
  return Array.isArray(value) ? value[0] : value;
}

function getPositiveNumber(value: RouteQueryValue) {
  const parsed = Number(getSingleValue(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function buildDeclarationListQuery({
  deadlineWithinDays,
  enterpriseId,
  keyword,
  missingMaterials,
  page,
  pageSize,
  status,
}: DeclarationListQuery): Record<string, string> {
  return {
    ...(deadlineWithinDays && deadlineWithinDays > 0
      ? { deadlineWithinDays: String(deadlineWithinDays) }
      : {}),
    ...(enterpriseId ? { enterpriseId } : {}),
    ...(keyword?.trim() ? { keyword: keyword.trim() } : {}),
    ...(missingMaterials ? { missingMaterials: '1' } : {}),
    ...(page && page > 1 ? { page: String(page) } : {}),
    ...(pageSize && pageSize !== 20 ? { pageSize: String(pageSize) } : {}),
    ...(status ? { status } : {}),
  };
}

export function parseDeclarationListQuery(query: RouteQuery): Required<Pick<DeclarationListQuery, 'page' | 'pageSize'>> & DeclarationListQuery {
  const keyword = getSingleValue(query.keyword)?.trim();
  return {
    deadlineWithinDays: getPositiveNumber(query.deadlineWithinDays),
    enterpriseId: getSingleValue(query.enterpriseId) || undefined,
    keyword: keyword || undefined,
    missingMaterials: getSingleValue(query.missingMaterials) === '1' || undefined,
    page: getPositiveNumber(query.page) ?? 1,
    pageSize: getPositiveNumber(query.pageSize) ?? 20,
    status: getSingleValue(query.status) || undefined,
  };
}
