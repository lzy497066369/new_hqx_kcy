import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_enterprise_certificate_record')
@Index(['enterpriseId', 'status'])
export class EnterpriseCertificateRecordEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'zs_name', type: 'varchar', length: 255, nullable: true })
  zsName!: null | string;

  @Column({ name: 'zs_class', type: 'int', nullable: true })
  zsClass!: null | number;

  @Column({ name: 'qualification_code', type: 'varchar', length: 64, nullable: true })
  qualificationCode!: null | string;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil!: Date | null;

  @Column({ name: 'zs_path', type: 'varchar', length: 1000, nullable: true })
  zsPath!: null | string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;
}
