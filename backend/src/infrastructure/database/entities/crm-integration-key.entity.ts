import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_crm_integration_key')
@Index(['clientId', 'keyId'], { unique: true })
@Index(['clientId'])
@Index(['status'])
export class CrmIntegrationKeyEntity extends BaseEntityModel {
  @Column({ name: 'client_id', type: 'bigint' })
  clientId!: string;

  @Column({ name: 'key_id', type: 'varchar', length: 64 })
  keyId!: string;

  @Column({ name: 'secret_encrypted', type: 'longtext' })
  secretEncrypted!: string;

  @Column({ name: 'scopes', type: 'varchar', length: 255, default: 'contracts,execution_orders,status' })
  scopes!: string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'last_used_at', type: 'datetime', nullable: true })
  lastUsedAt!: Date | null;
}
