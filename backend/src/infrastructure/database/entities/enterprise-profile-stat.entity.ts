import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_enterprise_profile_stat')
@Index(['enterpriseId'], { unique: true })
@Index(['calculatedAt'])
export class EnterpriseProfileStatEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'total_modules', type: 'int', default: 0 })
  totalModules!: number;

  @Column({ name: 'completed_modules', type: 'int', default: 0 })
  completedModules!: number;

  @Column({ name: 'total_records', type: 'int', default: 0 })
  totalRecords!: number;

  @Column({ name: 'attachment_records', type: 'int', default: 0 })
  attachmentRecords!: number;

  @Column({ name: 'missing_modules', type: 'longtext', nullable: true })
  missingModules!: null | string;

  @Column({ name: 'completeness_rate', type: 'decimal', precision: 6, scale: 2, default: 0 })
  completenessRate!: number | string;

  @Column({ name: 'health_score', type: 'decimal', precision: 6, scale: 2, default: 0 })
  healthScore!: number | string;

  @Column({ name: 'summary_json', type: 'longtext', nullable: true })
  summaryJson!: null | string;

  @Column({ name: 'calculated_at', type: 'datetime' })
  calculatedAt!: Date;
}
