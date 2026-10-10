import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_crm_execution_order_sync_record')
@Index(['sourceRequestId'], { unique: true })
@Index(['sourceRecordId'])
@Index(['orderNo'])
@Index(['companyName'])
@Index(['contractNo'])
@Index(['sourceUpdatedAt'])
@Index(['eventType'])
@Index(['enterpriseId'])
@Index(['processStatus'])
export class CrmExecutionOrderSyncRecordEntity extends BaseEntityModel {
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

  @Column({ name: 'order_no', type: 'varchar', length: 128 })
  orderNo!: string;

  @Column({ name: 'company_name', type: 'varchar', length: 255 })
  companyName!: string;

  @Column({ name: 'contract_no', type: 'varchar', length: 128, nullable: true })
  contractNo!: null | string;

  @Column({ name: 'contract_review_status', type: 'varchar', length: 64, nullable: true })
  contractReviewStatus!: null | string;

  @Column({ name: 'execution_order_name', type: 'varchar', length: 500 })
  executionOrderName!: string;

  @Column({ name: 'is_carried_forward', type: 'varchar', length: 32, nullable: true })
  isCarriedForward!: null | string;

  @Column({ name: 'execution_department', type: 'varchar', length: 128, nullable: true })
  executionDepartment!: null | string;

  @Column({ name: 'account_manager_name', type: 'varchar', length: 64, nullable: true })
  accountManagerName!: null | string;

  @Column({ name: 'product_manager_name', type: 'varchar', length: 64, nullable: true })
  productManagerName!: null | string;

  @Column({ name: 'enterprise_id', type: 'bigint', nullable: true })
  enterpriseId!: null | string;

  @Column({ name: 'enterprise_name', type: 'varchar', length: 255, nullable: true })
  enterpriseName!: null | string;

  @Column({ name: 'recognized_project_codes', type: 'varchar', length: 255, nullable: true })
  recognizedProjectCodes!: null | string;

  @Column({ name: 'intellectual_property_count', type: 'int', nullable: true })
  intellectualPropertyCount!: null | number;

  @Column({ name: 'declaration_ids_json', type: 'longtext', nullable: true })
  declarationIdsJson!: null | string;

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
