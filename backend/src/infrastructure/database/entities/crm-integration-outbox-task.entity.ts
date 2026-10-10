import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_crm_integration_outbox_task')
@Index(['status', 'availableAt'])
@Index(['inboundRequestId'], { unique: true })
export class CrmIntegrationOutboxTaskEntity extends BaseEntityModel {
  @Column({ name: 'inbound_request_id', type: 'bigint' })
  inboundRequestId!: string;

  @Column({ name: 'request_type', type: 'varchar', length: 32 })
  requestType!: 'contract' | 'execution_order';

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status!: 'completed' | 'failed' | 'pending' | 'processing' | 'retry';

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount!: number;

  @Column({ name: 'available_at', type: 'datetime' })
  availableAt!: Date;

  @Column({ name: 'locked_at', type: 'datetime', nullable: true })
  lockedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'last_error', type: 'varchar', length: 1000, nullable: true })
  lastError!: null | string;
}
