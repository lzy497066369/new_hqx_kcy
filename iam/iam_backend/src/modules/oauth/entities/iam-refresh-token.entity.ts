import { BeforeInsert, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('iam_refresh_token')
export class IamRefreshTokenEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;
  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash!: string;

  @Column({ name: 'client_id', type: 'varchar', length: 128 })
  clientId!: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'app_code', type: 'varchar', length: 64 })
  appCode!: string;

  @Column({ name: 'session_id', type: 'varchar', length: 64 })
  sessionId!: string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'rotated_from_id', type: 'bigint', nullable: true })
  rotatedFromId!: null | string;

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @BeforeInsert()
  setCreatedAt(): void {
    this.createdAt = new Date();
  }
}
