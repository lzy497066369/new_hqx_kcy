import { Column, Entity } from 'typeorm';

import { IamBaseEntity } from './iam-base.entity';

@Entity('iam_menu')
export class IamMenuEntity extends IamBaseEntity {
  @Column({ name: 'app_code', type: 'varchar', length: 64 }) appCode!: string;
  @Column({ name: 'parent_id', type: 'bigint', nullable: true }) parentId!: null | string;
  @Column({ name: 'menu_name', type: 'varchar', length: 128 }) menuName!: string;
  @Column({ name: 'menu_type', type: 'varchar', length: 32, default: 'menu' }) menuType!: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) path!: null | string;
  @Column({ type: 'varchar', length: 255, nullable: true }) component!: null | string;
  @Column({ type: 'varchar', length: 255, nullable: true }) redirect!: null | string;
  @Column({ name: 'auth_code', type: 'varchar', length: 128, nullable: true }) authCode!: null | string;
  @Column({ name: 'meta_json', type: 'json', nullable: true }) metaJson!: null | Record<string, unknown>;
  @Column({ name: 'sort_order', type: 'int', default: 0 }) sortOrder!: number;
  @Column({ type: 'tinyint', default: 1 }) status!: number;
}
