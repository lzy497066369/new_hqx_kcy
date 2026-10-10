import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_declaration_material_check_item')
@Index(['checkId'])
@Index(['requirementItemId'])
@Index(['moduleKey', 'tabKey'])
export class DeclarationMaterialCheckItemEntity extends BaseEntityModel {
  @Column({ name: 'check_id', type: 'bigint' })
  checkId!: string;

  @Column({ name: 'requirement_item_id', type: 'bigint', nullable: true })
  requirementItemId!: null | string;

  @Column({ name: 'module_key', type: 'varchar', length: 64 })
  moduleKey!: string;

  @Column({ name: 'tab_key', type: 'varchar', length: 64 })
  tabKey!: string;

  @Column({ name: 'item_name', type: 'varchar', length: 128 })
  itemName!: string;

  @Column({ name: 'required_count', type: 'int', default: 1 })
  requiredCount!: number;

  @Column({ name: 'matched_count', type: 'int', default: 0 })
  matchedCount!: number;

  @Column({ name: 'matched_record_ids', type: 'longtext', nullable: true })
  matchedRecordIds!: null | string;

  @Column({ name: 'missing_fields', type: 'longtext', nullable: true })
  missingFields!: null | string;

  @Column({ name: 'attachment_missing', type: 'tinyint', default: 0 })
  attachmentMissing!: number;

  @Column({ name: 'check_status', type: 'varchar', length: 32, default: 'missing' })
  checkStatus!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  suggestion!: null | string;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  score!: number | string;
}
