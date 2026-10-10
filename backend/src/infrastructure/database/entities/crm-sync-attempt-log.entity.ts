import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_crm_sync_attempt_log')
@Index(['recordType', 'recordId'])
@Index(['status'])
export class CrmSyncAttemptLogEntity extends BaseEntityModel {
  @Column({ name: 'record_type', type: 'varchar', length: 32 })
  recordType!: 'contract' | 'execution_order';

  @Column({ name: 'record_id', type: 'bigint' })
  recordId!: string;

  @Column({ name: 'attempt_type', type: 'varchar', length: 32 })
  attemptType!: 'automatic' | 'retry';

  @Column({ type: 'varchar', length: 32 })
  status!: 'success' | 'failed' | 'skipped';

  @Column({ name: 'operator_name', type: 'varchar', length: 64, nullable: true })
  operatorName!: null | string;

  @Column({ name: 'result_json', type: 'longtext', nullable: true })
  resultJson!: null | string;

  @Column({ name: 'failure_reason', type: 'varchar', length: 1000, nullable: true })
  failureReason!: null | string;
}
