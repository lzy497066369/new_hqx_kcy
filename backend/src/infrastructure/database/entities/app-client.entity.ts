import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('sys_app_client')
@Index('uk_sys_app_client_id', ['clientId'], { unique: true })
export class AppClientEntity extends BaseEntityModel {
  @Column({ name: 'app_code', type: 'varchar', length: 64 })
  appCode!: string;

  @Column({ name: 'client_id', type: 'varchar', length: 128 })
  clientId!: string;

  @Column({ name: 'client_type', type: 'varchar', length: 32, default: 'public' })
  clientType!: string;

  @Column({ name: 'redirect_uris', type: 'text', nullable: true })
  redirectUris!: string | null;

  @Column({ name: 'post_logout_redirect_uris', type: 'text', nullable: true })
  postLogoutRedirectUris!: string | null;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;
}
