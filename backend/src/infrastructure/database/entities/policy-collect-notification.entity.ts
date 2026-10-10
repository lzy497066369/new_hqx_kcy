import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('policy_collect_notifications')
@Index(['targetUserId'])
@Index(['status'])
@Index(['type'])
export class PolicyCollectNotificationEntity extends BaseEntityModel {
  @Column({ name: 'job_id', type: 'bigint', nullable: true })
  jobId!: null | string;

  @Column({ name: 'run_id', type: 'bigint', nullable: true })
  runId!: null | string;

  @Column({ name: 'run_item_id', type: 'bigint', nullable: true })
  runItemId!: null | string;

  @Column({ type: 'varchar', length: 32 })
  type!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  content!: null | string;

  @Column({ name: 'target_user_id', type: 'bigint', nullable: true })
  targetUserId!: null | string;

  @Column({ type: 'varchar', length: 32, default: 'unread' })
  status!: string;

  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt!: Date | null;
}
