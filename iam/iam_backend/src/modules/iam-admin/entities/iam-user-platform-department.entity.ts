import { Column, Entity } from 'typeorm';

import { IamBaseEntity } from './iam-base.entity';

@Entity('iam_user_platform_department')
export class IamUserPlatformDepartmentEntity extends IamBaseEntity {
  @Column({ name: 'department_id', type: 'bigint' })
  departmentId!: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'is_primary', type: 'tinyint', default: 1 })
  isPrimary!: number;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;
}
