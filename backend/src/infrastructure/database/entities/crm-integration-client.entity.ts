import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_crm_integration_client')
@Index(['appId'], { unique: true })
@Index(['status'])
export class CrmIntegrationClientEntity extends BaseEntityModel {
  @Column({ name: 'app_id', type: 'varchar', length: 64 })
  appId!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ name: 'allowed_ip_cidrs', type: 'varchar', length: 1000, nullable: true })
  allowedIpCidrs!: null | string;

  @Column({ name: 'rate_limit_per_minute', type: 'int', default: 60 })
  rateLimitPerMinute!: number;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;
}
