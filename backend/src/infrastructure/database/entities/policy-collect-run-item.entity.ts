import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('policy_collect_run_items')
@Index(['runId'])
@Index(['jobId'])
@Index(['projectId'])
@Index(['regionId'])
@Index(['compareStatus'])
@Index(['status'])
export class PolicyCollectRunItemEntity extends BaseEntityModel {
  @Column({ name: 'run_id', type: 'bigint' })
  runId!: string;

  @Column({ name: 'job_id', type: 'bigint' })
  jobId!: string;

  @Column({ name: 'project_id', type: 'bigint' })
  projectId!: string;

  @Column({ name: 'project_name', type: 'varchar', length: 128 })
  projectName!: string;

  @Column({ name: 'region_id', type: 'bigint', nullable: true })
  regionId!: null | string;

  @Column({ name: 'region_name', type: 'varchar', length: 128 })
  regionName!: string;

  @Column({ name: 'policy_category', type: 'varchar', length: 32, default: 'notice' })
  policyCategory!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'official_url', type: 'varchar', length: 500, nullable: true })
  officialUrl!: null | string;

  @Column({ name: 'issuing_agency', type: 'varchar', length: 128, nullable: true })
  issuingAgency!: null | string;

  @Column({ name: 'document_no', type: 'varchar', length: 128, nullable: true })
  documentNo!: null | string;

  @Column({ name: 'publish_date', type: 'date', nullable: true })
  publishDate!: Date | null;

  @Column({ type: 'text', nullable: true })
  summary!: null | string;

  @Column({ name: 'raw_text', type: 'longtext', nullable: true })
  rawText!: null | string;

  @Column({ name: 'structured_result', type: 'longtext', nullable: true })
  structuredResult!: null | string;

  @Column({ name: 'content_hash', type: 'varchar', length: 64, nullable: true })
  contentHash!: null | string;

  @Column({ name: 'attachment_url', type: 'varchar', length: 500, nullable: true })
  attachmentUrl!: null | string;

  @Column({ name: 'attachment_hash', type: 'varchar', length: 64, nullable: true })
  attachmentHash!: null | string;

  @Column({ name: 'official_verified', type: 'tinyint', default: 0 })
  officialVerified!: number;

  @Column({ name: 'official_confidence', type: 'varchar', length: 16, nullable: true })
  officialConfidence!: null | string;

  @Column({ name: 'compare_status', type: 'varchar', length: 32 })
  compareStatus!: string;

  @Column({ name: 'matched_policy_file_id', type: 'bigint', nullable: true })
  matchedPolicyFileId!: null | string;

  @Column({ name: 'ai_reason', type: 'text', nullable: true })
  aiReason!: null | string;

  @Column({ type: 'varchar', length: 32, default: 'pending_review' })
  status!: string;

  @Column({ name: 'ai_task_id', type: 'bigint', nullable: true })
  aiTaskId!: null | string;

  @Column({ name: 'reviewed_by', type: 'bigint', nullable: true })
  reviewedBy!: null | string;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt!: Date | null;
}
