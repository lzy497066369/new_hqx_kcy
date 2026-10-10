import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_gaoxin_book_draft')
@Index(['declarationId'], { unique: true })
@Index(['enterpriseId', 'projectId'])
export class GaoxinBookDraftEntity extends BaseEntityModel {
  @Column({ name: 'declaration_id', type: 'bigint' })
  declarationId!: string;

  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'project_id', type: 'bigint' })
  projectId!: string;

  @Column({ name: 'readonly_snapshot_json', type: 'longtext', nullable: true })
  readonlySnapshotJson!: null | string;

  @Column({ name: 'supplemental_json', type: 'longtext', nullable: true })
  supplementalJson!: null | string;

  @Column({ name: 'completion_rate', type: 'decimal', precision: 6, scale: 2, default: 0 })
  completionRate!: number | string;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status!: string;
}
