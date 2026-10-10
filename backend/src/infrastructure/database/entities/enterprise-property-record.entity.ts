import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

@Entity('biz_enterprise_property_record')
@Index(['enterpriseId', 'recordType', 'status'])
export class EnterprisePropertyRecordEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'record_type', type: 'varchar', length: 32 })
  recordType!: string;

  @Column({ name: 'ip_code', type: 'varchar', length: 32, nullable: true })
  ipCode!: null | string;

  @Column({ name: 'soft_work_name', type: 'varchar', length: 255, nullable: true })
  softWorkName!: null | string;

  @Column({ name: 'soft_work_type', type: 'int', nullable: true })
  softWorkType!: null | number;

  @Column({ name: 'soft_work_status', type: 'int', nullable: true })
  softWorkStatus!: null | number;

  @Column({ name: 'soft_work_num', type: 'varchar', length: 128, nullable: true })
  softWorkNum!: null | string;

  @Column({ name: 'apply_date', type: 'varchar', length: 32, nullable: true })
  applyDate!: null | string;

  @Column({ name: 'authorize_date', type: 'varchar', length: 32, nullable: true })
  authorizeDate!: null | string;

  @Column({ name: 'obtain_method', type: 'varchar', length: 128, nullable: true })
  obtainMethod!: null | string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  inventor!: null | string;

  @Column({ name: 'soft_work_file', type: 'varchar', length: 500, nullable: true })
  softWorkFile!: null | string;

  @Column({ name: 'ip_level', type: 'varchar', length: 16, nullable: true })
  ipLevel!: null | string;

  @Column({ name: 'right_holder', type: 'varchar', length: 255, nullable: true })
  rightHolder!: null | string;

  @Column({ name: 'is_core_ip', type: 'tinyint', nullable: true })
  isCoreIp!: null | number;

  @Column({
    name: 'advanced_degree',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  advancedDegree!: null | string;

  @Column({ name: 'support_effect', type: 'varchar', length: 255, nullable: true })
  supportEffect!: null | string;

  @Column({ name: 'ip_tech_category', type: 'varchar', length: 64, nullable: true })
  ipTechCategory!: null | string;

  @Column({ name: 'ky_project_name', type: 'varchar', length: 255, nullable: true })
  kyProjectName!: null | string;

  @Column({ name: 'ky_project_num', type: 'varchar', length: 128, nullable: true })
  kyProjectNum!: null | string;

  @Column({ name: 'ky_project_status', type: 'int', nullable: true })
  kyProjectStatus!: null | number;

  @Column({ name: 'init_date', type: 'varchar', length: 32, nullable: true })
  initDate!: null | string;

  @Column({ name: 'end_date', type: 'varchar', length: 32, nullable: true })
  endDate!: null | string;

  @Column({ name: 'ky_project_leader', type: 'varchar', length: 128, nullable: true })
  kyProjectLeader!: null | string;

  @Column({ name: 'project_type', type: 'varchar', length: 128, nullable: true })
  projectType!: null | string;

  @Column({ name: 'fund_source', type: 'int', nullable: true })
  fundSource!: null | number;

  @Column({ name: 'fund_amount', type: 'varchar', length: 64, nullable: true })
  fundAmount!: null | string;

  @Column({ name: 'lxbg_file', type: 'varchar', length: 500, nullable: true })
  lxbgFile!: null | string;

  @Column({ name: 'ky_project_des', type: 'text', nullable: true })
  kyProjectDes!: null | string;

  @Column({ name: 'rd_budget', type: 'varchar', length: 64, nullable: true })
  rdBudget!: null | string;

  @Column({ name: 'rd_expense_total', type: 'varchar', length: 64, nullable: true })
  rdExpenseTotal!: null | string;

  @Column({
    name: 'rd_organization_method',
    type: 'text',
    nullable: true,
  })
  rdOrganizationMethod!: null | string;

  @Column({ name: 'core_technology', type: 'text', nullable: true })
  coreTechnology!: null | string;

  @Column({ name: 'innovation_points', type: 'text', nullable: true })
  innovationPoints!: null | string;

  @Column({ name: 'stage_result', type: 'text', nullable: true })
  stageResult!: null | string;

  @Column({ name: 'ps_code', type: 'varchar', length: 64, nullable: true })
  psCode!: null | string;

  @Column({ name: 'ps_name', type: 'varchar', length: 255, nullable: true })
  psName!: null | string;

  @Column({ name: 'tech_field', type: 'varchar', length: 255, nullable: true })
  techField!: null | string;

  @Column({ name: 'tech_source', type: 'varchar', length: 255, nullable: true })
  techSource!: null | string;

  @Column({ name: 'last_year_income', type: 'varchar', length: 64, nullable: true })
  lastYearIncome!: null | string;

  @Column({ name: 'high_tech_income', type: 'varchar', length: 64, nullable: true })
  highTechIncome!: null | string;

  @Column({ name: 'tech_description', type: 'text', nullable: true })
  techDescription!: null | string;

  @Column({ name: 'tech_index', type: 'text', nullable: true })
  techIndex!: null | string;

  @Column({ name: 'competitive_advantage', type: 'text', nullable: true })
  competitiveAdvantage!: null | string;

  @Column({ name: 'transformation_code', type: 'varchar', length: 64, nullable: true })
  transformationCode!: null | string;

  @Column({ name: 'transformation_name', type: 'varchar', length: 255, nullable: true })
  transformationName!: null | string;

  @Column({ name: 'transformation_year', type: 'varchar', length: 16, nullable: true })
  transformationYear!: null | string;

  @Column({ name: 'transformation_method', type: 'varchar', length: 255, nullable: true })
  transformationMethod!: null | string;

  @Column({ name: 'transformation_income', type: 'varchar', length: 64, nullable: true })
  transformationIncome!: null | string;

  @Column({ name: 'customer_name', type: 'varchar', length: 255, nullable: true })
  customerName!: null | string;

  @Column({ name: 'application_scene', type: 'text', nullable: true })
  applicationScene!: null | string;

  @Column({ name: 'proof_files', type: 'text', nullable: true })
  proofFiles!: null | string;

  @Column({ name: 'related_rd_ids', type: 'text', nullable: true })
  relatedRdIds!: null | string;

  @Column({ name: 'related_ip_ids', type: 'text', nullable: true })
  relatedIpIds!: null | string;

  @Column({ name: 'related_ps_ids', type: 'text', nullable: true })
  relatedPsIds!: null | string;

  @Column({
    name: 'related_transformation_ids',
    type: 'text',
    nullable: true,
  })
  relatedTransformationIds!: null | string;

  @Column({ name: 'related_contract_ids', type: 'text', nullable: true })
  relatedContractIds!: null | string;

  @Column({ name: 'related_invoice_ids', type: 'text', nullable: true })
  relatedInvoiceIds!: null | string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: null | string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;
}
