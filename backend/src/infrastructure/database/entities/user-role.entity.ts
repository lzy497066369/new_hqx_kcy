import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';
import { RoleEntity } from './role.entity';
import { UserEntity } from './user.entity';

@Entity('sys_user_role')
@Index(['userId', 'roleId'], { unique: true })
export class UserRoleEntity extends BaseEntityModel {
  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'role_id', type: 'bigint' })
  roleId!: string;

  @ManyToOne(() => UserEntity, (item) => item.userRoles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @ManyToOne(() => RoleEntity, (item) => item.userRoles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'role_id' })
  role!: RoleEntity;
}
