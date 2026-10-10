import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/**
 * 数据库查询优化工具类
 * 提供常用的查询优化方法，避免N+1查询问题
 */
export class QueryOptimizer {
  /**
   * 批量加载关联数据，避免N+1查询
   * @param queryBuilder 查询构建器
   * @param relations 需要加载的关联关系
   */
  static withRelations<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    relations: string[],
  ): SelectQueryBuilder<T> {
    relations.forEach(relation => {
      const parts = relation.split('.');
      if (parts.length === 1) {
        queryBuilder.leftJoinAndSelect(`${queryBuilder.alias}.${relation}`, relation);
      } else {
        // 支持嵌套关联，如 'user.profile'
        let currentAlias = queryBuilder.alias;
        parts.forEach((part, index) => {
          const nextAlias = index === parts.length - 1 ? part : `${parts.slice(0, index + 1).join('_')}`;
          queryBuilder.leftJoinAndSelect(`${currentAlias}.${part}`, nextAlias);
          currentAlias = nextAlias;
        });
      }
    });
    return queryBuilder;
  }

  /**
   * 添加分页支持
   */
  static withPagination<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    page: number,
    pageSize: number,
  ): SelectQueryBuilder<T> {
    const skip = (page - 1) * pageSize;
    return queryBuilder.skip(skip).take(pageSize);
  }

  /**
   * 批量查询并映射
   * 用于解决 WHERE IN 查询优化
   */
  static async batchLoad<T, K extends keyof T>(
    repository: any,
    ids: any[],
    field: K,
  ): Promise<Map<any, T>> {
    if (ids.length === 0) {
      return new Map();
    }

    const items = await repository
      .createQueryBuilder()
      .where(`${String(field)} IN (:...ids)`, { ids })
      .getMany();

    const map = new Map<any, T>();
    items.forEach((item: T) => {
      map.set(item[field], item);
    });

    return map;
  }

  /**
   * 使用子查询优化复杂查询
   */
  static createSubquery<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    alias: string,
    subqueryFn: (qb: SelectQueryBuilder<T>) => SelectQueryBuilder<T>,
  ): SelectQueryBuilder<T> {
    const subquery = subqueryFn(queryBuilder.subQuery());
    return queryBuilder.where(`${queryBuilder.alias}.id IN ${subquery.getQuery()}`);
  }

  /**
   * 预加载计数，避免多次COUNT查询
   */
  static async loadWithCount<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
  ): Promise<{ items: T[]; total: number }> {
    const [items, total] = await queryBuilder.getManyAndCount();
    return { items, total };
  }

  /**
   * 优化排序查询
   * 对于大数据量排序，使用索引字段
   */
  static optimizedSort<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    sortField: string,
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): SelectQueryBuilder<T> {
    // 确保排序字段有索引
    return queryBuilder.orderBy(`${queryBuilder.alias}.${sortField}`, sortOrder);
  }

  /**
   * 使用 EXISTS 替代 IN 子查询（适用于大数据集）
   */
  static withExists<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    subqueryFn: (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>,
  ): SelectQueryBuilder<T> {
    const subquery = subqueryFn(queryBuilder.subQuery());
    return queryBuilder.where(`EXISTS ${subquery.getQuery()}`);
  }

  /**
   * 批量更新优化
   */
  static async batchUpdate<T>(
    repository: any,
    updates: Array<{ id: any; data: Partial<T> }>,
  ): Promise<void> {
    // 使用 CASE WHEN 批量更新，减少数据库往返
    if (updates.length === 0) return;

    const ids = updates.map(u => u.id);
    const firstUpdate = updates[0];
    const fields = Object.keys(firstUpdate.data);

    // 为每个字段构建 CASE WHEN 语句
    const setClauses = fields.map(field => {
      const cases = updates
        .map(u => `WHEN id = '${u.id}' THEN '${(u.data as any)[field]}'`)
        .join(' ');
      return `${field} = CASE ${cases} END`;
    });

    await repository
      .createQueryBuilder()
      .update()
      .set(Object.fromEntries(setClauses.map((clause, i) => [fields[i], clause])))
      .where('id IN (:...ids)', { ids })
      .execute();
  }
}

/**
 * 查询优化装饰器
 * 自动记录慢查询
 */
export function LogSlowQuery(threshold: number = 1000) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      const result = await method.apply(this, args);
      const duration = Date.now() - start;

      if (duration > threshold) {
        console.warn(
          `[SLOW_QUERY] ${target.constructor.name}.${propertyName} took ${duration}ms`,
        );
      }

      return result;
    };

    return descriptor;
  };
}
