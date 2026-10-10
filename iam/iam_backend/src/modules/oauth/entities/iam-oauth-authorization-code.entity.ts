import { BeforeInsert, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('iam_oauth_authorization_code')
export class IamOAuthAuthorizationCodeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;
  @Column({ name: 'code_hash', type: 'char', length: 64, unique: true })
  codeHash!: string;

  @Column({ name: 'client_id', type: 'varchar', length: 128 })
  clientId!: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'app_code', type: 'varchar', length: 64 })
  appCode!: string;

  @Column({ name: 'session_id', type: 'varchar', length: 64 })
  sessionId!: string;

  @Column({ name: 'redirect_uri', type: 'varchar', length: 500 })
  redirectUri!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  scope!: null | string;

  @Column({ name: 'code_challenge', type: 'varchar', length: 128 })
  codeChallenge!: string;

  @Column({ name: 'code_challenge_method', type: 'varchar', length: 16 })
  codeChallengeMethod!: string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'datetime', nullable: true })
  usedAt!: Date | null;

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @BeforeInsert()
  setCreatedAt(): void {
    this.createdAt = new Date();
  }
}
