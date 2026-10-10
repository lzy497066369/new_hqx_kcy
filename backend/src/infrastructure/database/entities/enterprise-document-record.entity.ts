import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_enterprise_document_record')
@Index(['enterpriseId', 'status'])
export class EnterpriseDocumentRecordEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'file_title', type: 'varchar', length: 255, nullable: true })
  fileTitle!: null | string;

  @Column({ name: 'file_class', type: 'int', nullable: true })
  fileClass!: null | number;

  @Column({ name: 'file_status', type: 'int', nullable: true })
  fileStatus!: null | number;

  @Column({ name: 'file_version', type: 'varchar', length: 64, nullable: true })
  fileVersion!: null | string;

  @Column({ name: 'file_start_date', type: 'varchar', length: 32, nullable: true })
  fileStartDate!: null | string;

  @Column({ name: 'file_remark', type: 'varchar', length: 1000, nullable: true })
  fileRemark!: null | string;

  @Column({ name: 'file_path', type: 'varchar', length: 500, nullable: true })
  filePath!: null | string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;
}
