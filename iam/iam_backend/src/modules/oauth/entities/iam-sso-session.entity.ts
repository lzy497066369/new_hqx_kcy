import { BeforeInsert, BeforeUpdate, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('iam_sso_session')
export class IamSsoSessionEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  declare id: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'login_ip', type: 'varchar', length: 64, nullable: true })
  loginIp!: null | string;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent!: null | string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @BeforeInsert()
  setCreationTimestamps(): void {
    const timestamp = new Date();
    this.createdAt = timestamp;
    this.updatedAt = timestamp;
  }

  @BeforeUpdate()
  setUpdateTimestamp(): void {
    this.updatedAt = new Date();
  }
}
