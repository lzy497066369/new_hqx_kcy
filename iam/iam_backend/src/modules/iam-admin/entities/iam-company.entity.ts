import { Column, Entity } from 'typeorm';

import { IamBaseEntity } from './iam-base.entity';

@Entity('iam_company')
export class IamCompanyEntity extends IamBaseEntity {
  @Column({ name: 'company_name', type: 'varchar', length: 128 })
  companyName!: string;

  @Column({ name: 'short_name', type: 'varchar', length: 128, nullable: true })
  shortName!: null | string;

  @Column({ name: 'credit_code', type: 'varchar', length: 64, nullable: true, unique: true })
  creditCode!: null | string;

  @Column({ name: 'legal_person', type: 'varchar', length: 64, nullable: true })
  legalPerson!: null | string;

  @Column({ name: 'contact_name', type: 'varchar', length: 64, nullable: true })
  contactName!: null | string;

  @Column({ name: 'contact_phone', type: 'varchar', length: 32, nullable: true })
  contactPhone!: null | string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  province!: null | string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  city!: null | string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  district!: null | string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @Column({ name: 'source_system', type: 'varchar', length: 64, nullable: true })
  sourceSystem!: null | string;

  @Column({ name: 'source_company_id', type: 'varchar', length: 64, nullable: true })
  sourceCompanyId!: null | string;
}
