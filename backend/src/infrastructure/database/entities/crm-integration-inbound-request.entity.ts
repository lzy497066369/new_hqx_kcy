import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_crm_integration_inbound_request')
@Index(['clientId', 'requestType', 'sourceRequestHash'], { unique: true })
@Index(['processStatus'])
@Index(['createdAt'])
export class CrmIntegrationInboundRequestEntity extends BaseEntityModel {
  @Column({ name: 'client_id', type: 'bigint' })
  clientId!: string;

  @Column({ name: 'key_id', type: 'varchar', length: 64 })
  keyId!: string;

  @Column({ name: 'request_type', type: 'varchar', length: 32 })
  requestType!: 'contract' | 'execution_order';

  @Column({ name: 'source_request_id', type: 'varchar', length: 128 })
  sourceRequestId!: string;

  @Column({ name: 'source_request_hash', type: 'char', length: 64 })
  sourceRequestHash!: string;

  @Column({ name: 'body_hash', type: 'char', length: 64 })
  bodyHash!: string;

  @Column({ name: 'request_json', type: 'longtext' })
  requestJson!: string;

  @Column({ name: 'request_ip', type: 'varchar', length: 64, nullable: true })
  requestIp!: null | string;

  @Column({ name: 'process_status', type: 'varchar', length: 32, default: 'accepted' })
  processStatus!: 'accepted' | 'failed' | 'processing' | 'skipped' | 'success';

  @Column({ name: 'failure_reason', type: 'varchar', length: 1000, nullable: true })
  failureReason!: null | string;

  @Column({ name: 'sync_record_type', type: 'varchar', length: 32, nullable: true })
  syncRecordType!: null | 'contract' | 'execution_order';

  @Column({ name: 'sync_record_id', type: 'bigint', nullable: true })
  syncRecordId!: null | string;

  @Column({ name: 'processed_at', type: 'datetime', nullable: true })
  processedAt!: Date | null;
}
