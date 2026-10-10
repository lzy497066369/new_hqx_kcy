import { Column, Entity } from 'typeorm';

import { IamBaseEntity } from './iam-base.entity';

@Entity('iam_user')
export class IamUserEntity extends IamBaseEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  username!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ name: 'real_name', type: 'varchar', length: 64 })
  realName!: string;

  @Column({ type: 'varchar', length: 32, nullable: true, unique: true })
  phone!: null | string;

  @Column({ type: 'varchar', length: 128, nullable: true, unique: true })
  email!: null | string;

  @Column({ name: 'avatar_path', type: 'varchar', length: 500, nullable: true })
  avatarPath!: null | string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @Column({ name: 'password_changed_at', type: 'datetime', nullable: true })
  passwordChangedAt!: Date | null;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: null | string;

  @Column({ name: 'source_system', type: 'varchar', length: 64, nullable: true })
  sourceSystem!: null | string;

  @Column({ name: 'source_user_id', type: 'varchar', length: 64, nullable: true })
  sourceUserId!: null | string;
}
