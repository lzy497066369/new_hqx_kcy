import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('biz_tianyancha_api_call_log')
@Index(['apiCode'])
@Index(['enterpriseId'])
@Index(['tycEnterpriseId'])
@Index(['creditCode'])
@Index(['companyName'])
@Index(['responseStatus'])
@Index(['createdAt'])
@Index(['createdBy'])
export class TianyanchaApiCallLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'api_code', type: 'varchar', length: 64 })
  apiCode!: string;

  @Column({ name: 'api_name', type: 'varchar', length: 128 })
  apiName!: string;

  @Column({ name: 'api_url', type: 'varchar', length: 255 })
  apiUrl!: string;

  @Column({ name: 'http_method', type: 'varchar', length: 16 })
  httpMethod!: string;

  @Column({ name: 'request_keyword', type: 'varchar', length: 128, nullable: true })
  requestKeyword!: null | string;

  @Column({ name: 'request_params_json', type: 'longtext', nullable: true })
  requestParamsJson!: null | string;

  @Column({ name: 'request_body_json', type: 'longtext', nullable: true })
  requestBodyJson!: null | string;

  @Column({ name: 'request_headers_masked_json', type: 'longtext', nullable: true })
  requestHeadersMaskedJson!: null | string;

  @Column({ name: 'response_status', type: 'varchar', length: 32 })
  responseStatus!: string;

  @Column({ name: 'http_status', type: 'int', nullable: true })
  httpStatus!: null | number;

  @Column({ name: 'tyc_code', type: 'varchar', length: 64, nullable: true })
  tycCode!: null | string;

  @Column({ name: 'tyc_message', type: 'varchar', length: 255, nullable: true })
  tycMessage!: null | string;

  @Column({ name: 'response_json', type: 'longtext', nullable: true })
  responseJson!: null | string;

  @Column({ name: 'response_hash', type: 'char', length: 64, nullable: true })
  responseHash!: null | string;

  @Column({ name: 'enterprise_id', type: 'bigint', nullable: true })
  enterpriseId!: null | string;

  @Column({ name: 'tyc_enterprise_id', type: 'varchar', length: 64, nullable: true })
  tycEnterpriseId!: null | string;

  @Column({ name: 'credit_code', type: 'varchar', length: 64, nullable: true })
  creditCode!: null | string;

  @Column({ name: 'company_name', type: 'varchar', length: 128, nullable: true })
  companyName!: null | string;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs!: null | number;

  @Column({ name: 'error_message', type: 'varchar', length: 500, nullable: true })
  errorMessage!: null | string;

  @Column({ name: 'created_by', type: 'varchar', length: 64, nullable: true })
  createdBy!: null | string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
