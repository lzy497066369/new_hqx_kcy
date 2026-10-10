import { Column, Entity, JoinColumn, ManyToOne, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';
import { PermissionEntity } from './permission.entity';
import { RoleEntity } from './role.entity';

@Entity('sys_role_permission')
@Index(['roleId', 'permissionId'], { unique: true })
export class RolePermissionEntity extends BaseEntityModel {
  @Column({ name: 'role_id', type: 'bigint' })
  roleId!: string;

  @Column({ name: 'permission_id', type: 'bigint' })
  permissionId!: string;

  @ManyToOne(() => RoleEntity, (item) => item.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'role_id' })
  role!: RoleEntity;

  @ManyToOne(() => PermissionEntity, (item) => item.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permission_id' })
  permission!: PermissionEntity;
}
