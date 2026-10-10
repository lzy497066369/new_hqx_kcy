import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntityModel } from './base.entity';
import { EnterpriseEntity } from './enterprise.entity';

@Entity('biz_enterprise_basic_info')
@Index(['enterpriseId'], { unique: true })
@Index(['creditCode'])
@Index(['name'])
@Index(['tycEnterpriseId'])
export class EnterpriseBasicInfoEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'tyc_enterprise_id', type: 'varchar', length: 64, nullable: true })
  tycEnterpriseId!: null | string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  alias!: null | string;

  @Column({ name: 'history_names', type: 'longtext', nullable: true })
  historyNames!: null | string;

  @Column({ name: 'reg_status', type: 'varchar', length: 64, nullable: true })
  regStatus!: null | string;

  @Column({ name: 'legal_person_name', type: 'varchar', length: 64, nullable: true })
  legalPersonName!: null | string;

  @Column({ name: 'legal_person_type', type: 'varchar', length: 64, nullable: true })
  legalPersonType!: null | string;

  @Column({ name: 'credit_code', type: 'varchar', length: 64, nullable: true })
  creditCode!: null | string;

  @Column({ name: 'reg_number', type: 'varchar', length: 64, nullable: true })
  regNumber!: null | string;

  @Column({ name: 'org_number', type: 'varchar', length: 64, nullable: true })
  orgNumber!: null | string;

  @Column({ name: 'tax_number', type: 'varchar', length: 64, nullable: true })
  taxNumber!: null | string;

  @Column({ name: 'reg_capital', type: 'varchar', length: 64, nullable: true })
  regCapital!: null | string;

  @Column({ name: 'actual_capital', type: 'varchar', length: 64, nullable: true })
  actualCapital!: null | string;

  @Column({ name: 'company_org_type', type: 'varchar', length: 128, nullable: true })
  companyOrgType!: null | string;

  @Column({ name: 'establish_time', type: 'datetime', nullable: true })
  establishTime!: Date | null;

  @Column({ name: 'approved_time', type: 'datetime', nullable: true })
  approvedTime!: Date | null;

  @Column({ name: 'from_time', type: 'datetime', nullable: true })
  fromTime!: Date | null;

  @Column({ name: 'to_time', type: 'datetime', nullable: true })
  toTime!: Date | null;

  @Column({ name: 'reg_institute', type: 'varchar', length: 128, nullable: true })
  regInstitute!: null | string;

  @Column({ name: 'reg_location', type: 'varchar', length: 255, nullable: true })
  regLocation!: null | string;

  @Column({ name: 'business_scope', type: 'longtext', nullable: true })
  businessScope!: null | string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  industry!: null | string;

  @Column({ name: 'category_code_first', type: 'varchar', length: 64, nullable: true })
  categoryCodeFirst!: null | string;

  @Column({ name: 'category_code_second', type: 'varchar', length: 64, nullable: true })
  categoryCodeSecond!: null | string;

  @Column({ name: 'category_code_third', type: 'varchar', length: 64, nullable: true })
  categoryCodeThird!: null | string;

  @Column({ name: 'category_code_fourth', type: 'varchar', length: 64, nullable: true })
  categoryCodeFourth!: null | string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  province!: null | string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  city!: null | string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  district!: null | string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  base!: null | string;

  @Column({ name: 'phone_number', type: 'varchar', length: 64, nullable: true })
  phoneNumber!: null | string;

  @Column({ name: 'phone_list_json', type: 'longtext', nullable: true })
  phoneListJson!: null | string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  email!: null | string;

  @Column({ name: 'email_list_json', type: 'longtext', nullable: true })
  emailListJson!: null | string;

  @Column({ name: 'website_list_json', type: 'longtext', nullable: true })
  websiteListJson!: null | string;

  @Column({ name: 'staff_num_range', type: 'varchar', length: 64, nullable: true })
  staffNumRange!: null | string;

  @Column({ name: 'social_staff_num', type: 'varchar', length: 32, nullable: true })
  socialStaffNum!: null | string;

  @Column({ name: 'bond_name', type: 'varchar', length: 128, nullable: true })
  bondName!: null | string;

  @Column({ name: 'bond_num', type: 'varchar', length: 64, nullable: true })
  bondNum!: null | string;

  @Column({ name: 'used_bond_name', type: 'varchar', length: 128, nullable: true })
  usedBondName!: null | string;

  @Column({ name: 'stock_type', type: 'varchar', length: 64, nullable: true })
  stockType!: null | string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo!: null | string;

  @Column({ name: 'tags_json', type: 'longtext', nullable: true })
  tagsJson!: null | string;

  @Column({ name: 'is_micro_ent', type: 'tinyint', nullable: true })
  isMicroEnt!: null | number;

  @Column({ name: 'percentile_score', type: 'varchar', length: 32, nullable: true })
  percentileScore!: null | string;

  @Column({ name: 'brn_number', type: 'varchar', length: 64, nullable: true })
  brnNumber!: null | string;

  @Column({ name: 'extra_json', type: 'longtext', nullable: true })
  extraJson!: null | string;

  @ManyToOne(() => EnterpriseEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'enterprise_id' })
  enterprise!: EnterpriseEntity;
}
