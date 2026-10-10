import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_crm_contract_sync_record')
@Index(['sourceRequestId'], { unique: true })
@Index(['sourceRecordId'])
@Index(['contractNo'])
@Index(['sourceUpdatedAt'])
@Index(['eventType'])
@Index(['companyName'])
@Index(['enterpriseId'])
@Index(['processStatus'])
export class CrmContractSyncRecordEntity extends BaseEntityModel {
  @Column({ name: 'source_request_id', type: 'varchar', length: 128 })
  sourceRequestId!: string;

  @Column({ name: 'source_record_id', type: 'varchar', length: 128, nullable: true })
  sourceRecordId!: null | string;

  @Column({ name: 'source_updated_at', type: 'datetime', nullable: true })
  sourceUpdatedAt!: Date | null;

  @Column({ name: 'source_version', type: 'varchar', length: 64, nullable: true })
  sourceVersion!: null | string;

  @Column({ name: 'event_type', type: 'varchar', length: 32, default: 'created' })
  eventType!: string;

  @Column({ name: 'sequence_no', type: 'varchar', length: 64, nullable: true })
  sequenceNo!: null | string;

  @Column({ name: 'contract_no', type: 'varchar', length: 128, nullable: true })
  contractNo!: null | string;

  @Column({ name: 'customer_contract_no', type: 'varchar', length: 128, nullable: true })
  customerContractNo!: null | string;

  @Column({ name: 'vendor_name', type: 'varchar', length: 128, nullable: true })
  vendorName!: null | string;

  @Column({ name: 'contract_name', type: 'varchar', length: 255, nullable: true })
  contractName!: null | string;

  @Column({ name: 'account_manager_name', type: 'varchar', length: 64, nullable: true })
  accountManagerName!: null | string;

  @Column({ name: 'company_name', type: 'varchar', length: 255 })
  companyName!: string;

  @Column({ name: 'enterprise_id', type: 'bigint', nullable: true })
  enterpriseId!: null | string;

  @Column({ name: 'enterprise_name', type: 'varchar', length: 255, nullable: true })
  enterpriseName!: null | string;

  @Column({ name: 'import_result_json', type: 'longtext', nullable: true })
  importResultJson!: null | string;

  @Column({ name: 'payload_json', type: 'longtext' })
  payloadJson!: string;

  @Column({ name: 'process_status', type: 'varchar', length: 32, default: 'received' })
  processStatus!: string;

  @Column({ name: 'failure_reason', type: 'varchar', length: 1000, nullable: true })
  failureReason!: null | string;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number;

  @Column({ name: 'last_processed_at', type: 'datetime', nullable: true })
  lastProcessedAt!: Date | null;
}
