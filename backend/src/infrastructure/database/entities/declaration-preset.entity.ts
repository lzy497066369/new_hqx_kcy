import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

export type DeclarationPresetType =
  | 'enterprise'
  | 'flow'
  | 'material'
  | 'qualification'
  | 'score';

@Entity('biz_declaration_preset')
@Index(['presetType', 'status'])
@Index(['presetType', 'name', 'version'], { unique: true })
export class DeclarationPresetEntity extends BaseEntityModel {
  @Column({ name: 'preset_type', type: 'varchar', length: 32 })
  presetType!: DeclarationPresetType;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 32, default: 'v1' })
  version!: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: 'draft' | 'published';

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: null | string;

  @Column({ name: 'payload_json', type: 'longtext' })
  payloadJson!: string;
}
