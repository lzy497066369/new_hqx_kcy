import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntityModel } from './base.entity';
import { EnterpriseEntity } from './enterprise.entity';
import { UserEntity } from './user.entity';

@Entity('biz_enterprise_teacher')
@Index(['enterpriseId'], { unique: true })
@Index(['teacherUserId'])
export class EnterpriseTeacherEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'teacher_user_id', type: 'bigint' })
  teacherUserId!: string;

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
  @JoinColumn({ name: 'teacher_user_id' })
  teacher!: UserEntity;
}
