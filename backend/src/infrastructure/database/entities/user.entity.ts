import { Column, Entity, OneToMany } from 'typeorm';

import type { PortalType } from '../../../common/types/portal-type';
import { BaseEntityModel } from './base.entity';
import { DeptEntity } from './dept.entity';
import { UserRoleEntity } from './user-role.entity';

@Entity('sys_user')
export class UserEntity extends BaseEntityModel {
  @Column({ name: 'portal_type', type: 'varchar', length: 16, default: 'admin' })
  portalType!: PortalType;

  @Column({ type: 'varchar', length: 64, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 255 })
  password!: string;

  @Column({ name: 'real_name', type: 'varchar', length: 64 })
  realName!: string;

  @Column({ name: 'home_path', type: 'varchar', length: 255, nullable: true })
  homePath!: string | null;

  @Column({ name: 'avatar_path', type: 'varchar', length: 500, nullable: true })
  avatarPath!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  email!: string | null;

  @Column({ name: 'dept_id', type: 'bigint', nullable: true })
  deptId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: string | null;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @Column({ name: 'dept_name', type: 'varchar', length: 64, nullable: true })
  deptName!: string | null;

  @OneToMany(() => UserRoleEntity, (item) => item.user)
  userRoles?: UserRoleEntity[];
}
