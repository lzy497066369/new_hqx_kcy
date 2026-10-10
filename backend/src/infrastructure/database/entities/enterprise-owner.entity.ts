import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntityModel } from './base.entity';
import { EnterpriseEntity } from './enterprise.entity';
import { UserEntity } from './user.entity';

@Entity('biz_enterprise_owner')
@Index(['enterpriseId'], { unique: true })
@Index(['userId'], { unique: true })
export class EnterpriseOwnerEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: null | string;

  @ManyToOne(() => EnterpriseEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'enterprise_id' })
  enterprise!: EnterpriseEntity;

  @ManyToOne(() => UserEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;
}
