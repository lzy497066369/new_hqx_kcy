import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_client_declaration')
@Index(['enterpriseId'])
@Index(['projectId'])
@Index(['enterpriseId', 'projectId', 'declarationRegionId'])
@Index(['status'])
@Index(['declarationNo'], { unique: true })
export class ClientDeclarationEntity extends BaseEntityModel {
  @Column({ name: 'declaration_no', type: 'varchar', length: 64 })
  declarationNo!: string;

  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'enterprise_name', type: 'varchar', length: 128 })
  enterpriseName!: string;

  @Column({ name: 'project_id', type: 'bigint' })
  projectId!: string;

  @Column({ name: 'project_name', type: 'varchar', length: 128 })
  projectName!: string;

  @Column({ name: 'policy_type', type: 'varchar', length: 128, nullable: true })
  policyType!: null | string;

  @Column({ name: 'policy_file_ids', type: 'varchar', length: 500, nullable: true })
  policyFileIds!: null | string;

  @Column({ name: 'declaration_region_id', type: 'bigint', nullable: true })
  declarationRegionId!: null | string;

  @Column({ name: 'scheme_id', type: 'bigint', nullable: true })
  schemeId!: null | string;

  @Column({ name: 'scheme_version', type: 'varchar', length: 32, nullable: true })
  schemeVersion!: null | string;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status!: string;

  @Column({ name: 'current_node_name', type: 'varchar', length: 128, nullable: true })
  currentNodeName!: null | string;

  @Column({ type: 'int', default: 0 })
  progress!: number;

  @Column({ type: 'date', nullable: true })
  deadline!: Date | null;

  @Column({ name: 'missing_material_count', type: 'int', default: 0 })
  missingMaterialCount!: number;

  @Column({ name: 'rejected_reason', type: 'varchar', length: 500, nullable: true })
  rejectedReason!: null | string;

  @Column({ name: 'submit_time', type: 'datetime', nullable: true })
  submitTime!: Date | null;

  @Column({ name: 'snapshot_json', type: 'longtext', nullable: true })
  snapshotJson!: null | string;
}
