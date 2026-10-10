import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('policy_collect_runs')
@Index(['jobId'])
@Index(['status'])
export class PolicyCollectRunEntity extends BaseEntityModel {
  @Column({ name: 'job_id', type: 'bigint' })
  jobId!: string;

  @Column({ name: 'job_name', type: 'varchar', length: 128 })
  jobName!: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status!: string;

  @Column({ name: 'current_step', type: 'varchar', length: 64, nullable: true })
  currentStep!: null | string;

  @Column({ type: 'int', default: 0 })
  progress!: number;

  @Column({ name: 'step_message', type: 'varchar', length: 255, nullable: true })
  stepMessage!: null | string;

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'datetime', nullable: true })
  finishedAt!: Date | null;

  @Column({ name: 'searched_keywords', type: 'text', nullable: true })
  searchedKeywords!: null | string;

  @Column({ name: 'total_count', type: 'int', default: 0 })
  totalCount!: number;

  @Column({ name: 'new_count', type: 'int', default: 0 })
  newCount!: number;

  @Column({ name: 'changed_count', type: 'int', default: 0 })
  changedCount!: number;

  @Column({ name: 'same_count', type: 'int', default: 0 })
  sameCount!: number;

  @Column({ name: 'uncertain_count', type: 'int', default: 0 })
  uncertainCount!: number;

  @Column({ name: 'ignored_count', type: 'int', default: 0 })
  ignoredCount!: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: null | string;

  @Column({ name: 'ai_task_id', type: 'bigint', nullable: true })
  aiTaskId!: null | string;
}
