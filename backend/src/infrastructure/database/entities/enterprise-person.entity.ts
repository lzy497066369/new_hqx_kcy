import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntityModel } from './base.entity';
import { EnterpriseEntity } from './enterprise.entity';
import { UserEntity } from './user.entity';

@Entity('biz_enterprise_person')
@Index(['enterpriseId', 'name', 'position'], { unique: true })
@Index(['tycPersonId'])
@Index(['accountUserId'])
export class EnterprisePersonEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'tyc_person_id', type: 'varchar', length: 64, nullable: true })
  tycPersonId!: null | string;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  position!: string;

  @Column({ name: 'person_type', type: 'varchar', length: 32, nullable: true })
  personType!: null | string;

  @Column({ name: 'is_legal_person', type: 'tinyint', default: 0 })
  isLegalPerson!: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone!: null | string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  email!: null | string;

  @Column({ name: 'account_user_id', type: 'bigint', nullable: true })
  accountUserId!: null | string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  source!: null | string;

  @Column({ name: 'extra_json', type: 'longtext', nullable: true })
  extraJson!: null | string;

  @ManyToOne(() => EnterpriseEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'enterprise_id' })
  enterprise!: EnterpriseEntity;

  @ManyToOne(() => UserEntity, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'account_user_id' })
  accountUser?: UserEntity | null;
}
