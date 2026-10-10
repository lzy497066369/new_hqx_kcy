import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_enterprise_material_parse_error')
@Index(['enterpriseId', 'materialId'])
export class EnterpriseMaterialParseErrorEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'material_id', type: 'bigint' })
  materialId!: string;

  @Column({ name: 'sheet_name', type: 'varchar', length: 64, nullable: true })
  sheetName!: null | string;

  @Column({ name: 'row_number', type: 'int', nullable: true })
  rowNumber!: null | number;

  @Column({ name: 'field_name', type: 'varchar', length: 128, nullable: true })
  fieldName!: null | string;

  @Column({ name: 'raw_value', type: 'varchar', length: 500, nullable: true })
  rawValue!: null | string;

  @Column({ name: 'error_message', type: 'varchar', length: 255 })
  errorMessage!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  suggestion!: null | string;
}
