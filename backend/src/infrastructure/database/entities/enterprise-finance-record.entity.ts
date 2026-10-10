import { Column, Entity, Index } from 'typeorm';

import { BaseEntityModel } from './base.entity';

const financeAmountColumn = {
  nullable: true,
  precision: 20,
  scale: 2,
  transformer: {
    from: (value: null | number | string) => value === null ? null : Number(value),
    to: (value: null | number) => value,
  },
  type: 'decimal' as const,
};

@Entity('biz_enterprise_finance_record')
@Index(['enterpriseId', 'recordType', 'status'])
export class EnterpriseFinanceRecordEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'record_type', type: 'varchar', length: 32 })
  recordType!: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  year!: null | string;

  @Column({ type: 'int', nullable: true })
  q!: null | number;

  @Column(financeAmountColumn)
  xxsr!: null | number;

  @Column(financeAmountColumn)
  zxc!: null | number;

  @Column({ ...financeAmountColumn, name: 'net_assets' })
  netAssets!: null | number;

  @Column(financeAmountColumn)
  yffy!: null | number;

  @Column({ ...financeAmountColumn, name: 'total_revenue' })
  totalRevenue!: null | number;

  @Column({ ...financeAmountColumn, name: 'main_business_income' })
  mainBusinessIncome!: null | number;

  @Column({ ...financeAmountColumn, name: 'high_tech_income' })
  highTechIncome!: null | number;

  @Column(financeAmountColumn)
  fz!: null | number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  fzl!: null | string;

  @Column({ ...financeAmountColumn, name: 'lr_total' })
  lrTotal!: null | number;

  @Column({ ...financeAmountColumn, name: 'net_profit' })
  netProfit!: null | number;

  @Column({ ...financeAmountColumn, name: 'rd_personnel_cost' })
  rdPersonnelCost!: null | number;

  @Column({ ...financeAmountColumn, name: 'rd_direct_input' })
  rdDirectInput!: null | number;

  @Column({ ...financeAmountColumn, name: 'rd_depreciation' })
  rdDepreciation!: null | number;

  @Column({ ...financeAmountColumn, name: 'rd_intangible_amortization' })
  rdIntangibleAmortization!: null | number;

  @Column({ ...financeAmountColumn, name: 'rd_design_fee' })
  rdDesignFee!: null | number;

  @Column({ ...financeAmountColumn, name: 'rd_equipment_debugging_fee' })
  rdEquipmentDebuggingFee!: null | number;

  @Column({ ...financeAmountColumn, name: 'rd_entrusted_development' })
  rdEntrustedDevelopment!: null | number;

  @Column({ ...financeAmountColumn, name: 'rd_other_expense' })
  rdOtherExpense!: null | number;

  @Column({ name: 'file_class', type: 'int', nullable: true })
  fileClass!: null | number;

  @Column({ name: 'tax_category', type: 'varchar', length: 128, nullable: true })
  taxCategory!: null | string;

  @Column({ name: 'file_path', type: 'varchar', length: 500, nullable: true })
  filePath!: null | string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: null | string;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;
}
