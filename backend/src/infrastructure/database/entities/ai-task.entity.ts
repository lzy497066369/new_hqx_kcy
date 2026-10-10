import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('ai_tasks')
@Index(['scene'])
@Index(['bizType', 'bizId'])
@Index(['status'])
export class AiTaskEntity extends BaseEntityModel {
  @Column({ type: 'varchar', length: 64 })
  scene!: string;

  @Column({ name: 'biz_type', type: 'varchar', length: 64 })
  bizType!: string;

  @Column({ name: 'biz_id', type: 'varchar', length: 64 })
  bizId!: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status!: string;

  @Column({ name: 'input_snapshot', type: 'longtext', nullable: true })
  inputSnapshot!: string | null;

  @Column({ name: 'result_id', type: 'bigint', nullable: true })
  resultId!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'finished_at', type: 'datetime', nullable: true })
  finishedAt!: Date | null;
}
