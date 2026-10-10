import { Column, Entity, Index, OneToMany } from 'typeorm';

import type { PortalType } from '../../../common/types/portal-type';
import { BaseEntityModel } from './base.entity';
import { RolePermissionEntity } from './role-permission.entity';

@Entity('sys_permission')
@Index('uk_sys_permission_app_portal_code', ['appCode', 'portalType', 'code'], {
  unique: true,
})
export class PermissionEntity extends BaseEntityModel {
  @Column({ name: 'portal_type', type: 'varchar', length: 16, default: 'admin' })
  portalType!: PortalType;

  @Column({ name: 'app_code', type: 'varchar', length: 64, default: 'kjqb' })
  appCode!: string;

  @Column({ length: 128 })
  code!: string;

  @Column({ length: 128 })
  name!: string;

  @Column({ length: 32 })
  type!: string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @OneToMany(() => RolePermissionEntity, (item) => item.permission)
  rolePermissions?: RolePermissionEntity[];
}
