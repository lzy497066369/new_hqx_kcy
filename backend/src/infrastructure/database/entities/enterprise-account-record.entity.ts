import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_enterprise_account_record')
@Index(['enterpriseId', 'status'])
export class EnterpriseAccountRecordEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'pt_name', type: 'varchar', length: 255, nullable: true })
  ptName!: null | string;

  @Column({ name: 'pt_url', type: 'varchar', length: 500, nullable: true })
  ptUrl!: null | string;

  @Column({ name: 'zh_type', type: 'int', nullable: true })
  zhType!: null | number;

  @Column({ name: 'zh_number', type: 'varchar', length: 255, nullable: true })
  zhNumber!: null | string;

  @Column({ name: 'zh_password', type: 'varchar', length: 255, nullable: true })
  zhPassword!: null | string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  charge!: null | string;

  @Column({ name: 'b_phone', type: 'varchar', length: 64, nullable: true })
  bPhone!: null | string;

  @Column({ name: 'b_email', type: 'varchar', length: 128, nullable: true })
  bEmail!: null | string;

  @Column({ name: 'zh_status', type: 'int', nullable: true })
  zhStatus!: null | number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  gsbm!: null | string;

  @Column({ name: 'end_date', type: 'varchar', length: 32, nullable: true })
  endDate!: null | string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: null | string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;
}
