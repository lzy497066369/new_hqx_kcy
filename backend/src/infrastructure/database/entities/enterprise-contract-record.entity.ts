import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_enterprise_contract_record')
@Index(['enterpriseId', 'recordType', 'status'])
export class EnterpriseContractRecordEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'record_type', type: 'varchar', length: 32 })
  recordType!: string;

  @Column({ name: 'ht_name', type: 'varchar', length: 255, nullable: true })
  htName!: null | string;

  @Column({ name: 'ht_num', type: 'varchar', length: 128, nullable: true })
  htNum!: null | string;

  @Column({ name: 'kh_name', type: 'varchar', length: 255, nullable: true })
  khName!: null | string;

  @Column({ name: 'qd_date', type: 'varchar', length: 32, nullable: true })
  qdDate!: null | string;

  @Column({ name: 'ht_money', type: 'varchar', length: 64, nullable: true })
  htMoney!: null | string;

  @Column({ name: 'ht_status', type: 'int', nullable: true })
  htStatus!: null | number;

  @Column({ name: 'start_date', type: 'varchar', length: 32, nullable: true })
  startDate!: null | string;

  @Column({ name: 'end_date', type: 'varchar', length: 32, nullable: true })
  endDate!: null | string;

  @Column({ name: 'ht_des', type: 'varchar', length: 1000, nullable: true })
  htDes!: null | string;

  @Column({ name: 'ht_path', type: 'varchar', length: 500, nullable: true })
  htPath!: null | string;

  @Column({ name: 'fp_num', type: 'varchar', length: 128, nullable: true })
  fpNum!: null | string;

  @Column({ name: 'ht_id', type: 'bigint', nullable: true })
  htId!: null | string;

  @Column({ name: 'fp_date', type: 'varchar', length: 32, nullable: true })
  fpDate!: null | string;

  @Column({ name: 'fp_money', type: 'varchar', length: 64, nullable: true })
  fpMoney!: null | string;

  @Column({ name: 'fp_status', type: 'int', nullable: true })
  fpStatus!: null | number;

  @Column({ name: 'zf_date', type: 'varchar', length: 32, nullable: true })
  zfDate!: null | string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: null | string;

  @Column({ name: 'fp_path', type: 'varchar', length: 500, nullable: true })
  fpPath!: null | string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;
}
