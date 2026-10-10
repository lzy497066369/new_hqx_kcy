import { Column, Entity } from 'typeorm';

import { IamBaseEntity } from './iam-base.entity';

@Entity('iam_company_member')
export class IamCompanyMemberEntity extends IamBaseEntity {
  @Column({ name: 'company_id', type: 'bigint' })
  companyId!: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'app_code', type: 'varchar', length: 64 })
  appCode!: string;

  @Column({ name: 'member_type', type: 'varchar', length: 32 })
  memberType!: string;

  @Column({ name: 'is_primary', type: 'tinyint', default: 0 })
  isPrimary!: number;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;
}
