import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_enterprise_photo_record')
@Index(['enterpriseId', 'status'])
export class EnterprisePhotoRecordEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'photo_title', type: 'varchar', length: 255, nullable: true })
  photoTitle!: null | string;

  @Column({ name: 'photo_status', type: 'int', nullable: true })
  photoStatus!: null | number;

  @Column({ name: 'ps_date', type: 'varchar', length: 32, nullable: true })
  psDate!: null | string;

  @Column({ name: 'photo_des', type: 'varchar', length: 1000, nullable: true })
  photoDes!: null | string;

  @Column({ name: 'photo_files', type: 'varchar', length: 2000, nullable: true })
  photoFiles!: null | string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;
}
