/**
 * 全局分页配置常量
 * 用于防止大量数据查询导致的性能问题和内存溢出
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * 标准化分页参数
 * @param page 页码
 * @param pageSize 每页大小
 * @returns 标准化后的分页参数
 */
export function normalizePagination(page?: number, pageSize?: number) {
  const normalizedPage = Math.max(1, page || DEFAULT_PAGE);
  const normalizedPageSize = Math.min(
    Math.max(1, pageSize || DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    skip: (normalizedPage - 1) * normalizedPageSize,
    take: normalizedPageSize,
  };
}
