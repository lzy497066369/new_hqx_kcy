import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_region')
@Index(['parentId'])
@Index(['level'])
@Index(['status'])
export class RegionEntity extends BaseEntityModel {
  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  parentId!: string | null;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ type: 'varchar', length: 16 })
  level!: string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @Column({ name: 'sort_num', type: 'int', default: 0 })
  sortNum!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: string | null;
}
