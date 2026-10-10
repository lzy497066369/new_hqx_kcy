import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('sys_dept')
export class DeptEntity extends BaseEntityModel {
  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  @Index()
  parentId!: string | null;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: string | null;

  @Column({ name: 'sort_num', type: 'int', default: 0 })
  sortNum!: number;
}
