import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_declaration_scheme')
@Index(['projectId', 'status'])
@Index(['regionId', 'status'])
export class DeclarationSchemeEntity extends BaseEntityModel {
  @Column({ name: 'project_id', type: 'bigint' })
  projectId!: string;

  @Column({ name: 'region_id', type: 'bigint', nullable: true })
  regionId!: null | string;

  @Column({ name: 'scheme_name', type: 'varchar', length: 128 })
  schemeName!: string;

  @Column({ type: 'varchar', length: 32, default: 'v1' })
  version!: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: 'draft' | 'published';

  @Column({ name: 'effective_start_date', type: 'date', nullable: true })
  effectiveStartDate!: Date | null;

  @Column({ name: 'effective_end_date', type: 'date', nullable: true })
  effectiveEndDate!: Date | null;

  @Column({ name: 'enterprise_preset_id', type: 'bigint', nullable: true })
  enterprisePresetId!: null | string;

  @Column({ name: 'enterprise_preset_json', type: 'longtext', nullable: true })
  enterprisePresetJson!: null | string;

  @Column({ name: 'qualification_preset_id', type: 'bigint', nullable: true })
  qualificationPresetId!: null | string;

  @Column({ name: 'qualification_rules_json', type: 'longtext', nullable: true })
  qualificationRulesJson!: null | string;

  @Column({ name: 'material_preset_id', type: 'bigint', nullable: true })
  materialPresetId!: null | string;

  @Column({ name: 'material_rules_json', type: 'longtext', nullable: true })
  materialRulesJson!: null | string;

  @Column({ name: 'score_preset_id', type: 'bigint', nullable: true })
  scorePresetId!: null | string;

  @Column({ name: 'score_rules_json', type: 'longtext', nullable: true })
  scoreRulesJson!: null | string;

  @Column({ name: 'flow_preset_id', type: 'bigint', nullable: true })
  flowPresetId!: null | string;

  @Column({ name: 'flow_template_json', type: 'longtext', nullable: true })
  flowTemplateJson!: null | string;

  @Column({ name: 'capabilities_json', type: 'longtext', nullable: true })
  capabilitiesJson!: null | string;
}
