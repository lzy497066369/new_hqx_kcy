import { Column, Entity } from 'typeorm';

import { IamBaseEntity } from './iam-base.entity';

@Entity('iam_app')
export class IamAppEntity extends IamBaseEntity {
  @Column({ name: 'app_code', type: 'varchar', length: 64, unique: true })
  appCode!: string;

  @Column({ name: 'app_name', type: 'varchar', length: 128 })
  appName!: string;

  @Column({ name: 'app_type', type: 'varchar', length: 32, default: 'web' })
  appType!: string;

  @Column({ name: 'portal_type', type: 'varchar', length: 32, default: 'admin' })
  portalType!: string;

  @Column({ name: 'company_source_system', type: 'varchar', length: 64, nullable: true })
  companySourceSystem!: null | string;

  @Column({ name: 'home_path', type: 'varchar', length: 255, nullable: true })
  homePath!: null | string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: null | string;
}
