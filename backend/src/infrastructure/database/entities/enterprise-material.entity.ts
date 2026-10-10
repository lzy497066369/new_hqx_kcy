import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_enterprise_material')
@Index(['enterpriseId'])
export class EnterpriseMaterialEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'template_id', type: 'varchar', length: 64, nullable: true })
  templateId!: null | string;

  @Column({
    name: 'template_name',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  templateName!: null | string;

  @Column({
    name: 'material_type',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  materialType!: null | string;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName!: null | string;

  @Column({ name: 'file_path', type: 'varchar', length: 500, nullable: true })
  filePath!: null | string;

  @Column({ type: 'varchar', length: 32, default: 'uploaded' })
  status!: string;

  @Column({ name: 'error_count', type: 'int', default: 0 })
  errorCount!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: null | string;
}
