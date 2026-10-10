import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_region_policy_file')
@Index(['regionId'])
@Index(['projectId'])
@Index(['status'])
@Index(['templateFileId'])
export class RegionPolicyFileEntity extends BaseEntityModel {
  @Column({ name: 'region_id', type: 'bigint', nullable: true })
  regionId!: null | string;

  @Column({ name: 'region_name', type: 'varchar', length: 128 })
  regionName!: string;

  @Column({ name: 'project_id', type: 'bigint' })
  projectId!: string;

  @Column({ name: 'project_name', type: 'varchar', length: 128 })
  projectName!: string;

  @Column({ name: 'policy_category', type: 'varchar', length: 32, default: 'notice' })
  policyCategory!: string;

  @Column({ type: 'varchar', length: 32, default: 'incomplete' })
  status!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  content!: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: Date | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: Date | null;

  @Column({
    name: 'subsidy_amount_min',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  subsidyAmountMin!: null | string;

  @Column({
    name: 'subsidy_amount_max',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  subsidyAmountMax!: null | string;

  @Column({ name: 'subsidy_text', type: 'varchar', length: 255, nullable: true })
  subsidyText!: string | null;

  @Column({ name: 'application_level', type: 'varchar', length: 32, nullable: true })
  applicationLevel!: string | null;

  @Column({ name: 'condition_text', type: 'text', nullable: true })
  conditionText!: string | null;

  @Column({ name: 'material_text', type: 'text', nullable: true })
  materialText!: string | null;

  @Column({ name: 'target_objects', type: 'varchar', length: 255, nullable: true })
  targetObjects!: string | null;

  @Column({
    name: 'official_file_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  officialFileUrl!: string | null;

  @Column({ name: 'source_run_item_id', type: 'bigint', nullable: true })
  sourceRunItemId!: string | null;

  @Column({ name: 'official_source_name', type: 'varchar', length: 128, nullable: true })
  officialSourceName!: string | null;

  @Column({ name: 'official_publish_date', type: 'date', nullable: true })
  officialPublishDate!: Date | null;

  @Column({ name: 'document_no', type: 'varchar', length: 128, nullable: true })
  documentNo!: string | null;

  @Column({ name: 'issuing_agency', type: 'varchar', length: 128, nullable: true })
  issuingAgency!: string | null;

  @Column({ name: 'source_hash', type: 'varchar', length: 64, nullable: true })
  sourceHash!: string | null;

  @Column({ name: 'imported_by_ai', type: 'tinyint', default: 0 })
  importedByAi!: number;

  @Column({ name: 'ai_confidence', type: 'varchar', length: 16, nullable: true })
  aiConfidence!: string | null;

  @Column({ name: 'file_url', type: 'varchar', length: 500, nullable: true })
  fileUrl!: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName!: string | null;

  @Column({ name: 'template_file_id', type: 'bigint', nullable: true })
  templateFileId!: string | null;

  @Column({ name: 'template_file_name', type: 'varchar', length: 255, nullable: true })
  templateFileName!: string | null;

  @Column({ name: 'owner_user_id', type: 'bigint' })
  ownerUserId!: string;

  @Column({ name: 'owner_name', type: 'varchar', length: 64 })
  ownerName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: string | null;
}
