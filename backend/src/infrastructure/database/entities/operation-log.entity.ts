import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('sys_operation_log')
export class OperationLogEntity extends BaseEntityModel {
  @Column({ name: 'user_id', type: 'bigint', nullable: true })
  @Index()
  userId!: string | null;

  @Column({ name: 'user_name', type: 'varchar', length: 64, nullable: true })
  userName!: string | null;

  @Column({ name: 'real_name', type: 'varchar', length: 64, nullable: true })
  realName!: string | null;

  @Column({ name: 'module', type: 'varchar', length: 64 })
  module!: string;

  @Column({ name: 'action', type: 'varchar', length: 64 })
  action!: string;

  @Column({ name: 'biz_id', type: 'varchar', length: 64, nullable: true })
  bizId!: string | null;

  @Column({ name: 'request_path', type: 'varchar', length: 255, nullable: true })
  requestPath!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  method!: string | null;

  @Column({ name: 'params_text', type: 'text', nullable: true })
  paramsText!: string | null;

  @Column({ name: 'result_text', type: 'text', nullable: true })
  resultText!: string | null;

  @Column({ name: 'success', type: 'tinyint', default: 1 })
  success!: number;

  @Column({ name: 'error_message', type: 'varchar', length: 255, nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'int', default: 0 })
  cost!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;
}
