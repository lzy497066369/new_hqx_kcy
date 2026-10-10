import { BeforeInsert, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('iam_role_permission')
export class IamRolePermissionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'role_id', type: 'bigint' }) roleId!: string;
  @Column({ name: 'permission_id', type: 'bigint' }) permissionId!: string;
  @Column({ name: 'created_at', type: 'datetime' }) createdAt!: Date;
  @BeforeInsert() setCreatedAt(): void { this.createdAt = new Date(); }
}
