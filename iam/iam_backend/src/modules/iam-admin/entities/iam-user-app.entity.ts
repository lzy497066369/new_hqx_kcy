import { Column, Entity } from 'typeorm';

import { IamBaseEntity } from './iam-base.entity';

@Entity('iam_user_app')
export class IamUserAppEntity extends IamBaseEntity {
  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'app_code', type: 'varchar', length: 64 })
  appCode!: string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @Column({ name: 'home_path', type: 'varchar', length: 255, nullable: true })
  homePath!: null | string;
}
