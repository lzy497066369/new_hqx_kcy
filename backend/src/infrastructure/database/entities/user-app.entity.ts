import { Column, Entity, Index } from 'typeorm';

import type { PortalType } from '../../../common/types/portal-type';
import { BaseEntityModel } from './base.entity';

@Entity('sys_user_app')
@Index('uk_sys_user_app_portal', ['userId', 'appCode', 'portalType'], {
  unique: true,
})
export class UserAppEntity extends BaseEntityModel {
  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'app_code', type: 'varchar', length: 64 })
  appCode!: string;

  @Column({ name: 'portal_type', type: 'varchar', length: 16, default: 'admin' })
  portalType!: PortalType;

  @Column({ name: 'home_path', type: 'varchar', length: 255, nullable: true })
  homePath!: string | null;

  @Column({ name: 'is_default', type: 'tinyint', default: 0 })
  isDefault!: number;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;
}
