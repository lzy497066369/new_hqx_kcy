import { Column, Entity, Index } from 'typeorm';

import type { PortalType } from '../../../common/types/portal-type';
import { BaseEntityModel } from './base.entity';

@Entity('sys_app')
@Index('uk_sys_app_code', ['code'], { unique: true })
export class AppEntity extends BaseEntityModel {
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ name: 'default_portal', type: 'varchar', length: 16, default: 'admin' })
  defaultPortal!: PortalType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: string | null;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;
}
