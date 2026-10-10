import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_declaration_material_check')
@Index(['enterpriseId'])
@Index(['projectId'])
@Index(['declarationId'])
@Index(['requirementId'])
@Index(['checkedAt'])
export class DeclarationMaterialCheckEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'project_id', type: 'bigint' })
  projectId!: string;

  @Column({ name: 'declaration_id', type: 'bigint', nullable: true })
  declarationId!: null | string;

  @Column({ name: 'requirement_id', type: 'bigint' })
  requirementId!: string;

  @Column({ name: 'check_status', type: 'varchar', length: 32, default: 'missing' })
  checkStatus!: string;

  @Column({ name: 'total_items', type: 'int', default: 0 })
  totalItems!: number;

  @Column({ name: 'passed_items', type: 'int', default: 0 })
  passedItems!: number;

  @Column({ name: 'missing_items', type: 'int', default: 0 })
  missingItems!: number;

  @Column({ name: 'readiness_score', type: 'decimal', precision: 6, scale: 2, default: 0 })
  readinessScore!: number | string;

  @Column({ name: 'risk_level', type: 'varchar', length: 32, default: 'high' })
  riskLevel!: string;

  @Column({ name: 'summary_json', type: 'longtext', nullable: true })
  summaryJson!: null | string;

  @Column({ name: 'checked_at', type: 'datetime' })
  checkedAt!: Date;
}
