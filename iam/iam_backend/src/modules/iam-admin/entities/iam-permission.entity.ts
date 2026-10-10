import { Column, Entity } from 'typeorm';

import { IamBaseEntity } from './iam-base.entity';

@Entity('iam_permission')
export class IamPermissionEntity extends IamBaseEntity {
  @Column({ name: 'app_code', type: 'varchar', length: 64 }) appCode!: string;
  @Column({ name: 'permission_code', type: 'varchar', length: 128 }) permissionCode!: string;
  @Column({ name: 'permission_name', type: 'varchar', length: 128 }) permissionName!: string;
  @Column({ name: 'resource_type', type: 'varchar', length: 32, default: 'api' }) resourceType!: string;
  @Column({ type: 'tinyint', default: 1 }) status!: number;
}
