import { Column, Entity, Index } from 'typeorm';

import type { PortalType } from '../../../common/types/portal-type';
import { BaseEntityModel } from './base.entity';

@Entity('sys_menu')
@Index('idx_sys_menu_app_portal', ['appCode', 'portalType'])
@Index('idx_sys_menu_app_portal_parent', ['appCode', 'portalType', 'parentId'])
export class MenuEntity extends BaseEntityModel {
  @Column({ name: 'portal_type', type: 'varchar', length: 16, default: 'admin' })
  @Index()
  portalType!: PortalType;

  @Column({ name: 'app_code', type: 'varchar', length: 64, default: 'kjqb' })
  appCode!: string;

  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  @Index()
  parentId!: string | null;

  @Column({ length: 128 })
  name!: string;

  @Column({ length: 255 })
  path!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  component!: string | null;

  @Column({ name: 'redirect_path', type: 'varchar', length: 255, nullable: true })
  redirectPath!: string | null;

  @Column({ name: 'menu_type', type: 'varchar', length: 32 })
  menuType!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  icon!: string | null;

  @Column({ type: 'varchar', length: 128 })
  title!: string;

  @Column({ name: 'order_num', type: 'int', default: 0 })
  orderNum!: number;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @Column({ name: 'auth_code', type: 'varchar', length: 128, nullable: true })
  authCode!: string | null;
}
