import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_enterprise_employee_record')
@Index(['enterpriseId', 'status'])
export class EnterpriseEmployeeRecordEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'yg_name', type: 'varchar', length: 128, nullable: true })
  ygName!: null | string;

  @Column({ name: 'yg_sex', type: 'int', nullable: true })
  ygSex!: null | number;

  @Column({ name: 'yg_lx', type: 'int', nullable: true })
  ygLx!: null | number;

  @Column({ name: 'yg_xl', type: 'int', nullable: true })
  ygXl!: null | number;

  @Column({ name: 'yg_zc', type: 'int', nullable: true })
  ygZc!: null | number;

  @Column({ name: 'yg_nl', type: 'int', nullable: true })
  ygNl!: null | number;

  @Column({ name: 'id_card', type: 'varchar', length: 32, nullable: true })
  idCard!: null | string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  department!: null | string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  position!: null | string;

  @Column({ name: 'entry_date', type: 'varchar', length: 32, nullable: true })
  entryDate!: null | string;

  @Column({ name: 'is_active', type: 'int', nullable: true })
  isActive!: null | number;

  @Column({ name: 'is_kjyf', type: 'int', nullable: true })
  isKjyf!: null | number;

  @Column({ name: 'rd_projects', type: 'varchar', length: 500, nullable: true })
  rdProjects!: null | string;

  @Column({ name: 'annual_work_days', type: 'int', nullable: true })
  annualWorkDays!: null | number;

  @Column({ name: 'yg_wj', type: 'int', nullable: true })
  ygWj!: null | number;

  @Column({ name: 'yg_lxgg', type: 'int', nullable: true })
  ygLxgg!: null | number;

  @Column({ name: 'yg_qr', type: 'int', nullable: true })
  ygQr!: null | number;

  @Column({ name: 'yg_files', type: 'varchar', length: 500, nullable: true })
  ygFiles!: null | string;

  @Column({ name: 'labor_contract_file', type: 'varchar', length: 500, nullable: true })
  laborContractFile!: null | string;

  @Column({ name: 'social_security_file', type: 'varchar', length: 500, nullable: true })
  socialSecurityFile!: null | string;

  @Column({ name: 'education_file', type: 'varchar', length: 500, nullable: true })
  educationFile!: null | string;

  @Column({ name: 'title_file', type: 'varchar', length: 500, nullable: true })
  titleFile!: null | string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: null | string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;
}
