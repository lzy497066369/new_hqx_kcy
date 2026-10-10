import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_project_material_requirement_item')
@Index(['requirementId'])
@Index(['moduleKey', 'tabKey'])
@Index(['enabled'])
export class ProjectMaterialRequirementItemEntity extends BaseEntityModel {
  @Column({ name: 'requirement_id', type: 'bigint' })
  requirementId!: string;

  @Column({ name: 'module_key', type: 'varchar', length: 64 })
  moduleKey!: string;

  @Column({ name: 'tab_key', type: 'varchar', length: 64 })
  tabKey!: string;

  @Column({ name: 'item_name', type: 'varchar', length: 128 })
  itemName!: string;

  @Column({ name: 'requirement_desc', type: 'varchar', length: 500, nullable: true })
  requirementDesc!: null | string;

  @Column({ name: 'required_count', type: 'int', default: 1 })
  requiredCount!: number;

  @Column({ name: 'required_years', type: 'longtext', nullable: true })
  requiredYears!: null | string;

  @Column({ name: 'required_fields', type: 'longtext', nullable: true })
  requiredFields!: null | string;

  @Column({ name: 'attachment_required', type: 'tinyint', default: 0 })
  attachmentRequired!: number;

  @Column({ name: 'is_required', type: 'tinyint', default: 1 })
  isRequired!: number;

  @Column({ name: 'score_weight', type: 'decimal', precision: 8, scale: 2, default: 1 })
  scoreWeight!: number | string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'tinyint', default: 1 })
  enabled!: number;
}
