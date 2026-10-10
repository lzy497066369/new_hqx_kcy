import { Column, Entity } from 'typeorm';

import { IamBaseEntity } from './iam-base.entity';

@Entity('iam_platform_department')
export class IamPlatformDepartmentEntity extends IamBaseEntity {
  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  parentId!: null | string;

  @Column({ name: 'dept_code', type: 'varchar', length: 64 })
  deptCode!: string;

  @Column({ name: 'dept_name', type: 'varchar', length: 128 })
  deptName!: string;

  @Column({ name: 'leader_user_id', type: 'bigint', nullable: true })
  leaderUserId!: null | string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: null | string;

  @Column({ name: 'source_system', type: 'varchar', length: 64, nullable: true })
  sourceSystem!: null | string;

  @Column({ name: 'source_department_id', type: 'varchar', length: 64, nullable: true })
  sourceDepartmentId!: null | string;
}
