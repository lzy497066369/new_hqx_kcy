import { Column, Entity, Index } from 'typeorm';
import { BaseEntityModel } from './base.entity';

@Entity('biz_high_tech_application')
@Index('uq_high_tech_application_enterprise', ['enterpriseId'], { unique: true })
export class HighTechApplicationEntity extends BaseEntityModel {
  @Column({ name: 'enterprise_id', type: 'bigint' })
  enterpriseId!: string;

  @Column({ name: 'draft_json', type: 'longtext' })
  draftJson!: string;

  @Column({ type: 'int', default: 1 })
  revision!: number;
}
