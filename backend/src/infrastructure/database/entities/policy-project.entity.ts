import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_policy_project')
@Index(['code'], { unique: true })
export class PolicyProjectEntity extends BaseEntityModel {
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ name: 'policy_type', type: 'varchar', length: 128, nullable: true })
  policyType!: string | null;

  @Column({ name: 'applicable_objects', type: 'varchar', length: 255, nullable: true })
  applicableObjects!: string | null;

  @Column({ name: 'basic_description', type: 'text', nullable: true })
  basicDescription!: string | null;

  @Column({ type: 'tinyint', default: 1 })
  enabled!: number;

  @Column({ name: 'sort_num', type: 'int', default: 0 })
  sortNum!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: string | null;
}
