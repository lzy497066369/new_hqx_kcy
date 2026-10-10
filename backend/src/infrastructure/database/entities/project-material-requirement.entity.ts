import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_project_material_requirement')
@Index(['projectId'])
@Index(['enabled'])
export class ProjectMaterialRequirementEntity extends BaseEntityModel {
  @Column({ name: 'project_id', type: 'bigint' })
  projectId!: string;

  @Column({ name: 'requirement_name', type: 'varchar', length: 128 })
  requirementName!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: null | string;

  @Column({ type: 'varchar', length: 32, default: 'v1' })
  version!: string;

  @Column({ type: 'tinyint', default: 1 })
  enabled!: number;
}
