import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_enterprise_contact')
@Index(['enterpriseId'])
export class EnterpriseContactEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone!: null | string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  email!: null | string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  position!: null | string;

  @Column({ name: 'role_name', type: 'varchar', length: 64, nullable: true })
  roleName!: null | string;

  @Column({ name: 'is_default', type: 'tinyint', default: 0 })
  isDefault!: number;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: null | string;
}
