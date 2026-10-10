import { Column, Entity } from 'typeorm';

import { IamBaseEntity } from './iam-base.entity';

@Entity('iam_user_company_scope')
export class IamUserCompanyScopeEntity extends IamBaseEntity {
  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'app_code', type: 'varchar', length: 64 })
  appCode!: string;

  @Column({ name: 'company_id', type: 'bigint' })
  companyId!: string;

  @Column({ name: 'relation_type', type: 'varchar', length: 32 })
  relationType!: string;

  @Column({ name: 'data_scope', type: 'varchar', length: 32, default: 'assigned' })
  dataScope!: string;

  @Column({ name: 'is_default', type: 'tinyint', default: 0 })
  isDefault!: number;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;
}
