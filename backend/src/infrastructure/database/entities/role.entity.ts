import { Column, Entity, Index, OneToMany } from 'typeorm';

import type { PortalType } from '../../../common/types/portal-type';
import { BaseEntityModel } from './base.entity';
import { RolePermissionEntity } from './role-permission.entity';
import { UserRoleEntity } from './user-role.entity';

@Entity('sys_role')
@Index('uk_sys_role_app_portal_code', ['appCode', 'portalType', 'code'], {
  unique: true,
})
export class RoleEntity extends BaseEntityModel {
  @Column({ name: 'portal_type', type: 'varchar', length: 16, default: 'admin' })
  portalType!: PortalType;

  @Column({ name: 'app_code', type: 'varchar', length: 64, default: 'kjqb' })
  appCode!: string;

  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: string | null;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @OneToMany(() => UserRoleEntity, (item) => item.role)
  userRoles?: UserRoleEntity[];

  @OneToMany(() => RolePermissionEntity, (item) => item.role)
  rolePermissions?: RolePermissionEntity[];
}
