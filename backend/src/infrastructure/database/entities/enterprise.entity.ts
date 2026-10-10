import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_enterprise')
@Index(['code'], { unique: true })
@Index(['creditCode'], { unique: true })
export class EnterpriseEntity extends BaseEntityModel {
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ name: 'short_name', type: 'varchar', length: 128, nullable: true })
  shortName!: null | string;

  @Column({ name: 'credit_code', type: 'varchar', length: 64, nullable: true })
  creditCode!: string | null;

  @Index('idx_biz_enterprise_region')
  @Column({ name: 'region_id', type: 'bigint', nullable: true })
  regionId!: string | null;

  @Column({ name: 'sales_owner', type: 'varchar', length: 64, nullable: true })
  salesOwner!: string | null;

  // simple-json stores the selection as TEXT, including on MySQL 5.6.
  @Column({ name: 'enterprise_projects', type: 'simple-json', nullable: true })
  enterpriseProjects!: string[] | null;

  @Column({ name: 'pre_declaration_year', type: 'smallint', nullable: true })
  preDeclarationYear!: number | null;

  @Column({ name: 'legal_person', type: 'varchar', length: 64, nullable: true })
  legalPerson!: null | string;

  @Column({ name: 'contact_name', type: 'varchar', length: 64, nullable: true })
  contactName!: null | string;

  @Column({ name: 'contact_phone', type: 'varchar', length: 32, nullable: true })
  contactPhone!: null | string;

  @Column({ name: 'contact_email', type: 'varchar', length: 128, nullable: true })
  contactEmail!: null | string;

  @Column({ name: 'industry', type: 'varchar', length: 128, nullable: true })
  industry!: null | string;

  @Column({ name: 'enterprise_type', type: 'varchar', length: 64, nullable: true })
  enterpriseType!: null | string;

  @Column({ name: 'province', type: 'varchar', length: 64, nullable: true })
  province!: null | string;

  @Column({ name: 'city', type: 'varchar', length: 64, nullable: true })
  city!: null | string;

  @Column({ name: 'district', type: 'varchar', length: 64, nullable: true })
  district!: null | string;

  @Column({ name: 'address', type: 'varchar', length: 255, nullable: true })
  address!: null | string;

  @Column({ name: 'profile_status', type: 'varchar', length: 32, default: 'draft' })
  profileStatus!: string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  source!: null | string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: null | string;
}
