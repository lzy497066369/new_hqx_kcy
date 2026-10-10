import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_crm_integration_nonce')
@Index(['clientId', 'nonce'], { unique: true })
@Index(['expiresAt'])
export class CrmIntegrationNonceEntity extends BaseEntityModel {
  @Column({ name: 'client_id', type: 'bigint' })
  clientId!: string;

  @Column({ type: 'varchar', length: 128 })
  nonce!: string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date;
}
