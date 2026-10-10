import { BeforeInsert, BeforeUpdate, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('iam_admin_session')
export class IamAdminSessionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true }) tokenHash!: string;
  @Column({ name: 'user_id', type: 'varchar', length: 64 }) userId!: string;
  @Column({ type: 'varchar', length: 64 }) username!: string;
  @Column({ name: 'real_name', type: 'varchar', length: 64 }) realName!: string;
  @Column({ name: 'avatar_path', type: 'varchar', length: 500, nullable: true }) avatarPath!: null | string;
  @Column({ name: 'home_path', type: 'varchar', length: 255 }) homePath!: string;
  @Column({ type: 'json' }) roles!: string[];
  @Column({ name: 'expires_at', type: 'datetime' }) expiresAt!: Date;
  @Column({ name: 'revoked_at', type: 'datetime', nullable: true }) revokedAt!: Date | null;
  @Column({ name: 'created_at', type: 'datetime' }) createdAt!: Date;
  @Column({ name: 'updated_at', type: 'datetime' }) updatedAt!: Date;

  @BeforeInsert()
  setCreatedAt(): void { const now = new Date(); this.createdAt = now; this.updatedAt = now; }

  @BeforeUpdate()
  setUpdatedAt(): void { this.updatedAt = new Date(); }
}
