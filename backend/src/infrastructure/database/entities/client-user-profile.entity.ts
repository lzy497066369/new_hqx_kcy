import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_client_user_profile')
@Index(['userId'], { unique: true })
export class ClientUserProfileEntity extends BaseEntityModel {
  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({
    name: 'current_enterprise_id',
    type: 'bigint',
    nullable: true,
  })
  currentEnterpriseId!: null | string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  position!: null | string;

  @Column({ name: 'role_name', type: 'varchar', length: 64, nullable: true })
  roleName!: null | string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: null | string;
}
