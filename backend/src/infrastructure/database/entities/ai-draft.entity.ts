import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('ai_drafts')
@Index(['enterpriseId', 'draftType', 'status'])
@Index(['taskId'])
export class AiDraftEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'task_id', type: 'bigint', nullable: true })
  taskId!: null | string;

  @Column({ name: 'draft_type', type: 'varchar', length: 64 })
  draftType!: string;

  @Column({ type: 'varchar', length: 32, default: 'reviewing' })
  status!: string;

  @Column({ name: 'source_ids', type: 'text', nullable: true })
  sourceIds!: null | string;

  @Column({ name: 'draft_payload', type: 'longtext', nullable: true })
  draftPayload!: null | string;

  @Column({ name: 'approved_record_id', type: 'bigint', nullable: true })
  approvedRecordId!: null | string;

  @Column({ name: 'reviewed_by', type: 'bigint', nullable: true })
  reviewedBy!: null | string;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt!: Date | null;
}
