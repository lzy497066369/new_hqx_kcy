import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('policy_collect_jobs')
@Index(['projectId'])
@Index(['regionId'])
@Index(['enabled'])
export class PolicyCollectJobEntity extends BaseEntityModel {
  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ name: 'project_id', type: 'bigint' })
  projectId!: string;

  @Column({ name: 'project_name', type: 'varchar', length: 128 })
  projectName!: string;

  @Column({ name: 'region_id', type: 'bigint', nullable: true })
  regionId!: null | string;

  @Column({ name: 'region_name', type: 'varchar', length: 128 })
  regionName!: string;

  @Column({ name: 'region_scope', type: 'varchar', length: 16, default: 'district' })
  regionScope!: string;

  @Column({ name: 'policy_category', type: 'varchar', length: 32, default: 'notice' })
  policyCategory!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  keywords!: null | string;

  @Column({ name: 'department_name', type: 'varchar', length: 128, nullable: true })
  departmentName!: null | string;

  @Column({ name: 'official_domain_rules', type: 'text', nullable: true })
  officialDomainRules!: null | string;

  @Column({ name: 'cron_expression', type: 'varchar', length: 64, nullable: true })
  cronExpression!: null | string;

  @Column({ type: 'tinyint', default: 0 })
  enabled!: number;

  @Column({ name: 'last_run_at', type: 'datetime', nullable: true })
  lastRunAt!: Date | null;

  @Column({ name: 'next_run_at', type: 'datetime', nullable: true })
  nextRunAt!: Date | null;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: null | string;

  @Column({ name: 'owner_user_id', type: 'bigint', nullable: true })
  ownerUserId!: null | string;

  @Column({ name: 'owner_name', type: 'varchar', length: 64, nullable: true })
  ownerName!: null | string;
}
