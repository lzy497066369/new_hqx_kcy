import { Column, Entity } from 'typeorm';

import { IamBaseEntity } from './iam-base.entity';

@Entity('iam_user_app_context')
export class IamUserAppContextEntity extends IamBaseEntity {
  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'app_code', type: 'varchar', length: 64 })
  appCode!: string;

  @Column({ name: 'default_company_id', type: 'bigint', nullable: true })
  defaultCompanyId!: null | string;
}
