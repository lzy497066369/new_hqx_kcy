import { BeforeInsert, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('iam_audit_event')
export class IamAuditEventEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'event_type', type: 'varchar', length: 64 }) eventType!: string;
  @Column({ type: 'varchar', length: 128 }) action!: string;
  @Column({ type: 'varchar', length: 16 }) outcome!: 'failure' | 'success';
  @Column({ name: 'actor_user_id', type: 'varchar', length: 64, nullable: true }) actorUserId!: null | string;
  @Column({ type: 'varchar', length: 64, nullable: true }) username!: null | string;
  @Column({ name: 'app_code', type: 'varchar', length: 64, nullable: true }) appCode!: null | string;
  @Column({ name: 'client_id', type: 'varchar', length: 128, nullable: true }) clientId!: null | string;
  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true }) ipAddress!: null | string;
  @Column({ type: 'json', nullable: true }) details!: null | Record<string, unknown>;
  @Column({ name: 'created_at', type: 'datetime' }) createdAt!: Date;
  @BeforeInsert() setCreatedAt(): void { this.createdAt = new Date(); }
}
