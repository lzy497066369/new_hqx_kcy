import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

/**
 * 事务管理服务
 * 提供统一的事务管理和最佳实践示例
 */
@Injectable()
export class TransactionService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 方式1: 使用 DataSource.transaction
   * 推荐用于简单的事务场景
   */
  async executeInTransaction<T>(
    callback: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      return callback(manager);
    });
  }

  /**
   * 方式2: 手动控制事务
   * 用于需要精细控制的复杂场景
   */
  async executeWithManualTransaction<T>(
    callback: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await callback(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 方式3: 使用隔离级别
   * 用于需要特定隔离级别的场景
   */
  async executeWithIsolationLevel<T>(
    isolationLevel:
      | 'READ UNCOMMITTED'
      | 'READ COMMITTED'
      | 'REPEATABLE READ'
      | 'SERIALIZABLE',
    callback: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction(isolationLevel);

    try {
      const result = await callback(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

/**
 * 事务装饰器
 * 自动将方法包装在事务中
 */
export function Transactional() {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: Record<string, any>, ...args: any[]) {
      const dataSource: DataSource = (this as any).dataSource;
      if (!dataSource) {
        throw new Error('DataSource not found. Inject DataSource in the service.');
      }

      return dataSource.transaction(async (manager) => {
        // 临时替换 repository 为事务中的 manager
        const originalRepos: any = {};
        for (const key in this) {
          if (this[key]?.target) {
            originalRepos[key] = this[key];
            (this as any)[key] = manager.getRepository(this[key].target);
          }
        }

        try {
          return await originalMethod.apply(this, args);
        } finally {
          // 恢复原始 repository
          for (const key in originalRepos) {
            (this as any)[key] = originalRepos[key];
          }
        }
      });
    };

    return descriptor;
  };
}

/**
 * 使用示例：
 *
 * 示例1: 基础事务使用
 * ```typescript
 * async createUserWithProfile(userData: any, profileData: any) {
 *   return this.transactionService.executeInTransaction(async (manager) => {
 *     // 创建用户
 *     const user = await manager.save(User, userData);
 *
 *     // 创建用户资料
 *     const profile = await manager.save(UserProfile, {
 *       ...profileData,
 *       userId: user.id,
 *     });
 *
 *     return { user, profile };
 *   });
 * }
 * ```
 *
 * 示例2: 使用装饰器
 * ```typescript
 * @Injectable()
 * export class OrderService {
 *   constructor(
 *     private readonly dataSource: DataSource,
 *     @InjectRepository(Order)
 *     private readonly orderRepo: Repository<Order>,
 *     @InjectRepository(OrderItem)
 *     private readonly orderItemRepo: Repository<OrderItem>,
 *   ) {}
 *
 *   @Transactional()
 *   async createOrder(orderData: any, items: any[]) {
 *     // 创建订单
 *     const order = await this.orderRepo.save(orderData);
 *
 *     // 创建订单项
 *     const orderItems = items.map(item => ({
 *       ...item,
 *       orderId: order.id,
 *     }));
 *     await this.orderItemRepo.save(orderItems);
 *
 *     return order;
 *   }
 * }
 * ```
 *
 * 示例3: 复杂业务场景（申报+材料+审核）
 * ```typescript
 * async submitDeclaration(declarationData: any, materials: any[]) {
 *   return this.dataSource.transaction(async (manager) => {
 *     // 1. 创建申报记录
 *     const declaration = await manager.save(Declaration, {
 *       ...declarationData,
 *       status: 'submitted',
 *       submittedAt: new Date(),
 *     });
 *
 *     // 2. 关联材料
 *     const materialRecords = materials.map(m => ({
 *       ...m,
 *       declarationId: declaration.id,
 *     }));
 *     await manager.save(Material, materialRecords);
 *
 *     // 3. 创建审核记录
 *     await manager.save(Audit, {
 *       declarationId: declaration.id,
 *       status: 'pending',
 *       createdAt: new Date(),
 *     });
 *
 *     // 4. 更新企业统计
 *     await manager.increment(
 *       Enterprise,
 *       { id: declarationData.enterpriseId },
 *       'declarationCount',
 *       1,
 *     );
 *
 *     return declaration;
 *   });
 * }
 * ```
 *
 * 示例4: 批量操作事务
 * ```typescript
 * async batchApproveDeclarations(declarationIds: string[]) {
 *   return this.dataSource.transaction(async (manager) => {
 *     // 批量更新申报状态
 *     await manager.update(
 *       Declaration,
 *       { id: In(declarationIds) },
 *       {
 *         status: 'approved',
 *         approvedAt: new Date(),
 *       },
 *     );
 *
 *     // 批量创建通知
 *     const declarations = await manager.findBy(Declaration, {
 *       id: In(declarationIds),
 *     });
 *
 *     const notifications = declarations.map(d => ({
 *       enterpriseId: d.enterpriseId,
 *       type: 'approval',
 *       message: `申报 ${d.projectName} 已通过审批`,
 *     }));
 *
 *     await manager.save(Notification, notifications);
 *
 *     return declarations;
 *   });
 * }
 * ```
 *
 * 示例5: 乐观锁防止并发冲突
 * ```typescript
 * async updateInventory(productId: string, quantity: number) {
 *   return this.dataSource.transaction(async (manager) => {
 *     // 查询当前库存（带版本号）
 *     const product = await manager.findOne(Product, {
 *       where: { id: productId },
 *     });
 *
 *     if (!product) {
 *       throw new Error('产品不存在');
 *     }
 *
 *     if (product.stock < quantity) {
 *       throw new Error('库存不足');
 *     }
 *
 *     // 更新库存（乐观锁）
 *     const result = await manager.update(
 *       Product,
 *       { id: productId, version: product.version },
 *       {
 *         stock: product.stock - quantity,
 *         version: product.version + 1,
 *       },
 *     );
 *
 *     if (result.affected === 0) {
 *       throw new Error('库存已被其他操作修改，请重试');
 *     }
 *
 *     return product;
 *   });
 * }
 * ```
 */
