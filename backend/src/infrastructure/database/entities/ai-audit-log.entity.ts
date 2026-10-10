import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('ai_audit_logs')
@Index(['taskId'])
@Index(['provider'])
export class AiAuditLogEntity extends BaseEntityModel {
  @Column({ name: 'task_id', type: 'bigint' })
  taskId!: string;

  @Column({ type: 'varchar', length: 64 })
  provider!: string;

  @Column({ type: 'varchar', length: 128 })
  model!: string;

  @Column({ type: 'longtext' })
  prompt!: string;

  @Column({ name: 'raw_response', type: 'longtext', nullable: true })
  rawResponse!: string | null;

  @Column({ name: 'token_usage', type: 'text', nullable: true })
  tokenUsage!: string | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs!: number | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 6, nullable: true })
  cost!: null | string;
}
