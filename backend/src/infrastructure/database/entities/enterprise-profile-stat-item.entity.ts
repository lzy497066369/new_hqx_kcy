import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_enterprise_profile_stat_item')
@Index(['statId', 'moduleKey', 'tabKey'], { unique: true })
@Index(['enterpriseId'])
@Index(['moduleKey', 'tabKey'])
export class EnterpriseProfileStatItemEntity extends BaseEntityModel {
  @Column({ name: 'stat_id', type: 'bigint' })
  statId!: string;

  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'module_key', type: 'varchar', length: 64 })
  moduleKey!: string;

  @Column({ name: 'tab_key', type: 'varchar', length: 64 })
  tabKey!: string;

  @Column({ name: 'module_name', type: 'varchar', length: 128 })
  moduleName!: string;

  @Column({ name: 'item_name', type: 'varchar', length: 128 })
  itemName!: string;

  @Column({ name: 'record_count', type: 'int', default: 0 })
  recordCount!: number;

  @Column({ name: 'attachment_count', type: 'int', default: 0 })
  attachmentCount!: number;

  @Column({ name: 'required_min_count', type: 'int', default: 1 })
  requiredMinCount!: number;

  @Column({ name: 'is_completed', type: 'tinyint', default: 0 })
  isCompleted!: number;

  @Column({ name: 'missing_fields', type: 'longtext', nullable: true })
  missingFields!: null | string;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  score!: number | string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  summary!: null | string;
}
