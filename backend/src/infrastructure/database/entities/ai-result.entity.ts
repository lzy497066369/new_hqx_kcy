import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('ai_results')
@Index(['taskId'])
@Index(['scene'])
@Index(['status'])
export class AiResultEntity extends BaseEntityModel {
  @Column({ name: 'task_id', type: 'bigint' })
  taskId!: string;

  @Column({ type: 'varchar', length: 64 })
  scene!: string;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ name: 'structured_result', type: 'longtext', nullable: true })
  structuredResult!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  confidence!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status!: string;

  @Column({ name: 'confirmed_by', type: 'bigint', nullable: true })
  confirmedBy!: string | null;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmedAt!: Date | null;
}
