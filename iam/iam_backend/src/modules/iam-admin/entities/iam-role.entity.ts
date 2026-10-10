import { Column, Entity } from 'typeorm';

import { IamBaseEntity } from './iam-base.entity';

@Entity('iam_role')
export class IamRoleEntity extends IamBaseEntity {
  @Column({ name: 'app_code', type: 'varchar', length: 64 }) appCode!: string;
  @Column({ name: 'role_code', type: 'varchar', length: 64 }) roleCode!: string;
  @Column({ name: 'role_name', type: 'varchar', length: 64 }) roleName!: string;
  @Column({ name: 'role_type', type: 'varchar', length: 32, default: 'custom' }) roleType!: string;
  @Column({ type: 'tinyint', default: 1 }) status!: number;
  @Column({ type: 'varchar', length: 255, nullable: true }) remark!: null | string;
}
