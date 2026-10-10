import { BeforeInsert, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('iam_user_role')
export class IamUserRoleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'user_id', type: 'bigint' }) userId!: string;
  @Column({ name: 'app_code', type: 'varchar', length: 64 }) appCode!: string;
  @Column({ name: 'role_id', type: 'bigint' }) roleId!: string;
  @Column({ name: 'created_at', type: 'datetime' }) createdAt!: Date;
  @BeforeInsert() setCreatedAt(): void { this.createdAt = new Date(); }
}
